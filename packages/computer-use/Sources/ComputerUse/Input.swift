import AppKit
import CoreGraphics
import CoreImage
import CoreMedia
import CoreVideo
import Darwin
import Foundation
import ApplicationServices
import ScreenCaptureKit
import Security

internal func perform(_ actions: [Action], in window: SCWindow, coordinateSpace: Target) throws {
    guard let processID = window.owningApplication?.processID else {
        throw HelperError.targetUnavailable
    }
    let frame = window.frame
    func point(_ x: Double?, _ y: Double?) throws -> CGPoint {
        guard let x, let y, x.isFinite, y.isFinite else {
            throw HelperError.invalidRequest("Pointer actions require finite x and y coordinates")
        }
        let localX = min(max(x, 0), Double(max(coordinateSpace.width, 1)))
        let localY = min(max(y, 0), Double(max(coordinateSpace.height, 1)))
        return CGPoint(
            x: frame.minX + localX / Double(max(coordinateSpace.width, 1)) * frame.width,
            y: frame.minY + localY / Double(max(coordinateSpace.height, 1)) * frame.height
        )
    }
    func withWindowRouting(_ operation: () throws -> Void) throws {
        try withInactiveWindowRouting(
            processID: processID,
            windowID: window.windowID,
            globalPoint: CGPoint(x: frame.midX, y: frame.midY),
            localPoint: CGPoint(x: frame.width / 2, y: frame.height / 2),
            operation
        )
    }

    for action in actions {
        switch action.type {
        case "click":
            updateVirtualCursor(action.x, action.y, window: window, coordinateSpace: coordinateSpace)
            let location = try point(action.x, action.y)
            try click(
                at: location,
                localPoint: CGPoint(x: location.x - frame.minX, y: location.y - frame.minY),
                count: 1,
                button: mouseButton(action.mouseButton),
                windowID: window.windowID,
                processID: processID
            )
        case "double_click":
            updateVirtualCursor(action.x, action.y, window: window, coordinateSpace: coordinateSpace)
            let location = try point(action.x, action.y)
            try click(
                at: location,
                localPoint: CGPoint(x: location.x - frame.minX, y: location.y - frame.minY),
                count: 2,
                button: mouseButton(action.mouseButton),
                windowID: window.windowID,
                processID: processID
            )
        case "move":
            updateVirtualCursor(action.x, action.y, window: window, coordinateSpace: coordinateSpace)
            try post(
                mouseEvent(type: .mouseMoved, at: point(action.x, action.y), button: .left),
                to: processID
            )
        case "drag":
            updateVirtualCursor(action.toX, action.toY, window: window, coordinateSpace: coordinateSpace)
            let start = try point(action.x, action.y)
            let end = try point(action.toX, action.toY)
            try drag(
                from: start,
                to: end,
                fromLocal: CGPoint(x: start.x - frame.minX, y: start.y - frame.minY),
                toLocal: CGPoint(x: end.x - frame.minX, y: end.y - frame.minY),
                windowID: window.windowID,
                processID: processID
            )
        case "scroll":
            try withWindowRouting {
                try scroll(
                    deltaX: action.deltaX ?? 0,
                    deltaY: action.deltaY ?? 0,
                    processID: processID
                )
            }
        case "type":
            guard let text = action.text, text.utf8.count <= 10_000 else {
                throw HelperError.invalidRequest("Typed text is missing or too long")
            }
            try withWindowRouting {
                try typeText(text, processID: processID)
            }
        case "keypress":
            guard let key = action.key else {
                throw HelperError.invalidRequest("keypress requires a key")
            }
            try withWindowRouting {
                try pressKey(
                    key,
                    modifiers: action.modifiers ?? [],
                    processID: processID
                )
            }
        case "wait":
            usleep(useconds_t(min(action.durationMs ?? 0, 2_000) * 1_000))
        default:
            throw HelperError.unsupportedAction(action.type)
        }
        usleep(90_000)
    }
}

internal func updateVirtualCursor(
    _ x: Double?,
    _ y: Double?,
    window: SCWindow,
    coordinateSpace: Target
) {
    guard let x, let y, x.isFinite, y.isFinite else { return }
    let cursor = VirtualCursorStore.shared.move(
        for: window.windowID,
        to: CGPoint(x: x, y: y),
        size: CGSize(width: CGFloat(coordinateSpace.width), height: CGFloat(coordinateSpace.height))
    )
    StatusAgentProcess.shared.showCursor(
        window: window,
        localPoint: cursor,
        coordinateSpace: coordinateSpace
    )
}

internal func updateVirtualCursor(
    atGlobalPoint point: CGPoint,
    window: SCWindow,
    coordinateSpace: Target
) {
    let frame = window.frame
    guard frame.width > 0, frame.height > 0 else { return }
    updateVirtualCursor(
        Double((point.x - frame.minX) / frame.width * CGFloat(coordinateSpace.width)),
        Double((point.y - frame.minY) / frame.height * CGFloat(coordinateSpace.height)),
        window: window,
        coordinateSpace: coordinateSpace
    )
}

internal enum WindowServerEventBridge {
    typealias SetWindowLocation = @convention(c) (UnsafeMutableRawPointer?, Double, Double) -> Void

    private static let handle = dlopen(
        "/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight",
        RTLD_LAZY | RTLD_GLOBAL
    )

    private static func resolve<T>(_ name: String, as type: T.Type) -> T? {
        guard let symbol = name.withCString({ dlsym(handle, $0) }) else {
            return nil
        }
        return unsafeBitCast(symbol, to: type)
    }

    private static let setWindowLocation = resolve(
        "CGEventSetWindowLocation",
        as: SetWindowLocation.self
    )

    static func setLocalLocation(_ localPoint: CGPoint, on event: CGEvent) {
        let pointer = Unmanaged.passUnretained(event).toOpaque()
        setWindowLocation?(pointer, localPoint.x, localPoint.y)
    }
}

internal enum TargetProcessInputRouting {
    private static let processNotificationType: UInt = 21
    private static let appKitDefinedType: UInt = 13
    private static let keyFocusReturnedSubtype: UInt16 = 0x8000
    private static let inactiveWindowActivatedSubtype: UInt16 = 1
    private static let appDeactivatedSubtype: UInt16 = 2
    private static let inactiveWindowModifiers = NSEvent.ModifierFlags(
        rawValue: 0xC0000
    )
    private static let lock = NSLock()
    private static var currentRoute: Route?

    private final class Route {
        let processID: pid_t
        let windowID: CGWindowID
        let focusStealSuppression: FocusStealSuppression

        init(
            processID: pid_t,
            windowID: CGWindowID,
            focusStealSuppression: FocusStealSuppression
        ) {
            self.processID = processID
            self.windowID = windowID
            self.focusStealSuppression = focusStealSuppression
        }
    }

    static func ensureInactiveWindowRouting(
        processID: pid_t,
        windowID: CGWindowID,
        activationPoint: CGPoint?,
        activationLocalPoint: CGPoint?,
        synthesizeActivationClick: Bool
    ) throws {
        lock.lock()
        defer { lock.unlock() }

        let frontmostProcessID = NSWorkspace.shared.frontmostApplication?.processIdentifier

        // Real user focus always wins. If the controlled app is genuinely
        // frontmost, it needs no synthetic route. Do not post a synthetic
        // deactivation here; that would fight the user's focus change.
        if frontmostProcessID == processID {
            currentRoute = nil
            return
        }

        if let currentRoute,
           currentRoute.processID == processID {
            return
        }

        // Sky retains one SyntheticAppFocusEnforcer for the selected process.
        // Arm the preventer before delivering either activation-shaped event;
        // the packets are not safe when sent outside this retained guard.
        deactivateCurrentRouteLocked()
        guard let suppression = FocusStealSuppression(
            targetProcessID: processID
        ) else {
            throw HelperError.eventCreationFailed
        }
        let route = Route(
            processID: processID,
            windowID: windowID,
            focusStealSuppression: suppression
        )
        currentRoute = route

        do {
            // This is Sky's exact inactive-window activation packet: an
            // AppKit-defined subtype-1 event carrying the real window number
            // and the private 0xC0000 inactive-window mask.
            try post(
                type: appKitDefinedType,
                subtype: inactiveWindowActivatedSubtype,
                windowNumber: Int(windowID),
                modifierFlags: inactiveWindowModifiers,
                to: processID
            )

            // Sky's activation bundle can include a left down/up at the
            // activation point. A background secondary click needs this so
            // AppKit first establishes the row under the pointer as the menu
            // owner instead of reusing the previously active row.
            if synthesizeActivationClick,
               let activationPoint,
               let activationLocalPoint {
                let eventNumber = SyntheticMouseEventNumbers.next()
                let down = try windowTargetedMouseEvent(
                    type: .leftMouseDown,
                    at: activationPoint,
                    localPoint: activationLocalPoint,
                    button: .left,
                    windowID: windowID,
                    eventNumber: eventNumber,
                    clickCount: 1,
                    pressure: 1
                )
                let up = try windowTargetedMouseEvent(
                    type: .leftMouseUp,
                    at: activationPoint,
                    localPoint: activationLocalPoint,
                    button: .left,
                    windowID: windowID,
                    eventNumber: eventNumber,
                    clickCount: 1,
                    pressure: 0
                )
                down.timestamp = CGEventTimestamp(mach_absolute_time())
                down.postToPid(processID)
                up.timestamp = CGEventTimestamp(mach_absolute_time())
                up.postToPid(processID)
            }

            // Sky updates the target's believed state in this order:
            // application active first, then key focus returned.
            try post(
                type: processNotificationType,
                subtype: keyFocusReturnedSubtype,
                windowNumber: 0,
                modifierFlags: [],
                to: processID
            )
        } catch {
            currentRoute = nil
            suppression.stop()
            throw error
        }
    }

    static func deactivateCurrentRoute() {
        lock.lock()
        defer { lock.unlock() }
        deactivateCurrentRouteLocked()
    }

    private static func deactivateCurrentRouteLocked() {
        guard let route = currentRoute else { return }
        currentRoute = nil

        // Do not send a synthetic deactivation over a real user activation.
        guard NSWorkspace.shared.frontmostApplication?.processIdentifier
            != route.processID else {
            return
        }
        try? post(
            type: appKitDefinedType,
            subtype: appDeactivatedSubtype,
            windowNumber: 0,
            modifierFlags: [],
            to: route.processID
        )
        route.focusStealSuppression.stop()
    }

    private static func post(
        type: UInt,
        subtype: UInt16,
        windowNumber: Int,
        modifierFlags: NSEvent.ModifierFlags,
        to processID: pid_t
    ) throws {
        guard let eventType = NSEvent.EventType(rawValue: type),
              let nsEvent = NSEvent.otherEvent(
                with: eventType,
                location: .zero,
                modifierFlags: modifierFlags,
                timestamp: 0,
                windowNumber: windowNumber,
                context: nil,
                subtype: Int16(bitPattern: subtype),
                data1: 0,
                data2: 0
              ), let event = nsEvent.cgEvent else {
            throw HelperError.eventCreationFailed
        }
        event.timestamp = CGEventTimestamp(mach_absolute_time())
        event.postToPid(processID)
    }
}

internal final class FocusStealSuppressionState {
    let targetProcessID: pid_t
    let ready = DispatchSemaphore(value: 0)
    let stopped = DispatchSemaphore(value: 0)
    var eventTap: CFMachPort?
    var runLoop: CFRunLoop?

    init(targetProcessID: pid_t) {
        self.targetProcessID = targetProcessID
    }
}

internal let focusStealSuppressionCallback: CGEventTapCallBack = {
    _, type, event, userInfo in
    guard let userInfo else {
        return Unmanaged.passUnretained(event)
    }
    let state = Unmanaged<FocusStealSuppressionState>
        .fromOpaque(userInfo)
        .takeUnretainedValue()

    if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
        if let eventTap = state.eventTap {
            CGEvent.tapEnable(tap: eventTap, enable: true)
        }
        return Unmanaged.passUnretained(event)
    }

    guard let targetProcessField = CGEventField(rawValue: 40),
          let sourceProcessField = CGEventField(rawValue: 41),
          let subjectProcessField = CGEventField(rawValue: 73) else {
        return Unmanaged.passUnretained(event)
    }
    let targetProcessID = pid_t(event.getIntegerValueField(targetProcessField))
    let sourceProcessID = pid_t(event.getIntegerValueField(sourceProcessField))
    let subjectProcessID = pid_t(event.getIntegerValueField(subjectProcessField))

    if type.rawValue == 32 {
        // Sky installs a second annotated-session tap for this private focus
        // theft event type whenever the target believes it is active but is
        // not really frontmost. Reject target-originated/target-directed
        // promotion while leaving unrelated user input untouched.
        if sourceProcessID == state.targetProcessID
            || targetProcessID == state.targetProcessID
            || subjectProcessID == state.targetProcessID {
            return nil
        }
        return Unmanaged.passUnretained(event)
    }

    guard type.rawValue == 21,
          let subtypeField = CGEventField(rawValue: 64) else {
        return Unmanaged.passUnretained(event)
    }
    let subtype = UInt16(
        truncatingIfNeeded: event.getIntegerValueField(subtypeField)
    )

    // Permit only the helper's synthetic KeyFocusReturned notification. Drop
    // a target-originated NewFront/key-focus request before WindowServer can
    // reorder either app. The target still receives the logical AppKit events
    // posted directly to its PID.
    if sourceProcessID == getpid() && subtype == 0x8000 {
        return Unmanaged.passUnretained(event)
    }
    if sourceProcessID == state.targetProcessID
        || targetProcessID == state.targetProcessID
        || subjectProcessID == state.targetProcessID {
        return nil
    }
    return Unmanaged.passUnretained(event)
}

internal final class FocusStealSuppression {
    private let state: FocusStealSuppressionState

    init?(targetProcessID: pid_t) {
        let state = FocusStealSuppressionState(targetProcessID: targetProcessID)
        self.state = state
        Thread {
            let mask = (CGEventMask(1) << 21) | (CGEventMask(1) << 32)
            guard let eventTap = CGEvent.tapCreate(
                tap: .cgAnnotatedSessionEventTap,
                place: .headInsertEventTap,
                options: .defaultTap,
                eventsOfInterest: mask,
                callback: focusStealSuppressionCallback,
                userInfo: Unmanaged.passUnretained(state).toOpaque()
            ) else {
                state.ready.signal()
                state.stopped.signal()
                return
            }
            let runLoop = CFRunLoopGetCurrent()
            let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0)
            state.eventTap = eventTap
            state.runLoop = runLoop
            CFRunLoopAddSource(runLoop, source, .commonModes)
            CGEvent.tapEnable(tap: eventTap, enable: true)
            state.ready.signal()
            CFRunLoopRun()
            CGEvent.tapEnable(tap: eventTap, enable: false)
            CFRunLoopRemoveSource(runLoop, source, .commonModes)
            CFMachPortInvalidate(eventTap)
            state.stopped.signal()
        }.start()

        guard state.ready.wait(timeout: .now() + 1) == .success,
              state.eventTap != nil else {
            return nil
        }
    }

    func stop() {
        guard let runLoop = state.runLoop else { return }
        CFRunLoopStop(runLoop)
        _ = state.stopped.wait(timeout: .now() + 1)
        state.runLoop = nil
        state.eventTap = nil
    }

    deinit {
        stop()
    }
}

internal enum SyntheticMouseEventNumbers {
    private static let lock = NSLock()
    private static var value: Int64 = 0

    static func next() -> Int64 {
        lock.lock()
        defer { lock.unlock() }
        let result = value
        value &+= 1
        return result
    }
}

internal func windowTargetedMouseEvent(
    type: NSEvent.EventType,
    at globalPoint: CGPoint,
    localPoint: CGPoint,
    button: CGMouseButton,
    windowID: CGWindowID,
    eventNumber: Int64,
    clickCount: Int,
    pressure: Float = 1
) throws -> CGEvent {
    // Match Codex's inactive-window pointer construction. Creating an NSEvent
    // with the real target window number supplies AppKit metadata that a raw
    // HID-state CGEvent lacks. TargetProcessInputRouting separately brackets
    // this pointer stream with Codex's guarded background markers. Do not add
    // an unguarded or empty-flags window activation here: that makes browser
    // chrome blink and can bring the controlled app to the front.
    guard let nsEvent = NSEvent.mouseEvent(
        with: type,
        location: globalPoint,
        modifierFlags: [],
        timestamp: 0,
        windowNumber: Int(windowID),
        context: nil,
        eventNumber: Int(eventNumber),
        clickCount: clickCount,
        pressure: pressure
    ), let event = nsEvent.cgEvent else {
        throw HelperError.eventCreationFailed
    }

    event.flags = []
    event.location = globalPoint
    event.setIntegerValueField(CGEventField(rawValue: 3)!, value: Int64(button.rawValue))
    event.setIntegerValueField(CGEventField(rawValue: 7)!, value: 3)
    let windowValue = Int64(windowID)
    event.setIntegerValueField(.mouseEventWindowUnderMousePointer, value: windowValue)
    event.setIntegerValueField(
        .mouseEventWindowUnderMousePointerThatCanHandleThisEvent,
        value: windowValue
    )
    WindowServerEventBridge.setLocalLocation(localPoint, on: event)
    return event
}

internal func mouseEvent(type: CGEventType, at point: CGPoint, button: CGMouseButton) throws -> CGEvent {
    guard let source = CGEventSource(stateID: .hidSystemState),
          let event = CGEvent(
              mouseEventSource: source,
              mouseType: type,
              mouseCursorPosition: point,
              mouseButton: button
          ) else {
        throw HelperError.eventCreationFailed
    }
    return event
}

internal func post(_ event: CGEvent, to processID: pid_t) {
    // Computer Use must never activate the controlled app or post pointer
    // input to a global event tap. PID-targeted delivery is what lets the host
    // operate another app without stealing the user's focus.
    event.timestamp = CGEventTimestamp(mach_absolute_time())
    event.postToPid(processID)
}

internal func mouseButton(_ value: String?) -> CGMouseButton {
    switch value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
    case "r", "right", "secondary": return .right
    case "m", "middle", "center": return .center
    default: return .left
    }
}

internal func withInactiveWindowRouting<T>(
    processID: pid_t,
    windowID: CGWindowID,
    globalPoint: CGPoint,
    localPoint: CGPoint,
    synthesizeActivationClick: Bool = false,
    _ operation: () throws -> T
) throws -> T {
    // The retained route owns the focus guard. Per-action AX focus writes and
    // per-action tap teardown are observably different from Sky and can both
    // dismiss transient menus.
    try TargetProcessInputRouting.ensureInactiveWindowRouting(
        processID: processID,
        windowID: windowID,
        activationPoint: globalPoint,
        activationLocalPoint: localPoint,
        synthesizeActivationClick: synthesizeActivationClick
    )
    return try operation()
}

internal func click(
    at point: CGPoint,
    localPoint: CGPoint,
    count: Int64,
    button: CGMouseButton,
    windowID: CGWindowID,
    processID: pid_t
) throws {
    let downType: NSEvent.EventType
    let upType: NSEvent.EventType
    switch button {
    case .right:
        downType = .rightMouseDown
        upType = .rightMouseUp
    case .center:
        downType = .otherMouseDown
        upType = .otherMouseUp
    default:
        downType = .leftMouseDown
        upType = .leftMouseUp
    }

    try withInactiveWindowRouting(
        processID: processID,
        windowID: windowID,
        globalPoint: point,
        localPoint: localPoint,
        synthesizeActivationClick: button == .right
    ) {
        for index in 1...count {
            let eventNumber = SyntheticMouseEventNumbers.next()
            let down = try windowTargetedMouseEvent(
                type: downType,
                at: point,
                localPoint: localPoint,
                button: button,
                windowID: windowID,
                eventNumber: eventNumber,
                clickCount: Int(index),
                pressure: 1
            )
            let up = try windowTargetedMouseEvent(
                type: upType,
                at: point,
                localPoint: localPoint,
                button: button,
                windowID: windowID,
                eventNumber: eventNumber,
                clickCount: Int(index),
                pressure: 0
            )
            StatusAgentProcess.shared.setCursorPressed(windowID: windowID, pressed: true)
            usleep(65_000)
            post(down, to: processID)
            usleep(45_000)
            post(up, to: processID)
            StatusAgentProcess.shared.setCursorPressed(windowID: windowID, pressed: false)
            usleep(70_000)
        }
    }
}

internal func drag(
    from start: CGPoint,
    to end: CGPoint,
    fromLocal: CGPoint,
    toLocal: CGPoint,
    windowID: CGWindowID,
    processID: pid_t
) throws {
    // A drag must remain PID-scoped. The only activation-shaped events allowed
    // are the guarded, specially flagged markers in TargetProcessInputRouting.
    // Never replace them with real app activation, empty-flags window markers,
    // or CGEvent.post(tap:): those change the controlled app's visible active
    // state. Restoring focus later is not equivalent because the browser has
    // already blinked or moved front.
    try withInactiveWindowRouting(
        processID: processID,
        windowID: windowID,
        globalPoint: start,
        localPoint: fromLocal
    ) {
        // Codex uses one event number for down/up and a second shared number
        // for every dragged sample. Preserve that AppKit gesture identity.
        let clickEventNumber = SyntheticMouseEventNumbers.next()
        let dragEventNumber = SyntheticMouseEventNumbers.next()
        let down = try windowTargetedMouseEvent(
            type: .leftMouseDown,
            at: start,
            localPoint: fromLocal,
            button: .left,
            windowID: windowID,
            eventNumber: clickEventNumber,
            clickCount: 1
        )
        post(down, to: processID)

        let initialDrag = try windowTargetedMouseEvent(
            type: .leftMouseDragged,
            at: start,
            localPoint: fromLocal,
            button: .left,
            windowID: windowID,
            eventNumber: dragEventNumber,
            clickCount: 0
        )
        post(initialDrag, to: processID)

        for step in 1...12 {
            let progress = Double(step) / 12
            let point = CGPoint(
                x: start.x + (end.x - start.x) * progress,
                y: start.y + (end.y - start.y) * progress
            )
            let localPoint = CGPoint(
                x: fromLocal.x + (toLocal.x - fromLocal.x) * progress,
                y: fromLocal.y + (toLocal.y - fromLocal.y) * progress
            )
            let event = try windowTargetedMouseEvent(
                type: .leftMouseDragged,
                at: point,
                localPoint: localPoint,
                button: .left,
                windowID: windowID,
                eventNumber: dragEventNumber,
                clickCount: 0
            )
            post(event, to: processID)
        }

        let up = try windowTargetedMouseEvent(
            type: .leftMouseUp,
            at: end,
            localPoint: toLocal,
            button: .left,
            windowID: windowID,
            eventNumber: clickEventNumber,
            clickCount: 1
        )
        post(up, to: processID)
    }
}

internal func scroll(
    deltaX: Double,
    deltaY: Double,
    at location: CGPoint? = nil,
    processID: pid_t
) throws {
    guard deltaX.isFinite, deltaY.isFinite,
          let event = CGEvent(
            scrollWheelEvent2Source: nil,
            units: .pixel,
            wheelCount: 2,
            wheel1: Int32(deltaY.rounded()),
            wheel2: Int32(deltaX.rounded()),
            wheel3: 0
          ) else {
        throw HelperError.eventCreationFailed
    }
    if let location {
        event.location = location
    }
    post(event, to: processID)
}

internal func typeText(_ text: String, processID: pid_t) throws {
    for chunk in Array(text.utf16).chunked(maxCount: 32) {
        guard let down = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: true),
              let up = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: false) else {
            throw HelperError.eventCreationFailed
        }
        down.keyboardSetUnicodeString(stringLength: chunk.count, unicodeString: chunk)
        up.keyboardSetUnicodeString(stringLength: chunk.count, unicodeString: chunk)
        post(down, to: processID)
        post(up, to: processID)
        usleep(8_000)
    }
}

internal func pressKey(_ key: String, modifiers: [String], processID: pid_t) throws {
    guard let keyCode = virtualKeyCode(for: key) else {
        throw HelperError.invalidRequest("Unsupported key: \(key)")
    }
    let flags = eventFlags(modifiers)
    guard let down = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: true),
          let up = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: false) else {
        throw HelperError.eventCreationFailed
    }
    down.flags = flags
    up.flags = flags
    post(down, to: processID)
    usleep(35_000)
    post(up, to: processID)
}

internal func eventFlags(_ modifiers: [String]) -> CGEventFlags {
    var flags: CGEventFlags = []
    for modifier in modifiers {
        switch modifier.lowercased() {
        case "command": flags.insert(.maskCommand)
        case "control": flags.insert(.maskControl)
        case "option": flags.insert(.maskAlternate)
        case "shift": flags.insert(.maskShift)
        default: break
        }
    }
    return flags
}

internal func virtualKeyCode(for key: String) -> CGKeyCode? {
    let codes: [String: CGKeyCode] = [
        "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7,
        "c": 8, "v": 9, "b": 11, "q": 12, "w": 13, "e": 14, "r": 15,
        "y": 16, "t": 17, "1": 18, "2": 19, "3": 20, "4": 21, "6": 22,
        "5": 23, "=": 24, "9": 25, "7": 26, "-": 27, "8": 28, "0": 29,
        "]": 30, "o": 31, "u": 32, "[": 33, "i": 34, "p": 35, "return": 36,
        "enter": 36, "l": 37, "j": 38, "'": 39, "k": 40, ";": 41, "\\": 42,
        ",": 43, "/": 44, "n": 45, "m": 46, ".": 47, "tab": 48, "space": 49,
        "`": 50, "backspace": 51, "delete": 51, "escape": 53, "command": 55,
        "shift": 56, "capslock": 57, "option": 58, "control": 59, "f17": 64,
        "volumeup": 72, "volumedown": 73, "mute": 74, "f18": 79, "f19": 80,
        "f20": 90, "f5": 96, "f6": 97, "f7": 98, "f3": 99, "f8": 100,
        "f9": 101, "f11": 103, "f13": 105, "f16": 106, "f14": 107, "f10": 109,
        "f12": 111, "f15": 113, "home": 115, "pageup": 116, "forwarddelete": 117,
        "f4": 118, "end": 119, "f2": 120, "pagedown": 121, "f1": 122,
        "left": 123, "right": 124, "down": 125, "up": 126,
    ]
    let normalized = key.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let aliases: [String: String] = [
        "backspace": "delete",
        "esc": "escape",
        "page_down": "pagedown",
        "page_up": "pageup",
        "period": ".",
        "greater": ".",
        "kp_0": "0",
        "numpad_0": "0",
        "spacebar": "space",
    ]
    return codes[aliases[normalized] ?? normalized]
}

internal extension Array where Element == UInt16 {
    func chunked(maxCount: Int) -> [[UInt16]] {
        guard !isEmpty else { return [] }
        return stride(from: 0, to: count, by: maxCount).map { start in
            Array(self[start..<Swift.min(start + maxCount, count)])
        }
    }
}
