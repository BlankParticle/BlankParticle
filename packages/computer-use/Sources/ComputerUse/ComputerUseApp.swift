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

@main
struct ComputerControl {
    static func main() async {
        let command = CommandLine.arguments.dropFirst().first

        if command == nil, getppid() == 1 {
            if await showPermissionsInRunningResident() {
                exit(0)
            }
            runResidentServer(showPermissions: true)
            return
        }

        if command == "status-agent" {
            serveStatusAgent()
            return
        }

        if command == "server" {
            runResidentServer()
            return
        }

        switch command {
        case nil, "help", "--help", "-h":
            printHelp(to: .standardOutput)
        case "perms":
            await runPermissionsCommand()
        case "status":
            do {
                printPermissions(try await residentPermissions(request: false))
            } catch {
                FileHandle.standardError.write(Data("\(helperDisplayName): \(error.localizedDescription)\n".utf8))
                exit(1)
            }
        case "mcp":
            do {
                try await bridgeMCPToResident(
                    replMode: CommandLine.arguments.dropFirst(2).contains("--repl-mode")
                )
            } catch {
                FileHandle.standardError.write(Data("\(helperDisplayName): \(error.localizedDescription)\n".utf8))
                exit(1)
            }
        default:
            FileHandle.standardError.write(Data("Unknown command: \(command!)\n\n".utf8))
            printHelp(to: .standardError)
            exit(2)
        }
    }

    static func printHelp(to output: FileHandle) {
        let help = """
        Usage: computer-use <command>

        Commands:
          mcp       Start the stdio MCP server
          perms     Request and check macOS permissions
          status    Check macOS permissions without prompting
          help      Show this help menu

        MCP options:
          --repl-mode   Expose a persistent QuickJS REPL instead of granular tools

        """
        try? output.write(contentsOf: Data(help.utf8))
    }

    static func printPermissions(_ permissions: Permissions) {
        print("Screen Recording: \(permissions.screenRecording ? "granted" : "not granted")")
        print("Accessibility: \(permissions.accessibility ? "granted" : "not granted")")
    }

    static func runPermissionsCommand() async {
        do {
            let permissions = try await residentPermissions(request: true)
            printPermissions(permissions)
            if !permissions.screenRecording || !permissions.accessibility {
                print("Permission prompts were requested. Grant access in System Settings, then run `computer-use perms` again to check.")
            }
        } catch {
            FileHandle.standardError.write(Data("\(helperDisplayName): \(error.localizedDescription)\n".utf8))
            exit(1)
        }
    }

    static func serveOneShot(
        input: FileHandle,
        output: FileHandle,
        authorizationFailure: String? = nil
    ) async throws {
        let response: Response
        do {
            let data = input.readDataToEndOfFile()
            let request = try JSONDecoder().decode(Request.self, from: data)
            if let authorizationFailure {
                response = .failure(HelperError.unauthorizedClient(authorizationFailure))
            } else {
                response = try await handle(request)
            }
        } catch {
            response = .failure(error)
        }

        try write(response, to: output)
    }

    static func serveStatusAgent() {
        let run = {
            NSApplication.shared.setActivationPolicy(.accessory)
            DispatchQueue.global(qos: .utility).async {
                while let line = readLine(from: .standardInput) {
                    guard let data = line.data(using: .utf8),
                          let message = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                    else {
                        continue
                    }
                    DispatchQueue.main.async {
                        switch message["type"] as? String {
                        case "cursor":
                            guard let windowID = (message["windowID"] as? NSNumber)?.uint32Value,
                                  let processID = (message["processID"] as? NSNumber)?.int32Value,
                                  let windowLayer = (message["windowLayer"] as? NSNumber)?.intValue,
                                  let normalizedX = (message["normalizedX"] as? NSNumber)?.doubleValue,
                                  let normalizedY = (message["normalizedY"] as? NSNumber)?.doubleValue,
                                  let x = (message["x"] as? NSNumber)?.doubleValue,
                                  let y = (message["y"] as? NSNumber)?.doubleValue else {
                                return
                            }
                            SoftwareCursorOverlay.shared.show(
                                windowID: windowID,
                                processID: processID,
                                windowLayer: windowLayer,
                                normalizedPoint: CGPoint(x: normalizedX, y: normalizedY),
                                fallbackScreenPoint: CGPoint(x: x, y: y)
                            )
                        case "cursor-press":
                            guard let windowID = (message["windowID"] as? NSNumber)?.uint32Value,
                                  let pressed = message["pressed"] as? Bool else {
                                return
                            }
                            SoftwareCursorOverlay.shared.setPressed(
                                windowID: windowID,
                                pressed: pressed
                            )
                        default:
                            guard let bundleID = message["bundleID"] as? String,
                                  let name = message["name"] as? String else {
                                return
                            }
                            ComputerUseStatusItem.shared.track(bundleID: bundleID, name: name)
                        }
                    }
                }
                DispatchQueue.main.async {
                    NSApplication.shared.terminate(nil)
                }
            }
            NSApplication.shared.run()
        }
        if Thread.isMainThread {
            run()
        } else {
            DispatchQueue.main.sync(execute: run)
        }
    }

    static func serveSession(
        input: FileHandle,
        output: FileHandle,
        authorizationFailure: String? = nil
    ) async throws {
        defer { TargetProcessInputRouting.deactivateCurrentRoute() }
        while let payload = try readFrame(from: input) {
            let response: Response
            do {
                let request = try JSONDecoder().decode(Request.self, from: payload)
                if let authorizationFailure {
                    response = .failure(HelperError.unauthorizedClient(authorizationFailure))
                } else {
                    response = try await handle(request)
                }
            } catch {
                response = .failure(error)
            }
            try writeFrame(response, to: output)
        }
    }

    static func handle(_ request: Request) async throws -> Response {
        switch request.operation {
        case "status":
            return Response(
                success: true,
                error: nil,
                permissions: currentPermissions(),
                targets: nil,
                target: nil,
                imageUrl: nil,
                summary: nil
            )
        case "requestPermissions":
            _ = CGRequestScreenCaptureAccess()
            // Exercise the same ScreenCaptureKit path used for window state.
            // On macOS this is what registers the app as a screen-content
            // capture client; Accessibility and Screen Recording are separate
            // TCC services and one does not register the other.
            _ = try? await availableContent()
            let prompt = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
            _ = AXIsProcessTrustedWithOptions(prompt)
            return Response(
                success: true,
                error: nil,
                permissions: currentPermissions(),
                targets: nil,
                target: nil,
                imageUrl: nil,
                summary: "macOS permission prompts requested."
            )
        case "listTargets":
            guard CGPreflightScreenCaptureAccess() else {
                throw HelperError.missingPermission("Screen Recording")
            }
            let content = try await availableContent()
            let windows = availableWindows(in: content)
            return Response(
                success: true,
                error: nil,
                permissions: currentPermissions(),
                targets: windows.map { target(for: $0, includeTitle: false) },
                target: nil,
                imageUrl: nil,
                summary: nil
            )
        case "use":
            guard let requested = request.target else {
                throw HelperError.invalidRequest("use requires a target")
            }
            let actions = request.actions ?? []
            guard actions.count <= 16 else {
                throw HelperError.invalidRequest("A computer-use call may contain at most 16 actions")
            }
            guard CGPreflightScreenCaptureAccess() else {
                throw HelperError.missingPermission("Screen Recording")
            }
            guard actions.isEmpty || AXIsProcessTrusted() else {
                throw HelperError.missingPermission("Accessibility")
            }
            let content = try await availableContent()
            guard let window = availableWindows(in: content).first(where: { $0.windowID == requested.windowId }) else {
                throw HelperError.targetUnavailable
            }
            let current = target(for: window)
            guard !isBlocked(bundleId: current.bundleId) else {
                throw HelperError.targetBlocked
            }
            guard current.bundleId == requested.bundleId,
                  requested.teamId == nil || current.teamId == requested.teamId else {
                throw HelperError.targetIdentityChanged
            }
            guard let display = captureDisplay(for: window, in: content.displays) else {
                throw HelperError.targetUnavailable
            }
            let filter = SCContentFilter(display: display, including: [window])
            let sourceRect = captureSourceRect(for: window, on: display)
            BridgeProcessRegistration.shared.activate()
            try await CaptureSessions.shared.start(
                for: window,
                filter: filter,
                sourceRect: sourceRect,
                target: current
            )
            if !actions.isEmpty {
                try perform(actions, in: window, coordinateSpace: requested)
            }
            StatusAgentProcess.shared.track(bundleID: current.bundleId, name: current.appName)
            let cursor = VirtualCursorStore.shared.position(
                for: window.windowID,
                size: CGSize(width: CGFloat(requested.width), height: CGFloat(requested.height))
            )
            let captured: Capture
            do {
                captured = try await capture(
                    window,
                    filter: filter,
                    sourceRect: sourceRect,
                    cursor: cursor,
                    coordinateSpace: requested
                )
            } catch {
                await CaptureSessions.shared.stopAll()
                throw error
            }
            await CaptureSessions.shared.stopAll()
            let capturedTarget = Target(
                windowId: current.windowId,
                bundleId: current.bundleId,
                teamId: current.teamId,
                appName: current.appName,
                windowTitle: current.windowTitle,
                width: UInt32(captured.width),
                height: UInt32(captured.height)
            )
            ComputerUsePreviewStore.publish(target: capturedTarget, capture: captured)
            return Response(
                success: true,
                error: nil,
                permissions: currentPermissions(),
                targets: nil,
                target: capturedTarget,
                imageUrl: captured.dataUrl,
                summary: actions.isEmpty ? "Captured \(current.appName)." : "Completed \(actions.count) action\(actions.count == 1 ? "" : "s") in \(current.appName)."
            )
        default:
            throw HelperError.invalidRequest("Unknown operation: \(request.operation)")
        }
    }

    static func serveMCP(
        input: FileHandle,
        output: FileHandle,
        replMode: Bool = false
    ) async throws {
        // The inactive-window route is intentionally shared by every action in
        // this MCP session. Tear it down once when the session ends, never once
        // per pen stroke; per-action activation/deactivation repaints Chromium
        // browser chrome and is visible as toolbar blinking.
        defer { TargetProcessInputRouting.deactivateCurrentRoute() }
        let repl = replMode ? try QuickJSRepl() : nil
        while let line = readLine(from: input) {
            guard let data = line.data(using: .utf8),
                  let message = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let method = message["method"] as? String else {
                continue
            }
            let id = message["id"]
            if method == "notifications/initialized" || method == "notifications/cancelled" {
                continue
            }

            do {
                let result: [String: Any]
                switch method {
                case "initialize":
                    result = [
                        "protocolVersion": "2025-06-18",
                        "capabilities": ["tools": ["listChanged": false]],
                        "serverInfo": ["name": "computer-use", "version": "1.0.0"],
                    ]
                case "tools/list":
                    result = ["tools": replMode ? replTools() : mcpTools()]
                case "tools/call":
                    guard let params = message["params"] as? [String: Any],
                          let name = params["name"] as? String else {
                        throw HelperError.invalidRequest("tools/call requires a tool name")
                    }
                    let arguments = params["arguments"] as? [String: Any] ?? [:]
                    if let repl {
                        guard name == "repl" else {
                            throw HelperError.invalidRequest("REPL mode only exposes the repl tool")
                        }
                        result = try replMCPResult(repl.evaluate(try requiredString(arguments, "code")))
                    } else {
                        result = try await callMCPTool(name: name, arguments: arguments)
                    }
                default:
                    throw HelperError.invalidRequest("Unsupported MCP method: \(method)")
                }
                if let id {
                    try writeMCP(["jsonrpc": "2.0", "id": id, "result": result], to: output)
                }
            } catch {
                if let id {
                    try writeMCP(
                        [
                            "jsonrpc": "2.0",
                            "id": id,
                            "error": ["code": -32603, "message": error.localizedDescription],
                        ],
                        to: output
                    )
                }
            }
        }
    }

    internal static func callMCPTool(name: String, arguments: [String: Any]) async throws -> [String: Any] {
        switch name {
        case "list_apps":
            let apps = listTargetableApps()
            return mcpResult(text: try jsonString(apps), structured: ["apps": apps])

        case "get_accessibility_tree":
            guard AXIsProcessTrusted() else {
                throw HelperError.missingPermission("Accessibility")
            }
            let app = try requiredString(arguments, "app")
            let resolved = try await resolveAppWindow(app)
            StatusAgentProcess.shared.track(bundleID: resolved.target.bundleId, name: resolved.target.appName)
            let tree = accessibilityText(for: resolved)
            return mcpResult(text: tree, structured: ["app": app, "tree": tree])

        case "get_accessibility_node":
            guard AXIsProcessTrusted() else {
                throw HelperError.missingPermission("Accessibility")
            }
            let app = try requiredString(arguments, "app")
            let resolved = try await resolveAppWindow(app)
            let index = try elementIndex(arguments["element_index"] as Any)
            guard AccessibilityRegistry.shared.belongs(
                bundleID: resolved.target.bundleId,
                processID: resolved.processID,
                windowID: resolved.target.windowId
            ), let element = AccessibilityRegistry.shared.element(for: index) else {
                throw HelperError.invalidRequest("Element \(index) is stale. Call get_accessibility_tree again.")
            }
            let node = try accessibilityNode(element, index: index)
            return mcpResult(text: try jsonString(node), structured: ["node": node])

        case "click", "drag", "press_key", "type_text":
            guard AXIsProcessTrusted() else {
                throw HelperError.missingPermission("Accessibility")
            }
            let app = try requiredString(arguments, "app")
            let resolved = try await resolveAppWindow(app)
            if name == "click", let rawIndex = arguments["element_index"] {
                let index = try elementIndex(rawIndex)
                guard AccessibilityRegistry.shared.belongs(
                    bundleID: resolved.target.bundleId,
                    processID: resolved.processID,
                    windowID: resolved.target.windowId
                ),
                      let element = AccessibilityRegistry.shared.element(for: index) else {
                    throw HelperError.invalidRequest("Element (index) is stale. Call get_accessibility_tree again.")
                }
                let rawCount = number(arguments, "click_count") ?? 1
                guard rawCount.isFinite,
                      rawCount.rounded() == rawCount,
                      rawCount >= 1,
                      rawCount <= 10 else {
                    throw HelperError.invalidRequest(
                        "click_count must be an integer from 1 through 10"
                    )
                }
                let button = mouseButton(arguments["mouse_button"] as? String)
                if let location = accessibilityFrameCenter(element) {
                    updateVirtualCursor(
                        atGlobalPoint: location,
                        window: resolved.window,
                        coordinateSpace: resolved.target
                    )
                }
                if button == .left, rawCount == 1 {
                    StatusAgentProcess.shared.setCursorPressed(
                        windowID: resolved.window.windowID,
                        pressed: true
                    )
                    usleep(65_000)
                    defer {
                        StatusAgentProcess.shared.setCursorPressed(
                            windowID: resolved.window.windowID,
                            pressed: false
                        )
                    }
                    try withInactiveElementRouting(
                        resolved: resolved,
                        element: element
                    ) {
                        try performAccessibilityAction(element, name: kAXPressAction)
                    }
                } else {
                    guard let location = accessibilityFrameCenter(element) else {
                        throw HelperError.invalidRequest(
                            "Element \(index) has no clickable position"
                        )
                    }
                    try click(
                        at: location,
                        localPoint: CGPoint(
                            x: location.x - resolved.window.frame.minX,
                            y: location.y - resolved.window.frame.minY
                        ),
                        count: Int64(rawCount),
                        button: button,
                        windowID: resolved.window.windowID,
                        processID: resolved.processID
                    )
                }
                RecentComputerActionStore.shared.record(resolved.target.bundleId)
                return mcpResult(text: "")
            }
            switch name {
            case "click":
                try performCoordinateClick(arguments, in: resolved)
            case "drag":
                try perform(
                    [Action(
                        type: "drag",
                        x: number(arguments, "from_x"),
                        y: number(arguments, "from_y"),
                        toX: number(arguments, "to_x"),
                        toY: number(arguments, "to_y"),
                        deltaX: nil,
                        deltaY: nil,
                        text: nil,
                        key: nil,
                        modifiers: nil,
                        mouseButton: nil,
                        durationMs: nil
                    )],
                    in: resolved.window,
                    coordinateSpace: resolved.target
                )
            case "press_key":
                let keyParts = try keyAndModifiers(try requiredString(arguments, "key"))
                let globalPoint = CGPoint(
                    x: resolved.window.frame.midX,
                    y: resolved.window.frame.midY
                )
                try withInactiveWindowRouting(
                    processID: resolved.processID,
                    windowID: resolved.window.windowID,
                    globalPoint: globalPoint,
                    localPoint: CGPoint(
                        x: resolved.window.frame.width / 2,
                        y: resolved.window.frame.height / 2
                    )
                ) {
                    try pressKey(
                        keyParts.key,
                        modifiers: keyParts.modifiers,
                        processID: resolved.processID
                    )
                }
            default:
                let globalPoint = CGPoint(
                    x: resolved.window.frame.midX,
                    y: resolved.window.frame.midY
                )
                try withInactiveWindowRouting(
                    processID: resolved.processID,
                    windowID: resolved.window.windowID,
                    globalPoint: globalPoint,
                    localPoint: CGPoint(
                        x: resolved.window.frame.width / 2,
                        y: resolved.window.frame.height / 2
                    )
                ) {
                    try typeText(
                        try requiredString(arguments, "text"),
                        processID: resolved.processID
                    )
                }
            }
            RecentComputerActionStore.shared.record(resolved.target.bundleId)
            return mcpResult(text: "")

        case "perform_secondary_action", "set_value", "select_text", "scroll":
            guard AXIsProcessTrusted() else {
                throw HelperError.missingPermission("Accessibility")
            }
            let app = try requiredString(arguments, "app")
            let resolved = try await resolveAppWindow(app)
            let index = try elementIndex(arguments["element_index"] as Any)
            guard AccessibilityRegistry.shared.belongs(
                bundleID: resolved.target.bundleId,
                processID: resolved.processID,
                windowID: resolved.target.windowId
            ) else {
                throw HelperError.invalidRequest("Element (index) is stale. Call get_accessibility_tree again.")
            }
            guard let element = AccessibilityRegistry.shared.element(for: index) else {
                throw HelperError.invalidRequest("Element \(index) is stale. Call get_accessibility_tree again.")
            }
            try withInactiveElementRouting(
                resolved: resolved,
                element: element
            ) {
                switch name {
                case "perform_secondary_action":
                    try performAccessibilityAction(
                        element,
                        matching: try requiredString(arguments, "action")
                    )
                case "set_value":
                    let value = try requiredString(arguments, "value")
                    guard AXUIElementSetAttributeValue(
                        element,
                        kAXValueAttribute as CFString,
                        value as CFTypeRef
                    ) == .success else {
                        throw HelperError.invalidRequest(
                            "Element \(index) does not accept a value"
                        )
                    }
                case "select_text":
                    try selectText(arguments, in: element)
                default:
                    try scrollAccessibility(
                        arguments,
                        element: element,
                        processID: resolved.processID
                    )
                }
            }
            RecentComputerActionStore.shared.record(resolved.target.bundleId)
            return mcpResult(text: "")

        default:
            throw HelperError.invalidRequest("Unknown MCP tool: \(name)")
        }
    }
}
