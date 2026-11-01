# 总览返回当前项目的 STALE_SCOPE 定位（2026-11-01）

本次工作仅只读定位及 `.work` patch/组件检查。未修改产品源码、app data、凭据或证据；未启动/控制 native GUI、构建、提交或改验收矩阵。GUI 由 `/root/gui_terra_max` 持有。

## 原生证据与归属

- 原进程 PID 54593，start 15:43:40 Asia/Shanghai，release SHA256 `b077f8307c0b208bb1d0c514934be09365c915c5f9602deaead7b87c036cc3a8`（身份由主线程提供）。
- actions：07:45:12Z 总览 → 07:45:30Z View 100% → 07:45:41Z 点击当前 Aurora → 07:45:50Z 设置 → 07:45:53Z 编辑器。第一份保留错误的完整 AX 为 `08-editor-context-error`；没有修改 autoSave。
- `08` AX 的“关闭错误提示”对应 `App.tsx:437` 的 `ErrorNotice`，由 `ErrorNotice.tsx:9-17` portal 到打开的 dialog。它是 App 全局 error，出现于设置之上不能据此归因 SettingsPanel。
- 父线程追加真实主界面证据 `terra-retest-1793519041629-16-workbench-launch-status.{jpg,ax.txt}`：AX 117 为启动方案，119 为“项目上下文已过期”（文件物理行 153/155）。此期间未点启动/重试。
- `LauncherToolbar` 的局部 `.process-error` 仅来自 `useLauncher` 的 `useError`，且该 `report` 同时调用父级 `onError`。本次局部错误与全局 toast 可归属同一 `useLauncher` 链。不能从截图分出 Promise.all 中哪条 list 最先失败。

证据目录：`docs/verification/results/appearance-terra-retest-current-20261101`。`16` 原图 SHA256 `9f39efba8cddd5f7d545448287c698fe7e76290feec9e69b3980fd93dbaa7ff0`；AX SHA256 `a88cfddee562b59044924e2558361bc7c4f7f6f0b9726f22e3b752ef7412e22e`，与 manifest 对应。

## 具体调用与竞态窗口

1. `App.tsx:155` 的 `DesktopShell.activate` 先 `setMainPage(null)`，再等待 `activateProject(id)`。
2. 总览时 `App.tsx:435` 不挂 `LauncherToolbar`；上述提前清 mainPage 令其在激活完成前重挂。
3. `processes/index.tsx:814-815` 使用真实 `useLauncher`；其 effect 在 listener 注册后 `reload().catch(report)`（710-717）。
4. `reload` 同时发送 `launch_profile_list`、`launch_list`（645-646），均携带 projectId。`bridge.ts:33-40` 构造 scope 时读取当前 frontend epoch。
5. Rust `projects.rs:89` 的 `project_activate` 对同一 id 亦无条件 epoch++。JS 直到回包、加载 editor 后才 `setProjectEpoch`（App 75-79）。两端之间存在 host 已新 epoch、前端仍旧 epoch 的窗口。
6. 此时重挂的 launcher list 被 `state.rs:196` 正常拒绝，原文正是 `STALE_SCOPE / 项目上下文已过期`。
7. `useError`（processes 150-160）保留局部错误并通知 App；App `reportError`（56）使全局 toast 同时出现。`useLauncher` effect 仅依赖 projectId 等，缺少 epoch；同 id 回包后不会再自动 reload，解释局部错误持续到设置关闭后仍在。

已排除直接 Settings 自动读：`useSettings`（AppearanceProvider 134）使用 app scope，失败不通知全局；SettingsPanel 自动 reload 亦 app scope。`useProjectActivity` 资源读同为 app scope且内部消化失败。editor store 的局部 error 展示亦不是该“关闭错误提示”全局 toast。

原生历史没有 request trace，所以本次原生先失败 method 仍限于两条 list，不能认定单条。真实组件受控调度已证明上述窗口足以生成完全相同的局部+全局错误；不再把设置页或 View zoom 本身作为根因。

## 日志边界

- 仅查询已知 owned PID 54593 的 fd1/fd2，均为 `/dev/null`。
- `lib.rs:57-67`、`69-96` 的 native call/start 没有 request/error 持久日志；`settings.rs:168-175` 的 diagnostics export 只有统计，不含调用错误历史。
- 未扩大搜索用户目录或读取 registry/真实 credentials。无需为本次定位另添日志工程。

## 最小候选修正（未应用产品）

`.work/navigation-activate.patch` 仅调序 `DesktopShell.activate`：先等待 `activateProject(id)`，成功后才清 mainPage 与 sleepingSnapshot；失败保留总览与原错误。未变更 epoch 验证、未吞错误、未改 autoSave/插件行为。

Patch SHA256：`7306d22bd1e516a418b382ae11d8a0adad5b3b7424f30cdd2157d329a8a6c294`。

## 真实组件 before/after（已执行）

复用 `.work/check-terminal-closed.mjs` 等既有 esbuild `write:false` + Playwright route 模式。运行脚本 `.work/navigation-activation-component.mjs`，结果 `.work/navigation-activation-component-result.json`。真实导入 App/DesktopShell、LauncherToolbar/useLauncher、bridge；隔离无关 appearance/editor/plugin 模块，仅对 Tauri IPC/event 边界做受控响应。不是三行逻辑镜像，也不是 native 修复验收。

一次最终运行 07:54:28.943Z–07:54:30.360Z，1417ms，exit 0：

- before：host epoch 先升到 2，扣留 activate 回包；总览提前消失，真实 toolbar 重挂，两条 list 均携带 epoch1、收到 STALE_SCOPE；局部与全局都显示原文。回包后不再发生 launcher reload。
- after（仅内存替换候选行）：pending 仍总览；0 toolbar、0 launcher list、0 toast。释放回包后两条 list 均 epoch2，成功加载方案、启动按钮可用。
- after 激活失败：pending 与失败后仍总览、无 toolbar/list，原激活错误仍显示。
- before/after 均无 browser/console error；App、bridge、processes 三份产品源 SHA 前后不变。Headless browser 已关闭，路由无真实外网请求。

首轮 fixture 使用非安全测试域，初始组件等待超时，结果保留于 `.work/navigation-activation-component-attempt-01.json`；最终改为受控 loopback 路由后完成。未将 fixture 初始化问题算作产品失败。

待主线程构建窗口：审核应用最小 patch 后，真实 native 只核一次“打开总览 → 点击当前项目 → 启动方案正常、无局部/全局 STALE_SCOPE”。当前独立视觉可继续；不需重复 View 缩放或设置 save-delay 检查。
