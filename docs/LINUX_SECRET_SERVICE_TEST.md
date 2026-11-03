# Linux Secret Service success-path test

Run on a disposable Linux CI runner with the existing Tauri/Rust dependencies plus
`gnome-keyring`, `dbus`, and `libglib2.0-bin` (`gdbus`).

```sh
bash scripts/test-linux-secret-service.sh
```

The wrapper compiles the dedicated `credentials_linux_secret_service` integration
binary first, then executes its explicitly ignored test under a **new D-Bus session**
and empty temporary HOME, XDG data/config/runtime directories. `env -i` prevents
inheriting a desktop session bus, provider credentials, or user keyring location.
A fixed synthetic fixture password initializes only this disposable daemon.
`gdbus` checks the default collection exists and is unlocked before the test runs;
interactive prompts are not accepted. A timeout bounds the test session and traps
remove the daemon and temporary files.

The test uses the real configured `keyring` backend (`sync-secret-service` and
`crypto-rust` on Linux). It does not install the fake/unavailable credential builder.
The separate integration executable prevents the global mock in
`credentials_workflow.rs` from affecting it. `cfg(target_os="linux")` and `#[ignore]`
prevent accidental normal-suite execution, and fixture environment checks reject
unwrapped direct execution.

Coverage: system save/read/update, a fresh HostState reading the system value,
system-to-session transition and system-item deletion, session expiry on HostState
restart, refusal to resurrect a legacy stray system value, deletion scoped to owned
references, preservation of the other fixture entry, and no plaintext secret in the
app metadata index. All values are invented and identify no real account.

This is a real Secret Service integration test, not real provider authentication.
A green normal mock suite does not substitute for this test, and an unexecuted or
failed daemon setup must be reported as unverified rather than a successful roundtrip.
