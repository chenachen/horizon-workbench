# 固定 Git diff 资源测量

2026-11-01 23:49:02–23:51:07（UTC+8），已安装 release `a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27`，PID91087。此结果属于该构建，不重标为后续修复构建。

样本为既有独立仓库：10 个已跟踪变更文件，共 2000 行增删；屏幕显示 `review-00.txt` 的 +100/-100 diff，其余九个文件列在更改列表。窗口1280×800、100%、底部导航、极光深色。Git 自动刷新保持启用，用户操作、构建和组件测试在125秒采样期间冻结。

统计包含 Horizon、全部 macOS responsibility 归属 helper 和实际发现的 Git 子进程。外部测试服务在采样前已停止；采样前原生诊断 activeTasks=0，OS 快照无 Pi/PTY/启动方案进程。该前置快照不表示整个窗口没有短暂自动 Git 刷新。

| 指标 | 实测 |
| --- | ---: |
| 总采样 / 实际跨度 | 117行 / 125.0082秒 |
| 60秒预热后 / 实际跨度 | 61行 / 64.5904秒 |
| 有效完整 footprint 行 | 全窗115；预热后59 |
| 预热后物理 footprint 中位数 | 227.038152 MB |
| 预热后物理 footprint P95 | 227.169224 MB |
| 全窗有效 footprint 最大值 | 227.218376 MB |
| 预热后有效总CPU均值 | 单核0.420471% |
| 预热后 RSS 总和中位数 | 475.693056 MB |

MB 为十进制百万字节；RSS 总和不等于私有内存。物理 footprint 采用 macOS rusage，其加总仍可能包含共享记账。上述有效测量低于 diff 450MB 建议值；不是对所有瞬时峰值的保证。

75.5869秒与124.6399秒两行中，自动刷新的 `horizon-git` 和 `git` 在进程枚举后、rusage读取前退出。两行完整 footprint/CPU 保留 `null`，未填零；CPU首行也没有差分前值。因此没有完整捕获所有短生命周期进程的峰值与CPU。常驻主程序及六个helper在所有行都有有效footprint，主程序未缺失。未归属候选的责任PID为645/732，需结合审查记录确认其他应用身份。

原生场景及F09来源：`../git-terra-20261101/git-91087-1793541773799-manifest.jsonl` 的07记录。实际导出在[诊断JSON](native-export/horizon-diagnostics.json)，文件规模门在[夹具回执](../git-terra-20261101/owner/07-review-fixture-gate.json)。

[采样命令与退出回执](receipt.json) · [环境和归属方式](scene/metadata.json) · [原始采样](scene/samples.jsonl) · [统计](scene/summary.json) · [场景状态](plugin-state.json) · [正常退出后的11个观测身份检查](after-normal-quit.json)

采样后原生正常退出，11个曾观测到的PID/start身份全部消失。没有为此测量启动额外性能场景或重跑既有阅读/Pi/长时循环。
