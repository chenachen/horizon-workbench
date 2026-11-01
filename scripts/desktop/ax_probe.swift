// Read-only native readiness/inspection probe. Does not activate, click or type.
import AppKit
import ApplicationServices
import Foundation

let args = Array(CommandLine.arguments.dropFirst())
func argument(_ name: String) -> String? {
    guard let index = args.firstIndex(of: name), index + 1 < args.count else { return nil }
    return args[index + 1]
}
if args.contains("--environment") {
    let tools = ["accessibilityTrusted": AXIsProcessTrusted(), "screenCaptureAllowed": CGPreflightScreenCaptureAccess()]
    print(String(data: try JSONSerialization.data(withJSONObject: tools, options: [.sortedKeys]), encoding: .utf8)!)
    exit(0)
}
guard let rawPid = argument("--pid"), let pid = Int32(rawPid) else {
    fputs("Usage: ax_probe --pid PID [--label EXACT_LABEL] [--role AXButton] [--dump]\n", stderr)
    exit(64)
}
if args.contains("--windows") {
    let info = CGWindowListCopyWindowInfo([.optionAll, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
    let owned = info.filter { ($0[kCGWindowOwnerPID as String] as? Int32) == pid }
    print(String(data: try JSONSerialization.data(withJSONObject: owned, options: [.sortedKeys]), encoding: .utf8)!)
    exit(0)
}
guard AXIsProcessTrusted() else { fputs("Accessibility permission unavailable\n", stderr); exit(77) }
let targetLabel = argument("--label")
let targetRole = argument("--role") ?? "AXButton"
if !args.contains("--dump") && targetLabel == nil {
    fputs("Readiness requires --label; a window alone is not interactive readiness\n", stderr)
    exit(64)
}
let app = AXUIElementCreateApplication(pid)
AXUIElementSetMessagingTimeout(app, 0.2)
func attribute(_ node: AXUIElement, _ key: String) -> AnyObject? {
    var value: CFTypeRef?
    return AXUIElementCopyAttributeValue(node, key as CFString, &value) == .success ? value : nil
}
var queue: [(AXUIElement, Int)] = [(app, 0)]
var inspected = 0
var found = false
var nodes: [[String: Any]] = []
while !queue.isEmpty && inspected < 3000 {
    let (node, depth) = queue.removeFirst()
    inspected += 1
    let role = attribute(node, kAXRoleAttribute) as? String ?? ""
    let title = attribute(node, kAXTitleAttribute) as? String ?? ""
    let description = attribute(node, kAXDescriptionAttribute) as? String ?? ""
    let value = attribute(node, kAXValueAttribute) as? String ?? ""
    let enabled = attribute(node, kAXEnabledAttribute) as? Bool ?? false
    if args.contains("--dump") {
        nodes.append(["role": role, "title": title, "description": description,
                      "value": String(value.prefix(200)), "enabled": enabled, "depth": depth])
    }
    if role == targetRole && enabled && [title, description, value].contains(targetLabel ?? "\u{0}") {
        found = true
        if !args.contains("--dump") { break }
    }
    if depth < 30, let children = attribute(node, kAXChildrenAttribute) as? [AXUIElement] {
        queue.append(contentsOf: children.map { ($0, depth + 1) })
    }
}
let result: [String: Any] = ["pid": pid, "ready": found, "inspected": inspected, "nodes": nodes,
                             "endpoint": "enabled accessible control with exact label and role; no input performed"]
print(String(data: try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]), encoding: .utf8)!)
exit(args.contains("--dump") || found ? 0 : 1)
