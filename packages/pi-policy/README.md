# Horizon Pi policy

The host embeds `horizon-policy.ts`, writes that exact source into its private runtime directory, and loads only that extension. Pi 1.4.0 owns model calls, conversation state and the tool loop. This package adapts four tools to the Rust broker; it does not implement an agent.

Chat: `--no-tools --no-extensions --no-mcp --no-skills --no-prompt-templates --no-themes --no-context-files --no-approve`.

Task: the same resource flags, `--no-builtin-tools`, explicit `-e` for this extension, exact tool allowlist. Every write/exec operation is approved once with a SHA-256 digest. The socket and random capability belong to one run. Unknown operations, stale permissions, bridge loss and cancellation fail closed. Read/list stay within the copy. Command execution receives an explicit environment with no provider secrets.

The native process and trusted policy are not an OS sandbox. A command approved by the user has their OS privileges. Task worktrees protect ordinary edits and support baseline review; they do not restrict an approved program's system access.


## Runtime and message storage

The native adapter lives in `apps/desktop/src-tauri/src/agent.rs`; the UI lives in `apps/desktop/src/features/agent`. A connection records either the exact user-installed Pi path or the Horizon-managed 1.4.0 runtime. Removing the managed runtime preserves connections, credentials, history and user-installed copies. An in-use managed runtime cannot be removed. Each connection has separate Pi directories for Horizon keys, runtime-owned authentication and external/local authentication. Switching modes does not let an old Pi login override the selected Horizon key. Legacy runtime-owned auth is copied into its new directory once; the original is preserved.

Pi exits after a settled run. Resuming starts the fixed runtime with the existing Pi session file; it does not replay prior user inputs. Connection tests use `--no-session`. No real provider credentials are included in the test fixtures.

Message storage is bounded per session at 32 MiB, including Pi history, Horizon transcript summaries and full message files. Host writes check the limit before appending; Pi-owned file growth is checked on message/compaction boundaries and stops the run with `RESOURCE_LIMIT` when exceeded. A Pi JSONL record is read with a 4 MiB cap, retaining partial bytes across cancellation polling. Existing history is preserved when a limit stops a run.

The UI keeps at most 100 message summaries and 50 tool entries per loaded project. Long messages expose explicit 32 KiB UTF-8 pages. The native store does not retain completed transcript bodies. Slow consumers receive the final content reference instead of an unbounded queue of deltas; final and interrupted text is persisted within the session budget. Prepared context snapshots are consumed on submit; pending snapshots are bounded by count and the 128 MiB task baseline budget.

## Reproducible verification

Run from the repository root with an official Pi 1.4.0 binary:

```sh
HORIZON_PI_BINARY=/absolute/path/to/pi node scripts/test-pi-rpc.mjs
HORIZON_PI_BINARY=/absolute/path/to/pi node scripts/test-pi-native.mjs
node scripts/test-pi-policy.mjs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml agent::tests -- --test-threads=1
```

The RPC/native scripts use a controlled local OpenAI-compatible service. They exercise the real Pi process and, for the native suite, the actual Rust tool broker. Coverage includes deny/allow/cancel, isolated worktree review, stale disk/editor versions, exact tool allowlist, no command credential inheritance, two-instance limits, attachment limits, long Unicode responses and an unacknowledged Channel. The policy transport test splits Unicode responses into single-byte socket writes and reproduces corruption without the decoder fix.

Machine-readable results and raw logs are under `research/verification/pi-*`. Native GUI acceptance and genuine provider credentials are separate checks; protocol fixtures do not substitute for either. `scripts/test-pi-resources.mjs` measures the standalone official Pi process only, not the combined app/WebView footprint.
