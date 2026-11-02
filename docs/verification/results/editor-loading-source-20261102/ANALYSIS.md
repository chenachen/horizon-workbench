# G01：真实加载缺口与最小候选

结论：文件树已有真实异步 skeleton；编辑器 cold open／session restore 仍会把尚未读完误显示为「从一个文件开始」。源码结论不是 visual pass；既有73张启动帧未重审、未新拍。

- `App.tsx:115–124/441` 的 boot 与 `390` 的 lazyPanel/Suspense 只覆盖启动和模块下载；`94–97` 先 setProject，`259–269` 才通过 view activation 恢复文件。普通异步 document_open 不触发 React Suspense。
- `FileExplorer.tsx:34–50/70` 已在真实 directory_list 期间显示 tree Loading，缓存已有行时保留内容，空目录只在成功后出现；不修改它。
- `packages/editor/src/store.ts:58–75/77–134` 原有 opens/restoringSessions 是真实 operation；`EditorWorkbench.tsx:87–90` 原先只覆盖 CodeSurface 模块、evicted 文本，未读到首个 buffer 即 welcome。已核这七个相关源码与 a449 sourceHead ed7061 字节一致。

候选只有两个 production 源目标：store 的只读 getProjectLoadState 查询既有 maps/live ticket，并在真实开始与结算 emit；Workbench 复用同一 Loading，保留已知 tabs/breadcrumb、错误/恢复入口与已就绪内容。`source.patch`、`manifest.json` 为最终v2；v1补丁和修改前manifest已保留。

- 不增加 persisted 字段／RPC／延时，不改 restore顺序、session 写屏障、empty project或 FileExplorer。
- old epoch／generation、host stop、project隔离由既有 ticket判定；每个 finalizer 只移除自己仍持有的条目，失败和同步throw也结算。新通知默认保留当前错误。
- pendingSessions 是 view启动前的恢复意图，不能用 restored=false 冒充持续I/O；此候选只公开实际 opens/restoringSessions。App 前置激活仍由既有 busyProject spinner表达，不伪称本次已补全整个启动参考态。
- 仅 documentLoading 时暂停 with-preview 双列与 Preview 子树，防止旧evicted空内容占第二栏；已就绪 preview偏好与正文流程不变。此谓词为源审，尚无新 native/renderedUI证据。

实际验证：复用原 Vitest fixture／transport／fake timers，仅.work隔离副本运行 **20pass／0fail／40skip**：新增12例加既有8例；212ms。覆盖 cold pending、去重/并发、成功/三类失败、old-ticket保new-pending、跨项目/host-stop、multi-tab恢复和原session写屏障/payload、ready buffer保留、真实空session不造I/O。精确命令及JSON在 `FOCUSED-RESULT.json`；未跑build/浏览器/GUI，production source/test未由本agent修改。root已确认无需重复同20。

下一最小自然动作由 root/Terra排：新包本run尚未读取过时，正常选择现有 `Paths 100k` → 文件栏，复用已有被动capture。owned路径 `/private/var/folders/9j/xnw538c934b2s559tl01cc800000gn/T/horizon-resume-editor-yesw9ppu/Paths 100k`；生成器实际100个根group、各10个module、各100文件，每次目录limit200，不是10万平铺。此动作只可能证明文件树真实初读，不保证可捕时长，更不能替代editor恢复；warm cache不清、不重造夹具/延时。编辑器部分应沿用已有非空session/evicted clean tab的一次自然读取，不能为凑两区同时 skeleton 给空项目造加载。尚未得到可比原生G01，canonical保持未验。
