# 未保存确认 native 层数候选 — PREPARED ONLY

产品未改；只交 root 审查后集成。没有新构建、native GUI 操作或计时重试。

源码事实：设置为第一层 native Modal；ConnectionForm 为第二层；其 Esc 或带连接草稿的 App closeRequested 再开未保存确认，形成第三层。Launcher 编辑器 inline，Done 确认只形成第二层。现有 Modal 的 useId/aria-labelledby 完整，cancel 在实际 dialog 上 preventDefault；body portal 没有改变 native 层数。root/Terra 报告 f544/PID27780 的 portal 包仍视觉正常、完整 AX 空，Tab 移到继续编辑后仍空。层数与 Q1 差异相符，仍只是原因假设。

两文件改动：Modal 新增默认 false 的 replaceTop；仅 UnsavedChanges 启用。有至少两个现存 native dialog 时，临时 close 焦点所在的顶部 dialog，然后 showModal 确认。保留 Settings 打开，React 表单始终挂载，不调业务 onClose。确认 cleanup 先关自身；仅原顶部 dialog 仍 connected 且未 open 才恢复 showModal，最后恢复原焦点。直接放弃与 App 放弃若已卸载原表单，不会复活它。只有 Settings 一层时不临时关闭，保留 Q1 旧路径。pending/resolver/busy/取消/卸载解决逻辑及 Escape.stopPropagation 均未改。

复用旧 after connection-close / outer-close-and-hidden 隔离场景，保留原 18 次条件，再加入同一连接草稿的 App 退出取消/放弃两次。`result.json`：7719ms，20 次确认检查的 nativeDialogs 均严格为“设置 + 放弃确认”；连接字段/key、继续编辑、Esc、父焦点和明确放弃通过。App 放弃后只剩退出计划，原连接 DOM 已卸载。Q1 一底层路径通过；零 browser/console 错误。测试为 headless Chromium + 真实 App/Settings/AgentSettings/Launcher/Modal，Tauri 与无关边界受控，不代表 macOS AX 通过。浏览器已结束。

`typecheck-result.json`：一次两文件 TypeScript noEmit，零诊断，680ms。`git apply --check source.patch` 通过。前后源码及实际 harness 支持源码 SHA 见 source-sha/manifest；旧 portal 失败与旧报告未改。

复现：`rtk proxy node .work/unsaved-native-stack-20261102/run.mjs`；`rtk proxy node .work/unsaved-native-stack-20261102/run-typecheck.mjs`。Mac 原生 AX 是否恢复仍待 root 下一包核实。
