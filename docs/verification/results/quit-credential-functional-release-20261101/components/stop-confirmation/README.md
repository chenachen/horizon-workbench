# 退出/停止失败归属当前确认框（PREPARED ONLY）

仅准备 `App.tsx` 候选；产品源码、运行中的原生应用均未修改，未构建、未操作 GUI。纯视觉 auxiliary patch 仍为 POSTPONED，与本次无关。

原生依据：`docs/verification/results/processes-terra-20261101/q1-1793535544818-{05-save-failure,05-save-recovered,06-final-quit-impact}.*`。恢复保存后 dirty 清除、保存按钮禁用、磁盘内容已由原生测试核实；`06-final-quit-impact.ax.txt` 同时出现“没有未保存文档”和旧全局保存失败提示。

当前 `applyStop` 将 saveAll false / stop apply 失败交 `reportError`，写入 App 全局错误。`prepareStop` 创建新计划时不会覆盖该错误，因此恢复保存与下一次退出计划仍可看到旧提示。每文件 `buffer.error` 在 editor store / EditorWorkbench 另有状态与呈现路径。

候选仅修改一文件：

- `applyStop` 保留 finally 释放 busy，让实际操作失败拒绝给当前 `StopConfirmation`。
- 确认框在提交事件内清本次错误并捕获失败，显示局部 `role="alert"`。重试立即清本次错误；取消/关闭通过卸载重置；`key={plan.planId}` 使新计划重置局部错误和决定。
- 不调用全局清错，不改每文件错误；准备计划失败仍使用原有全局错误路径。

按 Vercel React `rerender-move-effect-to-event`，交互逻辑保留事件处理函数；不添加 effect、后台监听或通知系统。`StopConfirmation` 仍为模块级组件。

## 最小组件验证

运行真实 `App → DesktopShell → StopConfirmation`、`Modal`、`ErrorNotice` 与真实 DOM 点击。mock Tauri / bridge、appearance、plugins、editor 模块。通过 App 原有 `horizon.closeRequested` 事件建立真实确认框；受控 saveAll false / pending / 退出 RPC failure 注入异步边界，不调用原生。每文件错误用 sentinel 检查没有被对话框代码清除；保存恢复由受控状态表示，不冒充重新验证真实文件权限/保存实现。

最终 before/after 各 3 组，2543ms，零浏览器/console 错误。**before 的 passed=true 表示成功复现旧缺陷，不表示旧产品正确。** 原始 result 保留全部调用和状态。

1. 保存失败：before 写全局并覆盖独立错误；after 仅写局部，保留独立全局错误与每文件错误。pending 重试清局部；新 plan / Cancel 重置局部，其余错误保留。
2. 关闭按钮卸载确认框；重新打开不继承操作错误，其余错误保留。
3. 保存已恢复的新 clean plan：before 仍显示旧全局保存错误；after 无该局部残留。随后 stop-apply RPC failure 仅写当前确认框，独立全局错误仍保留。

首轮缺 4 个 bridge mock 导出，未执行组件断言；原始脚本/结果保留 `attempt-01/`。仅补齐隔离模块的命名导出后完成上述一次定向运行，无产品修改，无扩展套件。此结果为组件边界证据，不宣称候选已通过原生回归。

## 文件与 SHA256

- `source.patch`：唯一产品变更候选。
- `before/apps/desktop/src/App.tsx`：`bcf6aff0d18437d32371012a925cb7b531ec70a2fb55a45a97c5a92eb204429d`
- `after/apps/desktop/src/App.tsx`：`b84605a820ee1d2c3746b953f40f7d773c479213622bb295dc45f6aa74ad91c6`
- `run.mjs` / `result.json` / `run-receipt.json`：实际脚本、原始报告与运行记录。
- `source-sha.json` / `source/`：另存 editor store 与 EditorWorkbench 的只读依据；结束时 App 与两份支持源码均 SHA 不变。

尚未应用，交 root 审核后与本批功能修正合并。
