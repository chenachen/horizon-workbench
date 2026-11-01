# macOS 文件面板 CPU 调查与实验撤回

2026-11-01，settings-project release `95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6`、Horizon PID34128、macOS 26.3.1（25D2128）。该二进制包含已撤回的 rfd 生命周期实验；源码撤回不改变仍在运行的旧二进制。

## 实测结论

同包、同 PID、同 1280×800 欢迎页，每阶段125秒、前60秒预热后统计全部责任进程。所有面板 helper 均计入总量，未杀 helper、未重启宿主。

| 阶段 | 实际动作 | 总 CPU 均值 | panel40868 均值 | 总 physical footprint 均值 |
| --- | --- | ---: | ---: | ---: |
| [A](../settings-project-panel-a-125s/audit.json) | 未打开文件面板 | 0.221823% | 未启动 | 98.415 MB |
| [B](../settings-project-panel-b-125s/audit.json) | F09 NSOpenPanel 目录选择，成功导出后关闭 | 3.424934% | 3.190867% | 168.646 MB |
| [C](../settings-project-panel-c-125s/audit.json) | NSSavePanel 列视图，成功导出外观方案后关闭 | 6.430524% | 6.249457% | 173.899 MB |
| [D](../settings-project-panel-d-125s/audit.json) | 同保存路径切为列表视图，另名成功导出后关闭 | 4.215005% | 3.998779% | 172.465 MB |

B/C/D 均超过单核1%的建议值。D未消除成本；C/D沿用同一 helper，先前面板历史和时间变化未隔离，不能从下降幅度认定列表视图修复了问题。C的实际AX显示空目标外还有所有祖先目录列，临时目录列包含166项及采样输出的兄弟目录，因此空目标不等于只枚举空目标。旧候选6/7的约13%结果属于另一场景，继续保留，不能与本表拼成优化前后对照。

C后协调空档执行一次8秒只读 `sample 40868 8`，原始记录见 [完整栈](panel-40868-post-c-sample.txt) 与 [进程/FD元数据](panel-post-c-process-metadata.json)。工作线程采到 `TNode::HandleSync` 334次，其中 `SynchronizeChildren → TFSInfoSynchronizer::FetchChildren` 239次、`_GetDirectoryURLs` 对应分支200次，继续做目录枚举、属性和访问检查。主线程主要等待事件。样本计数是栈采样命中数，不是固定场景CPU统计。

`lsof`未给出被枚举目录；cwd `/`、boot volume队列名称不证明正在枚举根目录。`launchctl procinfo`要求root，返回失败，未提权；归属使用C/D原始采样中 `responsible_pid=34128` 的证据。热点在系统服务，触发及保活原因尚未证实，不认定为Apple缺陷。

## 源码与公开 API

Horizon `apps/desktop/src-tauri/src/lib.rs:136` 将目录选择放入 `spawn_blocking`，完成后仅保存路径与选择token；`src/appearance.rs:688–709` 同样等待保存面板结果；`src/state.rs:144` 保存 `PathBuf` 与时间。未发现宿主保存原生面板句柄。

精确依赖 `tauri-plugin-dialog 2.8.4/src/desktop.rs:178–180,208–210` 在主线程构造 rfd async 面板，worker等待future后返回路径。上游 `rfd 0.17.2/src/backend/macos/modal_future.rs:54–65` 的completion取走 `state.modal`、复制返回路径、释放Rust面板所有权并唤醒；`:79–102` 使用继续运行的AppKit主循环与sheet。`file_dialog/panel_ffi.rs:39` 调用 `beginSheetModalForWindow:completionHandler:`。归档的实验改动只在completion后加入 `orderOut/close`，见[原始patch](experiment/horizon-macos-panel-lifecycle.patch)、[来源与hash](experiment/HORIZON_PROVENANCE.json)及[实验源码](experiment/src/backend/macos/modal_future.rs)。

已核对的公开边界：

- [Apple beginSheetModal](https://developer.apple.com/documentation/appkit/nssavepanel/beginsheetmodal(for:completionhandler:))：completion可能早于面板离屏；需要立即离屏时可调用orderOut。
- [Apple orderOut](https://developer.apple.com/documentation/appkit/nswindow/orderout(_:))：移出屏幕，不负责释放对象。[Apple close](https://developer.apple.com/documentation/appkit/nswindow/close())描述窗口关闭与释放规则；NSPanel默认不随close自动释放。
- [Apple NSOpenPanel](https://developer.apple.com/documentation/appkit/nsopenpanel)：现代macOS由独立进程绘制文件面板。[openPanel](https://developer.apple.com/documentation/appkit/nsopenpanel/openpanel)与[savePanel](https://developer.apple.com/documentation/appkit/nssavepanel/savepanel)创建新面板。服务存在本身不证明对象泄漏。
- 本机SDK `MacOSX.sdk/System/Library/Frameworks/AppKit.framework/Headers/NSSavePanel.h:144–159` 的公开入口为cancel、sheet/modeless/modal呈现；`NSOpenPanel.h:22` 是创建入口。核查范围内未找到用于销毁OpenSavePanel服务或其目录观察者的公开API。SDK绝对路径、解析后的路径与hash记录在[机器报告](report.json)。
- [rfd #270](https://github.com/PolyMeilex/rfd/issues/270)报告服务持续存在，也提到Chrome，但未确立CPU原因。[rfd #354](https://github.com/PolyMeilex/rfd/issues/354)的独立程序停止原生事件处理条件不同于Horizon，不能据此增加事件泵或禁用动画。

没有证据支持额外添加cancel/endSheet、改用runModal、修改私有视图偏好或强制终止系统服务。当前保持上游实现，后续最终固定场景继续计入所有责任helper并如实报告CPU。

## 已执行的撤回

移除 `apps/desktop/src-tauri/Cargo.toml` 的rfd本地覆盖；`Cargo.lock`恢复同版本crates.io来源与校验值 `20dafead71c16a34e1ff357ddefc8afc11e7d51d6d2b9fbd07eaa48e3e540220`，与本机原始crate归档一致。`THIRD_PARTY_NOTICES.md`同步标为上游原版。

移除前核验全部61个上游源文件：只有已记录的两处实验修改，另有patch/provenance两个文件，无额外文件或未记录修改。[移除文件清单](removed-vendor-files.json)保留63个hash。原始patch、provenance、MIT许可证与两份实验源码先归档，再删除仅为实验引入的 `vendor/rfd`。

撤回不是CPU修复。此次调查代理未重建、未运行测试。后续根任务已完成 Cargo locked/offline metadata 核查，并重新生成许可证归档（197 npm、335 crate、2086文件）；当前清单中的rfd为上游registry来源。原始测量时间与运行二进制身份保持不变，最终重建和固定场景性能仍由根任务完成。
