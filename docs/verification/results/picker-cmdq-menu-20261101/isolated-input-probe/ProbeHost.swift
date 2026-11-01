import AppKit

@MainActor final class ProbeHost: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    let status = NSTextField(labelWithString: "No child started.")
    var child: Process?
    var childInput: FileHandle?
    var blocker: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 540, height: 170),
                          styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = "Picker key routing probe"
        window.isReleasedWhenClosed = false
        status.frame = NSRect(x: 20, y: 20, width: 500, height: 50)
        window.contentView!.addSubview(status)
        let button = NSButton(title: "Open Save Picker", target: self, action: #selector(openPicker))
        button.frame = NSRect(x: 20, y: 100, width: 230, height: 32)
        window.contentView!.addSubview(button)
        window.center(); window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func openPicker() {
        guard child == nil else { return }
        let process = Process(), input = Pipe(), output = Pipe()
        process.executableURL = Bundle.main.bundleURL.deletingLastPathComponent()
            .appendingPathComponent("PickerKeyProbeChild.app/Contents/MacOS/PickerKeyProbeChild")
        process.standardInput = input; process.standardOutput = output
        process.standardError = FileHandle.standardError
        process.terminationHandler = { [weak self] finished in
            let bytes = output.fileHandleForReading.readDataToEndOfFile()
            let reply = (try? JSONSerialization.jsonObject(with: bytes)) as? [String: Any]
            let result = reply?["status"] as? String ?? "invalid reply"
            DispatchQueue.main.async {
                guard let self else { return }
                try? self.childInput?.close(); self.childInput = nil; self.child = nil
                if let blocker = self.blocker { self.window.endSheet(blocker) }
                self.blocker = nil
                self.window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
                self.status.stringValue = "Child \(finished.processIdentifier) exited \(finished.terminationStatus); reply \(result). Host remains alive."
            }
        }
        do {
            // Mirror Tauri's macOS set_enabled(false): a translucent titled sheet.
            let sheet = NSWindow(contentRect: window.frame, styleMask: [.titled], backing: .buffered, defer: false)
            sheet.alphaValue = 0.5; blocker = sheet; window.beginSheet(sheet)
            try process.run(); child = process; childInput = input.fileHandleForWriting
            let request: [String: Any] = ["mode": "save", "title": "Picker CmdQ Probe",
                "filters": [["name": "Horizon 外观组合", "extensions": ["json"]]],
                "defaultFilename": "probe-cmdq.json"]
            let data = try JSONSerialization.data(withJSONObject: request)
            childInput!.write(data + Data([10]))
            status.stringValue = "Child \(process.processIdentifier) active; send CmdQ, then inspect trace."
        } catch {
            if let blocker { window.endSheet(blocker) }; blocker = nil
            status.stringValue = error.localizedDescription
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { child == nil }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard child != nil else { return .terminateNow }
        childInput?.write(Data("{\"command\":\"cancel\"}\n".utf8))
        return .terminateCancel
    }
}

@main enum ProbeMain {
    @MainActor static func main() {
        let app = NSApplication.shared; app.setActivationPolicy(.regular)
        let delegate = ProbeHost(); app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}
