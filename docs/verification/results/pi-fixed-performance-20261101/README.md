# Installed release Pi resource scenes · 2026-11-01

Build: `12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d`, installed `/Users/chenpengxiang/Applications/Horizon.app`; macOS 26.3.1 (25D2128), Apple M2 Pro / 32 GiB. Real managed Pi 1.4.0, controlled loopback OpenAI Chat Completions service. No commercial-provider claim.

Each scene ran 125 seconds with no GUI/build/test activity. All 117 samples retained the expected 0/1/2 Pi identities; each post-60-second window has 61 samples spanning more than 64 seconds. Horizon includes the main process plus six attributed macOS helpers. The external fixture provider is reported separately.

MB means decimal 1,000,000 bytes. Physical footprint uses macOS `RUSAGE_INFO_V2`; sums can include shared accounting. RSS is available in raw data and is not private memory. CPU is percent of one core.

| Scene | Product footprint median MB | Product P95 MB | Whole-window peak MB | Post-60s CPU mean | External provider median MB |
|---|---:|---:|---:|---:|---:|
| 0 Pi, empty chat | 189.748 | 191.878 | 205.526 | 0.2810% | 26.544 |
| 1 Pi, active stream A | 275.585 | 284.350 | 320.952 | 17.9715% | 27.200 |
| 2 Pi, active streams A+B | 380.263 | 413.228 | 424.434 | 31.7887% | 28.560 |

The single-Pi product pipeline stays below the suggested 600 MB physical-footprint budget throughout this measured window. The zero-Pi post-warmup CPU stays below 1% of one core. Scenes 1 and 2 stream at about ten updates per second per Pi and must not be compared with the idle CPU budget.

These are sequential application scenes: A remains active when B starts, and the foreground project changes from A to B. Session ages and visible content differ. The zero-Pi scene has enabled features and existing projects; it is not the all-plugins-off host benchmark. Streaming deltas do not prove the 120 MB idle-Pi increment. No new listener/subscription diagnostic counts were collected.

Native preparation and process ownership: [owner records](../pi-perf-owner-20261101/); images/AX are referenced there and in `../pi-terra-20261101/context-fix-1793529728678-manifest.jsonl`. Each scene directory retains metadata and every raw process sample. [Product accounting](product-accounting.json) derives the exact per-sample sums rather than subtracting or adding independently calculated medians. External WebKit candidates belonged to CC Switch (responsible PID 645) or Safari (732), independently checked by PID/start/executable.

Collector receipts preserve actual invocation, start/end and exit code: [scene 0](scene0-receipt.json), [scene 1](scene1-receipt.json), [scene 2](scene2-receipt.json). Scene 2 ended at 12:14:44.358 UTC, before A’s conservative 12:15:04 deadline; both Pi identities appear in every sample. Subsequent GUI stops and ownership cleanup are separate evidence and do not extend the measured windows.

After measurement, Pi finished A’s 126,021-character reply at 12:15:10.540 UTC and issued a distinct checkpoint-summary request (provider ordinal 16). The fixture’s marker-matching branch also matched that summary input. This was after scene 2 ended and before the two explicit GUI stops; it was not a replay of request 14 or 15. Both Pi identities were then confirmed gone while the external provider remained alive. The initial expected-count mismatch is preserved in the [initial hold](../pi-perf-owner-20261101/scene2/post-stopped-initial-hold.json); the [investigation](../pi-perf-owner-20261101/request16-investigation.json), [own-session evidence](../pi-perf-owner-20261101/request16-a-transcript-proof.json), and [classified terminal check](../pi-perf-owner-20261101/scene2/post-stopped.json) explain the actual count of 16. No completed compaction event is claimed.
