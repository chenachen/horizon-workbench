# Q2 恢复完成后的草稿列表刷新候选

仅 `apps/desktop/src/features/editor/RecoveryNotice.tsx`，未 apply live source，未 push。真实 `EditorStore.restoreDraft`、Rust checkpoint / recovery_resolve、恢复正文和选择区语义均未改；没有按 fileId 隐藏草稿或改提示文字。

已亲看 root 的 Q2 原图 / AX 与 owner 记录：e8b8 恢复正文和 selection 已成功，原生仍显示 1 份待恢复、旧 05:26:20 时间；`04-owner-restored.json` 中旧 EE 已不存在，新 786 / rev1 / 21:30:09.736、92 B、selection 74/74，原盘仍 65 B。原证在 `docs/verification/results/q2-recovery-native-20261102/e8b8-post-crash-1793568540509-03-q2-draft-restored.{jpg,ax.txt}` 与 `docs/verification/results/q2-crash-recovery-native-20261102/04-owner-restored.json`，未覆盖。

源码时序：restoreDraft 先将 buffer.checkpointId 指向旧稿并 emit；写入新 document checkpoint 回执后，checkpoint 再将 buffer 指向新稿并 emit；最后才 await recovery_resolve 删除旧稿。RecoveryNotice 因两个 recoveryState 改变重跑 list effect、换 request token，且可在删除前读到旧稿。恢复成功仍检查最初的 list token，因自身状态变化跳过成功收口；resolve 之后没有新 store emit，因此可能永久展示已删旧稿。

最小修复：新增只随 projectId / projectEpoch / unmount 失效的 operationScope，供 restore 的成功、错误与 finally 判断所属页面。成功时立即使旧 list request 失效，只移除精确 checkpointId、清比较，再显式 refresh，从 recovery_resolve 已完成后的状态重读。原 list / compare 请求防陈旧守卫、exact-checkpoint candidates 过滤均保持。

验证使用真实 RecoveryNotice 与实际 EditorStore，只有 RPC 完成次序受控，未仿写 store 恢复逻辑。基线 `before-race-result.json` 958 ms 真实失败：buffer 已 cp-new / dirty / 正确文本与 selection，旧稿已删除，但删除前旧 list 响应在恢复成功后到达，仍展示 cp-old，断言 `1 !== 0`。原失败文件保留。

同一 race 修后通过：删除完成后的第 4 次 list 重读先返回，再送达旧 list，旧稿不复活、提示消失；真实恢复 buffer / selection / dirty 不变。另在同一聚焦组件检查中验证切换 B 后旧 A 完成不清 B、不触发 B 的额外读取；卸载后迟到完成不 refresh 或复活 UI。`after-race-result.json` 合计 5 阶段、1136 ms，0 page / console errors。定向 TypeScript 825 ms、1 overlay、7 imported sources、0 diagnostics，live source 未变化；source.patch 的 git apply --check 通过。

未运行全量 build、Rust 编译、GUI、原生恢复或 crash，未读写应用 appdata。候选只证明前端 race 修复；后续原生只按 root 既定 H005 A 待恢复稿一次 Restore 检查提示消失，无新 crash / fixture。
