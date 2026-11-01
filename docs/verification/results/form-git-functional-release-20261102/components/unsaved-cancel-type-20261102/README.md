# helper cancel 类型修正 — PREPARED ONLY

只删除 `UnsavedChanges.tsx` 外层 div 的冗余 `onCancel`；保留 div 的 Escape keydown.stopPropagation 和现有 Modal。没有 any、suppress、全局 Modal 改动或产品文件写入。

此前组件验证只经 esbuild 转译，漏了 TS 类型门。首次完整 release 失败原文另存 `source/release-build-first-failure.log`，原字节/SHA 见 manifest；不改旧证据。

实际父层：ConnectionForm 只有 form.onSubmit、共享 Modal.onClose；外设置也只用共享 Modal。它们没有 React onCancel 父处理器。共享 Modal 在实际 dialog 上注册 native cancel listener，preventDefault 后调用当前 onClose；native cancel 不冒泡。helper 的 div.onCancel 既不合法，也无需承担父表单隔离。确认层 Esc 由其自身 Modal 调 finish(false)，keydown 隔离保留。

- `typecheck-result.json`：使用当前 desktop tsconfig、rootNames 仅 helper，内存 overlay 加真实 Modal/类型依赖，noEmit。before 精确复现 TS2322/TS7006；after 零诊断，967ms。不是整产品 release build。
- `result.json`：复用原 harness，只跑当前已合入源码的 after `connection-close` / `outer-close-and-hidden` 两组，7699ms。确认层 Esc 后设置+连接仍在、字段/key 保留；外层 Done/X/Esc 确认层取消不联动关闭父；最终明确放弃仍有效。零 browser/console 错误，无配置或 editor buffer 误写。

旧10组和原始 hash 不变。本目录 `source.patch` 仅一处删除，after helper SHA `bbbee0de938704f4f1eb27b136ad765247d201ebb3e60944cf3e427f3aa44b17`。产品/helper/支持源码仍保持本轮 before。测试与浏览器已结束；root 独占应用补丁与下一次 release。
