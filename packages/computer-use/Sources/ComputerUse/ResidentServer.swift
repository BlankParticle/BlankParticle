import AppKit
import Darwin
import Foundation

internal let residentSocketPath = FileManager.default.temporaryDirectory
    .appendingPathComponent("com.blankparticle.computer-use", isDirectory: true)
    .appendingPathComponent("server.sock", isDirectory: false)
    .path

internal final class PermissionsWindowController: NSObject, NSWindowDelegate {
    static let shared = PermissionsWindowController()

    private let screenStatus = NSTextField(labelWithString: "")
    private let accessibilityStatus = NSTextField(labelWithString: "")
    private lazy var window = makeWindow()

    func show() {
        refresh()
        NSApplication.shared.setActivationPolicy(.regular)
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate()
    }

    func hide() {
        window.orderOut(nil)
        NSApplication.shared.setActivationPolicy(.accessory)
    }

    func windowWillClose(_ notification: Notification) {
        DispatchQueue.main.async {
            NSApplication.shared.setActivationPolicy(.accessory)
        }
    }

    func refresh() {
        let permissions = currentPermissions()
        screenStatus.stringValue = "Screen Recording: \(permissions.screenRecording ? "Granted" : "Not granted")"
        accessibilityStatus.stringValue = "Accessibility: \(permissions.accessibility ? "Granted" : "Not granted")"
    }

    @objc private func requestPermissions() {
        Task {
            _ = try? await ComputerControl.handle(Request(
                operation: "requestPermissions",
                target: nil,
                actions: nil
            ))
            refresh()
        }
    }

    private func makeWindow() -> NSWindow {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 440, height: 220),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.title = "Computer Use Permissions"
        window.isReleasedWhenClosed = false
        window.delegate = self

        let title = NSTextField(labelWithString: "macOS Permissions")
        title.font = .systemFont(ofSize: 20, weight: .semibold)
        let explanation = NSTextField(wrappingLabelWithString:
            "computer-use needs Screen Recording to inspect windows and Accessibility to interact with them."
        )
        explanation.textColor = .secondaryLabelColor
        let button = NSButton(
            title: "Request Permissions",
            target: self,
            action: #selector(requestPermissions)
        )
        button.bezelStyle = .rounded

        let stack = NSStackView(views: [title, explanation, screenStatus, accessibilityStatus, button])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        window.contentView = NSView()
        window.contentView?.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: window.contentView!.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: window.contentView!.trailingAnchor, constant: -24),
            stack.topAnchor.constraint(equalTo: window.contentView!.topAnchor, constant: 24),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: window.contentView!.bottomAnchor, constant: -24),
        ])
        return window
    }
}

internal final class ResidentAppDelegate: NSObject, NSApplicationDelegate {
    static let shared = ResidentAppDelegate()

    func installMenu() {
        let mainMenu = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu(title: "Computer Use")
        appMenu.addItem(
            withTitle: "About Computer Use",
            action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)),
            keyEquivalent: ""
        )
        appMenu.addItem(.separator())
        appMenu.addItem(
            withTitle: "Quit Computer Use",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        )
        appItem.submenu = appMenu
        mainMenu.addItem(appItem)
        NSApplication.shared.mainMenu = mainMenu
        NSAppleEventManager.shared().setEventHandler(
            self,
            andSelector: #selector(handleReopen(_:withReplyEvent:)),
            forEventClass: AEEventClass(kCoreEventClass),
            andEventID: AEEventID(kAEReopenApplication)
        )
        NSAppleEventManager.shared().setEventHandler(
            self,
            andSelector: #selector(handleQuit(_:withReplyEvent:)),
            forEventClass: AEEventClass(kCoreEventClass),
            andEventID: AEEventID(kAEQuitApplication)
        )
    }

    @objc private func handleReopen(
        _ event: NSAppleEventDescriptor,
        withReplyEvent reply: NSAppleEventDescriptor
    ) {
        PermissionsWindowController.shared.show()
    }

    @objc private func handleQuit(
        _ event: NSAppleEventDescriptor,
        withReplyEvent reply: NSAppleEventDescriptor
    ) {
        PermissionsWindowController.shared.hide()
    }

    func applicationShouldHandleReopen(
        _ sender: NSApplication,
        hasVisibleWindows flag: Bool
    ) -> Bool {
        PermissionsWindowController.shared.show()
        return true
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        PermissionsWindowController.shared.hide()
        return .terminateCancel
    }
}

internal extension ComputerControl {
    static func runResidentServer(showPermissions: Bool = false) {
        let run = {
            NSApplication.shared.setActivationPolicy(.accessory)
            NSApplication.shared.delegate = ResidentAppDelegate.shared
            ResidentAppDelegate.shared.installMenu()
            if showPermissions {
                PermissionsWindowController.shared.show()
            }
            Task.detached {
                do {
                    let listener = try UnixListener(path: residentSocketPath)
                    while true {
                        let channel = try listener.accept()
                        do {
                            try await serveResidentConnection(channel)
                        } catch {
                            try? writeLine(
                                try jsonString(["error": error.localizedDescription]),
                                to: channel
                            )
                        }
                        channel.closeFile()
                    }
                } catch {
                    FileHandle.standardError.write(Data("computer-use server: \(error.localizedDescription)\n".utf8))
                    exit(1)
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

    static func serveResidentConnection(_ channel: FileHandle) async throws {
        let peerPID = try peerProcessID(channel)
        if let failure = authorizationFailure(pid: peerPID) {
            throw HelperError.unauthorizedClient(failure)
        }
        guard let handshakeLine = readLine(from: channel),
              let data = handshakeLine.data(using: .utf8),
              let handshake = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let mode = handshake["mode"] as? String else {
            throw HelperError.ipc("missing client handshake")
        }
        switch mode {
        case "mcp":
            // The status agent owns both the menu-bar indicator and software
            // cursor overlays. Closing the MCP transport ends their lifetime;
            // a later session starts a fresh agent on its first UI operation.
            defer { StatusAgentProcess.shared.stop() }
            try await serveMCP(
                input: channel,
                output: channel,
                replMode: (handshake["replMode"] as? Bool) == true
            )
            await CaptureSessions.shared.stopAll()
        case "perms":
            DispatchQueue.main.async { PermissionsWindowController.shared.show() }
            _ = try await handle(Request(
                operation: "requestPermissions",
                target: nil,
                actions: nil
            ))
            let permissions = currentPermissions()
            DispatchQueue.main.async { PermissionsWindowController.shared.refresh() }
            try writeLine(try jsonString([
                "screenRecording": permissions.screenRecording,
                "accessibility": permissions.accessibility,
            ]), to: channel)
        case "status":
            let permissions = currentPermissions()
            try writeLine(try jsonString([
                "screenRecording": permissions.screenRecording,
                "accessibility": permissions.accessibility,
            ]), to: channel)
        case "showPermissions":
            DispatchQueue.main.async { PermissionsWindowController.shared.show() }
            try writeLine("{\"shown\":true}", to: channel)
        default:
            throw HelperError.ipc("unknown client mode: \(mode)")
        }
    }

    static func bridgeMCPToResident(replMode: Bool) async throws {
        let channel = try connectToResidentServer()
        defer { channel.closeFile() }
        try writeLine(try jsonString(["mode": "mcp", "replMode": replMode]), to: channel)
        while let line = readLine(from: .standardInput) {
            try writeLine(line, to: channel)
            guard let data = line.data(using: .utf8),
                  let message = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  message["id"] != nil else {
                continue
            }
            guard let response = readLine(from: channel) else {
                throw HelperError.ipc("resident app closed the MCP connection")
            }
            try writeLine(response, to: .standardOutput)
        }
    }

    static func residentPermissions(request: Bool) async throws -> Permissions {
        let channel = try connectToResidentServer()
        defer { channel.closeFile() }
        try writeLine(try jsonString(["mode": request ? "perms" : "status"]), to: channel)
        guard let line = readLine(from: channel),
              let data = line.data(using: .utf8),
              let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw HelperError.ipc("resident app returned no permission state")
        }
        return Permissions(
            screenRecording: value["screenRecording"] as? Bool ?? false,
            accessibility: value["accessibility"] as? Bool ?? false
        )
    }
}

internal func showPermissionsInRunningResident() async -> Bool {
    guard let channel = try? verifiedResidentChannel() else { return false }
    defer { channel.closeFile() }
    do {
        try writeLine("{\"mode\":\"showPermissions\"}", to: channel)
        return readLine(from: channel) != nil
    } catch {
        return false
    }
}

internal func connectToResidentServer() throws -> FileHandle {
    if let channel = try? verifiedResidentChannel() { return channel }
    let app = try containingApplicationBundleURL()
    let launcher = Process()
    launcher.executableURL = URL(fileURLWithPath: "/usr/bin/open")
    launcher.arguments = ["-n", "-g", app.path, "--args", "server"]
    launcher.standardInput = FileHandle.nullDevice
    launcher.standardOutput = FileHandle.nullDevice
    launcher.standardError = FileHandle.nullDevice
    try launcher.run()

    for _ in 0..<100 {
        usleep(50_000)
        if let channel = try? verifiedResidentChannel() { return channel }
    }
    throw HelperError.ipc("resident app did not start")
}

private func verifiedResidentChannel() throws -> FileHandle {
    let (channel, peerPID) = try connectedChannel(at: residentSocketPath)
    if let failure = authorizationFailure(pid: peerPID) {
        channel.closeFile()
        throw HelperError.unauthorizedClient(failure)
    }
    return channel
}

private func peerProcessID(_ channel: FileHandle) throws -> pid_t {
    var processID: pid_t = 0
    var size = socklen_t(MemoryLayout.size(ofValue: processID))
    guard getsockopt(channel.fileDescriptor, SOL_LOCAL, LOCAL_PEERPID, &processID, &size) == 0 else {
        throw HelperError.ipc("could not identify the client process")
    }
    return processID
}
