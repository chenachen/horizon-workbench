import AppKit

// Isolated causal probe, never linked into Horizon. Build/run remain unperformed.
@MainActor final class ProbeDelegate: NSObject, NSApplicationDelegate {
    let args = CommandLine.arguments
    var window: NSWindow?
    var status = NSTextField(labelWithString: "")
    var buttons: [NSButton] = []
    var child: Process?
    var panel: NSSavePanel?
    var pickerMode: Bool { args.dropFirst().first == "--picker" }
    var fixtureDirectory: String {
        args.count > 1 ? args[1] : Bundle.main.bundleURL.deletingLastPathComponent().appendingPathComponent("fixture").path
    }

    func log(_ value: [String: Any]) {
        var event = value
        event["timestamp"] = ISO8601DateFormatter().string(from: Date())
        event["uptimeSeconds"] = ProcessInfo.processInfo.systemUptime
        let data = try! JSONSerialization.data(withJSONObject: event, options: [.sortedKeys])
        FileHandle.standardOutput.write(data + Data([10]))
        if !pickerMode {
            let url = URL(fileURLWithPath: fixtureDirectory, isDirectory: true).appendingPathComponent("actions.jsonl")
            if !FileManager.default.fileExists(atPath: url.path) { FileManager.default.createFile(atPath: url.path, contents: nil) }
            if let file = try? FileHandle(forWritingTo: url) {
                file.seekToEndOfFile(); file.write(data + Data([10])); try? file.close()
            }
        }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        if pickerMode { showPicker(); return }
        let frame = NSRect(x: 0, y: 0, width: 580, height: 190)
        let host = NSWindow(contentRect: frame, styleMask: [.titled, .closable], backing: .buffered, defer: false)
        host.title = "Picker lifetime host · PID \(ProcessInfo.processInfo.processIdentifier)"
        host.isReleasedWhenClosed = false
        status.frame = NSRect(x: 20, y: 20, width: 540, height: 60)
        status.stringValue = "Parent stays alive after each child exits. No panel has opened."
        host.contentView!.addSubview(status)
        for (index, mode) in ["file", "folder", "save"].enumerated() {
            let button = NSButton(title: mode, target: self, action: #selector(spawnPicker(_:)))
            button.identifier = NSUserInterfaceItemIdentifier(mode)
            button.frame = NSRect(x: 20 + index * 180, y: 105, width: 160, height: 32)
            host.contentView!.addSubview(button); buttons.append(button)
        }
        window = host; host.center(); host.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        log(["event": "parent-ready", "pid": ProcessInfo.processInfo.processIdentifier])
    }

    @objc func spawnPicker(_ sender: NSButton) {
        guard child == nil else { return }
        let process = Process(), output = Pipe()
        process.executableURL = Bundle.main.bundleURL.deletingLastPathComponent()
            .appendingPathComponent("PanelLifetimeChild.app/Contents/MacOS/PanelLifetimeProbe")
        process.arguments = ["--picker", sender.identifier!.rawValue, fixtureDirectory]
        process.standardInput = FileHandle.nullDevice
        process.standardOutput = output
        process.standardError = FileHandle.standardError
        process.terminationHandler = { [weak self] finished in
            let data = output.fileHandleForReading.readDataToEndOfFile()
            let reply = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
            DispatchQueue.main.async {
                guard let self else { return }
                self.child = nil; self.buttons.forEach { $0.isEnabled = true }
                self.status.stringValue = "Child \(finished.processIdentifier) exited \(finished.terminationStatus); parent still running. \(reply["status"] ?? "no reply")"
                self.log(["event": "child-exited", "parentPid": ProcessInfo.processInfo.processIdentifier,
                          "childPid": finished.processIdentifier, "exitCode": finished.terminationStatus,
                          "frontmostPid": NSWorkspace.shared.frontmostApplication?.processIdentifier ?? 0,
                          "reply": reply])
            }
        }
        do {
            try process.run(); child = process; buttons.forEach { $0.isEnabled = false }
            status.stringValue = "Child \(process.processIdentifier) active; parent remains alive."
            log(["event": "child-started", "pid": process.processIdentifier, "mode": sender.identifier!.rawValue])
        } catch { status.stringValue = error.localizedDescription }
    }

    func showPicker() {
        let mode = args[2]
        let selection: NSSavePanel
        if mode == "save" {
            selection = NSSavePanel(); selection.nameFieldStringValue = "probe-selected.txt"
        } else {
            let open = NSOpenPanel()
            open.canChooseFiles = mode == "file"; open.canChooseDirectories = mode == "folder"
            open.allowsMultipleSelection = false; selection = open
        }
        panel = selection; selection.title = "Picker child · PID \(ProcessInfo.processInfo.processIdentifier)"
        selection.directoryURL = URL(fileURLWithPath: args[3], isDirectory: true)
        NSApp.activate(ignoringOtherApps: true)
        selection.begin { response in
            let chosenPath = response == .OK ? selection.url?.path : nil
            self.log(["pid": ProcessInfo.processInfo.processIdentifier, "status": response == .OK ? "selected" : response == .cancel ? "cancelled" : "aborted",
                      "response": response.rawValue, "path": chosenPath.map { $0 as Any } ?? NSNull(),
                      "frontmostPid": NSWorkspace.shared.frontmostApplication?.processIdentifier ?? 0])
            self.panel = nil
            DispatchQueue.main.async { NSApp.terminate(nil) }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        !pickerMode && child == nil
    }
}

@main enum ProbeMain {
    @MainActor static func main() {
        let picker = CommandLine.arguments.dropFirst().first == "--picker"
        precondition(picker ? CommandLine.arguments.count == 4 : CommandLine.arguments.count <= 2, "Optional parent argument is an owned fixture directory; child invocation is internal.")
        let app = NSApplication.shared
        app.setActivationPolicy(picker ? .accessory : .regular)
        let delegate = ProbeDelegate()
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}
