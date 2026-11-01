# UI004 平台原生确认 — PREPARED / MIXED CHECK RESULT

仅 UnsavedChanges / lib.rs 两个产品文件，未 apply。沿用 tauri-plugin-dialog 2.8.4 / rfd 0.17.2，未加 JS 包、Cargo 依赖、ACL 或平台适配。当前 9316 的 inline AX/焦点失败保留，不计作通过。

原生路径经现有 horizon_call 调固定空参数、app-scope form_discard_confirm。Rust 绑定 main 父窗口，以 show_with_result 回调 + oneshot 异步返回；不使用 blocking_show，不执行业务放弃。按钮依次为继续编辑 / 放弃修改 / 字面 Cancel。默认首钮继续，Cancel 对应 Escape；仅 Custom("放弃修改") 结果为 true，取消、关闭与其他结果 false，不倒置 show 的布尔值。

固定 method 只有一个在途 guard，覆盖 App 与 AgentSettings 两个 hook；重复请求直接 false，不排队。guard 被原生回调持有至回调结束，不会因前端 hook 卸载/等待 future 取消而提前开放第二个 sheet。

现有所有 caller 保持 confirmDiscard(dirty,busy): Promise<boolean> 与 confirmation 返回值。函数第一行立即捕获 activeElement；同 hook pending/busy 返回 false，clean 返回 true。Continue/取消只复位仍 connected 的原元素。卸载立即解决 false并清原 pending；晚回包不改状态/焦点。App/连接/Launcher 的业务关闭与保存逻辑未改。

原生 API 失败返回 false、保留表单，并复用现有 ErrorNotice 显示可见错误；不退回 HTML 确认或伪装成功。仅浏览器预览保留原 Modal fallback，删除 inline host 命名/inert/style/alertdialog 机制。Modal 本身仍是原 81ef。

窄 TypeScript 检查已通过（0 diagnostics，1024 ms，source 未变化），source.patch 的 git apply --check 已通过。真实 hook + bridge / Modal / ErrorNotice、受控 Tauri invoke 的 5 组 native 分支观察均通过：clean/busy、false 与调用时焦点/same-hook pending/另一 hook false、RPC 失败可见错误、unmount + late true、true 后 caller 卸载。这里只验证实际前端边界，不冒充执行了 Rust guard 或原生 dialog。

首轮整体 hook 检查因 browser fallback 失败。原始 runner / entry / report / TS 结果另存 checks/run01；原始 hook-result.json 未改。经 root 许可仅该失败的单次定向复查仍失败，未改两产品文件：首次 Escape→继续编辑 false、model 焦点和父 dialog 保留通过；第二次 Escape 与首次父 cancel 相隔 18.7 ms，此时父 dialog DOM 仍在但 open 已 false，随后 Continue 实际获焦、Enter 实际 click 继续编辑且结果 false，model 值保留，父 dialog 未恢复。JS showModal/close 记录没有父 close 调用。原因未定，不能将此记为纯即时断言问题或产品通过。第二次复查在此停止，browser 明确 Discard 分支未执行。详见 browser-fallback-result.json 和 browser-fallback-summary.json；没有重跑旧 20 条件。

Rust 未做本机编译，也未新增重复 enum/AtomicBool 的镜像测试。原生按钮、默认键、Escape、跨 hook 单在途、AX 与精确输入焦点需后续完整 release 及实际原生短卡验证，静态源码/受控 IPC 组件结果不能替代。
