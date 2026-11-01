// LaunchServices background launch for independent app identity and process attribution.
import AppKit
import Foundation

guard CommandLine.arguments.count >= 2 else {
    fputs("Usage: launch_app /absolute/Horizon.app [application arguments...]\n", stderr)
    exit(64)
}
let url = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL
guard FileManager.default.fileExists(atPath: url.appendingPathComponent("Contents/Info.plist").path) else {
    fputs("Application bundle missing Contents/Info.plist\n", stderr)
    exit(66)
}
let configuration = NSWorkspace.OpenConfiguration()
configuration.activates = false
configuration.createsNewApplicationInstance = true
configuration.arguments = Array(CommandLine.arguments.dropFirst(2))
configuration.environment = ProcessInfo.processInfo.environment
var finished = false
var failed = false
NSWorkspace.shared.openApplication(at: url, configuration: configuration) { application, error in
    defer { finished = true }
    guard let application = application else {
        fputs("\(error?.localizedDescription ?? "LaunchServices returned no app")\n", stderr)
        failed = true
        return
    }
    let result: [String: Any] = ["pid": application.processIdentifier,
                               "bundleIdentifier": application.bundleIdentifier ?? "",
                               "executable": application.executableURL?.path ?? "",
                               "activationRequested": false]
    print(String(data: try! JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]), encoding: .utf8)!)
}
let deadline = Date().addingTimeInterval(20)
while !finished && Date() < deadline {
    RunLoop.current.run(until: Date().addingTimeInterval(0.01))
}
if !finished { fputs("LaunchServices launch timed out\n", stderr); exit(70) }
exit(failed ? 1 : 0)
