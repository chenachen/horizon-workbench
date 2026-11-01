import AppKit
import UniformTypeIdentifiers

// Temporary keyboard-routing observation. Always return the original event and
// the superclass menu result. Never log filenames, paths, or clipboard data.
private let tracePath = "/Users/chenpengxiang/Desktop/Horizon/.work/picker-key-probe-20261101/key-events.jsonl"
private func trace(_ phase: String, event: NSEvent? = nil, handled: Bool? = nil) {
    var record: [String: Any] = ["phase": phase, "pid": ProcessInfo.processInfo.processIdentifier,
                                "timestamp": Date().timeIntervalSince1970]
    if let event {
        guard event.keyCode == 12 || event.modifierFlags.contains(.command) else { return }
        record["eventType"] = event.type.rawValue
        record["keyCode"] = event.keyCode
        record["modifierFlags"] = event.modifierFlags.rawValue
        record["charactersIgnoringModifiers"] = event.charactersIgnoringModifiers ?? ""
    }
    if let handled { record["handled"] = handled }
    guard let data = try? JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]) else { return }
    if !FileManager.default.fileExists(atPath: tracePath) {
        FileManager.default.createFile(atPath: tracePath, contents: nil)
    }
    guard let file = try? FileHandle(forWritingTo: URL(fileURLWithPath: tracePath)) else { return }
    file.seekToEndOfFile()
    file.write(data + Data([10]))
    try? file.close()
}

@MainActor private final class TraceMenu: NSMenu {
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        trace("menu.before", event: event)
        let handled = super.performKeyEquivalent(with: event)
        trace("menu.after", event: event, handled: handled)
        return handled
    }
}

private struct PickerRequest: Decodable {
    struct Filter: Decodable { let name: String; let extensions: [String] }
    enum Mode: String, Decodable { case file, folder, save }
    let mode: Mode
    let title: String?
    let filters: [Filter]
    let defaultFilename: String?
}

private struct PickerReply: Encodable {
    let status: String
    var path: String? = nil
    var message: String? = nil
}

private func reply(_ value: PickerReply) {
    if let data = try? JSONEncoder().encode(value) {
        FileHandle.standardOutput.write(data + Data([10]))
    }
}

@MainActor private final class PickerDelegate: NSObject, NSApplicationDelegate {
    let request: PickerRequest
    var panel: NSSavePanel?
    var cancelled = false
    var quitRequested = false
    var finished = false
    var keyTraceMonitor: Any?

    init(request: PickerRequest) { self.request = request }

    func applicationDidFinishLaunching(_ notification: Notification) {
        if cancelled { finish(); return }
        let picker: NSSavePanel
        switch request.mode {
        case .save:
            picker = NSSavePanel()
            if let name = request.defaultFilename { picker.nameFieldStringValue = name }
        case .file, .folder:
            let open = NSOpenPanel()
            open.canChooseFiles = request.mode == .file
            open.canChooseDirectories = request.mode == .folder
            open.allowsMultipleSelection = false
            picker = open
        }
        if let title = request.title { picker.title = title }
        let extensions = request.filters.flatMap { $0.extensions }
        if !extensions.isEmpty {
            picker.allowedContentTypes = extensions.compactMap { UTType(filenameExtension: $0, conformingTo: .data) }
        }
        panel = picker
        let mainMenu = TraceMenu()
        let appMenu = TraceMenu(title: "Horizon")
        appMenu.autoenablesItems = false
        let quit = NSMenuItem(title: "退出 Horizon", action: #selector(requestQuit), keyEquivalent: "q")
        quit.keyEquivalentModifierMask = .command
        quit.target = self
        appMenu.addItem(quit)
        let appItem = NSMenuItem()
        appItem.submenu = appMenu
        mainMenu.addItem(appItem)
        NSApp.mainMenu = mainMenu
        keyTraceMonitor = NSEvent.addLocalMonitorForEvents(matching: [.keyDown, .keyUp]) { event in
            trace("local", event: event)
            return event
        }
        trace("ready")
        NSApp.activate(ignoringOtherApps: true)
        picker.begin { [weak self] response in
            guard let self else { return }
            self.finish(path: response == .OK && !self.cancelled ? picker.url?.path : nil)
        }
    }

    func cancel() {
        cancelled = true
        if let panel { panel.cancel(nil) }
        else { finish() }
    }

    @objc func requestQuit() { trace("requestQuit"); quitRequested = true; cancel() }

    func finish(path: String? = nil) {
        guard !finished else { return }
        finished = true
        if let keyTraceMonitor { NSEvent.removeMonitor(keyTraceMonitor) }
        reply(PickerReply(status: quitRequested ? "quit" : path == nil ? "cancelled" : "selected", path: path))
        panel = nil
        DispatchQueue.main.async { NSApp.terminate(nil) }
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if finished { return .terminateNow }
        requestQuit()
        return .terminateCancel
    }
}

@main private enum PickerMain {
    @MainActor static func main() {
        guard let line = readLine(), let data = line.data(using: .utf8),
              let request = try? JSONDecoder().decode(PickerRequest.self, from: data) else {
            reply(PickerReply(status: "error", message: "文件选择请求无效"))
            return
        }
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let delegate = PickerDelegate(request: request)
        app.delegate = delegate
        // The host keeps this pipe open. A cancel message or EOF (including a
        // crashed host) closes the panel through AppKit before normal exit.
        DispatchQueue.global(qos: .utility).async {
            while let line = readLine() {
                if let data = line.data(using: .utf8),
                   let command = try? JSONSerialization.jsonObject(with: data) as? [String: String],
                   command["command"] == "cancel" { break }
            }
            DispatchQueue.main.async { delegate.cancel() }
        }
        withExtendedLifetime(delegate) { app.run() }
    }
}
