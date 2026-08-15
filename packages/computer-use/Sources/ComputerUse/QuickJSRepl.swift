import CQuickJS
import Darwin
import Foundation

internal final class QuickJSRepl {
    private var engine: OpaquePointer?

    init() throws {
        engine = cu_quickjs_create(
            Unmanaged.passUnretained(self).toOpaque(),
            computerUseQuickJSInvoke
        )
        guard engine != nil else {
            throw HelperError.invalidRequest("Could not initialize the QuickJS runtime")
        }
    }

    deinit {
        cu_quickjs_destroy(engine)
    }

    func evaluate(_ source: String) throws -> [String: Any] {
        guard let engine,
              let encoded = source.withCString({ cu_quickjs_evaluate(engine, $0) }) else {
            throw HelperError.invalidRequest("QuickJS evaluation did not return a result")
        }
        defer { cu_quickjs_free_string(encoded) }
        guard let data = String(cString: encoded).data(using: .utf8),
              let response = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw HelperError.invalidRequest("QuickJS returned an invalid response")
        }
        if response["ok"] as? Bool != true {
            throw HelperError.invalidRequest(
                response["error"] as? String ?? "JavaScript evaluation failed"
            )
        }
        return response
    }

    fileprivate func invoke(name: String, argumentsJSON: String) -> String {
        do {
            guard let data = argumentsJSON.data(using: .utf8),
                  let arguments = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                throw HelperError.invalidRequest("JavaScript passed invalid operation arguments")
            }
            let result = try waitForAsyncResult {
                try await ComputerControl.callMCPTool(name: name, arguments: arguments)
            }
            let value: Any
            if name == "list_apps",
               let structured = result["structuredContent"] as? [String: Any],
               let apps = structured["apps"] {
                value = apps
            } else if let structured = result["structuredContent"] {
                value = structured
            } else {
                value = NSNull()
            }
            return try jsonString(["ok": true, "value": value])
        } catch {
            return (try? jsonString(["ok": false, "error": error.localizedDescription]))
                ?? "{\"ok\":false,\"error\":\"Computer operation failed\"}"
        }
    }
}

@_cdecl("computer_use_quickjs_invoke")
internal func computerUseQuickJSInvoke(
    _ opaque: UnsafeMutableRawPointer?,
    _ name: UnsafePointer<CChar>?,
    _ argumentsJSON: UnsafePointer<CChar>?
) -> UnsafeMutablePointer<CChar>? {
    guard let opaque, let name, let argumentsJSON else { return nil }
    let repl = Unmanaged<QuickJSRepl>.fromOpaque(opaque).takeUnretainedValue()
    return strdup(repl.invoke(
        name: String(cString: name),
        argumentsJSON: String(cString: argumentsJSON)
    ))
}

private func waitForAsyncResult<T>(
    _ operation: @escaping () async throws -> T
) throws -> T {
    let semaphore = DispatchSemaphore(value: 0)
    let lock = NSLock()
    var outcome: Result<T, Error>?
    Task.detached {
        let result: Result<T, Error>
        do {
            result = .success(try await operation())
        } catch {
            result = .failure(error)
        }
        lock.withLock {
            outcome = result
        }
        semaphore.signal()
    }
    semaphore.wait()
    return try lock.withLock {
        try outcome!.get()
    }
}

internal func replTools() -> [[String: Any]] {
    [[
        "name": "repl",
        "description": "Evaluate JavaScript in a persistent QuickJS context with synchronous computer.* APIs.",
        "inputSchema": [
            "type": "object",
            "additionalProperties": false,
            "required": ["code"],
            "properties": [
                "code": [
                    "type": "string",
                    "description": "JavaScript source. Globals persist for the entire MCP session.",
                ],
            ],
        ],
        "annotations": [
            "readOnlyHint": false,
            "idempotentHint": false,
            "openWorldHint": false,
            "destructiveHint": false,
        ],
    ]]
}

internal func replMCPResult(_ response: [String: Any]) throws -> [String: Any] {
    let result = response["result"] ?? NSNull()
    let logs = response["logs"] as? [String] ?? []
    let structured: [String: Any] = ["result": result, "logs": logs]
    var textParts = logs
    if !(result is NSNull) {
        if JSONSerialization.isValidJSONObject(result) {
            textParts.append(try jsonString(result))
        } else if let string = result as? String {
            textParts.append(string)
        } else {
            textParts.append(String(describing: result))
        }
    }
    let imageURL = (result as? [String: Any])?["screenshot"] as? String
    return mcpResult(
        text: textParts.joined(separator: "\n"),
        imageURL: imageURL,
        structured: structured
    )
}
