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

internal func captureDisplay(for window: SCWindow, in displays: [SCDisplay]) -> SCDisplay? {
    var selected: SCDisplay?
    var selectedArea: CGFloat = 0
    for display in displays {
        let intersection = display.frame.intersection(window.frame)
        guard !intersection.isNull, !intersection.isEmpty else {
            continue
        }
        let area: CGFloat = intersection.width * intersection.height
        if area > selectedArea {
            selected = display
            selectedArea = area
        }
    }
    return selected
}

internal func captureSourceRect(for window: SCWindow, on display: SCDisplay) -> CGRect {
    let intersection = window.frame.intersection(display.frame)
    return CGRect(
        x: intersection.minX - display.frame.minX,
        y: intersection.minY - display.frame.minY,
        width: intersection.width,
        height: intersection.height
    )
}

internal func target(for window: SCWindow, includeTitle: Bool = true) -> Target {
    let app = window.owningApplication!
    let size = captureSize(for: window.frame)
    return Target(
        windowId: window.windowID,
        bundleId: app.bundleIdentifier,
        teamId: signingTeamId(pid: app.processID),
        appName: app.applicationName,
        windowTitle: includeTitle ? (window.title ?? "Untitled window") : "Window",
        width: UInt32(size.width),
        height: UInt32(size.height)
    )
}

internal func signingTeamId(pid: pid_t) -> String? {
    signingInformation(pid: pid)?[kSecCodeInfoTeamIdentifier as String] as? String
}

internal func signingInformation(pid: pid_t) -> [String: Any]? {
    var code: SecCode?
    let attributes = [kSecGuestAttributePid as String: NSNumber(value: pid)] as CFDictionary
    guard SecCodeCopyGuestWithAttributes(nil, attributes, SecCSFlags(rawValue: 0), &code) == errSecSuccess,
          let code,
          SecCodeCheckValidity(code, SecCSFlags(rawValue: 0), nil) == errSecSuccess else {
        return nil
    }
    var staticCode: SecStaticCode?
    guard SecCodeCopyStaticCode(code, SecCSFlags(rawValue: 0), &staticCode) == errSecSuccess,
          let staticCode else {
        return nil
    }
    var information: CFDictionary?
    guard SecCodeCopySigningInformation(
        staticCode,
        SecCSFlags(rawValue: UInt32(kSecCSSigningInformation)),
        &information
    ) == errSecSuccess,
    let dictionary = information as? [String: Any] else {
        return nil
    }
    return dictionary
}

internal func isBlocked(bundleId: String) -> Bool {
    let bundle = bundleId.lowercased()
    if [
        "com.1password.",
        "2bua8c4s2c.com.1password.",
        "com.bitwarden.",
        "com.lastpass.",
    ].contains(where: bundle.hasPrefix) {
        return true
    }
    return [
        "com.apple.loginwindow",
        "com.apple.securityagent",
        "com.apple.terminal",
        "com.apple.keychainaccess",
        "com.googlecode.iterm2",
        "com.mitchellh.ghostty",
        "org.alacritty",
    ].contains(bundle)
}

internal actor CaptureSessions {
    static let shared = CaptureSessions()

    private var sessions: [CGWindowID: WindowCaptureSession] = [:]

    func start(
        for window: SCWindow,
        filter: SCContentFilter,
        sourceRect: CGRect,
        target: Target
    ) async throws {
        if let session = sessions[window.windowID], session.sourceRect == sourceRect {
            session.update(target: target)
            return
        }

        let staleSessions = sessions.values
        sessions.removeAll()
        for session in staleSessions {
            await session.stop()
        }
        let session = try WindowCaptureSession(
            window: window,
            filter: filter,
            sourceRect: sourceRect,
            target: target
        )
        do {
            try await session.start()
            sessions[window.windowID] = session
        } catch {
            await session.stop()
            throw error
        }
    }

    func stopAll() async {
        let active = sessions.values
        sessions.removeAll()
        for session in active {
            await session.stop()
        }
    }
}

internal final class WindowCaptureOutput: NSObject, SCStreamOutput, SCStreamDelegate {
    private let context = CIContext(options: [.cacheIntermediates: false])
    private let targetLock = NSLock()
    private var target: Target

    init(target: Target) {
        self.target = target
    }

    func update(target: Target) {
        targetLock.lock()
        self.target = target
        targetLock.unlock()
    }

    private func currentTarget() -> Target {
        targetLock.lock()
        defer { targetLock.unlock() }
        return target
    }

    func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of outputType: SCStreamOutputType
    ) {
        guard outputType == .screen,
              sampleBuffer.isValid,
              let attachments = CMSampleBufferGetSampleAttachmentsArray(
                  sampleBuffer,
                  createIfNecessary: false
              ) as? [[SCStreamFrameInfo: Any]],
              let attachment = attachments.first,
              let statusRawValue = attachment[.status] as? Int,
              SCFrameStatus(rawValue: statusRawValue) == .complete,
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer)
        else {
            return
        }

        autoreleasepool {
            let image = CIImage(cvImageBuffer: pixelBuffer)
            let bounds = CGRect(
                x: 0,
                y: 0,
                width: CVPixelBufferGetWidth(pixelBuffer),
                height: CVPixelBufferGetHeight(pixelBuffer)
            )
            guard let frame = context.createCGImage(image, from: bounds) else {
                return
            }
            let target = currentTarget()
            let cursor = VirtualCursorStore.shared.position(
                for: target.windowId,
                size: CGSize(width: CGFloat(target.width), height: CGFloat(target.height))
            )
            let preview = drawVirtualCursor(
                on: frame,
                cursor: cursor,
                coordinateSpace: target
            )
            let previewTarget = Target(
                windowId: target.windowId,
                bundleId: target.bundleId,
                teamId: target.teamId,
                appName: target.appName,
                windowTitle: target.windowTitle,
                width: UInt32(preview.width),
                height: UInt32(preview.height)
            )
            ComputerUsePreviewStore.publish(target: previewTarget, image: preview)
        }
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {}
}

internal final class WindowCaptureSession {
    let sourceRect: CGRect
    private let output: WindowCaptureOutput
    private let outputQueue: DispatchQueue
    private let stream: SCStream
    private var capturing = false

    init(
        window: SCWindow,
        filter: SCContentFilter,
        sourceRect: CGRect,
        target: Target
    ) throws {
        self.sourceRect = sourceRect
        output = WindowCaptureOutput(target: target)
        let configuration = SCStreamConfiguration()
        let size = previewCaptureSize(for: sourceRect)
        configuration.sourceRect = sourceRect
        configuration.width = size.width
        configuration.height = size.height
        configuration.scalesToFit = true
        configuration.pixelFormat = kCVPixelFormatType_32BGRA
        configuration.queueDepth = 1
        configuration.minimumFrameInterval = CMTime(
            value: 1,
            timescale: previewFramesPerSecond
        )
        configuration.showsCursor = false
        configuration.capturesAudio = false
        outputQueue = DispatchQueue(label: "com.blankparticle.capture.\(window.windowID)")
        stream = SCStream(filter: filter, configuration: configuration, delegate: output)
        try stream.addStreamOutput(output, type: .screen, sampleHandlerQueue: outputQueue)
    }

    func update(target: Target) {
        output.update(target: target)
    }

    func start() async throws {
        try await stream.startCapture()
        capturing = true
    }

    func stop() async {
        guard capturing else {
            return
        }
        try? await stream.stopCapture()
        capturing = false
    }
}

internal struct Capture {
    let dataUrl: String
    let width: Int
    let height: Int
}

internal extension ComputerUsePreviewStore {
    static func publish(target: Target, image: CGImage) {
        let representation = NSBitmapImageRep(cgImage: image)
        guard let png = representation.representation(using: .png, properties: [:]) else {
            return
        }
        publish(
            target: target,
            capture: Capture(
                dataUrl: "data:image/png;base64," + png.base64EncodedString(),
                width: image.width,
                height: image.height
            )
        )
    }
}

internal func captureSize(for frame: CGRect) -> (width: Int, height: Int) {
    let scale = min(
        1,
        min(Double(maximumCaptureWidth) / max(frame.width, 1), Double(maximumCaptureHeight) / max(frame.height, 1))
    )
    return (
        max(1, Int((frame.width * scale).rounded())),
        max(1, Int((frame.height * scale).rounded()))
    )
}

internal func previewCaptureSize(for frame: CGRect) -> (width: Int, height: Int) {
    let scale = min(
        1,
        min(Double(maximumPreviewWidth) / max(frame.width, 1), Double(maximumPreviewHeight) / max(frame.height, 1))
    )
    return (
        max(1, Int((frame.width * scale).rounded())),
        max(1, Int((frame.height * scale).rounded()))
    )
}

internal func capture(
    _ window: SCWindow,
    filter: SCContentFilter,
    sourceRect: CGRect,
    cursor: CGPoint? = nil,
    coordinateSpace: Target? = nil
) async throws -> Capture {
    let size = captureSize(for: sourceRect)
    let configuration = SCStreamConfiguration()
    configuration.sourceRect = sourceRect
    configuration.width = size.width
    configuration.height = size.height
    configuration.scalesToFit = true
    configuration.showsCursor = false
    configuration.capturesAudio = false
    let image = try await SCScreenshotManager.captureImage(
        contentFilter: filter,
        configuration: configuration
    )
    let drawnImage = drawVirtualCursor(on: image, cursor: cursor, coordinateSpace: coordinateSpace)
    let representation = NSBitmapImageRep(cgImage: drawnImage)
    guard let png = representation.representation(using: .png, properties: [:]) else {
        throw HelperError.captureFailed
    }
    return Capture(
        dataUrl: "data:image/png;base64," + png.base64EncodedString(),
        width: drawnImage.width,
        height: drawnImage.height
    )
}

internal func drawVirtualCursor(on image: CGImage, cursor: CGPoint?, coordinateSpace: Target?) -> CGImage {
    guard let cursor, let coordinateSpace,
          coordinateSpace.width > 0, coordinateSpace.height > 0,
          let overlayCursor = CursorAssets.overlay,
          let context = CGContext(
              data: nil,
              width: image.width,
              height: image.height,
              bitsPerComponent: 8,
              bytesPerRow: image.width * 4,
              space: CGColorSpaceCreateDeviceRGB(),
              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
          ) else {
        return image
    }
    context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
    let x = cursor.x / CGFloat(coordinateSpace.width) * CGFloat(image.width)
    let y = cursor.y / CGFloat(coordinateSpace.height) * CGFloat(image.height)
    context.saveGState()
    context.translateBy(x: x, y: CGFloat(image.height) - y)
    context.interpolationQuality = .high
    context.setShadow(
        offset: .zero,
        blur: 2,
        color: CGColor(gray: 1, alpha: 0.42)
    )
    context.draw(
        overlayCursor,
        in: CGRect(
            x: -CursorAssets.overlayHotspot.x,
            y: CursorAssets.overlayHotspot.y - CursorAssets.overlaySize.height,
            width: CursorAssets.overlaySize.width,
            height: CursorAssets.overlaySize.height
        )
    )
    context.restoreGState()
    return context.makeImage() ?? image
}
