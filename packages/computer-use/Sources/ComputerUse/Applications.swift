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

internal func currentPermissions() -> Permissions {
    Permissions(
        screenRecording: CGPreflightScreenCaptureAccess(),
        accessibility: AXIsProcessTrusted()
    )
}

internal func availableContent() async throws -> SCShareableContent {
    try await SCShareableContent.excludingDesktopWindows(
        true,
        onScreenWindowsOnly: false
    )
}

internal func availableWindows(in content: SCShareableContent) -> [SCWindow] {
    return content.windows
        .filter { window in
            guard let app = window.owningApplication,
                  !app.bundleIdentifier.isEmpty,
                  window.frame.width >= 80,
                  window.frame.height >= 60,
                  !isBlocked(bundleId: app.bundleIdentifier) else {
                return false
            }
            return true
        }
        .sorted { lhs, rhs in
            let leftApp = lhs.owningApplication?.applicationName ?? ""
            let rightApp = rhs.owningApplication?.applicationName ?? ""
            if leftApp == rightApp {
                return (lhs.title ?? "") < (rhs.title ?? "")
            }
            return leftApp < rightApp
        }
}

internal struct ResolvedAppWindow {
    let content: SCShareableContent
    let window: SCWindow
    let target: Target
    let processID: pid_t
}

internal final class AccessibilityDiffStore {
    static let shared = AccessibilityDiffStore()

    private var trees: [String: String] = [:]
    private let lock = NSLock()

    func render(_ tree: String, for app: String, disableDiff: Bool) -> String {
        lock.lock()
        let previous = trees.updateValue(tree, forKey: app)
        lock.unlock()
        guard !disableDiff, let previous else {
            return tree
        }
        guard previous != tree else {
            let window = tree.split(separator: "\n", omittingEmptySubsequences: false)
                .first(where: { $0.hasPrefix("Window: ") })
                .map(String.init)
                ?? "the current window."
            let focus = tree.split(separator: "\n", omittingEmptySubsequences: false)
                .last(where: { $0.hasPrefix("The focused UI element is ") })
                .map(String.init)
            var result = "There has been no change in the accessibility tree for \(window)"
            if let focus {
                result += "\n\(focus)"
            }
            return result
        }

        let oldLines = indexedAccessibilityLines(previous)
        let newLines = indexedAccessibilityLines(tree)
        let indexes = Set(oldLines.keys).union(newLines.keys).sorted()
        var changes: [String] = []
        for index in indexes {
            switch (oldLines[index], newLines[index]) {
            case let (old?, new?) where old != new:
                changes.append("- \(old)")
                changes.append("+ \(new)")
            case let (old?, nil):
                changes.append("- \(old)")
            case let (nil, new?):
                changes.append("+ \(new)")
            default:
                break
            }
        }
        return "<accessibility_diff>\n\(changes.joined(separator: "\n"))\n</accessibility_diff>"
    }
}

internal final class AppSpecificInstructionsStore {
    static let shared = AppSpecificInstructionsStore()

    private var injectedApps = Set<String>()
    private let lock = NSLock()

    func take(_ instructions: String, for bundleID: String) -> String? {
        lock.lock()
        let isFirstInjection = injectedApps.insert(bundleID.lowercased()).inserted
        lock.unlock()
        return isFirstInjection ? instructions : nil
    }
}

internal final class RecentComputerActionStore {
    static let shared = RecentComputerActionStore()

    private var dates: [String: Date] = [:]
    private let lock = NSLock()

    func record(_ bundleID: String) {
        lock.lock()
        dates[bundleID] = Date()
        lock.unlock()
    }

    func remainingDelay(for bundleID: String) -> TimeInterval {
        lock.lock()
        let date = dates[bundleID]
        lock.unlock()
        guard let date else { return 0 }
        return max(0, 1 - Date().timeIntervalSince(date))
    }
}

internal func indexedAccessibilityLines(_ tree: String) -> [Int: String] {
    var result: [Int: String] = [:]
    for line in tree.split(separator: "\n", omittingEmptySubsequences: false) {
        let value = String(line)
        let trimmed = value.drop(while: { $0 == "\t" || $0 == " " })
        let digits = trimmed.prefix(while: \.isNumber)
        guard !digits.isEmpty, let index = Int(digits) else {
            continue
        }
        result[index] = value
    }
    return result
}

internal func normalizedAppIdentifier(_ identifier: String) throws -> String {
    let normalized = identifier.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !normalized.isEmpty else {
        throw HelperError.invalidRequest("app is required")
    }
    return normalized
}

internal func matchingWindows(
    for identifier: String,
    in content: SCShareableContent
) throws -> [SCWindow] {
    let normalized = try normalizedAppIdentifier(identifier)
    return availableWindows(in: content).filter { window in
        guard let app = window.owningApplication else { return false }
        let running = NSRunningApplication(processIdentifier: app.processID)
        let path = running?.bundleURL?.path.lowercased()
        let processName = running?.executableURL?.deletingPathExtension().lastPathComponent.lowercased()
        return app.applicationName.lowercased() == normalized
            || app.bundleIdentifier.lowercased() == normalized
            || path == normalized
            || processName == normalized
    }
}

internal func chooseWindow(_ windows: [SCWindow], identifier: String) throws -> SCWindow? {
    guard !windows.isEmpty else { return nil }
    let normalized = try normalizedAppIdentifier(identifier)
    let exactIdentities = Set(windows.compactMap { window -> String? in
        guard let app = window.owningApplication else { return nil }
        let running = NSRunningApplication(processIdentifier: app.processID)
        let path = running?.bundleURL?.path.lowercased()
        if app.bundleIdentifier.lowercased() == normalized || path == normalized {
            return app.bundleIdentifier
        }
        return nil
    })
    let bundleIDs = Set(windows.compactMap { $0.owningApplication?.bundleIdentifier })
    if exactIdentities.isEmpty, bundleIDs.count > 1 {
        let choices = bundleIDs.sorted().joined(separator: ", ")
        throw HelperError.invalidRequest(
            "App '\(identifier)' is ambiguous. Retry with a bundle identifier from list_apps(): \(choices)"
        )
    }

    let frontmostPID = NSWorkspace.shared.frontmostApplication?.processIdentifier
    return windows.max { lhs, rhs in
        func rank(_ window: SCWindow) -> (Int, Int, CGFloat) {
            let frontmost = window.owningApplication?.processID == frontmostPID ? 1 : 0
            let onScreen = window.isOnScreen ? 1 : 0
            return (frontmost, onScreen, window.frame.width * window.frame.height)
        }
        return rank(lhs) < rank(rhs)
    }
}

internal func applicationURL(for identifier: String) -> URL? {
    let trimmed = identifier.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.contains("/"), FileManager.default.fileExists(atPath: trimmed) {
        return URL(fileURLWithPath: trimmed)
    }
    if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: trimmed) {
        return url
    }
    let normalized = trimmed.lowercased()
    return installedApplicationURLs().first { url in
        let bundle = Bundle(url: url)
        let displayName = (bundle?.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String)
            ?? (bundle?.object(forInfoDictionaryKey: "CFBundleName") as? String)
            ?? url.deletingPathExtension().lastPathComponent
        return displayName.lowercased() == normalized
            || url.deletingPathExtension().lastPathComponent.lowercased() == normalized
    }
}

internal func installedApplicationURLs() -> [URL] {
    let roots = [
        URL(fileURLWithPath: "/Applications", isDirectory: true),
        URL(fileURLWithPath: "/System/Applications", isDirectory: true),
        FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Applications", isDirectory: true),
    ]
    var urls = Set<URL>()
    for root in roots where FileManager.default.fileExists(atPath: root.path) {
        guard let enumerator = FileManager.default.enumerator(
            at: root,
            includingPropertiesForKeys: [.isApplicationKey],
            options: [.skipsHiddenFiles, .skipsPackageDescendants]
        ) else { continue }
        for case let url as URL in enumerator where url.pathExtension.lowercased() == "app" {
            urls.insert(url.resolvingSymlinksInPath())
            enumerator.skipDescendants()
        }
    }
    for app in NSWorkspace.shared.runningApplications {
        if let url = app.bundleURL {
            urls.insert(url.resolvingSymlinksInPath())
        }
    }
    return urls.sorted { $0.path.localizedCaseInsensitiveCompare($1.path) == .orderedAscending }
}

internal func listTargetableApps() -> [[String: Any]] {
    let running = NSWorkspace.shared.runningApplications.filter { !$0.isTerminated }
    let runningBundleIDs = Set(running.compactMap(\.bundleIdentifier))
    var apps: [String: (name: String, running: Bool)] = [:]

    for url in installedApplicationURLs() {
        guard let bundle = Bundle(url: url),
              let bundleID = bundle.bundleIdentifier,
              !isBlocked(bundleId: bundleID) else {
            continue
        }
        let name = (bundle.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String)
            ?? (bundle.object(forInfoDictionaryKey: "CFBundleName") as? String)
            ?? url.deletingPathExtension().lastPathComponent
        apps[bundleID] = (name, runningBundleIDs.contains(bundleID))
    }
    for app in running {
        guard let bundleID = app.bundleIdentifier,
              !isBlocked(bundleId: bundleID),
              app.activationPolicy != .prohibited else {
            continue
        }
        apps[bundleID] = (app.localizedName ?? apps[bundleID]?.name ?? bundleID, true)
    }

    return apps.map { bundleID, app in
        [
            "id": bundleID,
            "displayName": app.name,
            "isRunning": app.running,
        ]
    }.sorted {
        ($0["displayName"] as? String ?? "").localizedCaseInsensitiveCompare(
            $1["displayName"] as? String ?? ""
        ) == .orderedAscending
    }
}

internal func launchApplication(for identifier: String) async throws {
    guard let url = applicationURL(for: identifier),
          let bundleID = Bundle(url: url)?.bundleIdentifier,
          !isBlocked(bundleId: bundleID) else {
        throw HelperError.invalidRequest(
            "App '\(identifier)' was not found. Call list_apps() to inspect targetable apps."
        )
    }
    let configuration = NSWorkspace.OpenConfiguration()
    configuration.activates = false
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        NSWorkspace.shared.openApplication(at: url, configuration: configuration) { _, error in
            if let error {
                continuation.resume(throwing: error)
            } else {
                continuation.resume(returning: ())
            }
        }
    }
}

internal func resolveAppWindow(_ identifier: String, launchIfNeeded: Bool = true) async throws -> ResolvedAppWindow {
    func resolve() async throws -> ResolvedAppWindow? {
        let content = try await availableContent()
        let windows = try matchingWindows(for: identifier, in: content)
        guard let window = try chooseWindow(windows, identifier: identifier),
              let processID = window.owningApplication?.processID else {
            return nil
        }
        return ResolvedAppWindow(
            content: content,
            window: window,
            target: target(for: window),
            processID: processID
        )
    }

    if let resolved = try await resolve() {
        return resolved
    }
    guard launchIfNeeded else {
        throw HelperError.invalidRequest(
            "App '\(identifier)' has no targetable window. Call list_apps() to confirm the app identifier."
        )
    }
    try await launchApplication(for: identifier)
    for _ in 0..<50 {
        if let resolved = try await resolve() {
            return resolved
        }
        try await Task.sleep(nanoseconds: 100_000_000)
    }
    throw HelperError.invalidRequest(
        "App '\(identifier)' launched but did not open a targetable window."
    )
}

internal func pointInWindow(
    x: Double?,
    y: Double?,
    resolved: ResolvedAppWindow
) throws -> CGPoint {
    guard let x, let y, x.isFinite, y.isFinite else {
        throw HelperError.invalidRequest("Pointer actions require finite x and y coordinates")
    }
    let width = Double(max(resolved.target.width, 1))
    let height = Double(max(resolved.target.height, 1))
    let localX = min(max(x, 0), width)
    let localY = min(max(y, 0), height)
    return CGPoint(
        x: resolved.window.frame.minX + localX / width * resolved.window.frame.width,
        y: resolved.window.frame.minY + localY / height * resolved.window.frame.height
    )
}

internal func performCoordinateClick(
    _ arguments: [String: Any],
    in resolved: ResolvedAppWindow
) throws {
    let rawCount = number(arguments, "click_count") ?? 1
    guard rawCount.isFinite,
          rawCount.rounded() == rawCount,
          rawCount >= 1,
          rawCount <= 10 else {
        throw HelperError.invalidRequest("click_count must be an integer from 1 through 10")
    }
    let x = number(arguments, "x")
    let y = number(arguments, "y")
    updateVirtualCursor(x, y, window: resolved.window, coordinateSpace: resolved.target)
    let location = try pointInWindow(x: x, y: y, resolved: resolved)
    try click(
        at: location,
        localPoint: CGPoint(
            x: location.x - resolved.window.frame.minX,
            y: location.y - resolved.window.frame.minY
        ),
        count: Int64(rawCount),
        button: mouseButton(arguments["mouse_button"] as? String),
        windowID: resolved.window.windowID,
        processID: resolved.processID
    )
}

internal func withInactiveElementRouting<T>(
    resolved: ResolvedAppWindow,
    element: AXUIElement,
    _ operation: () throws -> T
) throws -> T {
    let point = accessibilityFrameCenter(element) ?? CGPoint(
        x: resolved.window.frame.midX,
        y: resolved.window.frame.midY
    )
    return try withInactiveWindowRouting(
        processID: resolved.processID,
        windowID: resolved.window.windowID,
        globalPoint: point,
        localPoint: CGPoint(
            x: point.x - resolved.window.frame.minX,
            y: point.y - resolved.window.frame.minY
        ),
        operation
    )
}

internal func targetForApp(_ identifier: String) async throws -> Target {
    let content = try await availableContent()
    let normalized = identifier.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let windows = availableWindows(in: content)
    let matching = windows.filter { window in
        guard let app = window.owningApplication else { return false }
        let name = app.applicationName.lowercased()
        let bundle = app.bundleIdentifier.lowercased()
        let path = NSRunningApplication(processIdentifier: app.processID)?.bundleURL?.path.lowercased()
        return name == normalized || bundle == normalized || path == normalized
    }
    if let frontmost = NSWorkspace.shared.frontmostApplication,
       let window = matching.first(where: { $0.owningApplication?.processID == frontmost.processIdentifier }) {
        return target(for: window)
    }
    guard let window = matching.first else {
        throw HelperError.targetUnavailable
    }
    return target(for: window)
}

internal func processID(for target: Target) async throws -> pid_t {
    let content = try await availableContent()
    guard let window = availableWindows(in: content).first(where: { $0.windowID == target.windowId }),
          let processID = window.owningApplication?.processID else {
        throw HelperError.targetUnavailable
    }
    return processID
}
