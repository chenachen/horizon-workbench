# Offline Pi integration coverage

These checks use the **official pinned Pi 1.4.0 executable** with a deterministic
OpenAI-compatible fixture bound only to `127.0.0.1`. The fixture supplies invented
responses and tool calls. Passing proves runtime/protocol integration, not real
model quality, provider compatibility, paid inference, or account authentication.
No real provider credentials are required. Do not supply any in CI.

## Linux / macOS commands

Run from the repository root after installing JavaScript dependencies and the
native Rust/Tauri toolchain and system dependencies:

```sh
export HORIZON_PI_BINARY="$(node scripts/prepare-pi-fixture.mjs)"
node scripts/test-pi-policy.mjs
node scripts/test-pi-rpc.mjs
node scripts/test-pi-native.mjs
node scripts/test-pi-resources.mjs
```

The preparation script downloads only an official GitHub release asset, verifies
its pinned SHA256 and exact byte length before extraction, and prints its absolute
executable path. It does not log in or start a provider connection. It leaves an
isolated temporary runtime directory for the test job; use an ephemeral CI runner.
`research/verification/pi-fixture-asset.json` records artifact identity.

- **Policy:** real checked-in broker transport, byte-fragmented Unicode fixture;
  no Pi process. Requires a local Unix socket on Linux/macOS.
- **RPC:** actual Pi streaming, cancellation, session resume, long Unicode,
  controlled authentication failure, and disabled implicit context/extensions/tools.
  Pi HOME and coding-agent configuration live in temporary fixture directories.
- **Native:** explicitly selects the ignored Rust test
  `agent::tests::real_pi_broker_review_and_secret_isolation`. Uses temporary Git
  repositories and session-only invented credentials. Tests permission rejection
  and approval, review/apply, secret isolation, dirty-buffer/version conflicts,
  cancellation, transcript backpressure, and auth ownership with local fixtures.
- **Resources:** 75 seconds of standalone Pi idle / simulated streaming / abort /
  idle. Excludes Horizon, WebView, and fixture-server memory. On Linux, `/proc`
  provides RSS and CPU ticks; this is **not** macOS physical footprint or a full
  application memory acceptance result. Short-lived/reparented children may be
  missed. No universal pass threshold is claimed.
- **Server:** `test-pi-server.mjs` is a supporting service, not a standalone test.
  It should not be launched as an unbounded test command.

`windows_managed_pi_chat_roundtrip` is a separate Windows-only ignored
Rust test; it cannot count as Linux coverage. Graphical application interaction,
installation/packaging, real provider inference and OS credential-store integration
are separate verification stages, not covered by this fixture suite.
