# Horizon full-test inventory — 2026-11-03

Inventory baseline: commit `6b1ad73`, main baseline `7e46748`. Expanded workflow results must be read from the exact tested commit and its Actions artifacts. This document inventories executable tests and acceptance tools; it does **not** claim new test passes. No user computer, account secret, paid model API, merge or release is needed/authorized by this inventory. Existing historical results are not current Linux evidence.

## 1. Immediate runnable automated matrix

All commands below run from repository root unless noted. Use isolated HOME/XDG and disposable repositories for native tests. Capture exit codes with `set -o pipefail`; record exact commit, dependencies, binary hashes, logs and skipped cases. `rtk proxy` in old documentation is an optional command wrapper, not a prerequisite.

| Command / maintained sources | Platform / dependencies | What it actually verifies | Previous Linux CI |
|---|---|---|---|
| `npm ci`; `npm run desktop:check`; `npm run desktop:build` | Node declared engine (CI 24), npm registry | Locked JS install, TypeScript, real frontend compilation; not GUI | Included via check/release |
| `node --test scripts/linux-packaging.test.mjs scripts/linux-platform.test.mjs apps/desktop/tests/windows-feedback.test.mjs` | Node; platform-source tests can run on Linux | Mapping/config/source contracts, Windows feedback static regression; not native Windows execution | Included |
| `python3 scripts/check-linux-smoke-js.py`; `python3 scripts/test-linux-smoke-contract.py` | Python + Node JS parser | Embedded JS syntax and Python WebDriver helper contracts; mock driver in contract tests, not GUI | Included |
| `npx --no-install vitest run --root apps/desktop/src --maxWorkers=1 --no-file-parallelism` | Root npm deps | Six TS files: bridge, agent/reviewDiff, plugins/service, plugins/workerHost, settings/pendingAppearance, settings/diagnostics. Unit/state-machine/transport seams include mocks | Included |
| `npx --no-install vitest run --root packages/editor/src --maxWorkers=1 --no-file-parallelism` | Root npm deps | selection/store/outline; editor state and mocked host calls, not live file-save GUI | Included |
| `npx --no-install vitest run --root packages/appearance/src --maxWorkers=1 --no-file-parallelism` | Root npm deps | Appearance application/state tests, not real eight-layout screenshots | Included |
| `node --import tsx --test packages/plugins/tests/runtime.test.ts` | Root npm deps | Real plugin runtime logic with controlled providers/fixtures, no native QuickJS GUI | Included |
| `cargo test --locked --manifest-path apps/git-service/Cargo.toml` | Rust, C toolchain, real Git, temp writable disk/process spawning | Rust unit + `tests/workflow.rs`: real sidecar/Git/temp repos, local remotes; no account required | Included |
| `cargo test --locked --manifest-path apps/extension-host/Cargo.toml` | Rust/C, QuickJS build dependencies | Real isolated extension-host execution + `tests/isolation.rs`; controlled plugin programs | Included |
| `cargo test --locked --manifest-path apps/extension-host/Cargo.toml -- --ignored` | Same; 30+ seconds | Explicit production asynchronous deadline test | Included |
| `xvfb-run -a dbus-run-session -- cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml -- --test-threads=1` | Linux GTK3/WebKitGTK4.1/DBus dev libs, display, Git, lsof, prepared sidecars/ripgrep | Native host unit tests and five integration files: credentials_workflow, file_recovery, files_workflow, extensions_policy, search_workflow. Real filesystem/process/PTY/search operations plus some mocks/injected failure seams; not GUI acceptance | Included |
| `node scripts/test-pi-policy.mjs` | Node/TypeScript, Unix domain sockets | Actual checked-in policy transport with local broker; TypeBox schema constructors deliberately stubbed; fragmented Unicode/transport behavior | **Missing** |
| `cd packages/pi-policy && npm ci && npm run check` | Separate package-lock, npm registry | Policy extension typecheck against pinned Pi 1.4.0/TypeBox, not runtime requests | **Missing** |
| `HORIZON_PI_BINARY=/absolute/verified/pi node scripts/test-pi-rpc.mjs` | Official checksum-verified Pi 1.4.0 matching Linux arch, Node, loopback sockets, fresh HOME | Real Pi process/protocol against deterministic local OpenAI fixture; no model inference/account/paid API | **Missing** |
| `HORIZON_PI_BINARY=/absolute/verified/pi node scripts/test-pi-native.mjs` | Above + native host build/deps + Git | Runs explicitly ignored `agent::tests::real_pi_broker_review_and_secret_isolation`; real Pi and host broker/review, permissions, auth ownership and isolation using fake secrets/loopback fixture | **Missing** |
| `python3 apps/git-service/tests/benchmark.py --binary apps/git-service/target/release/horizon-git --output /absolute/new-evidence` | Release sidecar, real Git, substantial disposable disk/time | 10k/100k-file and 50 MiB default real sidecar pressure/cancellation; `--cancel-only` is focused subset, not full benchmark | **Missing** |

### Ignored tests: do not blindly run all host `--ignored`

- `agent::tests::real_pi_broker_review_and_secret_isolation`: meaningful explicit test above, requires official binary and local server.
- `processes::tests::http_fixture_server`: ignored child helper requires `HORIZON_TEST_PORT`; parent readiness test launches it. Not a standalone missing acceptance case.
- Windows owned-job ignored child similarly needs role/marker env and is launched by its parent test.
- Windows fixed-Pi download test is cfg(windows); run only on corresponding disposable Windows runner.
- `credentials_workflow::real_macos_keyring_system_to_session_expires_without_fallback_and_removes_only_its_ref` is cfg(macos)+ignored; writes isolated fake Keychain entries. Ordinary cross-platform credentials test intentionally installs a failing credential-store mock, so it is **not** Secret Service integration proof.
- Extension-host ignored deadline is a genuine independent test (already explicitly run by current CI).

## 2. Design/reference and documentation validators (not native product GUI)

Install root npm dependencies plus `npx playwright install --with-deps chromium` in the disposable runner.

| Command | Scope / output / caveat |
|---|---|
| `npm run build` then `npm run check` | Builds design artifact then Chromium checks 8-style reference scenes in `design/index.html`; static design runtime, NOT Tauri app |
| `npm run check:plugins` | Chromium design plugin workflows; simulated install/consent/actions, NOT native extension installation |
| `npm run check:customization` | Chromium design appearance customization/retention; NOT desktop host persistence |
| `npm run capture` | Reference screenshot generator; screenshots alone are not assertions or genuine product captures |
| `python3 scripts/desktop/acceptance_matrix.py --check` | Validates generated 104-requirement/39-task historical evidence matrix consistency; does not rerun features |
| `python3 scripts/desktop/visual_matrix.py --check` | Validates historical 8×73 design/evidence index; no newly captured Linux proof |
| `node scripts/desktop/check_visual_report.mjs` | Chromium checks historical report filtering/image display (584 design entries); not product UI |
| `cd research/experiments/cordis-react && npm ci && node check.mjs` | Separate research-only Cordis/React experiment; root Playwright, local esbuild; updates `result.json`. Not CodeMirror, IME, Tauri or QuickJS acceptance |

All above are absent from current Linux CI except normal desktop frontend build. Some validators may legitimately expose stale historical artifact indexes: report separately rather than rewriting evidence to claim Linux passes. Research and generated results should be copied to evidence or changes tracked, not silently committed as new application proof.

## 3. Real packaged-app paths and expansion priorities

Current proven/reusable harness: `scripts/linux-native-smoke.py` invokes official `tauri-driver` + `WebKitWebDriver`, checks installed process identity + actual Tauri IPC, clicks real UI, captures PNG/HTML/text, uses fresh HOME/XDG, and restarts same installed executable with same isolated data. It does not use Vite/Chromium preview.

Current command:

```sh
npm run desktop:release -- --bundles deb,appimage
# Install the exact generated .deb in the disposable Ubuntu runner, then:
xvfb-run -a -s '-screen 0 1440x1000x24' dbus-run-session -- \
  python3 scripts/linux-native-smoke.py --application /usr/bin/horizon-desktop \
  --artifacts /absolute/new-evidence/gui
```

Existing GUI coverage is deliberately narrow: native launch/IPC, workspace cancel→reopen→create, appearance dark-mode selection, modal close/reopen, workspace+theme restart persistence. Current Linux workflow builds/hashes AppImage but only installs/exercises Debian executable. Native picker, editor/search/terminal/Git/plugin GUI, Secret Service, IME, graceful UI shutdown, ARM64, Wayland, scaling and sustained performance are not implied.

Recommended real-app additions, in dependency order:

1. Reuse `apps/git-service/tests/gui_fixture.py prepare --output NEW_DIR` for isolated real project, HEAD/index/disk distinctions, local bare remote/peer. `observe --manifest fixture.json --label LABEL --output NEW_DIR` records real disk/Git states; `advance --manifest ... --action prepare-push|prepare-divergence|prepare-hook-failure|release-hook` supplies preconditions, **not** product action evidence.
2. Project add/selection via actual native picker where supported; verify cancel, repeated open, existing path dedupe and project switch. Do not seed host registry and call that picker acceptance. GTK dialogs are outside DOM WebDriver; may need disposable-runner accessibility automation or explicit limitation.
3. Real file tree → Unicode editor input → save/reopen → external conflict/recovery; assert disk hashes and UI text. Search Unicode/case/regex/cancel then jump to result. Preserve dirty buffer and selections across project/layout/restart.
4. Real PTY input/Unicode/resize/hide/show/stop; prove owned root+descendants exit and no unrelated process killed. Launch local service and test readiness/stop/failure with actual UI controls and owned ports.
5. Git status/diff/stage/unstage/commit/hook failure/fetch/push/local conflict against local bare remote only; assert index/HEAD/disk separately. No GitHub login or real remote required.
6. Built-in plugin enable/disable/uninstall/restore and checked-in external example lifecycle; explicit consent UI and ownership/cleanup evidence, not merely direct host invocation.
7. All eight layouts × light/dark, theme independence, dimensions/background/preset persistence, keyboard focus and narrow window; screenshots tied to installed executable SHA256. Composition/IME requires genuine OS IME setup; DOM synthetic composition does not substitute.
8. Graceful UI close and dirty/cancel/discard flows, then process/resource checks. WebDriver DELETE session is process/session teardown, not by itself graceful-close acceptance.
9. AppImage extracted or FUSE launch, package relocation, upgrade/persistence in disposable prefixes; distinguish extraction fallback from true FUSE mount launch. Separate ARM64 runner/build and Wayland session if claiming these platforms.
10. Synthetic Linux Secret Service roundtrip in isolated D-Bus/keyring (e.g. fresh GNOME Keyring), never user's store. Current normal credentials tests mock unavailable storage; Linux backend success requires new explicit coverage.

Harness cautions already learned: use visible welcome button (hidden nav exists in DOM); wait displayed+enabled before clicking; pass selector strings as JS args; test embedded-JS syntax; preserve XAUTHORITY through isolated env; assert no duplicate workspace after cancel; retain raw failure screenshots. Final output must separate real app actions, setup commands, host IPC assertions and mock fixtures.

## 4. Pressure/resource/startup tools and platform boundaries

- `python3 scripts/desktop/fixtures.py --output NEW_DIR`: real deterministic disposable filesystem/Git fixtures. Full default includes 10k/100k paths, same-dir 10k entries, 120-depth tree, 10/50/101 MiB and long-line files, Unicode/symlink/permission-denied cases, three projects, 10k Git changes, local bare remote, bounded-output data. `--smoke` checks generator only; `--reading-only` and `--review-only` provide distinct exact budget datasets. Generator title says macOS but uses portable filesystem/Git mechanisms; permissions differ if runner is root. Never reuse existing output directory; cleanup only generated path (restore 000 directory permission first).
- `python3 scripts/desktop/launch_benchmark.py --launch-command '["/absolute/binary"]' --probe-command '[...]' --output NEW_DIR --runs 20 --build release --cache-condition '...' --endpoint '...'`: macOS implementation imports `MacMetrics` even with `--launch-command`; do not run unchanged on Linux. Its orchestration design is reusable after replacing accounting and supplying a genuine Linux WebDriver/GTK readiness probe. Existing `.app`/Swift probe path is macOS-only. Do not substitute process-exists for interactive readiness.
- `scripts/desktop/summarize_editor_metrics.py INPUT --output PATH --build release --build-id HASH --native-actions ACTION_LOG`: reusable summarizer of real exported editor timings; no actions generated; not benchmark proof without same-build input/actions.
- `scripts/desktop/sample_macos.py`, `mac_metrics.py`, `observe_native_launches.py`, `cua_startup.mjs`, `ax_probe.swift`, `launch_app.swift`: macOS native metrics/AX/CUA helpers. **Not runnable as Linux proof, and do not access user computer.** A Linux `/proc` process-tree/RSS/CPU/FD observer needs separate adaptation, with scope/metric distinctions documented.
- `scripts/test-pi-resources.mjs` currently launches `sample_macos.py` and hardcodes a Darwin ARM64 asset/hash in its build label. Do not run unchanged on Linux or relabel its output; adapt observer and asset identity first. Official Pi process + deterministic localhost model is real runtime but simulated provider, not model-quality testing.
- `scripts/desktop/check_tools.py --fixture DIR --output JSON`: imports macOS counters; tool self-check, not application acceptance. Python syntax-only validation can run anywhere but counters require macOS.
- `scripts/desktop/audit_macos_package.py --bundle APP --dmg DMG --zip ZIP --output NEW_DIR`: macOS hdiutil/codesign package audit only, not Linux installation.

## 5. Windows / macOS runners and excluded accounts

- Existing `.github/workflows/windows-release.yml` / `windows-feedback-update.yml` supply Windows-specific cargo, package and startup checks. `node scripts/windows-sidecar-smoke.mjs` explicitly asserts win32/x64 and checks exact bundle inputs; `windows-startup-smoke.ps1` and `windows-uia-ready.ps1` need Windows desktop/WebView2. These cannot be claimed by Linux execution of `windows-feedback.test.mjs`.
- macOS keychain, picker subprocess, codesign/DMG/AX/IME and physical-footprint budgets require a separate authorized disposable native macOS environment. No user desktop.
- No ordinary maintained automated test requires a real provider account. Pi deterministic localhost tests use synthetic credentials; do not convert them into paid API requests. Real vendor/model response behavior and online auth remain explicitly excluded unless separately authorized.
- Local Git remotes avoid external credentials. External plugin fixtures are checked-in examples and disposable package paths, not arbitrary user extensions.

## 6. Canonical acceptance/evidence reading map

- `docs/product/REQUIREMENTS.md`, `docs/implementation/IMPLEMENTATION_PLAN.md`, `docs/implementation/EXECUTION_ACCEPTANCE.md`: requirement/task contract; evidence must distinguish mocked protocol from genuine OS operations, actual layout structure, permission/cleanup and performance scope.
- `docs/verification/README.md`: canonical tool commands and acceptance sequence; 104 requirements, 39 tasks; historical platform-specific totals are not Linux coverage.
- `MACOS_ACCEPTANCE.md`, `matrix.json`, `evidence.json`, `acceptance-scope-decisions.json`, `SPECIFICATION_MAPPING.md`: historical functional mapping.
- `VISUAL_MATRIX.md`, `visual-matrix.json`, `visual-records.json`, `visual-applicability.json`, `visual-rejected-captures.json`, `specification-records.json`, `visual-report.html`: historical visual evidence/index and exclusions.
- `GIT_GUI.md`, `GIT_NATIVE_VISUAL_REVIEW.md`, `GIT_VISUAL_REVIEW.md`, `PROCESSES_GUI.md`, `PLUGINS_GUI.md`, `APPEARANCE_GUI.md`, `APPEARANCE_VISUAL_REVIEW.md`, `SETTINGS_FIDELITY.md`, `SETTINGS_SCOPE_AUDIT.md`: reusable scenario descriptions; screenshots/old passes are not new-run proof.
- `PERFORMANCE.md`, `PANEL_CPU_RETEST.md`, `NATIVE_RUNS.md`: scope-specific native measurement notes.
- `GAP_REVIEW.md`, `CONDITION_GAPS.md`, `REMAINING_CONDITIONS.md`, `remaining-conditions.json`: historical open/closed conditions; note documented physical memory budget miss and Windows scaling limits, not blanket “everything passed.”
- `docs/LINUX_BUILD.md`, `docs/WINDOWS_TRIAL.md`, `docs/MACOS_CANDIDATE.md`: platform setup/distribution and explicit acceptance boundaries.
- `docs/verification/results/**` and archived `.../source/**` include historical scripts/source snapshots; they are evidence artifacts, not an additional maintained test suite to execute indiscriminately. Generated third-party `licenses/**/package.json` likewise excluded from project test inventory.

## 7. Suggested execution partition

A. Fast portable checks: existing JS/TS suites + Pi policy transport/typecheck + all three design Chromium suites + evidence validators/research experiment (report their distinct scope).

B. Linux native services: complete default Cargo unit/integration/doc tests; explicit extension deadline; official pinned Pi RPC + native ignored adapter test; Git full benchmark. Preserve local fixture identity and no-account logs.

C. Installed Debian/AppImage real GUI: extend existing official-driver harness with actual project/editor/search/terminal/Git/plugin/settings flows and restart/graceful-close checks, using disposable filesystem fixture and no paid APIs.

D. Separate conditional tracks: Linux Secret Service success; OS picker/IME; Wayland/scaling; ARM64; Windows/macOS native suites; sustained resource/20-launch metrics with correct Linux observer. List blocked/not applicable honestly rather than silently passing/skipping.

## Inventory snapshot note

Other workers began editing the workflow/Pi scripts and adding `sample_linux.py`/`prepare-pi-fixture.mjs` during this audit. The omissions and platform cautions above describe HEAD `6b1ad73` / pre-expansion CI, not a review of those uncommitted new implementations. Revalidate the final changed scripts before execution. This reviewer did not change repository files.

### Inventory addendum: maintained non-test-named harnesses

The initial filename search omitted maintained harnesses whose filenames do not include `test`:
- `apps/desktop/src-tauri/examples/extension_smoke.rs`: run `xvfb-run -a dbus-run-session -- cargo run --locked --manifest-path apps/desktop/src-tauri/Cargo.toml --example extension_smoke -- /absolute/report.json`. Real windowless Tauri/production-API extension lifecycle, temporary projects and actual sidecars; explicitly **not GUI**. Previously absent from Linux CI; new expansion includes it.
- `packages/editor/tests/chunked-wake.mjs`, `quick-open.mjs`, `recovery-notice.mjs`, `view-lifecycle.mjs`: run each `node FILE /absolute/report.json` with root esbuild/Playwright Chromium dependencies. Real React/CodeMirror component browser harnesses with deferred/fixture RPC, not installed native GUI. Previously absent; new expansion includes all four via directory glob.
