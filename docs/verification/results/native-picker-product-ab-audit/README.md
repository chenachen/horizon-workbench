# Native picker product lifecycle and reading A/B

Actual macOS release process 88219 remained alive through both 125-second reading windows and seven intervening picker lifetimes. All six baseline Horizon identities were counted in every A/B sample. The eight other WebKit candidates belong to CC Switch or Safari, confirmed by responsibility and independent process inspection.

| Post-warmup result | A: before any picker | B: after seven picker lifetimes |
| --- | --- | --- |
| Observed full duration | 125.0053 s | 125.0051 s |
| Raw / post-60s samples | 117 / 61 | 117 / 61 |
| Post-60s covered time | 64.5849 s | 64.5644 s |
| Physical footprint mean | 144.290889 MB | 151.626964 MB |
| Physical footprint P95 | 144.592784 MB | 151.654360 MB |
| CPU mean, % of one core | 0.360263% | 0.218225% |
| CPU P95, % of one core | 0.685174% | 0.588820% |

MB is decimal bytes / 1,000,000. Raw bytes remain in the summaries. Reading memory is below 350 MB and idle CPU mean below 1%. A and B use the same root identity, five clean 184320-byte TypeScript files, 10,000 clean tracked paths, Git ready, hot-4 active, 1280×800, 卡片分区 / iris and Mistlight light. One imported preset was added between windows without applying, so backend settings state is not claimed identical. A's obsolete display label in raw metadata is explicitly corrected by the separate audit; its exact layout ID and actual scene never changed.

The uninterrupted 423.815-second lifecycle observation contains 393 samples. All seven child pickers and 21 Apple service identities appeared with responsibility belonging to Horizon and disappeared after normal selection/cancel while the parent remained alive. The actual folder diagnostic export is 2244 bytes; preset export is 946 bytes; independent hashes match the operator record. Native images and AX prove all three selected/cancel paths, JSON filtering, deferred preset apply, host blocking and settings focus return. One-second scans provide observation bounds, not exact exit latency.

The seventh Save picker ignored two CmdQ attempts. It subsequently closed through normal Cancel. This remains a separate RUN004/UI004 failure and is not erased by successful lifetime cleanup. The later menu helper patch and outer re-sign happened after B and native parent exit; the tested original bundle hashes remain in `audit.json`. Later patched helper behavior requires its own actual native check.

Only the five prior picker CPU failure records are superseded by this actual product retest. Empty/diff/Pi budgets, the final same-state 30-minute loop and active resource exit remain. No full visual or accessibility requirement is inferred from functional screenshots. `post-native-quit.json` separately records all six remaining parent/helper PIDs absent after ordinary host exit; active Pi/PTY/launcher were not part of that quit.

Later scope review: the original unsuccessful picker-open CmdQ observations remain factual. Diagnostic local/menu trace did not observe a key event, and the canonical requirements do not add this combination as a separate mandatory path. The original failure record remains historical and is superseded by an explicit `not_run` scope observation, not a claimed CmdQ success. Actual main-window protected quit and picker-menu protected quit are recorded separately.
