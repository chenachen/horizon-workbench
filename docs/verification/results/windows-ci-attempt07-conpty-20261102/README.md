# Native Windows attempt07 — headless terminal-client CPR

fcaeada/run41342731739/job124955986359 entered real Host tests after the manifest fix: QuickJS1pass and owned Job1pass(0.06s). ConPTY then ran exactly1 test and failed in12.55s. It waited10s for real PowerShell Chinese output; state was running and actual output was only ESC[6n. Its own cleanup reported TIMEOUT/unconfirmed and remains in original job.log/result.json. Resize was not reached, and later storage/Pi/main/Publish were skipped. No failure is erased or called a pass.

The locked portable-pty code enables INHERIT_CURSOR. Microsoft requires the caller to respond asynchronously from hOutput to hInput. Actual xterm6.0 source responds to CSI6n with CSIrow;colR; CoreTerminal forwards this through onData, the product UI calls terminal_input, and Rust writes/flushes the real PTY input. The old headless test had no such client. source-chain.json records exact source hashes and locations.

The single cfg(windows,test) candidate supplies CSI1;1R once when the actual query is observed. A shared bool spans both Chinese-output and resize waits, so a retained query in the ring is not answered again. It clones the same real writer and writes/flushes only cursor-response bytes. It never writes expected Chinese text into output or changes the production flag. All original PowerShell Chinese/Console resize/production stop/root+Job/resource-release assertions and10s/5s deadlines remain. Production code before the test module is byte-identical.

Candidate and raw before/after hashes are in cpr-client-fix/. No local compile/run, GUI/service, live source edit, commit or push occurred. The same exact native test in the next CI provides the result.

Sources: [CreatePseudoConsole remarks](https://learn.microsoft.com/en-us/windows/console/createpseudoconsole#remarks), [Console VT sequences](https://learn.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences). Original cleanup TIMEOUT is part of this frozen failure record, not evidence of successful cleanup.
