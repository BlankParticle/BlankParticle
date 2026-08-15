// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "computer-use",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "computer-use", targets: ["ComputerUse"]),
    ],
    targets: [
        .target(
            name: "CQuickJS",
            path: "Sources/CQuickJS",
            exclude: ["LICENSE"],
            publicHeadersPath: "include",
            cSettings: [
                .define("CONFIG_VERSION", to: "\"0.15.0\""),
                .unsafeFlags(["-Wno-shorten-64-to-32"]),
            ],
            linkerSettings: [.linkedLibrary("m")]
        ),
        .executableTarget(
            name: "ComputerUse",
            dependencies: ["CQuickJS"],
            path: "Sources/ComputerUse"
        ),
    ],
    swiftLanguageModes: [.v5]
)
