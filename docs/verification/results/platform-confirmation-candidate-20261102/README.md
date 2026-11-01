# UI004 平台原生确认 — PREPARED / FOCUSED CHECKS PASS

仅 UnsavedChanges / lib.rs / Modal 三个产品文件，未 apply。沿用 tauri-plugin-dialog 2.8.4 / rfd 0.17.2，未加 JS 包、Cargo 依赖、ACL 或平台适配。当前 9316 的 inline AX/焦点失败保留，不计作通过。

原生路径经现有 horizon_call 调固定空参数、app-scope form_discard_confirm。Rust 绑定 main 父窗口，以 show_with_result 回调 + oneshot 异步返回；不使用 blocking_show，不执行业务放弃。按钮依次为继续编辑 / 放弃修改 / 字面 Cancel。依 locked rfd 和 Apple NSAlert 规则，首钮为 Return 默认，字面 Cancel 提供 Escape；这里只记录静态依据，实际按键仍待原生卡。仅 Custom("放弃修改") 结果为 true，取消、关闭与其他结果 false，不倒置 show 的布尔值。

固定 method 只有一个在途 guard，覆盖 App 与 AgentSettings 两个 hook；重复请求直接 false，不排队。guard 被原生回调持有至回调结束，不会因前端 hook 卸载/等待 future 取消而提前开放第二个 sheet。

现有所有 caller 保持 confirmDiscard(dirty,busy): Promise<boolean> 与 confirmation 返回值。函数第一行立即捕获 activeElement；同 hook pending/busy 返回 false，clean 返回 true。Continue/取消只复位仍 connected 的原元素。卸载立即解决 false并清原 pending；晚回包不改状态/焦点。App/连接/Launcher 的业务关闭与保存逻辑未改。

原生 API 失败返回 false、保留表单，并复用现有 ErrorNotice 显示可见错误；不退回 HTML 确认或伪装成功。仅浏览器预览保留原 Modal fallback，删除 inline host 命名/inert/style/alertdialog 机制。

初始两文件候选的 TypeScript 通过（0 diagnostics，1024 ms），真实 hook + bridge / Modal / ErrorNotice、受控 Tauri invoke 的 5 组 native 分支观察均通过：clean/busy、false 与调用时焦点/same-hook pending/另一 hook false、RPC 失败可见错误、unmount + late true、true 后 caller 卸载。这里只验证实际前端边界，不冒充执行了 Rust guard 或原生 dialog。

首轮整体 hook 检查因 browser fallback 失败。原始 runner / entry / report / TS 结果另存 checks/run01；原始 hook-result.json 未改。经 root 许可仅该失败的单次定向复查仍失败，未改两产品文件：首次 Escape→继续编辑 false、model 焦点和父 dialog 保留通过；第二次 Escape 与首次父 cancel 相隔 18.7 ms，此时父 dialog DOM 仍在但 open 已 false，随后 Continue 实际获焦、Enter 实际 click 继续编辑且结果 false，model 值保留，父 dialog 未恢复。JS showModal/close 记录没有父 close 调用。第二次复查在此停止，browser 明确 Discard 分支未执行。详见 checks/run02 原报告，根目录 browser-fallback-result.json 和 browser-fallback-summary.json 亦未改；这两次失败没有改成通过。

root 随后授权唯一必要第三文件：Modal 的 React onKeyDown 对未 defaultPrevented 的 Escape 执行 preventDefault + stopPropagation + 当前 onCloseRef；原 native cancel listener 保留。没有重开或恢复已关闭的 dialog，没有改输入间隔。已只读核现有子级 Escape：快捷键录制会自行 preventDefault/stopPropagation，局部启动器对话会 stopPropagation；Modal handler 尊重这两类拦截。browser confirmation 自身 Modal 拦下后，不再穿过 React portal 到父 Modal；App 全局键盘监听已有 defaultPrevented / dialog guard。

该第三文件后仅执行一次获批的合并定向检查：TypeScript 871 ms、2 overlay、0 diagnostics、live 源未动；原失败的快速连续 Escape→Escape→Escape→Enter→Escape→明确 Discard 短链通过，前两次 false 保留父 dialog 与精确 model 焦点，最后 true 由 caller 卸载，无 RPC；真实 hook native 桥接 5 组亦通过（本次第一请求由父 Modal 实际 Escape 触发），合计 6 observations / 1407 ms，0 browser/console errors。见 modal-escape-hook-result.json / typecheck-result.json。三文件 source.patch 的 git apply --check 通过。未重跑历史 20 条件。

Rust 未做本机编译，也未新增重复 enum/AtomicBool 的镜像测试。原生按钮、默认键、Escape、跨 hook 单在途、AX 与精确输入焦点需后续完整 release 及实际原生短卡验证，静态源码/受控 IPC 组件结果不能替代。
