# Worker cleanup owner RPC — PREPARED, NOT RUN

三文件候选：workerHost.ts、extension_host.rs、现有 workerHost.test.ts。产品未 apply；未执行 TypeScript/Vitest/Rust 编译或测试，未运行本机产品、GUI、构建或 worker。当前 Windows CI 源码未改。

源码链已核：自动 sleep 先停止项目 native session，再 invalidate_project_scope，然后发项目/扩展事件。前端 epoch 只在 activate 更新；旧 worker disposer 使用项目 scope，先被 lib.validate → state.validate_scope 拒绝，根本到不了原本已幂等的 extension_runtime_stop。Remove 后项目不存在也同理。runtime.ts 缓存失败 dispose Promise，只有清理成功才从 ownedInstances 删除，因此假失败可持续被计为 disposing。此链是具体可发生机制；当前 f544 的 2 disposing 尚待既定 diag/日志归因，未计作已证实。

全仓 search：现行 stop RPC 只有 workerHost.ts 这一调用；一个现有 test expect；其他命中仅历史源码归档。extension_smoke 仅 activate/execute，没有 stop RPC；未发现第二现行调用或公开 stop 契约需要保留项目 scope。

新 cleanup 由 app scope 发送显式 `{ extensionId, projectId: string | null, activationId }`。后端仅接受 app scope 和这三个字段；projectId 必须明确 null 或非空字符串。按 extension/project 精确键和三个身份字段匹配 session；null 只指 app 实例，不是 wildcard。无旧实例或已换新 activation 时幂等成功；实际匹配后沿用原 stop_sessions，清理错误照常抛出，Arc::ptr_eq 删除保护原样。activate/execute 分支、项目 gates、runtime 失败保留语义均未改，不吞 STALE_SCOPE，不删诊断计数。

准备的验证，全部 NOT RUN：

- 真实 workerHost 的既有 4 项 + 新增 4 项 Vitest：activate/execute 仍使用项目 scope；cleanup 在失效 epoch 下通过 app 调用携带原 owner；abort/removed 项目路径；app owner 明确 null；native stop 真拒绝仍由 AggregateError 传播。前端 mock 只测试调用与拒绝传播，不仿造 Rust 匹配器。
- Rust cleanup_owner_tests 3 项：state.validate_scope 对旧 epoch/removed 项目拒绝而实际 app cleanup 对 absent session 幂等；app-only/显式 owner 合同；复用已有真实 QuickJS StalledDeactivateSession 的新 A activation/另一 B 项目/其他扩展/null 非 wildcard 保留，注入真实 terminate 失败仍报 CLEANUP_FAILED，随后明确重试只停止所指 A。真实 worker 项仅 Unix，需已有 extension-host 可执行文件。未声称后端隔离已通过。

后续 root 在安全窗口集成后可运行：`rtk proxy node_modules/.bin/vitest run apps/desktop/src/features/plugins/workerHost.test.ts`；`rtk cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --lib cleanup_owner_tests -- --test-threads=1`。当前已做的仅只读 diff/hash 检查与 `git apply --check`，后者退出 0。

旧 2 disposing 不会因本候选而在当前运行中的 runtime 内被静默清零。当前 native 症状、后端执行、跨 epoch 实机生命周期仍待 root 验证；既有失败保留语义保持。
