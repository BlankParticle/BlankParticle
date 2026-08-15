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

// This process owns macOS privacy access and keeps its Apple Development
// code-signing identity while the surrounding debug app is rebuilt.
internal let maximumCaptureWidth = 1440
internal let maximumCaptureHeight = 1200
internal let maximumPreviewWidth = 608
internal let maximumPreviewHeight = 480
internal let previewFramesPerSecond: Int32 = 15
internal let helperDisplayName =
    (Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String)
    ?? "computer-use"

struct Permissions: Codable {
    let screenRecording: Bool
    let accessibility: Bool
}

struct Target: Codable {
    let windowId: UInt32
    let bundleId: String
    let teamId: String?
    let appName: String
    let windowTitle: String
    let width: UInt32
    let height: UInt32
}

struct Action: Decodable {
    let type: String
    let x: Double?
    let y: Double?
    let toX: Double?
    let toY: Double?
    let deltaX: Double?
    let deltaY: Double?
    let text: String?
    let key: String?
    let modifiers: [String]?
    let mouseButton: String?
    let durationMs: UInt64?
}

struct Request: Decodable {
    let operation: String
    let target: Target?
    let actions: [Action]?
}

internal enum CursorAssets {
    static let overlaySize = NSSize(width: 24, height: 24)
    static let overlayHotspot = NSPoint(x: 3, y: 2)

    static let menuBar: NSImage? = {
        guard let url = Bundle.main.url(forResource: "menubar-cursor", withExtension: "png") else {
            return nil
        }
        return NSImage(contentsOf: url)
    }()

    static let overlayImage: NSImage? = {
        guard let url = Bundle.main.url(forResource: "overlay-cursor", withExtension: "svg") else {
            return nil
        }
        return NSImage(contentsOf: url)
    }()

    static let overlay: CGImage? = {
        guard let image = overlayImage else { return nil }
        var rect = NSRect(origin: .zero, size: overlaySize)
        return image.cgImage(forProposedRect: &rect, context: nil, hints: nil)
    }()
}

internal final class VirtualCursorStore {
    static let shared = VirtualCursorStore()

    private var positions: [CGWindowID: CGPoint] = [:]
    private let lock = NSLock()

    func position(for windowID: CGWindowID, size: CGSize) -> CGPoint {
        lock.lock()
        defer { lock.unlock() }
        if let position = positions[windowID] {
            return position
        }
        let fallback = CGPoint(x: size.width * 0.5, y: size.height * 0.5)
        positions[windowID] = fallback
        return fallback
    }

    @discardableResult
    func move(for windowID: CGWindowID, to position: CGPoint, size: CGSize) -> CGPoint {
        let clamped = CGPoint(
            x: min(max(position.x, 0), max(size.width, 1)),
            y: min(max(position.y, 0), max(size.height, 1))
        )
        lock.lock()
        positions[windowID] = clamped
        lock.unlock()
        return clamped
    }
}

internal final class ComputerUseStatusItem {
    static let shared = ComputerUseStatusItem()

    private var item: NSStatusItem?
    private var apps: [TrackedApp] = []

    func track(bundleID: String, name: String) {
        DispatchQueue.main.async {
            self.createItemIfNeeded()
            if let index = self.apps.firstIndex(where: { $0.bundleID == bundleID }) {
                self.apps[index].name = name
            } else {
                self.apps.append(TrackedApp(bundleID: bundleID, name: name))
            }
            self.updateMenu()
        }
    }

    private func createItemIfNeeded() {
        guard item == nil else { return }
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.length = 54
        item.button?.toolTip = helperDisplayName
        self.item = item
    }

    func stop() {
        let remove = {
            if let item = self.item {
                NSStatusBar.system.removeStatusItem(item)
                self.item = nil
            }
        }
        if Thread.isMainThread {
            remove()
        } else {
            DispatchQueue.main.sync(execute: remove)
        }
    }

    private func updateMenu() {
        guard let item else { return }
        guard !apps.isEmpty else {
            NSStatusBar.system.removeStatusItem(item)
            self.item = nil
            return
        }
        let image = self.statusImage()
        item.length = image.size.width
        item.button?.image = image
        let menu = NSMenu()
        let title = NSMenuItem(title: helperDisplayName, action: nil, keyEquivalent: "")
        title.isEnabled = false
        menu.addItem(title)
        menu.addItem(.separator())
        for app in apps {
            let entry = NSMenuItem(title: app.name, action: nil, keyEquivalent: "")
            entry.isEnabled = false
            menu.addItem(entry)
        }
        item.menu = menu
    }

    private func statusImage() -> NSImage {
        let visibleApps = Array(apps.prefix(4))
        let stackedAppWidth = CGFloat(max(visibleApps.count - 1, 0)) * 8
        let cursorX = 29 + stackedAppWidth
        let imageWidth = 54 + stackedAppWidth
        let image = NSImage(size: NSSize(width: imageWidth, height: 22))
        image.lockFocus()
        let bounds = NSRect(x: 0.5, y: 0.5, width: imageWidth - 1, height: 21)
        let pill = NSBezierPath(roundedRect: bounds, xRadius: 10.5, yRadius: 10.5)
        NSColor.white.withAlphaComponent(0.28).setFill()
        pill.fill()
        NSColor.white.withAlphaComponent(0.16).setStroke()
        pill.lineWidth = 0.75
        pill.stroke()

        for (index, app) in visibleApps.enumerated() {
            let iconRect = NSRect(
                x: 7 + CGFloat(index) * 8,
                y: 1,
                width: 20,
                height: 20
            )
            NSGraphicsContext.current?.saveGraphicsState()
            let clip = NSBezierPath(roundedRect: iconRect, xRadius: 5, yRadius: 5)
            clip.addClip()
            if let icon = app.icon {
                icon.draw(in: iconRect, from: .zero, operation: .sourceOver, fraction: 1)
            } else {
                NSColor.windowBackgroundColor.setFill()
                iconRect.fill()
            }
            NSGraphicsContext.current?.restoreGraphicsState()
        }

        CursorAssets.menuBar?.draw(
            in: NSRect(x: cursorX, y: 2, width: 19, height: 17),
            from: .zero,
            operation: .sourceOver,
            fraction: 1
        )
        image.unlockFocus()
        return image
    }
}

internal final class SoftwareCursorView: NSView {
    struct Particle {
        let position: CGPoint
        let life: CGFloat
    }

    override var isFlipped: Bool { true }
    var cursorPosition = CGPoint(x: 80, y: 80)
    var particles: [Particle] = []
    var pressAmount: CGFloat = 0

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        for particle in particles {
            let alpha = 0.46 * particle.life * particle.life
            let radius = 1.5 + 2.1 * particle.life
            NSColor.white.withAlphaComponent(alpha).setFill()
            let dot = NSBezierPath(ovalIn: NSRect(
                x: particle.position.x - radius,
                y: particle.position.y - radius,
                width: radius * 2,
                height: radius * 2
            ))
            let glow = NSShadow()
            glow.shadowColor = NSColor.white.withAlphaComponent(alpha * 0.9)
            glow.shadowBlurRadius = 7
            glow.shadowOffset = .zero
            glow.set()
            dot.fill()
        }
        let shadow = NSShadow()
        shadow.shadowColor = NSColor.white.withAlphaComponent(0.62)
        shadow.shadowBlurRadius = 4
        shadow.shadowOffset = .zero
        shadow.set()
        if pressAmount > 0.01 {
            let radius = 4 + pressAmount * 4
            NSColor.white.withAlphaComponent(0.3 * pressAmount).setStroke()
            let ring = NSBezierPath(ovalIn: NSRect(
                x: cursorPosition.x - radius,
                y: cursorPosition.y - radius,
                width: radius * 2,
                height: radius * 2
            ))
            ring.lineWidth = 1.25
            ring.stroke()
        }
        let scale = 1 - pressAmount * 0.12
        CursorAssets.overlayImage?.draw(
            in: NSRect(
                x: cursorPosition.x - CursorAssets.overlayHotspot.x * scale,
                y: cursorPosition.y - CursorAssets.overlayHotspot.y * scale,
                width: CursorAssets.overlaySize.width * scale,
                height: CursorAssets.overlaySize.height * scale
            ),
            from: .zero,
            operation: .sourceOver,
            fraction: 1,
            respectFlipped: true,
            hints: nil
        )
    }
}

internal final class SoftwareCursorPanel: NSPanel {
    override func constrainFrameRect(_ frameRect: NSRect, to screen: NSScreen?) -> NSRect {
        // Particle canvases intentionally extend beyond display edges. AppKit's
        // normal window constraint would move the cursor hotspot away from the
        // requested coordinate near an edge or corner.
        frameRect
    }
}

internal final class SoftwareCursorOverlay {
    static let shared = SoftwareCursorOverlay()
    private static let canvasSize = NSSize(width: 160, height: 160)
    private static let canvasCenter = CGPoint(x: 80, y: 80)

    private final class State {
        let panel: NSPanel
        let processID: pid_t
        var windowLayer: Int
        var normalizedPoint: CGPoint
        var fallbackScreenPoint: CGPoint
        var position: CGPoint
        var velocity = CGPoint.zero
        var particles: [(position: CGPoint, life: CGFloat)] = []
        var isPressed = false
        var pressAmount: CGFloat = 0

        init(
            panel: NSPanel,
            processID: pid_t,
            windowLayer: Int,
            normalizedPoint: CGPoint,
            fallbackScreenPoint: CGPoint
        ) {
            self.panel = panel
            self.processID = processID
            self.windowLayer = windowLayer
            self.normalizedPoint = normalizedPoint
            self.fallbackScreenPoint = fallbackScreenPoint
            // Animate the cursor into its first position so a one-action MCP
            // session still communicates motion and emits a short trail.
            self.position = CGPoint(
                x: fallbackScreenPoint.x - 18,
                y: fallbackScreenPoint.y + 12
            )
        }
    }

    func setPressed(windowID: CGWindowID, pressed: Bool) {
        DispatchQueue.main.async {
            self.states[windowID]?.isPressed = pressed
        }
    }

    private var states: [CGWindowID: State] = [:]
    private var refreshTimer: Timer?

    func show(
        windowID: CGWindowID,
        processID: pid_t,
        windowLayer: Int,
        normalizedPoint: CGPoint,
        fallbackScreenPoint: CGPoint
    ) {
        guard CursorAssets.overlayImage != nil else { return }
        DispatchQueue.main.async {
            if let state = self.states[windowID] {
                state.windowLayer = windowLayer
                state.normalizedPoint = normalizedPoint
                state.fallbackScreenPoint = fallbackScreenPoint
            } else {
                self.states[windowID] = State(
                    panel: self.makePanel(),
                    processID: processID,
                    windowLayer: windowLayer,
                    normalizedPoint: normalizedPoint,
                    fallbackScreenPoint: fallbackScreenPoint
                )
            }
            self.startRefreshTimerIfNeeded()
            self.refresh()
        }
    }

    private func startRefreshTimerIfNeeded() {
        guard refreshTimer == nil else { return }
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
            self?.refresh()
        }
    }

    private func refresh() {
        for (windowID, state) in states {
            guard let target = screenPoint(for: windowID, state: state) else {
                state.panel.orderOut(nil)
                continue
            }
            let displacement = CGPoint(
                x: target.x - state.position.x,
                y: target.y - state.position.y
            )
            // Exponential ease-out keeps motion fluid without the overshoot
            // and oscillation of the previous under-damped spring.
            state.velocity.x = displacement.x * 0.18
            state.velocity.y = displacement.y * 0.18
            state.position.x += state.velocity.x
            state.position.y += state.velocity.y
            if hypot(displacement.x, displacement.y) < 0.2 {
                state.position = target
                state.velocity = .zero
            }
            let speed = hypot(state.velocity.x, state.velocity.y)
            if speed > 0.35 {
                state.particles.append((state.position, 1))
            }
            state.particles = state.particles.compactMap { particle in
                let life = particle.life - 0.035
                return life > 0 ? (particle.position, life) : nil
            }
            if state.particles.count > 32 {
                state.particles.removeFirst(state.particles.count - 32)
            }
            let mainScreenMaxY = NSScreen.screens.first?.frame.maxY ?? 0
            state.panel.setFrameOrigin(NSPoint(
                x: state.position.x - Self.canvasCenter.x,
                y: mainScreenMaxY - state.position.y - Self.canvasCenter.y
            ))
            if let view = state.panel.contentView as? SoftwareCursorView {
                let origin = CGPoint(
                    x: state.position.x - Self.canvasCenter.x,
                    y: state.position.y - Self.canvasCenter.y
                )
                view.cursorPosition = Self.canvasCenter
                let targetPress: CGFloat = state.isPressed ? 1 : 0
                state.pressAmount += (targetPress - state.pressAmount) * 0.42
                view.pressAmount = state.pressAmount
                view.particles = state.particles.map {
                    SoftwareCursorView.Particle(
                        position: CGPoint(
                            x: $0.position.x - origin.x,
                            y: $0.position.y - origin.y
                        ),
                        life: $0.life
                    )
                }
                view.needsDisplay = true
            }
            state.panel.level = NSWindow.Level(rawValue: state.windowLayer)
            // Keep the cursor immediately above its controlled window rather
            // than gating it on macOS's single global frontmost application.
            // A window on another display can therefore stay visible while
            // focus is elsewhere, and windows above the target in this same
            // z-order still cover the cursor naturally.
            state.panel.order(.above, relativeTo: Int(windowID))
        }
    }

    private func screenPoint(for windowID: CGWindowID, state: State) -> CGPoint? {
        guard let windows = CGWindowListCopyWindowInfo([.optionIncludingWindow], windowID)
                as? [[String: Any]],
              let window = windows.first(where: {
                  ($0[kCGWindowNumber as String] as? NSNumber)?.uint32Value == windowID
              }) else {
            return state.fallbackScreenPoint
        }
        guard (window[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value == state.processID,
              (window[kCGWindowIsOnscreen as String] as? NSNumber)?.boolValue != false,
              let bounds = window[kCGWindowBounds as String] as? NSDictionary else {
            return nil
        }
        var frame = CGRect.zero
        guard CGRectMakeWithDictionaryRepresentation(bounds as CFDictionary, &frame) else {
            return nil
        }
        return CGPoint(
            x: frame.minX + state.normalizedPoint.x * frame.width,
            y: frame.minY + state.normalizedPoint.y * frame.height
        )
    }

    private func makePanel() -> NSPanel {
        let panel = SoftwareCursorPanel(
            contentRect: NSRect(origin: .zero, size: Self.canvasSize),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.hidesOnDeactivate = false
        panel.ignoresMouseEvents = true
        panel.collectionBehavior = [.fullScreenAuxiliary]
        panel.contentView = SoftwareCursorView(frame: NSRect(origin: .zero, size: Self.canvasSize))
        return panel
    }
}

internal struct TrackedApp {
    let bundleID: String
    var name: String
    var icon: NSImage? {
        guard let application = NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).first,
              let bundleURL = application.bundleURL else {
            return nil
        }
        return NSWorkspace.shared.icon(forFile: bundleURL.path)
    }
}

internal final class StatusAgentProcess {
    static let shared = StatusAgentProcess()

    private var process: Process?
    private var input: FileHandle?
    private let lock = NSLock()

    func start() {
        lock.lock()
        defer { lock.unlock() }
        guard process == nil else { return }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: CommandLine.arguments[0])
        process.arguments = ["status-agent"]
        let pipe = Pipe()
        process.standardInput = pipe
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        do {
            try process.run()
            self.process = process
            self.input = pipe.fileHandleForWriting
        } catch {
            self.process = nil
            self.input = nil
        }
    }

    func track(bundleID: String, name: String) {
        start()
        send(["type": "track", "bundleID": bundleID, "name": name])
    }

    func showCursor(window: SCWindow, localPoint: CGPoint, coordinateSpace: Target) {
        let width = CGFloat(max(coordinateSpace.width, 1))
        let height = CGFloat(max(coordinateSpace.height, 1))
        let normalizedPoint = CGPoint(x: localPoint.x / width, y: localPoint.y / height)
        let screenPoint = CGPoint(
            x: window.frame.minX + normalizedPoint.x * window.frame.width,
            y: window.frame.minY + normalizedPoint.y * window.frame.height
        )
        guard let processID = window.owningApplication?.processID else { return }
        start()
        send([
            "type": "cursor",
            "windowID": Int(window.windowID),
            "processID": Int(processID),
            "windowLayer": window.windowLayer,
            "normalizedX": Double(normalizedPoint.x),
            "normalizedY": Double(normalizedPoint.y),
            "x": Double(screenPoint.x),
            "y": Double(screenPoint.y),
        ])
    }

    func setCursorPressed(windowID: CGWindowID, pressed: Bool) {
        start()
        send([
            "type": "cursor-press",
            "windowID": Int(windowID),
            "pressed": pressed,
        ])
    }

    private func send(_ message: [String: Any]) {
        lock.lock()
        defer { lock.unlock() }
        guard let input else { return }
        guard let data = try? JSONSerialization.data(withJSONObject: message) else { return }
        var payload = data
        payload.append(10)
        try? input.write(contentsOf: payload)
    }

    func stop() {
        lock.lock()
        let process = self.process
        let input = self.input
        self.process = nil
        self.input = nil
        lock.unlock()
        try? input?.close()
        if let process, process.isRunning {
            process.terminate()
        }
    }
}

internal final class BridgeProcessRegistration {
    static let shared = BridgeProcessRegistration()

    private var registration: URL?
    private let lock = NSLock()

    func activate() {
        lock.lock()
        defer { lock.unlock() }
        guard registration == nil,
              let directoryPath = commandLineArgument("--process-directory"),
              let bridgePID = commandLineArgument("--bridge-pid"),
              let bridgePIDValue = Int32(bridgePID),
              bridgePIDValue > 1 else {
            return
        }
        let directory = URL(fileURLWithPath: directoryPath, isDirectory: true).standardizedFileURL
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: directory.path, isDirectory: &isDirectory),
              isDirectory.boolValue else {
            return
        }
        let registration = directory.appendingPathComponent(bridgePID, isDirectory: false)
        guard FileManager.default.createFile(atPath: registration.path, contents: Data()) else {
            return
        }
        self.registration = registration
    }

    func remove() {
        lock.lock()
        let registration = self.registration
        self.registration = nil
        lock.unlock()
        if let registration {
            try? FileManager.default.removeItem(at: registration)
        }
    }
}

internal struct ComputerUsePreviewUpdate: Encodable {
    let target: Target
    let imageUrl: String
}

internal enum ComputerUsePreviewStore {
    static func publish(target: Target, capture: Capture) {
        guard let directoryPath = commandLineArgument("--process-directory") else { return }
        let directory = URL(fileURLWithPath: directoryPath, isDirectory: true)
        let destination = directory.appendingPathComponent(
            "preview-\(target.windowId).json",
            isDirectory: false
        )
        let update = ComputerUsePreviewUpdate(target: target, imageUrl: capture.dataUrl)
        guard let data = try? JSONEncoder().encode(update) else { return }
        try? data.write(to: destination, options: .atomic)
    }
}

struct Response: Encodable {
    let success: Bool
    let error: String?
    let permissions: Permissions?
    let targets: [Target]?
    let target: Target?
    let imageUrl: String?
    let summary: String?

    static func failure(_ error: Error) -> Response {
        Response(
            success: false,
            error: error.localizedDescription,
            permissions: nil,
            targets: nil,
            target: nil,
            imageUrl: nil,
            summary: nil
        )
    }
}

enum HelperError: LocalizedError {
    case invalidRequest(String)
    case ipc(String)
    case missingPermission(String)
    case unauthorizedClient(String)
    case targetUnavailable
    case targetIdentityChanged
    case targetBlocked
    case unsupportedAction(String)
    case eventCreationFailed
    case captureFailed

    var errorDescription: String? {
        switch self {
        case .invalidRequest(let message): message
        case .ipc(let message): "computer-use connection failed: \(message)"
        case .missingPermission(let permission): "\(helperDisplayName) needs \(permission) access in System Settings."
        case .unauthorizedClient(let reason): "computer-use rejected a request from an untrusted client: \(reason)"
        case .targetUnavailable: "The app has no available window. Retry get_accessibility_tree, or call list_apps() to confirm the app identifier."
        case .targetIdentityChanged: "The selected app window changed. Call get_accessibility_tree again before interacting."
        case .targetBlocked: "computer-use access to that app is blocked."
        case .unsupportedAction(let action): "Unsupported computer-use action: \(action)"
        case .eventCreationFailed: "macOS could not create an input event."
        case .captureFailed: "macOS could not capture the selected app window."
        }
    }
}
