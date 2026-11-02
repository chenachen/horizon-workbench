# Linux build and acceptance

Linux support is under validation. A successful frontend build or configuration
test is not a successful native application, package, or desktop acceptance test.

## Build environment

Use a Linux desktop/session with Rust (rustup stable), the Node version specified
in the root package.json, a C compiler and the Tauri 2 system dependencies. On
Debian/Ubuntu these include `libwebkit2gtk-4.1-dev`, `build-essential`, `libssl-dev`,
`libgtk-3-dev`, `libdbus-1-dev`, `librsvg2-dev`, `patchelf` and `pkg-config`.
Install those packages through the operating system's normal package manager.
An active D-Bus session and an unlocked Secret Service implementation (such as
GNOME Keyring or compatible KWallet) are needed for persistent credentials. No
plaintext credential fallback is provided. Git, lsof and xdg-utils are runtime
dependencies. Headless CI additionally needs a supported display server and
WebKit automation setup; a sandbox that prohibits sockets is not sufficient.

The first supported build targets are `x86_64-unknown-linux-gnu` and
`aarch64-unknown-linux-gnu`; cross compilation is not set up. The x64 ripgrep
upstream asset is static musl, copied under the native GNU sidecar name. Its
SHA256 is checked before extraction. Pi runtime Linux assets are independently
pinned and checked; installing them does not authorize a model API request.

## Commands

From the repository root:

```sh
npm ci
node --test scripts/linux-packaging.test.mjs scripts/linux-platform.test.mjs
npm run desktop:check
npm run desktop:build
cargo test --manifest-path apps/git-service/Cargo.toml --locked
cargo test --manifest-path apps/extension-host/Cargo.toml --locked
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --locked
npm run desktop:release
```

Tauri automatically merges `tauri.linux.conf.json` on Linux. The release command
builds both native sidecars and creates `.deb` and `.AppImage` outputs under
`apps/desktop/src-tauri/target/release/bundle/`. For an initial Debian-only pass,
use `npm run desktop:release -- --bundles deb`.

## Required acceptance, not covered by unit tests

Install the generated package in a disposable Linux desktop and run the packaged
application, not the Vite preview. Use an isolated HOME/XDG data directory and a
temporary Git repository. Verify launch, project picker and reveal, file edit /
save / reopen, search (including Unicode), terminal input and termination, local
Git status/diff, plugin host, settings persistence, and clean shutdown. Exercise
cancel/reopen/repeated clicks and missing dependencies. Verify credentials only
using synthetic test values in an isolated keyring. Do not call paid AI APIs.
Repeat on the claimed architecture and distribution baseline. Record the source
commit, package SHA256, environment, actual commands, screenshots, failures and
unexecuted stages before calling a package accepted.

Official references:
- https://v2.tauri.app/start/prerequisites/
- https://v2.tauri.app/distribute/appimage/
- https://github.com/BurntSushi/ripgrep/releases/tag/15.2.0
- https://github.com/earendil-works/pi/releases/tag/v1.4.0
- https://docs.rs/keyring/3.6.3/keyring/
