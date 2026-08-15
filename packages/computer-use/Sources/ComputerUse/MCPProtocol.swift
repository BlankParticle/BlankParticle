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

internal func commandLineArgument(_ name: String) -> String? {
    guard let index = CommandLine.arguments.firstIndex(of: name),
          CommandLine.arguments.indices.contains(index + 1) else {
        return nil
    }
    return CommandLine.arguments[index + 1]
}

internal func socketPathArgument() -> String? {
    commandLineArgument("--socket")
}

internal final class AccessibilityRegistry {
    static let shared = AccessibilityRegistry()

    private var elements: [String: AXUIElement] = [:]
    private var orderedElements: [(String, AXUIElement)] = []
    private var bundleID: String?
    private var processID: pid_t?
    private var windowID: CGWindowID?
    private let lock = NSLock()

    func reset(bundleID: String, processID: pid_t, windowID: CGWindowID) {
        lock.lock()
        elements.removeAll(keepingCapacity: true)
        orderedElements.removeAll(keepingCapacity: true)
        self.bundleID = bundleID
        self.processID = processID
        self.windowID = windowID
        lock.unlock()
    }

    func add(_ element: AXUIElement) -> String {
        lock.lock()
        defer { lock.unlock() }
        let index = String(elements.count)
        elements[index] = element
        orderedElements.append((index, element))
        return index
    }

    func index(for element: AXUIElement) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return orderedElements.first(where: { CFEqual($0.1, element) })?.0
    }

    func element(for index: String) -> AXUIElement? {
        lock.lock()
        defer { lock.unlock() }
        return elements[index]
    }

    func belongs(bundleID: String, processID: pid_t, windowID: CGWindowID) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return self.bundleID == bundleID
            && self.processID == processID
            && self.windowID == windowID
    }
}

internal func mcpTools() -> [[String: Any]] {
    let app = ["type": "string", "description": "App name, full app path, or unambiguous bundle identifier"] as [String: Any]
    let element = ["type": "integer", "description": "Element index from get_accessibility_tree"] as [String: Any]
    let coordinate = ["type": "number"] as [String: Any]
    return [
        [
            "name": "list_apps",
            "description": "List the visible apps currently running on this Mac.",
            "inputSchema": ["type": "object", "additionalProperties": false, "properties": [:]],
            "annotations": ["readOnlyHint": true, "idempotentHint": true, "openWorldHint": false, "destructiveHint": false],
        ],
        [
            "name": "get_accessibility_tree",
            "description": "Get only the app's compact accessibility tree. Call this before inspecting or interacting with nodes.",
            "inputSchema": ["type": "object", "additionalProperties": false, "required": ["app"], "properties": ["app": app]],
            "annotations": ["readOnlyHint": true, "idempotentHint": true, "openWorldHint": false, "destructiveHint": false],
        ],
        [
            "name": "get_accessibility_node",
            "description": "Get detailed, current metadata for one node from the latest accessibility tree.",
            "inputSchema": ["type": "object", "additionalProperties": false, "required": ["app", "element_index"], "properties": ["app": app, "element_index": element]],
            "annotations": ["readOnlyHint": true, "idempotentHint": true, "openWorldHint": false, "destructiveHint": false],
        ],
        [
            "name": "click",
            "description": "Click an app at screenshot pixel coordinates.",
            "inputSchema": ["type": "object", "additionalProperties": false, "required": ["app"], "properties": ["app": app, "element_index": element, "x": coordinate, "y": coordinate, "click_count": ["type": "integer", "minimum": 1], "mouse_button": ["type": "string", "enum": ["left", "right", "middle", "l", "r", "m"]]]],
            "annotations": ["readOnlyHint": false, "idempotentHint": false, "openWorldHint": false, "destructiveHint": false],
        ],
        [
            "name": "drag",
            "description": "Drag between screenshot pixel coordinates.",
            "inputSchema": ["type": "object", "additionalProperties": false, "required": ["app", "from_x", "from_y", "to_x", "to_y"], "properties": ["app": app, "from_x": coordinate, "from_y": coordinate, "to_x": coordinate, "to_y": coordinate]],
            "annotations": ["readOnlyHint": false, "idempotentHint": false, "openWorldHint": false, "destructiveHint": false],
        ],
        [
            "name": "press_key",
            "description": "Press a key or key combination in the app.",
            "inputSchema": ["type": "object", "additionalProperties": false, "required": ["app", "key"], "properties": ["app": app, "key": ["type": "string"]]],
            "annotations": ["readOnlyHint": false, "idempotentHint": false, "openWorldHint": false, "destructiveHint": false],
        ],
        [
            "name": "type_text",
            "description": "Type literal text into the app.",
            "inputSchema": ["type": "object", "additionalProperties": false, "required": ["app", "text"], "properties": ["app": app, "text": ["type": "string"]]],
            "annotations": ["readOnlyHint": false, "idempotentHint": false, "openWorldHint": false, "destructiveHint": false],
        ],
        [
            "name": "perform_secondary_action",
            "description": "Invoke a secondary accessibility action exposed by an element.",
            "inputSchema": ["type": "object", "additionalProperties": false, "required": ["app", "element_index", "action"], "properties": ["app": app, "element_index": element, "action": ["type": "string"]]],
            "annotations": ["readOnlyHint": false, "idempotentHint": false, "openWorldHint": false, "destructiveHint": false],
        ],
        [
            "name": "set_value",
            "description": "Set the value of a settable accessibility element.",
            "inputSchema": ["type": "object", "additionalProperties": false, "required": ["app", "element_index", "value"], "properties": ["app": app, "element_index": element, "value": ["type": "string"]]],
            "annotations": ["readOnlyHint": false, "idempotentHint": false, "openWorldHint": false, "destructiveHint": false],
        ],
        [
            "name": "select_text",
            "description": "Select matching text in an accessibility element.",
            "inputSchema": ["type": "object", "additionalProperties": false, "required": ["app", "element_index", "text"], "properties": ["app": app, "element_index": element, "text": ["type": "string"], "prefix": ["type": "string"], "suffix": ["type": "string"], "selection_type": ["type": "string", "enum": ["text", "cursor_before", "cursor_after"]]]],
            "annotations": ["readOnlyHint": false, "idempotentHint": false, "openWorldHint": false, "destructiveHint": false],
        ],
        [
            "name": "scroll",
            "description": "Scroll an accessibility element in a direction.",
            "inputSchema": ["type": "object", "additionalProperties": false, "required": ["app", "element_index", "direction"], "properties": ["app": app, "element_index": element, "direction": ["type": "string", "enum": ["up", "down", "left", "right", "u", "d", "l", "r"]], "pages": ["type": "number", "exclusiveMinimum": 0]]],
            "annotations": ["readOnlyHint": false, "idempotentHint": false, "openWorldHint": false, "destructiveHint": false],
        ],
    ]
}

internal func readLine(from input: FileHandle) -> String? {
    var data = Data()
    while true {
        guard let byte = try? input.read(upToCount: 1), !byte.isEmpty else {
            return data.isEmpty ? nil : String(data: data, encoding: .utf8)
        }
        if byte[0] == 10 {
            return String(data: data, encoding: .utf8)
        }
        data.append(byte[0])
    }
}

internal func writeLine(_ line: String, to output: FileHandle) throws {
    try output.write(contentsOf: Data(line.utf8))
    try output.write(contentsOf: Data([10]))
}

internal func writeMCP(_ object: [String: Any], to output: FileHandle) throws {
    let data = try JSONSerialization.data(withJSONObject: object, options: [.withoutEscapingSlashes])
    try output.write(contentsOf: data)
    try output.write(contentsOf: Data([10]))
}

internal func mcpResult(text: String, imageURL: String? = nil, structured: [String: Any]? = nil) -> [String: Any] {
    var content: [[String: Any]] = [["type": "text", "text": text]]
    if let imageURL,
       let comma = imageURL.firstIndex(of: ","),
       let data = Data(base64Encoded: String(imageURL[imageURL.index(after: comma)...])) {
        content.append(["type": "image", "data": data.base64EncodedString(), "mimeType": "image/png"])
    }
    var result: [String: Any] = ["content": content, "isError": false]
    if let structured { result["structuredContent"] = structured }
    return result
}

internal func requiredString(_ arguments: [String: Any], _ name: String) throws -> String {
    guard let value = arguments[name] as? String,
          !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        throw HelperError.invalidRequest("\(name) is required")
    }
    return value
}

internal func elementIndex(_ value: Any) throws -> String {
    if let value = value as? String, !value.isEmpty { return value }
    if let value = value as? NSNumber { return value.stringValue }
    throw HelperError.invalidRequest("Missing element_index")
}

internal func number(_ arguments: [String: Any], _ name: String) -> Double? {
    if let value = arguments[name] as? Double { return value }
    if let value = arguments[name] as? NSNumber { return value.doubleValue }
    return nil
}

internal func keyAndModifiers(_ value: String) throws -> (key: String, modifiers: [String]) {
    let parts = value.split(separator: "+", omittingEmptySubsequences: false)
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
    guard let key = parts.last, !key.isEmpty else {
        throw HelperError.invalidRequest("Key is empty")
    }
    let modifiers = parts.dropLast().map { part -> String in
        switch part.lowercased() {
        case "cmd", "command", "command_l", "command_r", "super", "super_l", "super_r", "meta":
            return "command"
        case "ctrl", "control", "control_l", "control_r":
            return "control"
        case "alt", "alt_l", "alt_r", "option", "option_l", "option_r":
            return "option"
        case "shift", "shift_l", "shift_r":
            return "shift"
        default: return part
        }
    }
    return (key, modifiers)
}

internal func jsonString(_ value: Any) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    return String(decoding: data, as: UTF8.self)
}

internal func jsonObject<T: Encodable>(_ value: T) throws -> [String: Any] {
    let data = try JSONEncoder().encode(value)
    guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        throw HelperError.invalidRequest("Could not encode response")
    }
    return object
}

internal func write(_ response: Response, to output: FileHandle) throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.withoutEscapingSlashes]
    try output.write(contentsOf: encoder.encode(response))
}

internal func readFrame(from input: FileHandle) throws -> Data? {
    guard let header = try readExactly(4, from: input) else {
        return nil
    }
    let bytes = [UInt8](header)
    let length =
        Int(bytes[0]) << 24
        | Int(bytes[1]) << 16
        | Int(bytes[2]) << 8
        | Int(bytes[3])
    guard length <= 24 * 1024 * 1024 else {
        throw HelperError.ipc("request is too large")
    }
    return try readExactly(length, from: input)
}

internal func readExactly(_ count: Int, from input: FileHandle) throws -> Data? {
    var data = Data()
    while data.count < count {
        let chunk = try input.read(upToCount: count - data.count) ?? Data()
        if chunk.isEmpty {
            if data.isEmpty {
                return nil
            }
            throw HelperError.ipc("the client connection closed mid-message")
        }
        data.append(chunk)
    }
    return data
}

internal func writeFrame(_ response: Response, to output: FileHandle) throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.withoutEscapingSlashes]
    let payload = try encoder.encode(response)
    try writeFrame(payload, to: output)
}

internal func writeFrame(_ payload: Data, to output: FileHandle) throws {
    guard let length = UInt32(exactly: payload.count) else {
        throw HelperError.ipc("response is too large")
    }
    var bigEndianLength = length.bigEndian
    try withUnsafeBytes(of: &bigEndianLength) { header in
        try output.write(contentsOf: header)
    }
    try output.write(contentsOf: payload)
}

internal final class UnixListener {
    let path: String
    private var descriptor: Int32

    init(path requestedPath: String? = nil) throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("com.blankparticle.computer-use", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try FileManager.default.setAttributes(
            [.posixPermissions: 0o700],
            ofItemAtPath: directory.path
        )
        path = requestedPath ?? directory.appendingPathComponent(UUID().uuidString).path
        descriptor = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard descriptor >= 0 else {
            throw HelperError.ipc(String(cString: strerror(errno)))
        }

        do {
            var address = sockaddr_un()
            let pathBytes = Array(path.utf8CString)
            guard pathBytes.count <= MemoryLayout.size(ofValue: address.sun_path) else {
                throw HelperError.ipc("socket path is too long")
            }
            address.sun_family = sa_family_t(AF_UNIX)
            address.sun_len = UInt8(MemoryLayout<sockaddr_un>.size)
            path.withCString { source in
                withUnsafeMutablePointer(to: &address.sun_path) { pointer in
                    pointer.withMemoryRebound(to: CChar.self, capacity: pathBytes.count) { destination in
                        _ = strlcpy(destination, source, pathBytes.count)
                    }
                }
            }
            Darwin.unlink(path)
            let bound = withUnsafePointer(to: &address) { pointer in
                pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { socketAddress in
                    Darwin.bind(descriptor, socketAddress, socklen_t(MemoryLayout<sockaddr_un>.size))
                }
            }
            guard bound == 0 else {
                throw HelperError.ipc(String(cString: strerror(errno)))
            }
            chmod(path, 0o600)
            guard Darwin.listen(descriptor, 1) == 0 else {
                throw HelperError.ipc(String(cString: strerror(errno)))
            }
        } catch {
            close()
            throw error
        }
    }

    func accept() throws -> FileHandle {
        let connection = Darwin.accept(descriptor, nil, nil)
        guard connection >= 0 else {
            throw HelperError.ipc(String(cString: strerror(errno)))
        }
        return FileHandle(fileDescriptor: connection, closeOnDealloc: true)
    }

    func close() {
        if descriptor >= 0 {
            Darwin.close(descriptor)
            descriptor = -1
        }
        Darwin.unlink(path)
    }
}

internal func launchSelfThroughLaunchServices(arguments: [String], background: Bool = true) throws -> Process {
    let applicationBundle = try containingApplicationBundleURL()
    let launcher = Process()
    launcher.executableURL = URL(fileURLWithPath: "/usr/bin/open")
    launcher.arguments = ["-n", "-W"]
        + (background ? ["-g"] : [])
        + [applicationBundle.path, "--args"]
        + arguments
    launcher.standardInput = FileHandle.nullDevice
    launcher.standardOutput = FileHandle.nullDevice
    launcher.standardError = FileHandle.nullDevice
    try launcher.run()
    return launcher
}

internal func containingApplicationBundleURL() throws -> URL {
    let executable = URL(fileURLWithPath: CommandLine.arguments[0])
        .standardizedFileURL
        .resolvingSymlinksInPath()
    let contents = executable
        .deletingLastPathComponent()
        .deletingLastPathComponent()
    let application = contents.deletingLastPathComponent()
    guard contents.lastPathComponent == "Contents",
          application.pathExtension.lowercased() == "app",
          FileManager.default.fileExists(atPath: application.path) else {
        throw HelperError.ipc(
            "could not resolve the Computer Use app bundle from \(executable.path)"
        )
    }
    return application
}

internal func connectedChannel(at path: String) throws -> (FileHandle, pid_t) {
    let descriptor = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
    guard descriptor >= 0 else {
        throw HelperError.ipc(String(cString: strerror(errno)))
    }

    do {
        var address = sockaddr_un()
        let pathBytes = Array(path.utf8CString)
        guard pathBytes.count <= MemoryLayout.size(ofValue: address.sun_path) else {
            throw HelperError.ipc("socket path is too long")
        }
        address.sun_family = sa_family_t(AF_UNIX)
        address.sun_len = UInt8(MemoryLayout<sockaddr_un>.size)
        path.withCString { source in
            withUnsafeMutablePointer(to: &address.sun_path) { pointer in
                pointer.withMemoryRebound(to: CChar.self, capacity: pathBytes.count) { destination in
                    _ = strlcpy(destination, source, pathBytes.count)
                }
            }
        }
        let result = withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { socketAddress in
                Darwin.connect(descriptor, socketAddress, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        guard result == 0 else {
            throw HelperError.ipc(String(cString: strerror(errno)))
        }

        var peerPID: pid_t = 0
        var peerPIDSize = socklen_t(MemoryLayout.size(ofValue: peerPID))
        guard getsockopt(descriptor, SOL_LOCAL, LOCAL_PEERPID, &peerPID, &peerPIDSize) == 0 else {
            throw HelperError.ipc("could not identify the client process")
        }
        return (FileHandle(fileDescriptor: descriptor, closeOnDealloc: true), peerPID)
    } catch {
        Darwin.close(descriptor)
        throw error
    }
}

internal func authorizationFailure(pid: pid_t) -> String? {
    guard let information = signingInformation(pid: pid) else {
        return "the peer has no valid code signature"
    }
    guard let identifier = information[kSecCodeInfoIdentifier as String] as? String else {
        return "the peer has no signing identifier"
    }
    guard let helperIdentifier = Bundle.main.bundleIdentifier else {
        return "the helper bundle identifier is invalid"
    }
    guard identifier == helperIdentifier else {
        return "expected \(helperIdentifier), got \(identifier)"
    }
    if let helperTeam = signingTeamId(pid: getpid()) {
        let peerTeam = information[kSecCodeInfoTeamIdentifier as String] as? String
        guard peerTeam == helperTeam else {
            return "expected signing team \(helperTeam), got \(peerTeam ?? "none")"
        }
    }
    return nil
}
