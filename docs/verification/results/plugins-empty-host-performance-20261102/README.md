# 全插件卸载后的空宿主采样

2026-11-02，macOS arm64 release；安装主程序 SHA-256 为 `9316ce984d50c945f72fb62903633872feac1bf2bf00a7b51b7ce7a9ce60c5ad`。这是完成插件生命周期操作后的同一进程，未通过重启或清除系统缓存降低数字。工作区及自有项目仍登记，窗口 1280×800、100%，显示 Git/编辑器不可用占位；原启动器卸载提示仍可见。

采样启动于 `2026-11-01T21:04:44.908974Z`，正常退出，实际覆盖 125.0052 秒、117 个完整样本。前 60 秒排除后为 61 个样本，覆盖 64.5789 秒。整个区间保持相同 7 个进程身份，根进程未缺失，无 GUI、编译或产品测试操作。

| 指标 | 实测 |
| --- | ---: |
| 稳态物理 footprint 均值 | 228.012 MB |
| 稳态物理 footprint 中位数 | 228.021 MB |
| 稳态物理 footprint P95 / 全窗峰值 | 228.054 MB |
| 稳态 CPU 均值（单核 100%） | 0.3754% |
| 稳态 CPU P95 | 0.9512% |
| 稳态 RSS 总和均值 | 455.060 MB |

MB 按 1,000,000 字节。RSS 包含共享映射，不等同私有内存。物理 footprint 也可能包含共享记账；所有归属进程均计入，没有扣除系统 helper。

| 归属进程 | PID | 稳态 footprint 均值 |
| --- | ---: | ---: |
| WebContent | 74801 | 114.107 MB |
| Horizon | 74714 | 52.053 MB |
| WebKit GPU | 74799 | 30.049 MB |
| SafariPlatformSupport.Helper | 76905 | 13.026 MB |
| ThemeWidgetControlViewService | 74807 | 9.208 MB |
| WebKit Networking | 74800 | 6.587 MB |
| Audio SandboxHelper | 74802 | 2.982 MB |

空宿主 footprint 高于建议 200 MB 约 28.012 MB，不能标为内存预算通过。主应用、WebContent 与 GPU 合计约 196.209 MB，其余系统辅助进程约 31.803 MB，仍全部计入 228.012 MB。当前证据定位了进程成本，没有证明其中某块是可安全释放的应用泄漏；不通过杀辅助进程、强制刷新或减少已确认界面功能来降低结果。后续若出现可定位的应用保留对象，再修复并定向复测。

最终 F09 在 `2026-11-01T21:02:28.371881Z` 实际导出：已安装插件 0 的原生界面与 registry 对应，原生活动扩展 0；文档、watcher、subscription、活动任务、EditorView、插件实例、worker 命令/视图/事件/Abort listener、disposing 和 disposal failure 均为 0。宿主固有计数保留：eventListeners 12、Cordis root listeners 3、plugin store observers 11、worker command observers 2、activation error observer 1。该导出是采样前快照；每个采样行的 `resources` 均为 null，没有冒充逐秒实时计数。

其他 WebKit 候选的责任进程为 CC Switch PID 645、Safari PID 732，均早于本次 Horizon 启动；它们不归属本应用。采样包含主进程的后代及 macOS responsibility 归属。125 秒的短窗不能替代既有 32 分钟循环，也不能单独证明长期无增长。

原始数据：`metadata.json`、`samples.jsonl`、`summary.json`；实际退出：`collector-exit.json`；逐进程拆分及 7 项核对：`root-process-breakdown.json`。`metadata.json` 内保存原图、完整 AX、最终诊断和卸载结果的路径与 SHA-256。采样实际退出后才通知操作员恢复默认 24 项功能；恢复证据独立登记。
