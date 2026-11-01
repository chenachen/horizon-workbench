# Picker CmdQ routing probe

Diagnostic copy of production helper only. Production source and running bundle are unchanged. Host mirrors the Tauri translucent blocking sheet and sends the same JSON protocol. Host intentionally remains alive after the helper replies, including `quit`.

Trace `key-events.jsonl` appends timestamp/PID plus local or menu key event keyCode/modifierFlags/charactersIgnoringModifiers, menu Bool result, and requestQuit entry. Only Command combinations or physical Q (keyCode12) are recorded. No filename/path/clipboard/document text is logged. Menu override calls super unchanged, local monitor returns the original event.

Native sequence (root CUA owner only):
1. Launch PickerKeyProbeHost.app, click Open Save Picker.
2. Bind child bundle `dev.horizon.picker-key-probe-child`, click Save As field, send `super+q` once with100ms.
3. Read trace and AX. If still open, click Horizon → 退出 Horizon once as action-path control.
4. Confirm host displays child exit0/replyquit, then close the probe host normally.

No input-source changes. No probe was launched during preparation. A local/menu trace absence locates an observation boundary, not a proven OS/automation cause.
