# Horizon 前端组件契约

| 文档属性 | 内容 |
| --- | --- |
| 版本 / 日期 | 0.4.0 / 2026-10-31（Asia/Shanghai）；资料初读 2026-10-30，交付整合 2026-10-31 |
| 状态 | 组件、状态机与适配层的设计基线；当前实现与桌面验收结果见[验收矩阵](../verification/MACOS_ACCEPTANCE.md) |
| 范围 | 最小宿主、默认附带扩展、Agent/终端/项目启动等可选扩展；macOS 与 Windows |
| 依赖 | [交互规格](INTERACTION_SPEC.md) 的来源快照、页面行为、REQ-UXI/ADR-UX；产品 `PRD.md` 0.2.0 与 `REQUIREMENTS.md`；技术 `INTERFACES.md` 的服务 DTO |
| 验收定义 | 组件参数/事件可用假数据验证；文件、Git、Agent、进程和资源释放必须以真实服务验证 |

本文件中的 TypeScript 为**拟议的前端边界契约**，不是已存在的应用 API，也不是完整 IPC schema。字段名可与技术文档统一，但作用域、版本、能力、焦点、资源所有权语义不能省略。组件不自行执行文件或 shell 操作；发出意图，由控制器调用受权限约束的服务，再以真实结果更新 props。

## 1. 技术与版本依据

2026-10-30 实际读取官方文档与发布注册表，记录如下；这不是锁文件，也不表示它们已经安装在 Horizon。

| 依赖 | 本次可核验版本 / 依据 | 对本设计的影响 |
| --- | --- | --- |
| Tauri | 官方 v2 文档；发布者 `@tauri-apps/api` 的 npm `latest` 为 **2.12.4** | 前端 API 与 Rust crate/CLI 版本要分别锁定；不能把前端包版本当全部 Tauri 组件版本 |
| React | 研究样例 React/DOM 为 **19.3.1**；官网另有 2.0 RC 信息 | 研究固定 React/DOM 19.3.1；桌面版本在 M0 锁定，见插件调研 |
| CodeMirror | `@codemirror/state` **6.7.6**、`view` **6.43.15**、`merge` **6.12.3** | 模块分别发版；读取“CodeMirror 6”不足以锁完整依赖；合并视图只负责显示，Git 操作由服务验证 |

发布记录来源：[Tauri API](https://registry.npmjs.org/@tauri-apps/api/2.12.4)、[React](https://registry.npmjs.org/react/19.3.1)、[CodeMirror state](https://registry.npmjs.org/@codemirror/state/6.7.6)、[view](https://registry.npmjs.org/@codemirror/view/6.43.15)、[merge](https://registry.npmjs.org/@codemirror/merge/6.12.3)。包仓库字段与官方项目对应；补丁版本是该日查询结果，实施时由技术设计统一选择并做双端验证。

CodeMirror 的状态与视图分离，视口外内容不必全量渲染为 DOM，但文档状态仍需要资源。本设计据此使用文档句柄、有限视图和明确销毁，不能据此宣称大文件或内存预算已达标。[CodeMirror System Guide](https://codemirror.net/docs/guide/)。React effect 的清理函数与外部 store 退订可清除 UI 订阅；前端卸载回调只释放 UI 资源，不等同于停止后端进程。[React useEffect](https://react.dev/reference/react/useEffect)。Tauri 的系统 WebView/核心进程边界要求真实测量关联进程；风格选择不能推导内存结果。[Tauri Process Model](https://v2.tauri.app/concept/process-model/)。

Material 作为视觉和交互语言，不要求 MUI。采用 React 可访问 primitives 或自有薄组件；MUI 按实际交互/包体验证再决定，保持单一 React 运行时。组件选型必须先验证弹窗、菜单、树、中文 IME、VoiceOver/NVDA，不能只看示例截图。

## 2. 共用类型、所有权与事件规则

```ts
type Id = string;
type Scope =
  | { kind: "app" }
  | { kind: "project"; workspaceId: Id; projectId: Id; projectEpoch: number };
type ProjectScope = Extract<Scope, { kind: "project" }>;
type Revision = number; // 服务给定的安全整数 revision
type Version =
  | { kind: "revision"; value: Revision }
  | { kind: "disk"; token: string; contentHash: string; byteLength: string; modifiedAt: string }
  | { kind: "snapshot"; token: string };
// 视图层标记，控制器解包映射至 INTERFACES.md；不是第二套 wire schema。
type UiError = {
  code: string; message: string; retryable: boolean;
  detailRef?: Id; recoveryCommandIds: readonly Id[];
};
type Loadable<T> = {
  phase: "idle" | "loading" | "ready" | "empty" | "error" | "cancelled";
  data?: T; stale: boolean; requestId?: Id; error?: UiError;
};
type ActionState = {
  phase: "idle" | "pending" | "cancelling" | "succeeded" | "failed" | "cancelled";
  operationId?: Id; error?: UiError;
};
type Availability = { enabled: true } | { enabled: false; reason: string; remedy?: Id };
type Capability =
  | { status: "verified"; supported: true; verifiedVersion: string }
  | { status: "unsupported" | "untested"; supported: false; reason: string };
type FocusAnchor = { regionId: Id; itemId?: Id; fallbackRegionId: Id };
type Intent<T extends string, P> = {
  type: T; scope: Scope; payload: P; origin: "pointer" | "keyboard" | "command";
};
type Emit<T> = (event: T) => void;
```

- `scope` 不可根据当前全局项目临时补上；事件产生时就固定。项目切换后的旧确认仍指向原项目，不准对新项目执行。
- `requestId` 隔离异步读取；`operationId` 标识真实写操作。重复确认由控制器合并；结果未知先查询，不盲目重试提交、Agent 输入或启动进程。
- 组件拥有 hover、当前菜单、临时焦点等视图状态；控制器拥有选择、表单草稿与布局；领域服务拥有文档版本、Git/进程/扩展真实状态。完整文本保留在文档模型，主 store 不复制每次按键的全文。
- `Loadable.data` 可在刷新/失败时保留；必须用 `stale` 表达。`empty` 只用于已完成且无数据，不用于尚未加载。静态菜单/确认框的无内容状态为关闭或明确不可用，不造 spinner。
- 隐藏→可销毁视图与订阅；文档、进程、Agent 会话是否结束由专门命令控制。扩展卸载须先完成文档保护与服务释放，不能靠 React effect cleanup 推断成功。
- 所有禁用按钮/命令有 `reason`；指针可查看说明，键盘可从关联文本/菜单项读到。错误容器使用稳定 ID，避免刷新令读屏重复朗读全部内容。
- 密钥不在普通 props、DOM、日志、序列化草稿中出现；只使用 `credentialRef`/`secretRef` 与 `configured`。用户正在输入的密钥只在专用短期控件内驻留，保存或取消即清除。

与技术接口的映射：本文件 `workspaceId` 供 UI 归属，IPC 使用 `projectId/projectEpoch`；`Version.kind=revision` 映射安全整数 Revision，disk 分支映射完整 DiskRevision，不能只用 modifiedAt 校验。`requestId/operationId` 不替代写入的 `idempotencyKey`。任务流按 `instanceEpoch/seq` 去重、发现缺口重取快照；组件只是订阅消费者，不自行绕过 `stream_ack` 背压。UI 的 `ready`/`disconnected` 等可为服务状态与证据派生展示，不要求修改传输枚举。Agent 首版范围已按用户确认收敛为 Pi 默认候选；Codex/Claude 只保留接口。

### 2.1 最小宿主与扩展插槽

```ts
type Slot = "primarySidebar" | "editor" | "secondaryPanel" | "bottomPanel"
  | "settings" | "status" | "projectMenu";
type Contribution = {
  id: Id; extensionId: Id; slot: Slot; title: string;
  scope: "app" | "project"; commandId?: Id;
  availability: Availability;
  minWidth?: number; minHeight?: number;
  focusRegionId: Id; // 名称与焦点由宿主统一登记
};
```

宿主管理窗口、项目记录、布局、命令注册、设置、扩展中心、权限、通知、资源归属和恢复草稿导出；默认附带文件树、代码、Git、搜索等扩展贡献 UI。扩展可安装但未启用、可启用但未运行。扩展中心与恢复入口不得依赖可卸载的文件树/代码/Git。

扩展只能贡献有名称的槽位/命令；不能自行改宿主 DOM、抢占快捷键或添加常驻工具条。`minWidth` 是布局求解输入，宿主可将面板转浮层或互斥标签，扩展必须支持。停用时删除贡献但保留可恢复会话摘要，返回焦点至同一区域替代项或项目导航。

## 3. 主组件契约

### 3.1 WorkbenchShell 与 ProjectNavigator

**页面 / 归属：**A01–A06、B01、G01/G03/G04/G06/G07；最小宿主。对应 REQ-UXI-001/002/003/009/014。

| 契约 | 具体定义 |
| --- | --- |
| props | `workspaces[] {id,name,projectIds}`、`projects[] {id,rootDisplay,name,pinned,status,dirtyCount,runningCount}`、`activeWorkspaceId`、`activeProjectId`、`navigationVariant`、`desiredLayout`、`effectiveLayout`、`focusAnchor`、`loadState` |
| 本地状态 | 当前展开分组、菜单锚点、筛选输入；选中项目是受控值，点击不能先假装激活成功 |
| 事件 | `activateProject({projectId})`、`openOverview()`、`createWorkspace()`、`addProject({workspaceId})`、`projectAction({projectId,action})`、`changeLayout({patch,source})`、`enterFocus()`、`exitFocus()` |
| 返回要求 | 激活失败原项目仍可恢复；移除结果必须已完成未保存/进程处理；期望布局只由用户操作改动，自动适配只改有效布局 |
| 状态 | loading 保留导航壳；空工作区显示添加；sleeping 与手动 paused 分开；状态不可用时允许进入扩展恢复；后台待输入标点和文本不抢导航 |
| 尺寸 | 图标栏 56–72；展开 176–240；项目标题单行省略并给完整名称；8 个布局插件映射见第 5 节 |

**键盘/焦点：**列表上下、Home/End，Enter 激活，Shift+F10 菜单；顶部项目标签使用项目专用 `tablist`，手动激活；按钮名称“切换到项目 X”。与文件标签使用不同 region ID。切项目先保存焦点锚点，恢复目标项目锚点；无有效锚点去树根或空态按钮。主窗口快捷键绑定动作 ID，不能绑定皮肤 DOM 位置。

**验收：**连续甲→乙→甲，甲迟到的加载结果只更新甲；工作区移除不删除磁盘目录；无功能扩展时仍有设置/安装入口。

### 3.2 FileTree

**页面 / 归属：**B01/B02/B10；文件树扩展，符号树可复用可访问树 primitive。对应 REQ-UXI-004/005/011。

```ts
type TreeNode = {
  id: Id; parentId?: Id; name: string; pathDisplay: string;
  kind: "directory" | "file" | "symlink";
  childState: "unloaded" | "loading" | "loaded" | "empty" | "error";
  hasChildren?: boolean; writable: boolean; gitLabel?: string; error?: UiError;
};
// props: scope, nodesById, visibleIds, expandedIds, focusedId, selectedId,
//        rowHeight, rootState, filter, menuAvailability
// events: expand(id), collapse(id), requestChildren(id, cursor?), select(id),
//         open(id, "preview" | "keep"), rename(id, newName, expectedVersion),
//         create(parentId, kind, name), reveal(id), copyPath(id, format), trash(ids)
```

名称编辑在行内，仅编辑一项；Enter 校验并提交，Escape 原样返回。创建占位行显示 pending，真实节点 ID 成功后才替换；失败保留输入。刷新保留仍存在的选中/展开节点；被删焦点移到最近父节点，不能直接 body。

树行建议舒适 32、标准 28、紧凑 24 px；缩进每层 12–16，深层路径通过水平滚动/路径提示解决，不逐层压缩点击区。侧栏 min 220。目录局部 loading 不阻止其他目录。搜索过滤与真实层级分开标示，不能把过滤后的数量读作全部目录数量。

使用 `tree/treeitem/group`、`aria-level`、`aria-expanded`、`aria-selected`；单 Tab 入口。上下移动当前可见节点；右展开/首子项，左折叠/父项；Enter 文件预览、目录切展开；输入前缀可定位，IME 组合不触发。虚拟化前先滚动并挂载焦点行；对已知完整兄弟集合报告正确 posinset/setsize，未知总数不编造。

**验收：**1 万路径不是一次渲染 1 万 DOM；读屏能知道层级；单目录权限失败不清整个树；重命名不覆盖已存在目标。

### 3.3 DocumentTabs

**页面 / 归属：**B01/B06/B08、C08；宿主标签框架 + 内容扩展。对应 REQ-UXI-002/004。

| 契约 | 具体定义 |
| --- | --- |
| props | `scope`、`tabs[] {id,documentId,viewKind,title,pathSuffix,preview,pinned,dirty,gitStatus,externalConflict,loadPhase}`、`activeTabId`、`closeAvailability` |
| 状态 | focusedTabId、溢出列表；每项目最多一个干净 preview；dirty 是领域状态，不能由 CSS 类推断 |
| 事件 | `activate(tabId)`、`keep(tabId)`、`requestClose(tabIds,reason)`、`reorder(tabId,beforeId)`、`openTabMenu(tabId)`；关闭请求先交宿主保护，组件不能立即删标签 |
| 尺寸/响应 | 高 32–40；建议宽 100–220；溢出单行滚动并有列表按钮；不换多行；当前标签自动滚入视野但不影响代码滚动 |
| 命名 | “文件名，目录，未保存，Git 已修改”；Git M 和未保存点同时可读；临时标签有“预览”名称 |

左右/Home/End 移动焦点，Enter/Space 激活；Mod+W 请求关闭，菜单提供关闭其他/全部。关闭成功选右邻，没有则左邻；空集合聚焦打开文件入口。拖动排序有菜单“左移/右移”替代。标签内部关闭按钮不能导致方向键在多个 Tab 停点乱跳，推荐用活动标签的菜单或明确焦点按钮进入关闭操作。

**验收：**关闭脏 preview 不被替换；取消 B08 后 activeTabId 与光标不变；换项目只换集合，不关闭其他项目文档。

### 3.4 CodeSurface、LargeFileSurface 与 DiffSurface

**页面 / 归属：**B06/B07/B09/B10、C01/C05/C08、D06；代码/差异/预览扩展。对应 REQ-UXI-004/005/006/009。

```ts
type DocumentHandle = {
  id: Id; scope: ProjectScope; displayPath: string;
  editorVersion: Version; diskVersion: Version;
  dirty: boolean; readOnlyReason?: string;
  mode: "editable" | "simplified" | "chunked-readonly" | "binary";
};
type Range = { from: number; to: number }; // UTF-16 code unit；不是字节或像素
type DiffSource = {
  kind: "head" | "index" | "worktree" | "buffer" | "commit" | "task-baseline";
  ref: Id; version: Version; label: string;
};
type DiffModel = {
  id: Id; scope: ProjectScope; left: DiffSource; right: DiffSource;
  hunkIds: readonly Id[]; complete: boolean; binary: boolean;
};
```

| 组件 | props 与状态 | 事件 |
| --- | --- | --- |
| CodeSurface | `documentHandle`、控制器提供的 editor state 句柄、`selection`、`scrollAnchor`、`editorPreferences`、`theme`、`saveState`、`externalConflict`；不接全量文本的双向 reactive 绑定 | `edit(transaction,baseEditorVersion)`、`selectionChanged(range,version)`、`saveRequested(version)`、`reveal(range,version)`、`compareExternal()`、`requestClose()` |
| LargeFileSurface | 文件大小、已加载字节/行范围、`hasMore`、只读说明、分块加载状态 | `loadNext(cursor)`、`cancelLoad(requestId)`、`openExternal()`；没有全文能力时不发全文查找 |
| DiffSurface | `Loadable<DiffModel>`、首选/有效形式、当前 hunk、行位置映射、可执行动作 | `navigateHunk(id)`、`changePreferredMode(mode)`、`requestStage(fileOrHunkId,baselineVersion)`、`requestRestore(baselineVersion)`；逐块动作未实现则无对应 availability |
| MarkdownPreview | 文档句柄与版本、渲染状态、外链策略、split/switch 模式 | `requestRender(version)`、`openExternalUrl(url)`、`closePreview()`；本身不写源文件 |

CodeMirror 由内容扩展创建和销毁。切主题/字号/只读属性应配置更新，不能每次重建文档导致撤销丢失；切标签可卸载视图但保留有界状态和恢复稿。卸载代码扩展前宿主必须已取得恢复数据，不能把恢复能力绑在失效扩展上。未确认持久化时拒绝清除最后一份脏文本。

文档行列在服务中从 0 开始，显示时加 1；分块查看器字节 offset 与编辑器 UTF-16 offset 使用不同字段。不能将中文/emoji 的字节位置直接传给 `Range`。

代码区目标 min 560×240；Diff 单栏 min 360，两栏空间不足切行内；分块查看器显示当前位置与已加载范围，不把全文件行号总数猜出来。超大 diff 服务可以截断，但必须显示 `complete=false` 并禁基于不完整内容的块级操作。

编辑器名包含文件/只读状态；只读区仍能选中复制。保存键交控制器，不绕过磁盘版本检查。编辑器接管 Tab 缩进时提供 Escape 后 Tab 离开的可见帮助；差异用增加/删除标签和可读块摘要。中文 IME、撤销、CRLF、emoji、长行、换主题不丢光标为必测场景。

**验收：**保存 version n 时继续编辑 n+1，返回成功只更新 n 的基线；旧补丁不能写入新缓冲区；停止或卸载不销毁唯一脏稿。

### 3.5 QuickOpen、CommandPalette 与 ProjectSearch

**页面 / 归属：**B03–B05；命令框属于宿主，文件搜索 provider 属于搜索扩展。对应 REQ-UXI-005/011/016。

| 契约 | 具体定义 |
| --- | --- |
| QuickOpen props | `open`、`scope`、`mode(file\|command)`、`query`、`Loadable<results>`、`activeResultId`、`returnFocus`；结果 `{id,title,pathHint,commandId?,availability}` |
| QuickOpen events | `queryChanged(text,mode)`、`requestResults(queryId)`、`execute(resultId,queryId)`、`cancel(queryId)`、`dismiss()` |
| Search props | `scope`、query、case/word/regex、include/exclude、`groups[] {fileRef,matches,cursor}`、requestId、complete、truncated、error |
| Search events | `search(criteria)`、`cancel(requestId)`、`loadMore(cursor)`、`activateMatch(fileRef,range,documentVersion)`、`clearFilters()` |
| 状态 | 空输入显示最近项；无匹配保留输入；正则错误关联字段；加载时结果属旧查询必须标旧，不让 Enter 意外选中旧结果 |
| 尺寸 | QuickOpen max 720 宽、距顶 64，窗口边缘 ≥16；结果最多约 60vh；Search 复用 220–400 侧栏，匹配上下文可折行 |

QuickOpen 用 combobox 输入+listbox 结果；方向键改变活动后代，输入焦点不动；Enter 只执行当前查询活动结果；Escape 返回原焦点。项目搜索结果使用文件分组，Tab 进入一次、方向导航；点击结果后仍可从 F6 回原匹配。高级过滤有“已应用”标记，关闭高级区域不取消条件。

**验收：**过期查询/项目请求被忽略；搜索结果达到上限有说明与缩小范围入口；安装/卸载搜索扩展不会移除宿主命令框。

### 3.6 GitPanel 与 CommitComposer

**页面 / 归属：**C01–C08/F07；Git 扩展。对应 REQ-UXI-006/016。

```ts
type GitEntry = {
  id: Id; fileRef: Id; displayPath: string;
  group: "unstaged" | "staged" | "conflicted";
  status: string; oldPath?: string; bufferDirty: boolean;
};
// props: scope, repositoryId, repositoryRootDisplay, snapshotVersion,
//        branch, upstream, entries, selectedEntryId, loadState,
//        commitDraft, writeOperation, commandAvailability
// events: refresh(), openDiff(entryId,snapshotVersion),
//         stage(ids,snapshotVersion), unstage(ids,snapshotVersion),
//         commit(message,stagedIds,snapshotVersion), discardRequested(ids,source),
//         checkoutRequested(ref), createBranch(name,startPoint),
//         syncRequested(kind,remote,branch), openHistory(cursor)
```

同一文件两个分组的条目 ID 必须不同，否则选择和 diff 会互相覆盖。提交只基于 staged 条目；消息草稿按项目保存；Git 服务确认真实提交成功后才清稿。仓库写队列 pending 禁冲突动作，读取可用时仍可看已缓存差异并标过期。仓库根与项目根不同必须显示，不无提示操作父仓库。

组件宽 220–400；提交框建议最小 3 行、最大 8 行内滚动；长文件名显示路径提示。菜单集中文件操作，整文件暂存是首版主按钮；块级能力后续不占空位。方向键导航组与文件；Enter 打开对应 diff；Mod+Enter 在提交框内触发合法提交，Ctrl/Cmd+Enter 在其他区域不误触。

**状态：**无 Git、非仓库、空仓库、干净、detached HEAD、未跟踪、重命名、冲突、部分暂存、同步 pending、认证失败、非快进分别有解释。取消只请求服务停止，完成前不更改远端状态。失败保留消息、选中项和操作目标。

**验收：**index→worktree 与 HEAD→index 标题及来源正确；hooks 失败保留草稿；默认没有自动 force push、自动 stash、自动提交全部。

### 3.7 AgentConnection、AgentContext、AgentSession、AgentRun 与 AgentReview

**页面 / 归属：**D01–D08/F05/F06；通用会话 UI + Pi 默认候选扩展；Codex/Claude 仅后续接口。对应 REQ-UXI-007/008/019。

```ts
type AgentCapabilities = {
  structuredMessages: Capability; structuredProgress: Capability;
  approvalRequests: Capability; userQuestions: Capability;
  interruptTurn: Capability; resumeHistory: Capability; attachRunning: Capability;
  enforceReadOnly: Capability; modelSelection: Capability;
  explicitAttachments: Capability; fileChangeEvents: Capability;
};
type AgentConnection = {
  id: Id; adapterId: Id; name: string; executableDisplay: string;
  detectedVersion?: string; protocolVersion?: string;
  mode: "structured" | "terminal";
  status: "not-detected" | "detecting" | "missing" | "unauthenticated"
    | "incompatible" | "configured" | "verifying" | "ready" | "error";
  capabilities: AgentCapabilities;
};
type AgentSession = {
  id: Id; scope: ProjectScope; connectionId: Id; providerSessionId?: string;
  instanceId: Id; instanceEpoch: number; lastEventSeq: number;
  ownership: "horizon-owned" | "external-attached";
  permissionsLabel: string; permissionsVerified: boolean;
  status: "starting" | "idle" | "running" | "awaiting-input" | "stopping"
    | "interrupted" | "completed" | "failed" | "disconnected";
};
type ContextAttachment = {
  id: Id; kind: "file" | "selection" | "git-diff" | "text";
  label: string; source: "buffer" | "disk" | "snapshot";
  version: Version; range?: Range; byteSize: number;
  validity: "valid" | "changed" | "missing" | "oversize" | "unsupported";
};
```

| 组件 | props / 状态 | 事件 / 规则 |
| --- | --- | --- |
| AgentConnectionForm | runtime/provider 两层连接草稿、字段 schema、configured/verified、认证归属、检测/测试结果、字段错误；秘密只用引用 | `detect(path)`、`testInitialization(configRevision)`、`requestAuth(connectionId)`、`save(configRevision)`、`cancel()`；检测/测试都不发任务 |
| AgentContextPicker | scope、附件、过滤查询、大小限制、Agent 可读取范围说明 | `add(sourceRef,range,version)`、`remove(id)`、`refresh(id)`、`confirm(snapshotIds)`；脏稿来源由用户选择，超限不静默截断 |
| AgentSessionPanel | session、messages/cursor、draft、attachments、capabilities、sendState、followingTail、活动实例/任务列表 `{instanceId,sessionId,projectId}[]`、全局实例上限 2、每项目任务上限 1 | `send(inputId,draft,contextSnapshot)`、`appendToTurn(...)`（支持才出现）、`loadHistory(cursor)`、`openSessionChooser()`、`hide()`、`requestEndSession()`；同项目已有任务或全局实例满时保留草稿，并可跳转现有任务；不隐式创建第二实例 |
| AgentRunTimeline | session、外部事件流、状态、pendingRequests、detectedFileChanges | `interrupt(turnId)`、`openRequest(id)`、`viewChanges(baselineId)`、`openTerminal()`；步骤只来自事件，不自造执行循环 |
| AgentRequestCard | requestId/providerRequestId、session/turn/item ID、kind、内容、availableDecisions、expires/resolved、respondState | `respond(requestId,decisionId,input?)`；一次回答后等 provider 确认；过期/已解决禁答；仅列协议真实支持选项 |
| AgentReview | scope、baselineId/source、origin（proposed/taskCopy/observedDisk）、changes、currentVersions、reviewedIds、rollbackAvailability | `markReviewed(fileId)`、`applyTaskResult(fileId,expectedVersions)`（Pi 副本结果）、`applyProposedPatch(fileId,version)`（仅尚未应用补丁）、`restoreRequested(fileId,baseline,currentVersion)`；已落盘变化不使用“接受即写入”文案 |

消息列表分页/虚拟化，建议一次展示最近 100 条，旧历史按需加载；更新流合并刷新，滚离底部后显示“新内容”按钮，不拉回底部。不以每个 token 触发全页响应。消息数量/刷新间隔是待测建议，不能以截断隐藏结论或待授权事项。

面板 min 320、默认 360、max 520；窄窗变覆盖面板，所有关键状态保持可见。输入建议 3–8 行，附件折叠为带数量的摘要，可展开逐项查看；模型/权限不支持时不占假控件。审批卡的内容可内部滚动，允许/拒绝区始终可达；危险操作默认聚焦说明或拒绝。

**键盘/焦点：**输入 Enter 发送（可改 Mod+Enter），Shift+Enter 换行，IME 组合例外；AI 流只播报“正在回复/已完成/待输入”等摘要。后台请求不自动弹阻塞全局模态；项目标记+通知引导用户打开。会话切换需保留独立草稿；改变连接需要新会话，不能把旧 providerSessionId 传给另一适配器。

**能力限制：**只读聊天要有 `enforceReadOnly.supported` 且当前策略已验证；终端模式只显示终端和生命周期入口。关闭卡片保留待输入，不能当批准。停止轮次与终止进程分开；外部附着会话默认只断开，不取得进程所有权。任务前快照缺失时不能提供一键恢复；有后续暂存或文件编辑时也不能直接恢复。首版每项目一个任务，全局最多两个用户显式启动的 Pi 实例；同会话不并发/排队新回合。dirty 文档允许用户明确选 buffer 快照进入任务副本，原文档保持未保存；应用通过版本检查与可撤销编辑事务，不强制先保存。附件初始建议上限 20 文件/256 KiB。

**验收：**Pi 使用固定版本完成实际协议、策略、取消与副本审查验证；Codex/Claude 仅验收接口设计；适配器回传不支持时对应动作消失并可从能力说明了解原因；本项目没有 Agent 计划/工具/记忆循环。协议依据见交互规格 6.2。

### 3.8 TerminalPanel

**页面 / 归属：**E01、D08 终端模式、I02；可选终端扩展。对应 REQ-UXI-008/017/018。

```ts
type TerminalSession = {
  id: Id; scope: ProjectScope; processOwnerId: Id; title: string;
  cwdDisplay: string; shellDisplay: string;
  origin: "manual" | "agent" | "launch-profile";
  status: "starting" | "running" | "stopping" | "exited" | "failed";
  exitCode?: number; reconnectable: boolean;
};
// props: sessions, activeSessionId, outputStreamHandle, viewport,
//        hidden, stopState, extensionState, returnFocus
// events: create(scope,cwd,shellProfile), activate(id), writeInput(id,bytes),
//         resize(id,cols,rows), hide(), requestTerminate(id), restart(id),
//         clearVisibleOutput(id), copySelection(id)
```

`hide()` 不调用 `terminate`；`clearVisibleOutput` 不发送进程清理命令。组件重挂载连接原 sessionId，不能自动再创建 shell。窗口关闭由宿主收集活动进程统一处理；扩展卸载前显示影响清单。开发服务终端由启动实例拥有，终端 UI 只是展示入口；终端仅显示 pipe 输出时，停用终端转到日志列表，不终止启动组；实际依赖 PTY 则列入停止计划。关闭标签可选择隐藏记录/结束进程，不能含糊。每项目建议最多 3 个手动终端，启动方案会话另列归属，不混算为手动标签。

默认高 240、min 160，max 可用高度 50%；代码高度不足改互斥视图。resize 合并后发送实际字符网格，隐藏状态不发零行零列把进程弄坏；再次显示重新测量。输出缓冲有界并显示历史被裁剪，不使用无限 DOM。

**键盘/焦点：**Ctrl+C 在终端内中断进程；复制按平台明确键位。系统快捷键、F6/返回编辑器不被吞。多行粘贴显示实际文本预览及发送/取消，用户可显式配置；不偷偷修改 shell 命令。终端有名称和当前项目，输出不默认逐行 aria-live。

**验收：**隐藏/显示不增加新进程；终止后全部归属进程结果可查；Win ConPTY 与 macOS PTY 分别测试，外部附着会话退出不越权杀进程。

### 3.9 SettingsDialog 与 SettingsField

**页面 / 归属：**F01–F14、E09、I01 配置入口；宿主设置容器 + 扩展声明字段。对应 REQ-UXI-010/011/017。

| 契约 | 具体定义 |
| --- | --- |
| props | `open`、`sectionId`、`scope`、`sections[]`、`fields[] {key,label,type,defaultValue,globalValue,projectOverride,effectiveValue,source,validation,availability,persistence}`、pending、dirtyForms、returnFocus |
| 持久化策略 | `persistence="immediate"` 仅合法偏好值；`"explicit"` 用于连接/启动方案/键位录入。二者 UI 文案不同，不放一个含糊总保存按钮 |
| events | `selectSection(id)`、`changeScope(scope)`、`setValue(key,value,revision)`、`clearOverride(key)`、`resetSection()`、`saveForm(id)`、`discardForm(id)`、`requestClose(reason)` |
| 状态 | 字段验证失败保留输入和上个有效值；持久化失败提示并回退/重试，不宣称已保存；扩展消失时保留未保存表单并允许导出或丢弃 |
| 尺寸 | 宽高上限参考 880×640、边缘 ≥16；分类宽 180–220；窄窗口分类改选择器/返回列表，内容单列；按钮不随内容滚出可视区 |

继承控制展示 `source`，恢复继承是删除 override，不能复制当前全局值假装继承。产品基线规定的全局禁用为扩展总开关，项目不能绕过；项目启用只在全局允许时生效。编辑器、布局、主题、密度、尺寸、图片与颜色可项目覆盖；快捷键首版全局。

**键盘/焦点：**模态约束焦点；首次聚焦分类或目标设置标题；Escape 有脏表单时询问，仅已即时保存偏好则直接关闭。切分类不会丢显式表单。表单 label/描述/错误稳定关联；开关读出当前值，不只“开关”。

**验收：**全局字号 14→15，覆盖 16 的项目保持16，恢复继承变15；删除连接需处理正在运行的会话；密钥未进入导出。

### 3.10 ExtensionCenter、ExtensionCard 与 LifecycleDialog

**页面 / 归属：**E02–E09；最小宿主。对应 REQ-UXI-015/017。

```ts
type ExtensionStatus = {
  id: Id; version?: string; name: string; bundled: boolean;
  installation: "absent" | "installing" | "installed" | "updating" | "uninstalling" | "failed";
  globalAllowed: boolean;
  projectPolicy: "inherit" | "enabled" | "disabled";
  effectiveEnabled: boolean;
  runtime: "inactive" | "activating" | "active" | "sleeping" | "pausing"
    | "paused" | "stopping" | "failed";
  manualPause: boolean; dependencies: readonly Id[];
  uiReclaim: "notRequested" | "releasing" | "released" | "reloadRequired" | "failed";
  remainingResourceIds: readonly Id[];
  availability: Availability;
};
type LifecyclePlan = {
  id: Id; revision: Version; scope: Scope;
  action: "install" | "enable" | "pause" | "resume" | "disable" | "uninstall" | "update";
  targets: readonly Id[]; affectedProjects: readonly Id[];
  dependents: readonly Id[]; dirtyDocumentIds: readonly Id[];
  activeResourceIds: readonly Id[]; permissionsRequested: readonly string[];
  blockers: readonly string[]; retainData: boolean;
};
```

中心 props 为目录/已安装列表、scope、query、selectedId、loadState；详情 props 为版本来源、贡献、权限、依赖和 ExtensionStatus；影响确认 props 为 LifecyclePlan、各项处理结果和 ActionState。事件为 `queryChanged`、`select`、`previewLifecycle(action,scope,ids)`、`resolveBlocker(id,choice)`、`executePlan(planId,revision)`、`cancelPlan`、`openLogs`。

UI 不按静态依赖列表自行决定可以卸载；服务返回有版本的影响计划，执行前再次校验。暂停保留启用策略，释放运行资源并阻止所选范围自动激活；暂停标记跨重启保留，只有显式恢复或用户确认的启动方案临时恢复才能解除，恢复不重放任务/进程；休眠则可自动唤醒。卸载作用全局安装包，默认保留数据；“同时删除配置/历史”单独选择。升级若增加权限须明确确认，未完整安装不替换可用版本。

运行资源已停止不等于 WebView 模块内存立即归零。若宿主报告 `reloadRequired`，扩展详情显示“已停止，完成内存回收需重载界面”，经草稿持久化与活动视图恢复准备后提供重载；不能为了清缓存直接销毁脏文档。`remainingResourceIds` 非空时保留进程处理入口。皮肤只改变状态样式，不隐藏这些差异。

默认附带包与其他包使用相同状态模型。卸载编辑器前处理脏稿；卸载文件树后仍可从宿主安装恢复；卸载 Git 后关闭或保留只读差异快照需明确标过期。依赖服务跨项目使用时必须列全部受影响项目。用户取消时不提前停掉依赖。

**尺寸/键盘：**中心可用设置大弹窗或编辑区内容页，列表/详情窄窗互斥；行 min 48，动作放更多菜单；搜索、scope、条目、详情、操作顺序可达。确认标题描述目标和作用域，默认聚焦取消。动态移除条目后焦点到邻项或搜索。

**验收：**依赖在确认后变化时执行拒绝并重算；暂停无法停止进程时不标 paused；被用户暂停的扩展不会因搜索、文件打开或项目唤醒偷偷激活。

### 3.11 LaunchProfileEditor 与 ProjectRunPanel

**页面 / 归属：**建议 I01–I03，A06/F04 入口；可选项目启动扩展，宿主保存资源归属。对应 REQ-UXI-018。

```ts
type LaunchProcess = {
  id: Id; name: string; executable: string; args: readonly string[];
  cwd: string; env: Record<string, { value: string } | { secretRef: Id }>;
  platformOverrides?: Partial<Record<"macos" | "windows", {
    executable: string; args: readonly string[]; cwd?: string;
  }>>;
  shellMode: false | { shellProfileId: Id; script: string };
  dependsOn: readonly { processId: Id; condition: "started" | "ready" }[];
  lifecycle: "service" | "oneshot"; ioMode: "pipe" | "pty";
  required: boolean;
  ready: { kind: "none" } | { kind: "port"; host: string; port: number; timeoutMs: number }
    | { kind: "output"; pattern: string; timeoutMs: number }
    | { kind: "exit"; codes: readonly number[]; timeoutMs: number }
    | { kind: "http"; url: string; statusCodes: readonly number[]; timeoutMs: number };
  discoveredSource?: { path: string; commandName: string; reviewedContentHash: string };
  terminal: "on-start" | "on-failure" | "manual";
};
type LaunchProfile = {
  id: Id; scope: ProjectScope; revision: Version; name: string;
  extensions: readonly { id: Id; versionRange: string }[];
  processes: readonly LaunchProcess[]; failurePolicy: "stopStarted" | "keepRunning";
  urls: readonly { url: string; afterProcessId: Id; openWhenReady: boolean }[];
  saveBeforeRun: "ask" | "save-all" | "use-disk";
};
type ProjectRun = {
  id: Id; scope: ProjectScope; profileId: Id; profileRevision: Version;
  phase: "validating" | "preparing" | "starting" | "running" | "ready"
    | "partial" | "stopping" | "stopped" | "failed" | "unknown";
  processIds: readonly Id[]; extensionLeaseIds: readonly Id[];
  ownedResourceIds: readonly Id[]; error?: UiError;
};
```

此结构是 UI 表单数据，不是让 WebView 直接启动进程的权限凭据。`cwd` 可显示相对项目路径，控制器提交时解析并验证；`executable/args` 与显式 shell 模式二选一，不能同时生效。ready=none 的常驻进程仅达到 started/running；一次性步骤需明确成功退出码。依赖 ready 的节点必须配置真实检测，否则表单报错。首版端口/HTTP 探测默认限定 loopback；不能把已有进程的响应误认为本次实例就绪。表单 `none/port/output` 分别映射技术接口 `processStarted/tcp/stdout`，依赖 condition 映射为该步骤经声明的完成/就绪条件；不复制另一套执行器。

| 组件 | props / 状态 | 事件 |
| --- | --- | --- |
| LaunchProfileEditor | profiles、draft、detectedCandidates（仅发现）、installedExtensions、validationByField、saveState；草稿与运行快照分离 | `scanCandidates()`、`adoptCandidate(id)`、`editProcess(id,patch)`、`reorder(id,direction)`、`save(revision)`、`saveAndRun(revision)`、`cancel()` |
| ProjectRunPanel | selectedProfile、ProjectRun、`processes[] {id,status,pid?,exitCode?,readyStatus,logRef,ownership}`、extensionPreparation、stopState | `start(profileId,revision)`、`openRun(id)`、`stop(runId,processIds?)`、`restart(runId,revisionChoice)`、`openTerminal(id)`、`openUrl(urlId)`、`hide()` |
| RunFailureView | failedStep、partialResults、remainingOwnedResources、retryAvailability、redactedLog | `retryFailed(runId,expectedState)`、`stopRemaining(runId)`、`editProfile(profileId)`；不会 kill 非本实例资源 |

开始执行前锁定方案快照和资源影响计划；同方案已有实例则打开该实例。停止时按依赖逆序停止本实例进程；失败时必需节点失败默认清理本次新建资源，可选节点失败标 partial。启动前已存在的进程/扩展租约不属于本次清理对象；需要复用已有服务必须显式配置并显示外部归属，首版不自动认领。

一键启动是用户保存方案后的直接动作，不每次重复询问相同配置。只有配置改变、来源脚本内容摘要变化、新权限、缺依赖需安装或有脏文档时才出现对应决策。打开项目、恢复会话、扫描脚本均不执行启动。URL 按已保存选择在就绪后打开一次；模式/域名变化需重新审阅配置，不自动打开日志里的任意链接。重启默认使用最新已保存配置，先审阅新计划并取得执行授权，再停止旧实例并启动新实例；删除方案必须先停止实例，不能遗留无入口的进程。

**尺寸/键盘：**主界面仅一个启动/停止状态入口；详细运行面板使用底部槽位，与终端互斥标签共享空间；窄窗口覆盖或代码/运行切换。表单进程列表可折叠，排序有按钮；状态流不抢焦点；重启对运行实例标明使用旧快照还是最新已保存配置。

**验收：**扫描零进程；重复点击只一实例；ready 超时不能标就绪；停止失败阻止重启重复占端口；取消退出保持方案与真实资源状态。

### 3.12 Dialog、Menu、Notification 与反馈 primitives

**页面 / 归属：**全局、B08/C06/D05/E13/F 系列；宿主 primitives。对应 REQ-UXI-011/013/016。

| 组件 | 必需 props | 事件、状态和键盘 |
| --- | --- | --- |
| Dialog | `id,open,title,description?,kind,initialFocus,returnFocus,actions[],busy,dismissPolicy,dirty` | `requestClose(reason)`、`action(id)`；每个 action 有 availability、danger、pending。Tab 约束，Escape 按取消语义，背景 inert；复杂内容初始聚焦标题，危险确认默认取消 |
| Menu | `id,anchor,items[{id,label,shortcut?,kind,checked?,availability,children?}],returnFocus` | `select(id)`、`dismiss(reason)`；上下/Home/End，右开子菜单、左返回，Enter 选择；Escape 逐层关闭；点击外部关闭，不触发背景危险操作 |
| Notification | `id,scope,severity,title,body,operationId?,actions[],persistent,createdAt` | `activateAction(id)`、`dismiss()`；普通成功可建议 5 秒淡出但焦点/悬停暂停；关键错误/待授权持久，另有通知列表；不移动焦点，不把 toast 当唯一恢复入口 |
| InlineStatus | `phase,label,detail?,progress?,retryAvailability` | 有真实总量才用数值进度；无总量显示阶段；polite status；关键失败 alert 不重复轰炸 |
| Button/IconButton | `label,availability,variant,pending,tooltip?` | 图标也必须名称；pending 保留尺寸；不自动提交非提交表单；最小命中 24×24，舒适 32–40 |
| Field | `id,label,value,description,error,required,availability` | 原生输入优先；错误 `aria-describedby`；组合输入完成才校验/提交；placeholder 不代替 label |
| Splitter | `orientation,value,min,max,controls,label` | 方向键每次 1 px，Shift 每次 10；Home/End 到界限；`role=separator`、值与控制区关联；双击/命令恢复默认 |

菜单禁用项允许方向键聚焦并读出原因，Enter 无动作；普通 disabled 按钮旁必须有可读取的原因，不依赖无法聚焦按钮的 tooltip。对话框宽度参考：简单确认 440、一般表单 560–720、设置 880；全部约束在视口内，内容内滚动，底部动作可见。模态堆叠最多两个（设置内确认）；原生选择器计入交互顺序但不复制另一层 Web 模态。

浮层关闭返回触发元素；元素已被移除则回邻近项或区域入口。D05 关闭只收起请求，必须在文案和可见项目标记上体现“仍待答”；B08 的 Escape 才等于取消整个关闭动作。不能给所有对话框套同一“关闭即放弃”逻辑。

**验收：**键盘完整完成新建项目、重命名、未保存取消、Git 放弃取消、扩展卸载取消；屏幕阅读器能读动作范围与错误；所有浮层在 200% 文本缩放下可关闭。

## 4. 事件与状态转换样例

| 触发 | 组件意图 | 控制器/服务结果 | UI 必须呈现 |
| --- | --- | --- | --- |
| 点击关闭脏文件 | requestClose(tabId) | 宿主创建未保存决策；保存失败 | 保持标签/草稿、错误可重试，不预先删除 |
| AI 面板关闭 | hide() | 仅布局更新 | 任务仍运行，项目状态入口可回到会话 |
| 点击停止 Agent | interrupt(turnId) | accepted→terminal event | stopping→interrupted/completed；不能直接变 stopped |
| 暂停终端扩展 | previewLifecycle(pause) | 发现活动终端，需要停止 | 显示影响清单；取消后终端不变；停止失败不标 paused |
| 全局卸载 Git | executePlan(id,revision) | 依赖版本已变 | 保留当前安装，重新计算计划；不部分卸载 |
| 项目启动 | start(profileId,revision) | 方案验证、依赖准备、进程就绪 | 每阶段真实状态；端口未就绪不能展示绿色“已就绪” |
| 开发服务失败 | failure event | 清理本次拥有资源，部分清理失败 | failed+残留列表；不能把 UI 移除当进程结束 |
| 项目切换 | activateProject(B) | A 的旧搜索继续回包 | 可缓存到 A，不改变 B 的树/搜索/Agent 上下文 |

流程操作名统一注册在 command registry；点击、键盘、菜单、扩展调用共享同一 availability 与保护流程。UI 测试可以替换控制器，不能绕过服务限制来伪造成功。

## 5. 皮肤、功能结构与响应语义

### 5.1 令牌分类

| 类别 | 示例令牌 | 可变与固定边界 |
| --- | --- | --- |
| 语义色 | `surface.canvas/panel/overlay`、`text.primary/secondary/disabled`、`border.default`、`focus.ring`、`state.selected/error/warning/success`、`diff.added/removed` | 值可换；状态含义不能互换，禁用不能仅低透明度导致看不清 |
| 字体 | `font.ui/code`、`font.size.body/code/caption`、`lineHeight.ui/code` | UI 与代码分别设置；字体 fallback 由平台适配，不能把代码字体硬套中文导航 |
| 尺寸/密度 | `row.tree`、`row.menu`、`control.height`、`space.1…6`、`panel.gap` | 可紧凑；最小命中与可读性不变；主代码宽度约束不被皮肤覆盖 |
| 形状/层级 | `radius.control/panel/dialog`、`elevation.panel/overlay`、`z.overlay/menu/dialog/toast` | 圆角/阴影可变；层级顺序、遮罩和焦点约束固定 |
| 动效 | `motion.duration.fast/normal`、`motion.easing`、`motion.reduced` | 可调整表现；停止/保存响应不等待动画；减少动效必须覆盖 |
| 图标 | `icon.family/stroke/size` | 形态可换；可访问名称、危险语义、必要文字不变 |

尺寸断点、作用域、dirty/Git 状态、权限判断、命令可用性、进程状态是功能逻辑，不能编码到主题 CSS 中。扩展读取宿主语义令牌，不能用自己的固定白底让深色主题失效。未知主题缺少关键令牌时回退完整默认语义组并指出缺失。

### 5.2 八个布局插件的结构映射

八套导航全部作为布局插件进入首版，共用功能视图与状态；主题资源独立，可跨布局组合。

| 布局插件 | 项目 / 文件结构映射 | 必须保持的语义与窄窗规则 |
| --- | --- | --- |
| mist 雾蓝 / rail | 独立项目图标栏 + 文件侧栏 | 图标有完整项目名；先折项目栏再浮层文件；选中/待输入不只靠蓝色 |
| paper 暖纸 / unified | 一个侧栏中的项目标题/切换列表 + 当前项目树 | 视觉一体不合并项目身份；文件标签仍仅当前项目；窄窗一个抽屉 |
| orbit 深空 / tabs | 顶层项目 tablist + 下层文件 tablist | 两组独立命名/焦点；项目过多使用溢出列表；窄窗顶层改项目选择按钮 |
| graphite 石墨 / compact | 紧凑项目入口 + 文件区域 | 行高可减、命中不少于 24；图标菜单有名称；不能靠隐藏错误获得紧凑 |
| celadon 青瓷 / drawer | 宽项目切换器 + 可折叠主侧栏 | 侧栏文件/搜索互斥；折叠保持状态；抽屉只有一个活动实例 |
| iris 鸢尾 / expressive | 项目组与文件组分区、大形状选中 | 大圆角不裁焦点环和行点击区；留白不足时按密度/浮层规则适配 |
| sand 砂岩 / expanded | 展开项目目录 + 当前项目文件树 | 两组层级名称分清，不能把不同项目文件混成同一树；宽导航先压缩为切换器 |
| aurora 极光 / dock | 底部项目栏 + 顶部文件/命令区 | 项目栏不是终端标签；底部运行面板与 dock 有明确边界；窄窗 dock 收为项目入口 |

所有皮肤使用同一 command IDs、状态模型、事件 payload、DOM 可访问名称和测试场景。主导航位置可变，焦点按真实视觉顺序建立，不用 CSS reorder 留下错误 Tab 顺序；F6 始终按命名区域轮换。

## 6. 可访问性与验证责任

交互规格第 7 节为目标基线。本节定义组件验证责任，避免只对比静态颜色。

| 检查项 | 责任组件 | 必测场景 |
| --- | --- | --- |
| 焦点顺序、可见、不遮挡 | Shell、Dialog、Menu、Panel | 开关浮层、卸载当前区域、通知不抢焦点、专注恢复、窄窗切工具 |
| 命名与状态 | Tree、Tabs、Git、Agent、Run | 同名文件、dirty+Git M、断连与停止中、安装/启用/运行区别 |
| 键盘不陷入 | Code、Terminal、Dialog | Tab 缩进后离开、终端 Ctrl+C 与区域切换、模态循环/退出 |
| 对比度与目标尺寸 | 主题与 primitives | 八种候选语义映射；实际交付浅深主题；高密度；forced-colors |
| 文本/显示缩放 | Shell、Settings、Confirm | 200% 文字、640×480、Windows 125%/150%，无关按钮不被水平裁掉 |
| 虚拟化可访问性 | Tree、Search、Messages | 活动项保留 DOM、正确层级、长历史分页、状态摘要而非逐 token 播报 |
| 降低动效 | 所有动效 | 系统减少动效后无强位移/闪烁；加载仍有文本；聚焦无滚动突跳 |
| 原生实际行为 | 宿主与适配器 | 两端中文 IME、原生菜单/选择器、Git 凭据、VoiceOver/NVDA、进程停止 |

最低验证组合：每个组件的 loading/empty/error/disabled/pending 状态样例；核心流程浏览器交互检查；随后 macOS 与 Windows 真机键盘/输入法/读屏。没有运行真实桌面包前只记录“原型通过”，不能标“功能/性能通过”。不要求为每个静态视觉令牌建立无价值单元测试；优先验证状态转换、作用域和数据保护。

## 7. 实施顺序、整合事项与阻塞边界

1. **TASK-UX-C01 宿主 primitives：**按钮、表单、对话框、菜单、通知、焦点注册、命令与布局；空扩展环境完成安装恢复入口。
2. **TASK-UX-C02 默认扩展：**项目导航接文件树/编辑器/搜索/Git；文档保存与关闭保护接真实服务；各默认扩展可停用与重装。
3. **TASK-UX-C03 生命周期：**安装/策略/运行三维状态、项目覆盖、依赖影响计划、暂停/恢复、卸载、草稿恢复和资源终止。
4. **TASK-UX-C04 Agent：**先检测/模型配置与能力 UI，再接 Pi RPC/受控策略；Codex/Claude 只留接口；真实消息/请求/停止/审查；没有真实协议能力就保留终端模式。
5. **TASK-UX-C05 启动：**终端、启动方案编辑、运行状态、就绪与失败清理；引用同一进程所有权服务，不另建看似成功的状态。
6. **TASK-UX-C06 验证：**八套布局与跨布局主题组合、浅深色、宽窄布局、全键盘、两端原生测试；按交互规格验收表记录结果。

与产品/技术文档整合时保留以下契约差异：全局禁用优先于项目启用；暂停与自动休眠分开；首版视觉实现不要求八套导航；“聊天只读”必须是实际能力；Agent 自己写入与建议补丁不能共用接受/撤回事件；E05–E16 使用当前源页面；D08/I01–I03 仍为建议状态，可由现有入口承载。服务字段、扩展 manifest、资源预算和事件协议由技术会话统一，不在本文复制第二份不兼容 schema。

没有需要用户先批准的普通组件实现选择。真正阻塞某功能出厂验收的是其真实能力：没有经验证的 Agent 请求协议就不能显示批准按钮，没有可靠版本/基线就不能显示一键恢复，没有进程回收证据就不能显示“已停止”。这些页面可以先按明确能力缺失状态编码。

## 0.4 外观定制补充契约

F01/F02 更新为独立主题与布局插件入口，新增 F10 区域尺寸、F11 背景图片、F12 自定义配色、F13 外观组合、F14 布局恢复。具体状态、尺寸、继承与组件以 [CUSTOMIZATION_DESIGN](CUSTOMIZATION_DESIGN.md) 为准。八个预设全部为插件；前端 React，共享 Cordis 插槽服务。设置页编辑视图只发送字段 patch，不直接重建文档；结构切换等待 IME 结束并保留 EditorState。外观配置与临时会话状态分离，字段规则以定制设计为准。
