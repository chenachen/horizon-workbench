# 总览返回当前项目：组件回归归档

这份归档保留已完成检查，未重跑。产品源码仍未应用修正，native 修后核验待主线程安排。

`result.json` 的 before `passed: true` 表示**成功复现旧缺陷**：host epoch 已升至 2、激活回包仍被扣留时，总览提前关闭，真实 LauncherToolbar 重挂，两条 list 携带 epoch1 均收到 STALE_SCOPE，出现局部错误和全局 toast。它不表示旧产品通过。

after 仅在内存中应用 `navigation-activate.patch`。pending 保留总览，不挂 launcher、无 list；激活完成后两条 list 均用 epoch2 并加载方案；激活失败仍保留总览和原错误。它是候选修正的组件结果，不替代 native 修后验收。

## 检查边界

- 真实：App/DesktopShell、LauncherToolbar/useLauncher、bridge，包括实际 React 事件/挂载、bridge epoch map/request 和 launcher 的并行 list/report 链。
- 受控：appearance、editor、plugin hooks/模块；Tauri IPC/event 响应。没有完整产品/native 宿主仿真。
- 原生证据 `appearance-terra-retest-current-20261101/*16-workbench-launch-status*` 的局部错误可归属 useLauncher。历史 native 仅能确认两条并行 list 中**至少一条**失败；原进程无调用 trace，不能指定先失败的单条 method。组件受控时序证实两条都可携带旧 epoch。
- 没有启动/控制 native GUI、运行产品构建、写 app data 或修改三个产品源。Headless Chromium 检查结束后已关闭。

## 保留内容

- `run.mjs`、`result.json`：已执行脚本和最终原始结果，原样保留 `.work` 路径。
- `attempt-01.json`：首轮 fixture 初始化等待超时；最终改用 loopback 测试路由完成。此文件不作为产品失败。首轮 exec session 元数据未保留，未补造。
- `source/`：App、bridge、processes 三份准确快照；归档前再次核对 SHA256 与最终结果一致。
- `execution-receipt.json`：已保留的 exec_command 和 write_stdin 原始参数/返回值；exit 0。07:54:28.943Z–07:54:30.360Z、1417ms 为 harness 自报时间，未另收 OS 进程起止时间。
- `tool-output.log`：completion 工具返回的 output 原文；工具未分离 stdout/stderr，未伪造独立 stderr 文件。
- `summary.json`、`observation.md`、`navigation-activate.patch`：明确结果语义、原生归属与候选修正。
- `manifest.json`：以上归档文件大小和 SHA256。

下一步仅需主线程集成后真实核一次“项目总览 → 点击当前项目 → 启动方案正常，无局部/全局 STALE_SCOPE”。
