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

internal func accessibilityRoot(for processID: pid_t) -> AXUIElement {
    AXUIElementCreateApplication(processID)
}

internal func accessibilityAttribute(_ element: AXUIElement, _ name: String) -> AnyObject? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else {
        return nil
    }
    return value
}

internal func accessibilityString(_ element: AXUIElement, _ name: String) -> String? {
    if let value = accessibilityAttribute(element, name) as? String {
        return value
    }
    if let value = accessibilityAttribute(element, name) as? NSNumber {
        return value.stringValue
    }
    return nil
}

internal func accessibilityElement(_ element: AXUIElement, _ name: String) -> AXUIElement? {
    guard let value = accessibilityAttribute(element, name),
          CFGetTypeID(value) == AXUIElementGetTypeID() else {
        return nil
    }
    return unsafeBitCast(value, to: AXUIElement.self)
}

internal func accessibilityBoolean(_ element: AXUIElement, _ name: String) -> Bool? {
    (accessibilityAttribute(element, name) as? NSNumber)?.boolValue
}

internal func accessibilityURLString(_ element: AXUIElement, _ name: String) -> String? {
    guard let value = accessibilityAttribute(element, name) else { return nil }
    if let url = value as? URL {
        return url.absoluteString
    }
    if let url = value as? NSURL {
        return url.absoluteString
    }
    return value as? String
}

internal func accessibilityValueString(_ value: AnyObject?) -> String? {
    guard let value else { return nil }
    if let string = value as? String {
        return string
    }
    if CFGetTypeID(value) == CFBooleanGetTypeID(), let number = value as? NSNumber {
        return number.boolValue ? "on" : "off"
    }
    if let number = value as? NSNumber {
        return number.stringValue
    }
    if let attributed = value as? NSAttributedString {
        return attributed.string
    }
    return nil
}

internal func accessibilityFrame(_ element: AXUIElement) -> CGRect? {
    guard let positionAttribute = accessibilityAttribute(element, kAXPositionAttribute),
          let sizeAttribute = accessibilityAttribute(element, kAXSizeAttribute),
          CFGetTypeID(positionAttribute) == AXValueGetTypeID(),
          CFGetTypeID(sizeAttribute) == AXValueGetTypeID() else {
        return nil
    }
    let positionValue = unsafeBitCast(positionAttribute, to: AXValue.self)
    let sizeValue = unsafeBitCast(sizeAttribute, to: AXValue.self)
    var position = CGPoint.zero
    var size = CGSize.zero
    guard AXValueGetValue(positionValue, .cgPoint, &position),
          AXValueGetValue(sizeValue, .cgSize, &size) else {
        return nil
    }
    return CGRect(origin: position, size: size)
}

internal func accessibilityChildren(_ element: AXUIElement) -> [AXUIElement] {
    if accessibilityString(element, kAXRoleAttribute) == "AXLink" {
        return []
    }
    if ["AXCloseButton", "AXFullScreenButton", "AXMinimizeButton", "AXZoomButton"]
        .contains(accessibilityString(element, kAXSubroleAttribute)) {
        return []
    }
    var attributes = [
        kAXChildrenAttribute,
        "AXChildrenInNavigationOrder",
        kAXVisibleChildrenAttribute,
        kAXContentsAttribute,
        "AXRows",
        "AXColumns",
        "AXTabs",
    ]
    if accessibilityString(element, kAXRoleAttribute) == kAXWindowRole {
        attributes += [
            "AXToolbarButton",
            "AXCloseButton",
            "AXFullScreenButton",
            "AXZoomButton",
            "AXMinimizeButton",
            "AXDefaultButton",
            "AXCancelButton",
        ]
    }
    var seen = Set<CFHashCode>()
    var children: [AXUIElement] = []
    for attribute in attributes {
        if let child = accessibilityElement(element, attribute),
           seen.insert(CFHash(child)).inserted {
            children.append(child)
        }
        for child in (accessibilityAttribute(element, attribute) as? [AXUIElement]) ?? [] {
            if seen.insert(CFHash(child)).inserted {
                children.append(child)
            }
        }
    }
    return children
}

internal func enableEnhancedAccessibility(_ application: AXUIElement) {
    _ = AXUIElementSetAttributeValue(
        application,
        "AXEnhancedUserInterface" as CFString,
        kCFBooleanTrue
    )
}

internal func accessibilityFrameCenter(_ element: AXUIElement) -> CGPoint? {
    guard let frame = accessibilityFrame(element) else { return nil }
    return CGPoint(x: frame.midX, y: frame.midY)
}

internal func accessibilityWindowCandidates(_ application: AXUIElement) -> [AXUIElement] {
    var candidates: [AXUIElement] = []
    var seen = Set<CFHashCode>()
    func append(_ candidate: AXUIElement?) {
        guard let candidate,
              accessibilityString(candidate, kAXRoleAttribute) == kAXWindowRole,
              seen.insert(CFHash(candidate)).inserted else {
            return
        }
        candidates.append(candidate)
    }
    for candidate in (accessibilityAttribute(application, kAXWindowsAttribute) as? [AXUIElement]) ?? [] {
        append(candidate)
    }
    append(accessibilityElement(application, kAXFocusedWindowAttribute))
    append(accessibilityElement(application, kAXMainWindowAttribute))
    for candidate in accessibilityChildren(application) {
        append(candidate)
    }
    return candidates
}

internal func chooseAccessibilityWindow(
    application: AXUIElement,
    resolved: ResolvedAppWindow
) -> AXUIElement {
    let candidates = accessibilityWindowCandidates(application)
    guard !candidates.isEmpty else { return application }
    let targetFrame = resolved.window.frame
    let targetTitle = resolved.target.windowTitle
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
    let focusedWindow = accessibilityElement(application, kAXFocusedWindowAttribute)
    let mainWindow = accessibilityElement(application, kAXMainWindowAttribute)

    func score(_ candidate: AXUIElement) -> Double {
        var score = 0.0
        for attribute in ["AXWindowNumber", "_AXWindowNumber"] {
            if (accessibilityAttribute(candidate, attribute) as? NSNumber)?.uint32Value
                == resolved.target.windowId {
                score += 1_000_000
            }
        }
        let title = (accessibilityString(candidate, kAXTitleAttribute) ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        if !targetTitle.isEmpty, title == targetTitle {
            score += 100_000
        } else if !targetTitle.isEmpty,
                  (title.contains(targetTitle) || targetTitle.contains(title)),
                  !title.isEmpty {
            score += 50_000
        }
        if let frame = accessibilityFrame(candidate), frame.width > 0, frame.height > 0 {
            let intersection = frame.intersection(targetFrame)
            if !intersection.isNull, !intersection.isEmpty {
                let intersectionArea = intersection.width * intersection.height
                let unionArea = frame.width * frame.height
                    + targetFrame.width * targetFrame.height
                    - intersectionArea
                score += 20_000 * Double(intersectionArea / max(unionArea, 1))
            }
            let widthRatio = min(frame.width, targetFrame.width) / max(frame.width, targetFrame.width, 1)
            let heightRatio = min(frame.height, targetFrame.height) / max(frame.height, targetFrame.height, 1)
            score += 5_000 * Double(widthRatio * heightRatio)
            if frame.width < 80 || frame.height < 60 {
                score -= 10_000
            }
        }
        if let focusedWindow, CFEqual(candidate, focusedWindow) { score += 200 }
        if let mainWindow, CFEqual(candidate, mainWindow) { score += 100 }
        return score
    }
    return candidates.max(by: { score($0) < score($1) }) ?? candidates[0]
}

internal let browserComputerUseInstructions = """
<app_specific_instructions>
## Browser Computer Use

When navigating to a new website or starting a separate web task, prefer opening a new tab instead of reusing the current tab; reuse the current tab only when the user explicitly asks to continue there or when the current page is clearly the right place to continue the existing workflow.
</app_specific_instructions>
"""

internal func isBrowser(bundleID: String) -> Bool {
    let bundleID = bundleID.lowercased()
    return [
        "com.apple.safari",
        "com.brave.browser",
        "com.google.chrome",
        "com.microsoft.edgemac",
        "company.thebrowser.browser",
        "net.imput.helium",
        "org.mozilla.firefox",
    ].contains(where: bundleID.hasPrefix)
}

internal func accessibilityText(for resolved: ResolvedAppWindow) -> String {
    AccessibilityRegistry.shared.reset(
        bundleID: resolved.target.bundleId,
        processID: resolved.processID,
        windowID: resolved.target.windowId
    )
    let application = accessibilityRoot(for: resolved.processID)
    enableEnhancedAccessibility(application)
    let window = chooseAccessibilityWindow(application: application, resolved: resolved)
    var lines: [String] = []
    var ancestors = Set<CFHashCode>()
    appendAccessibilityTree(
        window,
        depth: 0,
        maximumDepth: 30,
        lines: &lines,
        ancestors: &ancestors
    )
    if let menuBar = accessibilityElement(application, kAXMenuBarAttribute) {
        ancestors.removeAll(keepingCapacity: true)
        appendAccessibilityTree(
            menuBar,
            depth: 0,
            maximumDepth: 1,
            lines: &lines,
            ancestors: &ancestors
        )
    }

    let focused = accessibilityElement(application, kAXFocusedUIElementAttribute)
    if let focused, AccessibilityRegistry.shared.index(for: focused) == nil {
        ancestors.removeAll(keepingCapacity: true)
        appendAccessibilityTree(
            focused,
            depth: 0,
            maximumDepth: 0,
            lines: &lines,
            ancestors: &ancestors
        )
    }

    var sections: [String] = []
    sections.append("Window: \"\(resolved.target.windowTitle)\", App: \(resolved.target.appName).")
    sections.append(lines.joined(separator: "\n"))
    if let focused,
       let focusedIndex = AccessibilityRegistry.shared.index(for: focused) {
        sections.append(
            "The focused UI element is \(accessibilityDetail(focused, index: focusedIndex))"
        )
    }
    return sections.joined(separator: "\n")
}

internal func captureAppState(
    _ initialResolved: ResolvedAppWindow,
    disableDiff: Bool
) async throws -> (text: String, capture: Capture) {
    var resolved = initialResolved
    let remainingDelay = RecentComputerActionStore.shared.remainingDelay(for: resolved.target.bundleId)
    if remainingDelay > 0 {
        try await Task.sleep(nanoseconds: UInt64(remainingDelay * 1_000_000_000))
        resolved = try await resolveAppWindow(resolved.target.bundleId, launchIfNeeded: false)
    }
    guard let display = captureDisplay(for: resolved.window, in: resolved.content.displays) else {
        throw HelperError.captureFailed
    }
    let filter = SCContentFilter(display: display, including: [resolved.window])
    let sourceRect = captureSourceRect(for: resolved.window, on: display)
    BridgeProcessRegistration.shared.activate()
    try await CaptureSessions.shared.start(
        for: resolved.window,
        filter: filter,
        sourceRect: sourceRect,
        target: resolved.target
    )
    StatusAgentProcess.shared.track(
        bundleID: resolved.target.bundleId,
        name: resolved.target.appName
    )
    let cursor = VirtualCursorStore.shared.position(
        for: resolved.window.windowID,
        size: CGSize(
            width: CGFloat(resolved.target.width),
            height: CGFloat(resolved.target.height)
        )
    )
    let captured: Capture
    do {
        captured = try await capture(
            resolved.window,
            filter: filter,
            sourceRect: sourceRect,
            cursor: cursor,
            coordinateSpace: resolved.target
        )
    } catch {
        await CaptureSessions.shared.stopAll()
        throw error
    }
    await CaptureSessions.shared.stopAll()
    ComputerUsePreviewStore.publish(target: resolved.target, capture: captured)
    let fullTree = accessibilityText(for: resolved)
    var text = AccessibilityDiffStore.shared.render(
        fullTree,
        for: resolved.target.bundleId,
        disableDiff: disableDiff
    )
    // App-specific guidance belongs to the conversation context, not to each
    // accessibility snapshot. A fresh full tree must not repeat it.
    if isBrowser(bundleID: resolved.target.bundleId),
       let instructions = AppSpecificInstructionsStore.shared.take(
           browserComputerUseInstructions,
           for: resolved.target.bundleId
       ) {
        text = "\(instructions)\n\(text)"
    }
    return (text, captured)
}

internal func appendAccessibilityTree(
    _ element: AXUIElement,
    depth: Int,
    maximumDepth: Int,
    lines: inout [String],
    ancestors: inout Set<CFHashCode>
) {
    guard depth <= maximumDepth, lines.count < 5_000 else { return }
    let hash = CFHash(element)
    guard !ancestors.contains(hash) else { return }
    ancestors.insert(hash)
    defer { ancestors.remove(hash) }

    let children = accessibilityChildren(element).filter {
        !isEmptyAccessibilityContainerLeaf($0)
    }
    if shouldFlattenAccessibilityElement(element, children: children) {
        for child in children {
            appendAccessibilityTree(
                child,
                depth: depth,
                maximumDepth: maximumDepth,
                lines: &lines,
                ancestors: &ancestors
            )
        }
        return
    }

    let index = AccessibilityRegistry.shared.add(element)
    lines.append(String(repeating: "\t", count: depth) + accessibilityTreeDetail(element, index: index))
    let parentRole = accessibilityString(element, kAXRoleAttribute)
    for child in children {
        if isRedundantLinkText(child, parent: element) { continue }
        if parentRole == kAXMenuBarRole, shouldHideMenuBarItem(child) { continue }
        appendAccessibilityTree(
            child,
            depth: depth + 1,
            maximumDepth: maximumDepth,
            lines: &lines,
            ancestors: &ancestors
        )
    }
}

internal func accessibilityTreeDetail(_ element: AXUIElement, index: String) -> String {
    let role = semanticAccessibilityRole(
        role: accessibilityString(element, kAXRoleAttribute) ?? "AXUIElement",
        subrole: accessibilityString(element, kAXSubroleAttribute),
        roleDescription: accessibilityString(element, "AXRoleDescription")
    )
    var traits: [String] = []
    if accessibilityBoolean(element, kAXEnabledAttribute) == false { traits.append("disabled") }
    if accessibilityBoolean(element, kAXSelectedAttribute) == true { traits.append("selected") }
    let label = renderedAccessibilityString(accessibilityString(element, kAXTitleAttribute))
        ?? renderedAccessibilityString(accessibilityString(element, kAXDescriptionAttribute))
        ?? renderedAccessibilityString(accessibilityValueString(accessibilityAttribute(element, kAXValueAttribute)))
    var result = index
    if !role.isEmpty { result += " \(role)" }
    if !traits.isEmpty { result += " (\(traits.joined(separator: ", ")))" }
    if let label {
        result += " " + (label.count > 160 ? String(label.prefix(160)) + "…" : label)
    }
    return result
}

internal func accessibilityNode(_ element: AXUIElement, index: String) throws -> [String: Any] {
    let role = accessibilityString(element, kAXRoleAttribute) ?? "AXUIElement"
    var node: [String: Any] = [
        "index": Int(index) ?? 0,
        "role": semanticAccessibilityRole(
            role: role,
            subrole: accessibilityString(element, kAXSubroleAttribute),
            roleDescription: accessibilityString(element, "AXRoleDescription")
        ),
        "axRole": role,
        "enabled": accessibilityBoolean(element, kAXEnabledAttribute) ?? true,
        "selected": accessibilityBoolean(element, kAXSelectedAttribute) ?? false,
        "focused": accessibilityBoolean(element, kAXFocusedAttribute) ?? false,
        "actions": try accessibilityActions(element).map(accessibilityActionName),
    ]
    let strings: [(String, String?)] = [
        ("subrole", accessibilityString(element, kAXSubroleAttribute)),
        ("title", accessibilityString(element, kAXTitleAttribute)),
        ("description", accessibilityString(element, kAXDescriptionAttribute)),
        ("value", accessibilityValueString(accessibilityAttribute(element, kAXValueAttribute))),
        ("url", accessibilityURLString(element, kAXURLAttribute)),
        ("placeholder", accessibilityString(element, kAXPlaceholderValueAttribute)),
        ("help", accessibilityString(element, kAXHelpAttribute)),
    ]
    for (key, value) in strings {
        if let value = renderedAccessibilityString(value) { node[key] = value }
    }
    if let frame = accessibilityFrame(element) {
        node["frame"] = ["x": frame.minX, "y": frame.minY, "width": frame.width, "height": frame.height]
    }
    node["children"] = accessibilityChildren(element).compactMap {
        AccessibilityRegistry.shared.index(for: $0).flatMap(Int.init)
    }
    return node
}

internal func shouldFlattenAccessibilityElement(
    _ element: AXUIElement,
    children: [AXUIElement]
) -> Bool {
    guard children.count == 1 else { return false }
    return isSemanticallyEmptyAccessibilityContainer(element)
}

internal func isEmptyAccessibilityContainerLeaf(_ element: AXUIElement) -> Bool {
    isSemanticallyEmptyAccessibilityContainer(element)
        && accessibilityChildren(element).isEmpty
}

internal func isSemanticallyEmptyAccessibilityContainer(_ element: AXUIElement) -> Bool {
    let role = accessibilityString(element, kAXRoleAttribute)
    guard role == kAXGroupRole || role == "AXGenericElement" else { return false }
    return renderedAccessibilityString(accessibilityString(element, kAXTitleAttribute)) == nil
        && renderedAccessibilityString(accessibilityString(element, kAXDescriptionAttribute)) == nil
        && renderedAccessibilityString(
            accessibilityValueString(accessibilityAttribute(element, kAXValueAttribute))
        ) == nil
        && renderedAccessibilityString(accessibilityURLString(element, kAXURLAttribute)) == nil
}

internal func shouldHideMenuBarItem(_ element: AXUIElement) -> Bool {
    let title = renderedAccessibilityString(accessibilityString(element, kAXTitleAttribute))
    return title == "Apple" || title == "AppKit Debug"
}

internal func isRedundantLinkText(_ element: AXUIElement, parent: AXUIElement) -> Bool {
    guard accessibilityString(parent, kAXRoleAttribute) == "AXLink",
          accessibilityString(element, kAXRoleAttribute) == kAXStaticTextRole else {
        return false
    }
    let childText = renderedAccessibilityString(accessibilityString(element, kAXTitleAttribute))
        ?? renderedAccessibilityString(
            accessibilityValueString(accessibilityAttribute(element, kAXValueAttribute))
        )
    let parentText = renderedAccessibilityString(accessibilityString(parent, kAXTitleAttribute))
        ?? renderedAccessibilityString(accessibilityString(parent, kAXDescriptionAttribute))
    return childText != nil && childText == parentText
}

internal func accessibilityDetail(_ element: AXUIElement, index: String) -> String {
    let axRole = accessibilityString(element, kAXRoleAttribute) ?? "AXUIElement"
    let subrole = accessibilityString(element, kAXSubroleAttribute)
    let roleDescription = accessibilityString(element, "AXRoleDescription")
    let role = semanticAccessibilityRole(
        role: axRole,
        subrole: subrole,
        roleDescription: roleDescription
    )
    let rawValue = accessibilityAttribute(element, kAXValueAttribute)
    var value = accessibilityValueString(rawValue)
    var title = accessibilityString(element, kAXTitleAttribute)
    var description = accessibilityString(element, kAXDescriptionAttribute)

    if axRole == kAXStaticTextRole {
        if title?.isEmpty != false { title = value }
        value = nil
    } else if title?.isEmpty != false,
              [
                  kAXButtonRole,
                  kAXGroupRole,
                  kAXImageRole,
                  kAXMenuBarItemRole,
                  "AXPopUpButton",
              ].contains(axRole) {
        title = description
        description = nil
    }

    title = renderedAccessibilityString(title)
    description = renderedAccessibilityString(description)
    value = renderedAccessibilityString(value)
    let placeholder = renderedAccessibilityString(
        accessibilityString(element, kAXPlaceholderValueAttribute)
    )
    let help = renderedAccessibilityString(accessibilityString(element, kAXHelpAttribute))
    var url = renderedAccessibilityString(accessibilityURLString(element, kAXURLAttribute))
    if url == nil, axRole == kAXWindowRole {
        url = firstAccessibilityURL(in: element, remainingDepth: 4)
    }

    var traits: [String] = []
    if accessibilityBoolean(element, kAXEnabledAttribute) == false {
        traits.append("disabled")
    }
    if accessibilityBoolean(element, kAXSelectedAttribute) == true {
        traits.append("selected")
    }
    let settableRoles = ["AXComboBox", "AXTab", "AXTextArea", "AXTextField"]
    var settable = DarwinBoolean(false)
    if settableRoles.contains(axRole),
       rawValue != nil,
       AXUIElementIsAttributeSettable(element, kAXValueAttribute as CFString, &settable) == .success,
       settable.boolValue {
        traits.append("settable")
        if let type = accessibilityValueType(rawValue) {
            traits.append(type)
        }
    }

    var detail = index
    if !role.isEmpty { detail += " \(role)" }
    if !traits.isEmpty { detail += " (\(traits.joined(separator: ", ")))" }
    if let title, !title.isEmpty { detail += " \(title)" }
    if let description, !description.isEmpty, description != title {
        detail += ", Description: \(description)"
    }
    if let url, !url.isEmpty {
        detail += axRole == "AXLink" ? ", Value: \(url)" : ", URL: \(url)"
    } else if let value, !value.isEmpty, value != title, value != description {
        detail += ", Value: \(value)"
    }
    if let placeholder, !placeholder.isEmpty {
        detail += ", Placeholder: \(placeholder)"
    }
    if let help, !help.isEmpty {
        detail += ", Help: \(help)"
    }
    let secondaryActions: [String]
    if axRole == kAXMenuBarRole || axRole == kAXMenuBarItemRole {
        secondaryActions = []
    } else {
        secondaryActions = ((try? accessibilityActions(element)) ?? [])
            .filter {
                $0 != kAXPressAction
                    && $0 != "AXShowMenu"
                    && $0 != "AXScrollToVisible"
            }
            .map(accessibilityActionName)
    }
    if !secondaryActions.isEmpty {
        detail += ", Secondary Actions: \(secondaryActions.joined(separator: ", "))"
    }
    return detail
}

internal func firstAccessibilityURL(in element: AXUIElement, remainingDepth: Int) -> String? {
    guard remainingDepth >= 0 else { return nil }
    if let url = renderedAccessibilityString(accessibilityURLString(element, kAXURLAttribute)) {
        return url
    }
    for child in accessibilityChildren(element) {
        if let url = firstAccessibilityURL(in: child, remainingDepth: remainingDepth - 1) {
            return url
        }
    }
    return nil
}

internal func renderedAccessibilityString(_ value: String?) -> String? {
    guard var value else { return nil }
    value = value.replacingOccurrences(of: "\r", with: "")
        .trimmingCharacters(in: .whitespacesAndNewlines)
    guard !value.isEmpty else { return nil }
    let limit = 1_000
    if value.count > limit {
        value = String(value.prefix(limit)) + "…"
    }
    return value
}

internal func accessibilityValueType(_ value: AnyObject?) -> String? {
    guard let value else { return nil }
    if CFGetTypeID(value) == CFBooleanGetTypeID() { return "boolean" }
    if value is String || value is NSAttributedString { return "string" }
    if value is NSNumber { return "number" }
    return nil
}

internal func semanticAccessibilityRole(
    role: String,
    subrole: String?,
    roleDescription: String?
) -> String {
    if roleDescription?.lowercased() == "column header" {
        return "column header"
    }
    switch subrole {
    case "AXStandardWindow": return "standard window"
    case "AXDialog", "AXSystemDialog": return "dialog"
    case "AXCloseButton": return "close button"
    case "AXMinimizeButton": return "minimize button"
    case "AXZoomButton", "AXFullScreenButton": return "full screen button"
    case "AXSearchField": return "text field"
    case "AXSecureTextField": return "secure text field"
    case "AXToggle", "AXSwitch": return "toggle button"
    case "AXColumnHeader": return "column header"
    default: break
    }
    switch role {
    case "AXApplication": return "application"
    case "AXBrowser", "AXGenericElement", "AXGroup": return "container"
    case "AXButton": return "button"
    case "AXCheckBox": return "toggle button"
    case "AXCell": return "cell"
    case "AXColumn": return "column"
    case "AXColumnHeader": return "column header"
    case "AXComboBox": return "combo box"
    case "AXDisclosureTriangle": return "disclosure triangle"
    case "AXHeading": return "heading"
    case "AXImage": return "image"
    case "AXLink": return "link"
    case "AXList": return "content list"
    case "AXMenu": return "menu"
    case "AXMenuBar": return "menu bar"
    case "AXMenuBarItem": return ""
    case "AXMenuButton": return "menu button"
    case "AXMenuItem": return "menu item"
    case "AXOutline": return "outline"
    case "AXPopUpButton": return "pop up button"
    case "AXProgressIndicator": return "progress indicator"
    case "AXRadioButton": return "radio button"
    case "AXRadioGroup": return "radio group"
    case "AXRow": return "row"
    case "AXScrollArea": return "scroll area"
    case "AXSheet": return "sheet"
    case "AXSlider": return "slider"
    case "AXSplitGroup": return "split group"
    case "AXStaticText": return "text"
    case "AXTab": return "tab"
    case "AXTabGroup": return "tab group"
    case "AXTable": return "table"
    case "AXTextArea": return "text area"
    case "AXTextField": return "text field"
    case "AXToolbar": return "toolbar"
    case "AXWebArea": return "HTML content"
    case "AXWindow": return "window"
    default: return humanizeAccessibilityIdentifier(role)
    }
}

internal func accessibilityActionName(_ action: String) -> String {
    switch action {
    case "AXRaise": return "Raise"
    case "AXShowMenu": return "Show Menu"
    case "AXIncrement": return "Increment"
    case "AXDecrement": return "Decrement"
    case "AXConfirm": return "Confirm"
    case "AXCancel": return "Cancel"
    case "AXZoomWindow": return "zoom the window"
    default:
        let name = humanizeAccessibilityIdentifier(action)
        return name.prefix(1).uppercased() + name.dropFirst()
    }
}

internal func humanizeAccessibilityIdentifier(_ identifier: String) -> String {
    let source = identifier.hasPrefix("AX") ? String(identifier.dropFirst(2)) : identifier
    var result = ""
    for character in source {
        if character.isUppercase, !result.isEmpty, result.last != " " {
            result.append(" ")
        }
        if character == "_" || character == "-" {
            if result.last != " " { result.append(" ") }
        } else {
            result.append(character.lowercased())
        }
    }
    return result.trimmingCharacters(in: .whitespaces)
}

internal func accessibilityActions(_ element: AXUIElement) throws -> [String] {
    var names: CFArray?
    guard AXUIElementCopyActionNames(element, &names) == .success,
          let names = names as? [String] else {
        return []
    }
    return names
}

internal func performAccessibilityAction(_ element: AXUIElement, name: String) throws {
    guard AXUIElementPerformAction(element, name as CFString) == .success else {
        throw HelperError.invalidRequest("The element does not expose the \(name) action")
    }
}

internal func performAccessibilityAction(_ element: AXUIElement, matching requested: String) throws {
    let actions = try accessibilityActions(element)
    let normalized = normalizeAccessibilityAction(requested)
    guard let action = actions.first(where: { normalizeAccessibilityAction($0) == normalized }) else {
        throw HelperError.invalidRequest(
            "The element does not expose the \(requested) action"
        )
    }
    try performAccessibilityAction(element, name: action)
}

internal func normalizeAccessibilityAction(_ value: String) -> String {
    var normalized = value.lowercased().filter(\.isLetter)
    if normalized.hasPrefix("ax") {
        normalized.removeFirst(2)
    }
    return normalized
}

internal func selectText(_ arguments: [String: Any], in element: AXUIElement) throws {
    let text = try requiredString(arguments, "text")
    guard let value = accessibilityString(element, kAXValueAttribute) else {
        throw HelperError.invalidRequest("Text was not found in the element")
    }
    let prefix = arguments["prefix"] as? String
    let suffix = arguments["suffix"] as? String
    let source = value as NSString
    let needle = text as NSString
    var candidates: [NSRange] = []
    var search = NSRange(location: 0, length: source.length)
    while search.length > 0 {
        let match = source.range(of: needle as String, options: [], range: search)
        if match.location == NSNotFound { break }
        let prefixMatches = prefix.map { candidate in
            let length = (candidate as NSString).length
            guard match.location >= length else { return false }
            return source.substring(with: NSRange(location: match.location - length, length: length)) == candidate
        } ?? true
        let suffixMatches = suffix.map { candidate in
            let length = (candidate as NSString).length
            let location = match.location + match.length
            guard location + length <= source.length else { return false }
            return source.substring(with: NSRange(location: location, length: length)) == candidate
        } ?? true
        if prefixMatches && suffixMatches {
            candidates.append(match)
        }
        let next = match.location + max(match.length, 1)
        search = NSRange(location: next, length: source.length - next)
    }
    guard candidates.count == 1, var match = candidates.first else {
        let reason = candidates.isEmpty ? "was not found" : "is ambiguous"
        throw HelperError.invalidRequest("Text \(reason) in the element")
    }
    switch (arguments["selection_type"] as? String) ?? "text" {
    case "text":
        break
    case "cursor_before":
        match.length = 0
    case "cursor_after":
        match.location += match.length
        match.length = 0
    default:
        throw HelperError.invalidRequest(
            "selection_type must be text, cursor_before, or cursor_after"
        )
    }
    var selection = CFRange(location: match.location, length: match.length)
    guard let rangeValue = AXValueCreate(.cfRange, &selection),
          AXUIElementSetAttributeValue(element, kAXSelectedTextRangeAttribute as CFString, rangeValue) == .success else {
        throw HelperError.invalidRequest("The element does not support text selection")
    }
}

internal func scrollAccessibility(
    _ arguments: [String: Any],
    element: AXUIElement,
    processID: pid_t
) throws {
    let direction = try requiredString(arguments, "direction").lowercased()
    let pages = number(arguments, "pages") ?? 1
    guard pages.isFinite, pages > 0 else {
        throw HelperError.invalidRequest("pages must be a finite number greater than zero")
    }
    let distance = pages * 700
    let delta: (x: Double, y: Double)
    switch direction {
    case "up", "u": delta = (0, distance)
    case "down", "d": delta = (0, -distance)
    case "left", "l": delta = (distance, 0)
    case "right", "r": delta = (-distance, 0)
    default: throw HelperError.invalidRequest("Unsupported scroll direction: \(direction)")
    }
    try scroll(
        deltaX: delta.x,
        deltaY: delta.y,
        at: accessibilityFrameCenter(element),
        processID: processID
    )
}
