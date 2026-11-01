# Horizon 接口与 IPC 契约

| 项目 | 内容 |
| --- | --- |
| 版本 / 日期 | 0.4.0 / 2026-10-31，Asia/Shanghai；2026-10-30 开始核验 |
| 状态 | 可实现的协议提案；尚未生成代码或接通真实服务 |
| 范围 | 最小宿主 IPC、默认/可选扩展、任务流、AgentAdapter、Pi 映射、项目启动器与进程 |
| 依赖 | [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md)、[PI_AGENT_RESEARCH.md](PI_AGENT_RESEARCH.md)、[DECISIONS.md](DECISIONS.md) |
| 验收 | 请求/响应 fixtures 双向校验；生命周期、取消、过期、权限与卸载用例见第 12 节 |

本协议属于 Horizon，不是 Tauri/Pi/ACP 已存在的通用 API。方法由宿主或对应扩展注册；扩展未安装/禁用时返回明确错误，不要求最小宿主保留该业务实现。术语、读取基线与技术文档一致：新清单 E05–E16 已落位；D08、I01–I03 仍是交互建议。旧交互 E05/E06 的含义不得覆盖新清单，整合映射见 DECISIONS。

## 1. 传输、身份与共同类型

Tauri 仅暴露三个入口：`horizon_call`（请求响应）、`horizon_start`（带 Channel 的长任务）、`horizon_subscribe`（带 Channel 的状态订阅）。请求中的 `method` 使用下表的稳定名称。宿主 registry 将方法映射到内核能力或扩展服务，禁止前端任意指定 executable 或反射调用 Rust 函数。Tauri command permission 与窗口 capability 显式登记；主窗口身份从 Tauri 调用上下文取得。

普通 JSON 使用 camelCase，未知字段/无效 enum 拒绝；新必填/删除/语义改变提高 protocol major。可选字段也须在已协商 schema 中使用，不能因称为小版本就向严格旧接收器发送新字段。第一次 `app_bootstrap` 校验 major，返回可用服务与 schemaHash。ID 为不透明字符串，不含路径；revision 为 0 到 JS MAX_SAFE_INTEGER 的整数，耗尽应新建实例 epoch。大于该范围的字节数用十进制字符串。

```ts
type Id = string;
type Revision = number;
type ByteCount = string;
type Scope =
  | { kind: "app" }
  | { kind: "project"; projectId: Id; projectEpoch: number };

interface Call<P> {
  protocolVersion: 1;
  requestId: Id;
  method: string;
  scope: Scope;
  params: P;
  idempotencyKey?: Id; // 下表要求的写操作必须提供
}
type Reply<T> =
  | { ok: true; requestId: Id; data: T }
  | { ok: false; requestId: Id; error: HorizonError };
interface HorizonError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  operationId?: Id;
  details?: Record<string, string | number | boolean | null>;
  recovery?: ("retry" | "refresh" | "compare" | "reauthenticate" |
    "openSettings" | "installExtension" | "saveAs" | "stopResources")[];
}
type ErrorCode =
  | "INVALID_ARGUMENT" | "PROTOCOL_UNSUPPORTED" | "NOT_FOUND" | "PERMISSION_DENIED"
  | "STALE_SCOPE" | "STALE_VERSION" | "STALE_CURSOR" | "CANCELLED" | "TIMEOUT"
  | "RESOURCE_LIMIT" | "RESOURCE_BUSY" | "DEPENDENCY_UNAVAILABLE"
  | "EXTENSION_DISABLED" | "EXTENSION_MISSING" | "EXTENSION_FAILED"
  | "CAPABILITY_UNSUPPORTED" | "FILE_CHANGED" | "FILE_LOCKED" | "ENCODING_UNSUPPORTED"
  | "IO_ERROR" | "DISK_FULL" | "CONFIG_VERSION_UNSUPPORTED" | "CREDENTIAL_UNAVAILABLE"
  | "GIT_NOT_FOUND" | "GIT_LOCKED" | "GIT_AUTH_REQUIRED" | "GIT_NON_FAST_FORWARD"
  | "GIT_CONFLICT" | "GIT_COMMAND_FAILED" | "AGENT_UNAVAILABLE" | "AGENT_PROTOCOL_ERROR"
  | "AUTH_REQUIRED" | "RATE_LIMITED" | "CONNECTION_FAILED" | "CONTEXT_TOO_LARGE"
  | "PERMISSION_EXPIRED" | "PROCESS_EXITED" | "OUTCOME_UNKNOWN" | "PORT_IN_USE";
```

前端传来的 projectEpoch 用于结果有效性，不是权限凭证。服务每次从 window session/extension session 检查允许的项目范围。扩展调用没有自报身份字段，宿主通道已经绑定 `extensionId/version/activationId/grants`；任何伪造字段忽略并拒绝未知 schema。

写操作 `idempotencyKey` 在 app boot 内与 method/scope/参数 digest 绑定，默认保留 10 分钟或直到任务结束后 10 分钟；同 key 同参数返回已有操作，同 key 不同参数报 INVALID_ARGUMENT。崩溃后写结果未知不得盲重放，查询实际磁盘/Git/启动实例。不是跨应用永久 exactly-once 保证。

## 2. 长任务、事件、取消与订阅

### 2.1 长任务类型

```ts
type TaskState = "queued" | "running" | "waitingPermission" |
  "succeeded" | "failed" | "cancelled";
interface TaskAccepted {
  taskId: Id;
  requestId: Id;
  state: "queued";
  cancelMode: "cooperative" | "process" | "none";
}
interface TaskEvent<P = unknown> {
  protocolVersion: 1;
  event: "horizon.task.v1";
  taskId: Id;
  requestId: Id;
  scope: Scope;
  seq: number; // 每 task 从 1 严格递增
  payload: P;
}
type TaskPayload<T> =
  | { type: "started" }
  | { type: "progress"; phase: string; completed?: number; total?: number }
  | { type: "data"; kind: string; data: unknown }
  | { type: "permissionRequired"; permission: PermissionRequest }
  | { type: "terminal"; state: "succeeded"; result: T; effect: Effect }
  | { type: "terminal"; state: "failed"; error: HorizonError; effect: Effect }
  | { type: "terminal"; state: "cancelled"; partialResult?: T; effect: Effect };
type Effect = "none" | "applied" | "partial" | "unknown";
```

调用者先设置 Channel 的回调，再发 start。事件可能先于 invoke promise 返回，必须按 requestId 缓冲，拿到 taskId 后校验；不能用“当前页面的请求”代替关联。进入 running 的任务 `started` 一次；尚在 queued 即取消可直接 terminal。data/progress 零到多次，terminal 最多一次，terminal 后无新 data。进程异常也要由宿主形成 terminal；窗口消失后只保存状态，不继续向销毁的 WebView 发送。

`task_cancel` 只返回 `{taskId,cancelRequested,alreadyTerminal}`，不会立即返回 cancelled 终态。未开始任务可直接取消；运行中的任务先设置 token，再按实际协议停止；已提交的不可撤销阶段可能最终 succeeded/applied。对于未知网络写入结果，failed/OUTCOME_UNKNOWN 优于伪造 cancelled/none。业务终态和取消响应允许交错；终态胜出。

### 2.2 背压与重连

每批 data 最大 64 KiB，单任务未确认窗口 512 KiB，全局 4 MiB。前端按 100 ms 或 64 KiB 调用 `stream_ack`，参数为最高连续已处理 seq；ack 可重复，不允许跨过缺失序号。服务停发普通 data 但必须继续处理取消/权限/终态。日志可截断并报告 droppedBytes；代码、搜索结果和 AI 正文不能默默丢失。

Pi stdout 持续消费，控制事件与输出片段分别处理；UI 背压时将正文保留在有界回合缓冲，并在消息结束/中断时写本地会话存储；最终消息发正文或页引用，读端用 `agent_transcript_read` 读取摘要、`agent_message_read` 读取全文页。首版单条Pi JSONL记录/回合中的单条消息上限4 MiB；每会话Pi历史、宿主摘要和全文文件合计32 MiB。宿主追加前检查预算，Pi自有文件在消息/压缩边界检查；超限终止run并报告RESOURCE_LIMIT，保留已有记录。前端最多保留100条摘要、50条工具状态，不无限积累或阻塞停止按钮。Tauri Channel 提供有序传输，不替代应用自己的限额。[Tauri Channel](https://v2.tauri.app/develop/calling-frontend/#channels)

任务状态保留至终态后至少 10 分钟；event ring 只保留有界最近事件。重连 `task_get` + `task_attach(afterSeq)`：可 replay 就续传，窗口已丢失返回 `resetRequired` 与 snapshot/cursor，前端丢弃局部不完整结果再读取。命令返回与全局事件不承诺同一时钟顺序。

### 2.3 低频订阅

三个入口均接收 `Call<P>`，只有 start/subscribe 另带 Channel。`horizon_subscribe` 的 `service_subscribe` 方法在同一服务锁下捕获 snapshot、注册订阅并排队后续事件。回调必须先安装，先于响应的事件按 requestId 暂存。目录失效等只送 ID/revision，不广播文件正文或秘密。

topic 清单：`horizon.project.v1`、`horizon.files.v1`、`horizon.document.v1`、`horizon.git.v1`、`horizon.agent.v1`、`horizon.extension.v1`、`horizon.launch.v1`、`horizon.process.v1`、`horizon.settings.v1`。Git/Agent 等业务 topic 仅在对应扩展提供时存在。相同 entityRevision 重复事件可丢弃；不连续 revision 触发 snapshot，不凭猜测补状态。Agent topic 只送实例/会话状态，正文通过 agent_submit 的任务流读取。

组件卸载调用 `subscription_close`；项目切换结束项目作用域 view subscription；取消任务/终端会话与关闭视图订阅是不同动作。窗口关闭由宿主扫除其 subscriptions、挂起 UI 权限；运行实例是否继续依项目/退出策略处理。所有清理幂等。

### 2.4 控制方法与订阅形状

除标注 subscribe/start 的方法外，所有表内方法走 `horizon_call`。任务使用原 task scope；跨项目控制须从资源面板选择对应项目，不能伪造当前项目 epoch。

```ts
interface TaskSnapshot {
  taskId: Id; requestId: Id; method: string; scope: Scope; state: TaskState;
  cancelRequested: boolean; lastSeq: number;
  terminal?: Extract<TaskPayload<unknown>, { type: "terminal" }>;
}
interface ServiceEvent {
  protocolVersion: 1; event: "horizon.subscription.v1";
  requestId: Id; subscriptionId: Id; scope: Scope; seq: number;
  topic: string; entityId: Id; entityRevision: Revision;
  change: "upsert" | "remove" | "invalidate";
}
```

| 方法 / 入口 | params | data / Channel |
| --- | --- | --- |
| `task_get` / call | `{taskId}` | `TaskSnapshot`；过期记录 NOT_FOUND |
| `task_cancel` / call | `{taskId}` | `{taskId,cancelRequested:boolean,alreadyTerminal:boolean}` |
| `stream_ack` / call | `{taskId,throughSeq:number}` | `{acceptedThroughSeq:number}`；仅活跃消费者可以 ack |
| `task_attach` / subscribe | `{taskId,afterSeq:number}` | `{subscriptionId,task:TaskSnapshot,resetRequired:boolean,nextSeq:number,resultCursor?:string}` + 原 TaskEvent；保留原 requestId |
| `service_subscribe` / subscribe | `{topics:string[]}` | `{subscriptionId,snapshots:{topic,entityId,revision,data}[]}` + ServiceEvent；重新订阅取新快照 |
| `subscription_close` / call | `{subscriptionId}` | `{closed:true}`；重复关闭仍成功 |
| `task_detach` / call | `{taskId}` | `{detached:true,taskContinues:boolean}`；解除 start 的主 Channel，不请求取消 |

每个任务同时只有一个活跃 UI 消费者；task_attach 原子替换旧消费者并吊销其 ack 权限，避免两条 UI 确认游标混淆。原任务 requestId 与 task_attach 的请求 requestId 各自用于原流、附着响应。snapshot/replay 排在后续实时事件之前；resetRequired 时通过方法对应的结果页接口重建，不能把缺失内容当空结果。低频订阅不复用流 ack，队列满则发送 invalidate 并要求重订阅。

## 3. 核心实体与文件类型

```ts
interface Workspace { id: Id; name: string; projectIds: Id[]; revision: Revision }
interface Project {
  id: Id; workspaceId: Id; displayName: string; rootDisplayPath: string;
  pinned: boolean; revision: Revision;
  state: "registered" | "activating" | "active" | "idle" | "sleeping" | "unavailable";
}
interface FileRef { projectId: Id; fileId: Id; displayPath: string }
interface DiskRevision {
  token: string; // 不透明；Rust 内部含身份/hash，客户端只原样传回
  contentHash: string;
  byteLength: ByteCount;
  modifiedAt: string; // RFC3339；不独立用于写入判定
}
interface DirectoryEntry {
  entryId: Id; file: FileRef; name: string;
  kind: "file" | "directory" | "symlink" | "other";
  nativeNameLossless: boolean; ignored: boolean;
}
interface DirectoryPage {
  directoryRevision: Revision; entries: DirectoryEntry[];
  nextCursor: string | null; truncated: boolean;
}
interface DocumentMeta {
  documentId: Id; file: FileRef; editorRevision: Revision;
  baseDiskRevision: DiskRevision;
  encoding: "utf8" | "utf8bom" | "utf16le" | "utf16be";
  eol: "lf" | "crlf" | "mixed";
  state: "clean" | "dirty" | "saving" | "conflict" | "missing";
  readOnly: boolean;
}
type OpenDocument =
  | { mode: "editor"; meta: DocumentMeta; text: string; simplified: boolean }
  | { mode: "chunked"; file: FileRef; revision: DiskRevision; cursor: string }
  | { mode: "unsupported"; file: FileRef; reason: "binary" | "encoding" };
interface SaveDocument {
  documentId: Id;
  editorRevision: Revision;
  expectedDiskRevision: DiskRevision;
  text: string;
  encoding: DocumentMeta["encoding"];
  eol: "lf" | "crlf";
}
interface SaveResult {
  savedEditorRevision: Revision;
  diskRevision: DiskRevision;
  recoveryCheckpointId: Id | null;
}
interface FileRelocationPlan {
  planId: Id; digest: string; expiresAt: string; // RFC3339；创建后5分钟
  source: FileRef; hasBuffer: boolean; dirty: boolean;
  candidate: {
    displayPath: string; fileId?: Id; // 已登记候选才含 fileId
    mode: OpenDocument["mode"]; diskRevision: DiskRevision;
    encoding?: DocumentMeta["encoding"]; eol?: DocumentMeta["eol"];
    readOnly: boolean; simplified: boolean; canKeepBuffer: boolean;
    text?: string; previewTruncated: boolean; reason?: "binary" | "encoding";
  };
}
interface FileRelocationResult {
  previousFileId: Id; choice: "useSelected" | "keepBuffer";
  file: FileRef; opened: OpenDocument;
}
```

编码与换行转换是显式输入；保存不隐式 trim、format。mixed EOL 文档首期 readOnly，用户选择规范化另存后才能编辑，不能直接传 LF 冒充原样保存。偏移采用 UTF-16 code unit，与 CodeMirror/JS 一致；文件 chunk 的 offset/length 是字节，类型字段必须说明，不能混用。行列均 0-based，UI 显示时再加 1。

## 4. 工作区、文件、设置命令

下表每个方法的完整 params 是表内对象；未写可选标记的字段均必填。`Page<T>` 定义为 `{items:T[],nextCursor:string|null}`；`Ack` 定义为 `{revision:number}`。公共 INVALID_ARGUMENT/PERMISSION_DENIED/STALE_SCOPE 不在每行重复。`*` 表示必须提供 idempotencyKey。

| 方法 / 所有者 | 请求 params | 响应 data | 特定错误 / 页面 |
| --- | --- | --- | --- |
| `app_bootstrap` / kernel | `{clientVersion,protocolVersion:1}` | `{protocolVersion:1,schemaHash,workspaces:Workspace[],projects:Project[],availableServices:string[]}` | PROTOCOL_UNSUPPORTED；A01/G01 |
| `form_discard_confirm` / kernel（app scope） | `{}` | `{discard:boolean}`；仅明确选择“放弃修改”为 true，继续编辑、取消或已有确认在途为 false；只询问，不改业务数据 | NOT_FOUND/IO_ERROR；主窗口系统确认，F03/F05/F07 |
| `workspace_create`* / kernel | `{name:string}` | `Workspace` | INVALID_ARGUMENT；A03 |
| `workspace_update`* / kernel | `{workspaceId,expectedRevision,name?,projectOrder?:Id[]}` | `Workspace` | STALE_VERSION；A02 |
| `workspace_remove`* / kernel | `{workspaceId,expectedRevision,moveToWorkspaceId}` | `{removedId,movedProjects:Id[]}` | RESOURCE_BUSY；不能移除默认工作区 |
| `project_pick_directory` / kernel | `{}` | `{selectionToken:Id\|null,displayPath?:string}` | 用户取消为 null；A04 |
| `project_register`* / kernel | `{selectionToken,workspaceId,displayName?}` | `{project:Project,reused:boolean}` | NOT_FOUND；A04 |
| `project_update`* / kernel | `{projectId,expectedRevision,displayName?,pinned?,workspaceId?}` | `Project` | STALE_VERSION；A06 |
| `project_activate` / kernel | `{projectId}` | `{project:Project,projectEpoch:number,session:ProjectSession}` | NOT_FOUND/IO_ERROR；B01 |
| `project_close_plan` / kernel | `{projectId,action:"sleep"\|"remove"}` | `ResourceStopPlan` | G03/A06；不执行停止 |
| `project_close_apply`* / kernel | `{planId,planDigest,decisions:ResourceDecision[]}` | `{state:"sleeping"\|"removed",remainingResources:Id[]}` | STALE_VERSION/RESOURCE_BUSY |
| `directory_list` / explorer | `{directoryId:Id\|null,cursor?:string,limit?:number}` | `DirectoryPage` | STALE_CURSOR/IO_ERROR；B01 |
| `file_create`* / kernel | `{parentEntryId,name,kind:"file"\|"directory"}` | `DirectoryEntry` | FILE_LOCKED/IO_ERROR；B02 |
| `file_rename`* / kernel | `{entryId,newName,expectedRevision:DiskRevision}` | `DirectoryEntry` | FILE_CHANGED/FILE_LOCKED；B02 |
| `file_trash`* / kernel | `{entryId,expectedRevision:DiskRevision,confirmationDigest}` | `{trashed:boolean}` | FILE_CHANGED/IO_ERROR；不降级永久删除 |
| `document_open` / editor | `{fileId,mode:"auto"\|"simplified"}` | `OpenDocument` | NOT_FOUND/RESOURCE_LIMIT；B01/B09 |
| `document_mark_dirty` / editor→kernel | `{documentId,editorRevision,dirty:boolean}` | `Ack` | STALE_VERSION；合并元数据不传全文 |
| `document_checkpoint`* / kernel | `{documentId,editorRevision,baseDiskRevision,text,selection:{anchor,head}}` | `{checkpointId,editorRevision}` | DISK_FULL；最多16 MiB |
| `document_save`* / kernel | `SaveDocument` | `SaveResult` | FILE_CHANGED/FILE_LOCKED/DISK_FULL；B06 |
| `document_save_as`* / kernel | `{documentId,editorRevision,text,encoding,eol:"lf"\|"crlf",destinationSelectionToken,name,expectedDestinationRevision:DiskRevision\|null}` | `{file:FileRef,result:SaveResult}` | null 表示目标必须不存在；已有目标须先读取/确认其版本 |
| `document_reload` / editor | `{documentId,expectedEditorRevision,expectedDiskRevision,discardLocal:boolean}` | `OpenDocument` | STALE_VERSION/FILE_CHANGED；dirty 需明确选择 |
| `document_relocate_prepare` / editor→kernel | `{fileId,documentId?,expectedEditorRevision?}` | `{plan:FileRelocationPlan\|null}` | 原生选择并预览；取消为 null；STALE_VERSION/RESOURCE_BUSY/NOT_FOUND；G02 |
| `document_relocate_apply`* / editor→kernel | `{planId,digest,choice:"useSelected"\|"keepBuffer"}` | `FileRelocationResult` | STALE_VERSION/FILE_CHANGED/RESOURCE_BUSY/RESOURCE_LIMIT；显式确认关联，不写候选文件；G02 |
| `document_close`* / editor | `{documentId,expectedEditorRevision,decision:"saved"\|"discard"}` | `{closed:true}` | STALE_VERSION/RESOURCE_BUSY；B08 |
| `file_read_chunk` / kernel | `{fileId,cursor,limitBytes?:number}` | `{text,byteStart:ByteCount,byteEnd:ByteCount,nextCursor:null\|string,revision:DiskRevision}` | FILE_CHANGED；默认256 KiB、最大1 MiB |
| `settings_get` / kernel | `{projectId?:Id}` | `{revision,global,overrides,effective,sources}` | F01–F14；JSON object 按设置 schema，外观结构变更复用第12节事务 |
| `settings_patch`* / kernel | `{scope:"global"\|"project",projectId?:Id,expectedRevision,set:Record<string,unknown>,unset:string[]}` | `{revision,effective}` | STALE_VERSION/INVALID_ARGUMENT |
| `credential_set`* / kernel | `{connectionId,secret:string,persistence:"system"\|"session"}` | `{credentialRef,configured:true}` | CREDENTIAL_UNAVAILABLE；从不返回 secret |
| `credential_remove`* / kernel | `{credentialRef}` | `{removed:boolean}` | CREDENTIAL_UNAVAILABLE |
| `recovery_list` / kernel | `{projectId?:Id}` | `{items:{checkpointId,documentId,projectId,editorRevision,updatedAt,byteCount:ByteCount}[]}` | 编辑扩展卸载后仍可列恢复稿 |
| `recovery_export`* / kernel | `{checkpointId,expectedEditorRevision,destinationSelectionToken,name}` | `{exportReceiptId,checkpointId,editorRevision,bytesWritten:ByteCount}` | STALE_VERSION/IO_ERROR；目标存在则拒绝覆盖 |
| `data_export`*（start） / kernel | `{categories:("settings"\|"diagnostics")[],destinationSelectionToken,name}` | `{exportReceiptId,excludedFields:string[],bytesWritten:ByteCount}` | F09；设置无密钥、正文和机器绝对路径，诊断先脱敏 |
| `data_clear_prepare` / kernel | `{categories:("cache"\|"agentHistory"\|"recoveryDrafts")[],projectId?:Id,itemIds?:Id[]}` | `{planId,digest,expiresAt,items:{id,category,bytes:ByteCount}[],blockedIds:Id[],externalUntouched:string[]}` | F09；只预览，未选具体恢复稿不允许删除草稿类 |
| `data_clear_apply`*（start） / kernel | `{planId,digest}` | `{clearedIds:Id[],failed:{id,error:HorizonError}[],externalUntouched:string[]}` | STALE_VERSION/RESOURCE_BUSY；不把部分失败报成全部完成 |

文件定位的两个方法均为 project scope，受编辑服务启用状态和当前 `projectEpoch` 约束。`prepare` 只通过原生文件选择器取得候选、读取并建立比较计划；不接受客户端路径，不更改原关联，不写目标，也不授予候选外部访问权。已有文档须同时传 `documentId` 与 `expectedEditorRevision`；dirty 文档须先完成当前版本的完整恢复稿。候选 `text` 只供预览，最多256 KiB，并以 `previewTruncated` 标明截断；不能用预览正文保存或接替恢复稿。

`apply` 必须来自用户明确选择。`keepBuffer` 仅允许 dirty 源文档与完整可编辑候选：源文档可写、编码为 UTF-8/UTF-8 BOM、换行为 LF/CRLF；候选不能是只读、mixed EOL、UTF-16、不支持类型或简化/分块模式。成功时保留原 `documentId`、`editorRevision`、草稿全文、编码、换行、dirty/conflict 状态与恢复稿选择位置，将文档和完整恢复稿的 FileRef、`baseDiskRevision` 重绑到确认候选。恢复稿完成安全重绑后才替换内存文档；磁盘目标要等后续显式保存才写入。

`useSelected` 表示载入候选；存在 dirty 内容时必须先比较并明确放弃旧编辑。完整可读的只读文本允许载入，返回 `readOnly:true`；该选择不要求目标可写。dirty 源遇到无法完整读取比较的分块或不支持候选，返回 `RESOURCE_LIMIT` 并保留原关联与恢复稿。候选成功读取且新打开状态已准备好后才移除旧恢复稿；失败保留旧 native 文档。已有文档载入 editor 候选时沿用 `documentId` 与 `editorRevision`，变为 clean；无原文档时生成新 `documentId`。返回的 `file`/`previousFileId` 用于重绑标签与会话；`keepBuffer` 同时迁移原编辑视图以保留 Undo、选择和滚动位置。原 FileRef 仍代表原路径，不把该登记身份改指新路径。

计划 TTL 为5分钟；`apply` 重验 `digest`、项目/epoch、原路径关联、原文档元数据与编辑版本、完整恢复稿摘要和候选 `diskRevision`。计划过期、源版本/恢复稿变化返回 `STALE_VERSION`；候选磁盘变化返回 `FILE_CHANGED`，均须重新选择/比较。候选已被另一 native 文档打开返回 `RESOURCE_BUSY`；若预览含候选 `fileId`，前端同样拒绝与另一个现有缓冲合并。确认外部候选后只授权该文件，不扩展到目录或同级文件。两个 apply 选项均不写原文件或候选文件；`idempotencyKey` 保证已成功调用可安全重试。

`ProjectSession` 固定字段：`{schemaVersion:1,revision,tabs:{fileId,pinned,selection,scrollTop}[],activeFileId:string|null,expandedEntryIds:Id[],searchDraft:string,commitDraft:string,layout:LayoutState}`。LayoutState `{panels:Record<string,{visible:boolean,activeViewId:Id|null}>,focusMode:boolean,focusRestore:Record<string,boolean>|null}`；只存临时显隐/选中视图与专注恢复快照。layoutId、首选几何、主题与背景由第12节 AppearancePreferences 持有；位置来自布局插件，窗口钳制结果不写入会话。

`ResourceStopPlan` 为 `{planId,digest,scope,expiresAt,resources:{resourceId,ownerExtensionId,kind,state,actions:string[]}[],dirtyDocuments:Id[],dependentExtensions:Id[]}`。`ResourceDecision` 为 `{resourceId,action:"save"|"discard"|"retainCheckpoint"|"export"|"stop"|"detach",checkpointId?:Id,exportReceiptId?:Id}`；retainCheckpoint/export 必须分别校验本次文档最新版本的持久检查点/导出回执。任一必需资源未决返回 RESOURCE_BUSY，不部分卸载编辑器后再问 dirty 文档。保留恢复稿是用户明确选择，不声称原文件已保存。

数据清理计划固定项目、条目与版本摘要，执行前重验；活动会话、仍被编辑器引用的恢复稿返回 blocked，不静默丢弃。清 cache 不包含恢复稿、聊天或凭据；未解决恢复稿只有用户单独选择具体条目并确认删除才可清除。凭据通过 credential_remove 单独管理；Pi 自有 OAuth/外部历史列入 externalUntouched，不声称已清理。recovery_export 由系统保存对话框取得目标 token，宿主验证选择范围，不依赖代码扩展。

长任务方法：

| start 方法 / 所有者 | 请求 | data 事件 / 最终结果 | 取消 |
| --- | --- | --- | --- |
| `search_start` / explorer | `{query,regex,caseSensitive,wholeWord,includeGlobs:string[],excludeGlobs:string[],includeIgnored:boolean,maxMatches?:number}` | `search.matches:{items:SearchMatch[]}`；`{matches,files,truncated,elapsedMs}` | 停 rg；返回已显示的部分结果 |
| `path_query` / explorer | `{query,generation,limit?:number}` | `{items:{file:FileRef,score:number}[],generation,truncated}`；短查询用 call | 新 generation 废弃旧结果 |
| `search_results_read`（call） / explorer | `{taskId,cursor?:string,limit?:number}` | `Page<SearchMatch>`；默认200、最大1000；任务记录过期 NOT_FOUND | 只读已保存结果页；不自动重跑搜索 |
| `git_clone`* / git | `{url,destinationSelectionToken,directoryName,openAfter:boolean}` | `git.progress:{phase,received?,total?}`；`{project?,createdDirectoryToken}` | 只回收本次进程；残留目录交用户选择 |

`SearchMatch` 为 `{file:FileRef,line:number,lineText?:string,ranges:({unit:"utf16",from:number,to:number}|{unit:"byte",from:ByteCount,to:ByteCount})[],diskRevision?:DiskRevision}`。正常解码时将 rg byte offsets 转换到行内 UTF-16；非法编码仅返回文件内绝对 byte 范围，不能猜列号。点击过期文件定位前重读。

## 5. Git 服务契约

Git 方法注册于 `horizon.git`，由独立 sidecar 实现。宿主通过 extension activation 租约路由，禁用 Git 后不应还能执行它的命令。`repoToken` 是 sidecar 对 HEAD/index/目标文件状态生成的不透明短期快照，不是对外部 Git 的全局事务锁。

```ts
interface GitFileStatus {
  file: FileRef; originalPath?: string;
  index: string; worktree: string; // porcelain XY，保留两列
  kind: "ordinary" | "rename" | "unmerged" | "untracked" | "ignored";
  binary?: boolean;
}
interface GitSnapshot {
  repoId: Id; generation: number; repoToken: string;
  head: { state: "branch" | "detached" | "unborn"; name?: string; oid?: string };
  upstream: { name: string; ahead: number | null; behind: number | null } | null;
  files: GitFileStatus[]; truncated: boolean;
}
type DiffBase = "indexToWorktree" | "headToIndex" | "commitToParent";
interface GitDiff {
  diffId: Id; repoToken: string; base: DiffBase; file: FileRef;
  binary: boolean; truncated: boolean;
  oldText?: string; newText?: string; patch?: string;
  oldOid?: string; newOid?: string;
}
```

| 方法 | params | 返回 / 事件 | 附加错误 |
| --- | --- | --- | --- |
| `git_status` | `{refresh:boolean}` | `GitSnapshot` | GIT_NOT_FOUND；无仓库返回 NOT_FOUND 与 notRepository detail |
| `git_diff` | `{repoId,fileId,base:DiffBase,commitOid?:string,expectedRepoToken?}` | `GitDiff` | STALE_VERSION |
| `git_conflict_get` | `{repoId,fileId,expectedRepoToken}` | `{repoToken,base:GitBlobRef\|null,ours:GitBlobRef\|null,theirs:GitBlobRef\|null,workingFile:FileRef}` | 缺失 stage 用 null 表达 add/delete 冲突；不伪造空文件 |
| `git_blob_read` | `{repoId,blob:GitBlobRef,cursor?:string,limitBytes?:number}` | `{text?:string,binary:boolean,nextCursor:string\|null}` | 默认256 KiB、最大1 MiB；binary 无 text |
| `git_history` | `{repoId,cursor?:string,limit?:number}` | `Page<{oid,parents:string[],subject,author,time}>` | STALE_CURSOR |
| `git_branches` | `{repoId}` | `{items:{name,oid,current,remote,upstream?}[],repoToken}` | GIT_COMMAND_FAILED |
| `git_mutate`*（start） | `GitMutation` | `git.progress`；`{snapshot:GitSnapshot,commitOid?,perFile?:FileOutcome[]}` | GIT_LOCKED/GIT_AUTH_REQUIRED/GIT_NON_FAST_FORWARD/GIT_CONFLICT/GIT_COMMAND_FAILED |
| `git_discard_plan` | `{repoId,fileIds:Id[],source:"index"\|"head"}` | `{planId,digest,repoToken,files:{fileId,beforeHash,operation}[]}` | FILE_CHANGED |

```ts
type GitMutation = {
  repoId: Id; expectedRepoToken: string;
} & (
  | { operation: "stage" | "unstage"; fileIds: Id[] }
  | { operation: "commit"; message: string; stagedFileIds: Id[] }
  | { operation: "fetch"; remote: string }
  | { operation: "pull"; remote: string; branch: string; strategy: "ffOnly" }
  | { operation: "push"; remote: string; sourceRef: string; targetRef: string; setUpstream: boolean }
  | { operation: "switch"; branch: string }
  | { operation: "createBranch"; name: string; startOid: string; switchAfter: boolean }
  | { operation: "discard"; planId: Id; planDigest: string }
);
interface FileOutcome { fileId: Id; state: "applied" | "unchanged" | "failed"; error?: HorizonError }
```

`GitBlobRef` 为 `{oid:string,byteLength:ByteCount}`。冲突结果通过文档条件保存，再显式 stage；首版可提供 base/ours/theirs 阅读与整文件选择，完整三栏交互按产品 v0.2 范围交付。commit 只针对已暂存索引，`stagedFileIds` 用来核对用户审查范围，不转为 `git commit <paths>`。没有 force push 字段；逐块暂存另开协议版本。取消 network/commit 的 terminal effect 必须反映实际/未知效果。

## 6. 扩展与贡献点契约

### 6.1 Manifest

```json
{
  "schemaVersion": 1,
  "id": "horizon.git",
  "version": "0.1.0",
  "engines": { "horizon": ">=0.1.0 <0.2.0" },
  "apiVersion": 1,
  "runtime": {
    "kind": "nativeService",
    "entryByTarget": {
      "darwin-aarch64": "bin/git-service-aarch64",
      "darwin-x86_64": "bin/git-service-x64",
      "windows-x86_64": "bin/git-service.exe"
    },
    "uiRuntime": "trusted-main",
    "uiEntry": "ui/index.js"
  },
  "activation": ["onProject:git", "onCommand:horizon.git.open"],
  "requires": {},
  "optional": { "horizon.editor": "^0.1.0" },
  "capabilities": ["project.read", "project.write.reviewed", "process.git"],
  "provides": [{ "service": "git", "version": 1 }],
  "contributes": {
    "commands": [{ "id": "horizon.git.open", "title": "查看 Git 更改" }],
    "views": [{ "id": "horizon.git.changes", "slot": "sidebar", "renderer": "trusted" }]
  }
}
```

manifest 是提案实例；实际包摘要/签名存在安装记录，不写入被摘要的同一个 manifest。入口必须位于包内；nativeService/trusted-main 首期仅受信任第一方包。普通逻辑扩展 `runtime.kind=quickjs`，entry 是已构建 JS；这是待 M0 验证的隔离适配，不在 runtime 内装 Cordis。声明式包无 entry，可贡献 layouts/themes（第 12 节）。不接收任意“Rust 动态库”或带安装脚本执行的 npm 包。

### 6.2 生命周期 API

```ts
interface ExtensionContext {
  activationId: Id;
  scope: Scope;
  subscriptions: Disposable[];
  commands: { register(id: string, fn: (args: unknown) => Promise<unknown>): Disposable };
  services: { get<T>(name: string, version: number): Promise<ServiceLease<T>> };
  views: { register(id: string, model: DeclarativeView): Disposable };
  storage: { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> };
}
interface Disposable { dispose(): void | Promise<void> }
interface ServiceLease<T> extends Disposable { service: T; leaseId: Id }
type DeclarativeView = {
  kind: "tree" | "list" | "text";
  title: string;
  items: { id: Id; label: string; description?: string; commandId?: string }[];
};
interface ExtensionModule {
  activate(ctx: ExtensionContext): Promise<void>;
  prepareDeactivate(reason: "pause" | "disable" | "uninstall" | "shutdown"):
    Promise<{ ready: boolean; blockers: Id[] }>;
  deactivate(): Promise<void>;
}
```

宿主即使 deactivate 抛错也继续回收租约；不依赖扩展自愿 dispose 才停止资源。逻辑失败与进程终止区别呈现。进程/文件 grant 的身份由 context 的通道能力绑定，不能拷贝到其它 activation 继续用；回收立即吊销。

| 方法 | params | data / 语义 |
| --- | --- | --- |
| `extension_list` | `{projectId?:Id}` | `{items:ExtensionState[]}` |
| `extension_install_prepare` | `{packageSelectionToken}` | `{planId,digest,manifest,dependencies,permissions,downloadBytes:ByteCount}`；只校验 |
| `extension_install_apply`*（start） | `{planId,digest,grantIds:string[]}` | progress；`ExtensionState`；失败保留旧版 |
| `extension_enable`* | `{extensionId,scope:"global"\|"project",projectId?:Id,expectedRevision,enabled:boolean}` | `{status:"applied",state:ExtensionState}` 或 `{status:"needsStop",plan:ResourceStopPlan}`；needsStop 尚未改变启用意图 |
| `extension_project_override`* | `{extensionId,projectId,expectedRevision,policy:"inherit"\|"enabled"\|"disabled"}` | 与 extension_enable 同返回；inherit 删除覆盖，不能复制当前全局值 |
| `extension_resume`* | `{extensionId,scope:"global"\|"project",projectId?:Id,expectedRevision}` | `ExtensionState`；仅清除指定范围手动暂停标记，不重放任务或进程 |
| `extension_activate`*（start） | `{extensionId,reason:{kind:"command"\|"view"\|"language"\|"launch",id:string}}` | `ExtensionState`；按依赖拓扑激活 |
| `extension_stop_prepare` | `{extensionId,action:"pause"\|"disable"\|"uninstall",scope:"global"\|"project",projectId?:Id}` | `ResourceStopPlan` |
| `extension_stop_apply`*（start） | `{planId,digest,decisions:ResourceDecision[],deleteData:boolean}` | `{state:ExtensionState,resourcesReleased,uiReclaim}` |
| `renderer_reload_prepare` | `{}` | `{planId,digest,canRestoreUndo:boolean,blockers:Id[]}` |
| `renderer_reload_apply`* | `{planId,digest}` | `{newRendererEpoch}`；owned 进程保持，重绑订阅 |

```ts
interface ExtensionState {
  id: Id; revision: Revision; installedVersion: string | null;
  installState: "absent" | "installing" | "installed" | "updating" | "uninstalling" | "failed";
  pausedGlobal: boolean; pausedProject: boolean; effectivePaused: boolean;
  enabledGlobal: boolean; projectOverride: "inherit" | "enabled" | "disabled";
  effectiveEnabled: boolean;
  runState: "stopped" | "activating" | "active" | "sleeping" | "pausing" | "paused" | "failed" | "cleanupFailed";
  activationId?: Id; dependents: Id[]; ownedResourceCount: number;
  uiReclaim: "released" | "retainedModule" | "reloadRequired" | "failed";
  error?: HorizonError;
}
```

暂停标记按全局/项目范围持久化，重启不清除；effectivePaused 由两者合成，extension_activate 遇有效暂停返回 RESOURCE_BUSY，遇禁用返回 EXTENSION_DISABLED。extension_resume 不改变禁用策略；解除项目暂停也不能绕过全局暂停。恢复后视图/命令可重新触发普通激活，但不自动重放用户任务。启动方案临时恢复经计划批准并持有租约，结束后按计划与期间用户修改记录恢复原状态。卸载的 scope 必须 global；项目覆盖的 expectedRevision 防止旧页面改写新策略。sleeping 是可按需唤醒状态，stopped+无暂停表示未激活。

列表在指定项目下返回 effectiveEnabled；全局视图聚合实例并展示各项目状态，不能用单一 active 值抹掉多项目租约。全局禁用时 projectOverride=enabled 也不能激活。E02/E12 的停用不宣称内存零；native/QuickJS 进程退出与共享 WebView 模块回收分别验收。停用/卸载失败进入 cleanupFailed；安装记录只在停止成功后移除。

### 6.3 扩展宿主与策略桥的进程协议

Horizon 自有进程通道使用 `uint32 big-endian length + UTF-8 JSON`，length 不含4字节前缀，最大1 MiB；stdout 只写协议，诊断走 stderr。它与 Pi 的按 LF 分帧 RPC 不同。主进程在创建时给每个宿主通道分配身份；QuickJS 的 native binding 在 activation 建立时绑定 capability handle，JS 不能自填 extensionId 获取身份。

```ts
type HostFrame =
  | { type: "hello"; protocolVersion: 1; hostEpoch: Id; packageDigest: string }
  | { type: "request"; id: Id; activationHandle: Id; method: string; params: unknown }
  | { type: "reply"; id: Id; result: Reply<unknown> }
  | { type: "event"; activationHandle: Id; seq: number; event: string; data: unknown }
  | { type: "cancel"; id: Id }
  | { type: "dispose"; activationHandle: Id; reason: string }
  | { type: "disposed"; activationHandle: Id; remainingLeaseIds: Id[] };
```

hello 的摘要须与已启动安装记录匹配；它是版本核对，不是靠 payload 自证发布者。request ID 在 hostEpoch 内唯一，reply.result.requestId 必须等于 id。activate/deactivate 为宿主控制方法，业务 method 只能调用已注册且满足 grant 的服务；不是传入任意 Rust 函数名。请求超时默认30秒，等待用户交互另有 expiresAt；cancel 后等待明确结果，不能把正在落盘的写操作当作尚未发生。dispose 后拒绝新请求，回收尚存租约；无应答则由 ProcessSupervisor 结束该宿主，影响同宿主的所有 runtime 并逐项标 failed。

Pi 策略桥使用同一帧格式但独立实例通道（macOS 本地 socket/管道、Windows 限当前用户的 named pipe），以启动时分配的单次握手凭证绑定 instanceEpoch。仅策略扩展加载该通道，不能在模型 prompt 中暴露凭证。包装工具调用 `tool_operation_prepare({runId,toolCallId,operation})` 获得 `{operationId,digest,expiresAt}`；宿主按 PermissionRequest 展示批准或拒绝。`tool_operation_execute({operationId,digest})` 只消费已经由 UI 批准且版本仍匹配的操作，返回工具结果引用/owned process ID；重复执行返回同结果，不能再做一次副作用。未批准、过期、参数变化或断桥都拒绝。这里没有实现 Agent 规划或工具循环，Pi 仍决定何时调用工具。

## 7. AgentAdapter 与 Pi 映射

### 7.1 能力与对象

```ts
interface AgentCapabilities {
  protocol: "pi-rpc" | "acp-v1" | "codex-app-server" | "sdk-bridge" | "terminal";
  structuredMessages: boolean;
  tools: "none" | "observed" | "gated";
  permissions: "none" | "runtimeNative" | "horizonBroker";
  sessionResume: boolean;
  attach: boolean;
  modelSelection: boolean;
  auth: ("horizonApiKey" | "runtimeOwned" | "external")[];
  input: ("text" | "textSnippets" | "images" | "fileReferences")[];
  changes: "none" | "observedDisk" | "versionedReview";
  cancel: "protocol" | "ownedProcessOnly" | "none";
}
interface AgentConnection {
  connectionId: Id; adapterId: string;
  runtime: { source: "managed" | "userInstalled"; version?: string; executableRef?: Id };
  provider?: { id: string; api: string; model: string; endpoint?: string; credentialRef?: Id };
  authOwner: "horizon" | "runtime" | "external";
}
interface AgentSession {
  sessionId: Id; projectId: Id; connectionId: Id;
  instanceId: Id | null; instanceEpoch: number;
  state: "dormant" | "starting" | "idle" | "running" | "waitingInput" | "closing" | "failed";
  profile: "chat" | "task";
  resumeAvailable: boolean;
}
interface ContextItem {
  id: Id; file: FileRef; source: "disk" | "buffer" | "gitDiff";
  editorRevision?: Revision; diskRevision?: DiskRevision;
  range?: { fromUtf16: number; toUtf16: number };
  byteLength: ByteCount; contentHash: string;
}
interface ContextSnapshot {
  snapshotId: Id; manifestDigest: string; items: ContextItem[];
  totalBytes: ByteCount; expiresAt: string;
}
interface SubmitResult {
  submissionId: Id;
  disposition: "started" | "queued" | "handled";
  runId: Id | null; // handled 为 null；不是执行结果
}
```

Pi 首期 `attach=false`，并非所有 capabilities 都 true。外部进程与受管实例分开：`ownership=attached` 的 close 仅断开；除非明确获得控制权，不能按 PID stop。首期 Pi 只 owned。

### 7.2 适配器内侧接口

```ts
interface AgentAdapter {
  detect(input: { executableRef?: Id }): Promise<{
    installed: boolean; version?: string; supported: boolean; diagnostics: string[];
  }>;
  connect(input: { connection: AgentConnection; projectId: Id }): Promise<{
    connectionHandle: Id; capabilities: AgentCapabilities;
    authState: "unknown" | "configured" | "verified" | "needsAuthentication";
  }>;
  createSession(input: { connectionHandle: Id; projectId: Id; profile: "chat" | "task" }):
    Promise<AgentSession>;
  resumeSession?(sessionId: Id): Promise<AgentSession>;
  submit(input: { sessionId: Id; submissionId: Id; text: string; snapshotId: Id }):
    Promise<SubmitResult>;
  cancel(input: { sessionId: Id; runId: Id }): Promise<{ requested: boolean }>;
  answerInteraction(input: InteractionAnswer): Promise<{ accepted: boolean }>;
  subscribe(sessionId: Id, listener: (event: AgentEvent) => void): Disposable;
  close(input: { sessionId: Id; reason: "idle" | "disable" | "shutdown" | "user" }):
    Promise<{ closed: boolean; forced: boolean; effect: Effect }>;
}
```

这是进程边界的逻辑接口，可用 Rust trait + DTO 实现，不要求在主 WebView 运行这份 TypeScript。首次实现为 Pi adapter；SDK bridge/ACP 实现可以后加，不先写空的三套运行时。

```ts
interface AgentEvent {
  sessionId: Id; instanceEpoch: number; seq: number;
  runId: Id | null;
  payload:
    | { type: "runStarted"; submissionId: Id }
    | { type: "textDelta"; messageId: Id; blockIndex: number; text: string }
    | { type: "messageFinal"; messageId: Id; text: string; stopReason?: string }
    | { type: "toolState"; toolCallId: Id; parentToolCallId?: Id; name: string;
        state: "requested" | "waitingPermission" | "running" | "succeeded" | "failed" | "blocked" }
    | { type: "interaction"; request: InteractionRequest }
    | { type: "phase"; phase: "retrying" | "compacting"; detail?: string }
    | { type: "runSettled"; state: "succeeded" | "failed" | "cancelled";
        effect: Effect; error?: HorizonError }
    | { type: "sessionState"; state: AgentSession["state"] };
}
```

普通 Agent 流不统一伪造百分比。Pi `agent_start` 可能一 run 内多次；只创建一次 Horizon runStarted，后续是内部 phase。messageId 由适配器对 message_start 分配，stream delta 对应 blockIndex，message_end 覆盖对应消息最终内容。toolCallId 保留 runtime ID，并与 instanceEpoch 联合去重。

### 7.3 UI-facing 方法

| 方法 | params | data / 错误 |
| --- | --- | --- |
| `agent_detect` / Pi 扩展 | `{adapterId,executableRef?:Id}` | `{installed,version,supported,diagnostics}`；只检测不发模型请求 |
| `agent_connection_save`* | `{expectedRevision,connection:AgentConnection}` | `{revision,connectionId}`；秘密另交 credential_set |
| `agent_connect`（start） | `{connectionId}` | `{capabilities,authState}`；AUTH_REQUIRED/AGENT_UNAVAILABLE |
| `agent_connection_test`（start） | `{connectionId,expectedRevision}` | `{authState:"verified"\|"needsAuthentication",modelAvailable:boolean}`；用户触发的固定无项目文本探测；费用提示由 UI 呈现 |
| `agent_models_list` | `{connectionId}` | `{items:{providerId,modelId,label}[],source:"configured"\|"runtime"}`；列表存在不代表认证成功 |
| `agent_session_create`* | `{connectionId,profile:"chat"\|"task"}` | `AgentSession` |
| `agent_session_resume`*（start） | `{sessionId}` | `AgentSession`；CAPABILITY_UNSUPPORTED |
| `agent_context_prepare` | `{sessionId,items:ContextInput[]}` | `ContextSnapshot`；CONTEXT_TOO_LARGE/STALE_VERSION |
| `agent_submit`*（start） | `{sessionId,text,snapshotId,manifestDigest,submissionId}` | data kind `agent.accepted:SubmitResult`，再 `AgentEvent`；终态对应 runSettled/handled |
| `agent_cancel` | `{sessionId,runId}` | `{cancelRequested:boolean}`；继续观察 runSettled |
| `agent_interaction_answer`* | `InteractionAnswer` | `{accepted:boolean}`；PERMISSION_EXPIRED/STALE_SCOPE |
| `agent_session_close`*（start） | `{sessionId,reason:"idle"\|"disable"\|"user"}` | `{closed,forced,effect}` |
| `agent_transcript_read` | `{sessionId,cursor?:string,limit?:number}` | `Page<{messageId,role,text,state,contentRef?,truncated?}>`；默认50、最多100条；正文摘要最多32 KiB |
| `agent_message_read` | `{sessionId,messageId,cursor?:string}` | `{text,nextCursor:string\|null,totalBytes:ByteCount}`；按UTF-8边界读取32 KiB全文页 |
| `review_get` | `{reviewId}` | `{origin:"proposed"\|"taskCopy"\|"observedDisk",files:ReviewFile[]}` |
| `review_file_read` | `{reviewId,fileId,side:"baseline"\|"after",cursor?:string,limitBytes?:number}` | `{text?:string,binary:boolean,contentHash,nextCursor:string\|null}`；默认256 KiB、最大1 MiB |
| `review_apply`*（start） | `{reviewId,targets:{fileId,expectedDiskRevision:DiskRevision\|null,expectedEditorRevision?:Revision}[]}` | `{results:FileOutcome[]}`；FILE_CHANGED/STALE_VERSION；null 表示新增目标必须不存在 |
| `review_editor_result`* | `{applicationId,documentId,state:"applied"\|"rejected",editorRevision,contentHash?,reason?}` | `{recorded:boolean}`；只接受被指定的 editor owner；不能由其它扩展代报 |
| `review_discard`* | `{reviewId,deleteTaskCopy:boolean}` | `{discarded:boolean}`；不重置原项目 |

`ReviewFile` = `{file:FileRef,baselineHash:string|null,afterHash:string|null,expectedDiskRevision:DiskRevision|null,expectedEditorRevision?:Revision,kind:"added"|"modified"|"deleted",canApply:boolean,reason?:string}`。新增的 baselineHash、删除的 afterHash 为 null。完整正文通过 diff/page 读取，列表不带全仓文本。

```ts
type ContextInput =
  | { source: "disk"; fileId: Id; expectedDiskRevision: DiskRevision;
      range?: { fromUtf16: number; toUtf16: number } }
  | { source: "buffer"; documentId: Id; editorRevision: Revision; text: string;
      range?: { fromUtf16: number; toUtf16: number } }
  | { source: "gitDiff"; diffId: Id; expectedRepoToken: string };
```

buffer 的 text 是本次冻结全文，range 在该全文内选择；host 校验所属项目、editorRevision 与大小，并按所选片段计附件预算。全文传输上限与编辑上限相同为16 MiB；冻结片段总计仍不得超过256 KiB/20项。gitDiff 引用不可变 diffId，不以“当前 diff”代替基线。超限返回 CONTEXT_TOO_LARGE，不静默截断。

`review_apply` 对未打开文件走宿主条件写；对打开文档先发送 data kind `review.editorApply`，内容为 `{applicationId,reviewId,fileId,documentId,expectedEditorRevision,expectedDiskRevision,afterContentRef:{reviewId,fileId,side:"after"}}`。编辑控制器读取结果并再次检查当前编辑版本，在一个 undo transaction 中应用，随后调用 review_editor_result。只有确认成功才返回该文件 applied；超时/窗口消失为未确认，不自动重发编辑。应用期间磁盘发生变化时保留编辑结果为 dirty/conflict，不能自动保存。文件删除在打开文档时需要单独关闭/删除确认；新增/删除没有对应正文的一侧返回 NOT_FOUND，而不是空字符串。

### 7.4 权限与一般交互

```ts
interface PermissionRequest {
  permissionRequestId: Id; taskId: Id; runId?: Id;
  ownerExtensionId: string; operationDigest: string; expiresAt: string;
  operation:
    | { kind: "write"; files: { file: FileRef; beforeHash: string | null; bytes: ByteCount }[] }
    | { kind: "exec"; executable: string; argv: string[]; cwd: string; network?: string[] }
    | { kind: "install"; extensionId: string; version: string; capabilities: string[] };
}
interface InteractionRequest {
  interactionId: Id; sessionId: Id; runId: Id | null; expiresAt?: string;
  kind: "permission" | "confirm" | "select" | "input" | "editor";
  title: string; message?: string; options?: string[]; permission?: PermissionRequest;
}
interface InteractionAnswer {
  sessionId: Id; interactionId: Id;
  decision: "allowOnce" | "deny" | "cancel" | "value";
  value?: string;
  operationDigest?: string; // permission 必填；绑定已展示操作
}
```

权限来源与实际执行工具绑定，一次性消费；回答重复返回已处理结果，过期/旧 instance 拒绝。Pi 原生 UI dialog 没有 Horizon operationDigest，不能仅看到“Allow?”就升级成可信系统权限；结构化工具权限走经过握手的 Horizon 策略桥。取消 run 时先拒绝挂起询问；notify/setStatus 无应答。

### 7.5 Pi wire 示例与映射

下面是 Pi 1.4.0 格式，不加 `jsonrpc` 字段；省略的是普通流事件数量，不是必需字段。Horizon ID 与 Pi command ID 的映射保存在适配器。

```json
{"id":"pi-request-7","type":"prompt","message":"解释所选片段：\n<snapshot id=\"ctx-1\">...</snapshot>"}
```

```json
{"id":"pi-request-7","type":"response","command":"prompt","success":true,"data":{"disposition":"started"}}
```

```json
{"type":"agent_settled","aborted":false}
```

`handled`：agent_submit 终态 result `{disposition:"handled",runId:null}`；没有模型完成消息也不算错误。`queued`：不得报 completed；本版禁用主动排队，异常发生先同步状态。stdout 非法 JSON/未知必须字段返回 AGENT_PROTOCOL_ERROR 并关闭受管实例；未知可扩展事件可保留诊断忽略，不能把不认识的终态当成功。

取消：先发带不同 id 的 clear_queue，再发 abort；响应各自关联，不能依据先后顺序猜命令。强制结束实例后当前 run 标 cancelled/unknown 或 failed/PROCESS_EXITED，保留工具效果。Pi `agent_settled.aborted=false` 且最终消息 error 时应 failed，不能仅由 aborted 推断成功。详见 [Pi 调研](PI_AGENT_RESEARCH.md)。

## 8. 项目启动器与进程契约

### 8.1 配置

```ts
interface LaunchProfile {
  schemaVersion: 1; profileId: Id; projectId: Id; revision: Revision;
  name: string;
  requiredExtensions: { id: string; versionRange: string }[];
  steps: LaunchStep[];
  failurePolicy: "stopStarted" | "keepRunning";
}
interface LaunchStep {
  stepId: Id; title: string; dependsOn: Id[];
  command:
    | { kind: "exec"; executable: string; args: string[] }
    | { kind: "shell"; shell: string; script: string };
  cwd: string; // 项目相对路径，默认 "."；由 broker 解析
  env: Record<string, string>;
  secretRefs: Record<string, Id>;
  mode: "pipe" | "pty";
  lifecycle: "service" | "oneshot";
  ready:
    | { kind: "processStarted" }
    | { kind: "exit"; codes: number[] }
    | { kind: "tcp"; host: "127.0.0.1" | "::1"; port: number; timeoutMs: number }
    | { kind: "http"; url: string; statusCodes: number[]; timeoutMs: number }
    | { kind: "stdout"; pattern: string; timeoutMs: number };
  onReady?: { openTerminal?: boolean; openUrl?: string };
}
interface LaunchPlan {
  planId: Id; profileId: Id; profileRevision: Revision; digest: string; expiresAt: string;
  extensionActions: { id: string; action: "activate" | "install" | "blockedDisabled" }[];
  resolvedSteps: { stepId: Id; executable: string; args: string[]; cwd: string; envKeys: string[] }[];
  requiresApproval: boolean;
}
interface ProcessInstance {
  processInstanceId: Id;
  owner: { extensionId: string; activationId: Id; projectId: Id; launchRunId?: Id; agentRunId?: Id };
  ownership: "owned" | "attached";
  state: "starting" | "running" | "stopping" | "exited";
  startedAt: string; exitCode?: number;
}
```

配置 JSON 示例仅表示保存的数据，不是本轮执行命令：

```json
{
  "schemaVersion": 1,
  "profileId": "launch-dev",
  "projectId": "project-web",
  "revision": 1,
  "name": "前端与接口",
  "requiredExtensions": [{"id":"horizon.terminal","versionRange":"^0.1.0"}],
  "failurePolicy": "stopStarted",
  "steps": [
    {
      "stepId": "api", "title": "接口", "dependsOn": [],
      "command": {"kind":"exec","executable":"node","args":["server.js"]},
      "cwd": "api", "env": {}, "secretRefs": {}, "mode": "pipe", "lifecycle":"service",
      "ready": {"kind":"http","url":"http://127.0.0.1:3001/health","statusCodes":[200],"timeoutMs":30000}
    },
    {
      "stepId": "web", "title": "前端", "dependsOn": ["api"],
      "command": {"kind":"exec","executable":"npm","args":["run","dev"]},
      "cwd": ".", "env": {}, "secretRefs": {}, "mode": "pty", "lifecycle":"service",
      "ready": {"kind":"tcp","host":"127.0.0.1","port":5173,"timeoutMs":30000},
      "onReady": {"openTerminal":true,"openUrl":"http://127.0.0.1:5173"}
    }
  ]
}
```

Windows 的 npm.cmd 需要平台 launcher 处理；不能将任意 .cmd 直接当原生 exe 假设 argv 安全。resolve 阶段识别 launcher 类型，显示实际 shell/argv；优先调用已知 node + npm CLI 路径，任意 batch 脚本属于显式 shell 模式。

### 8.2 方法、状态与幂等

| 方法 / 所有者 | params | data / 事件 / 错误 |
| --- | --- | --- |
| `launch_detect` / launcher | `{}` | `{candidates:{sourceFile,scriptName,suggestedStep}[]}`；不执行脚本、不装依赖 |
| `launch_profile_save`* | `{profile:LaunchProfile,expectedRevision:Revision\|null}` | `LaunchProfile`；DAG/重复 ID/非法 cwd 拒绝 |
| `launch_profile_list` | `{}` | `{items:LaunchProfile[]}` |
| `launch_profile_delete`* | `{profileId,expectedRevision}` | `{deletedId:Id}`；有活动实例返回 RESOURCE_BUSY/existingRunId，先 launch_stop 成功再删；只删配置 |
| `launch_prepare` | `{profileId,profileRevision}` | `LaunchPlan`；blockedDisabled 不隐式启用 |
| `launch_start`*（start） | `{planId,planDigest,approved:boolean}` | `{launchRunId,steps}`，连续 `horizon.launch.v1` 状态；PORT_IN_USE/DEPENDENCY_UNAVAILABLE |
| `launch_get` | `{launchRunId}` | `LaunchRunState` |
| `launch_stop`*（start） | `{launchRunId}` | `{stopped:Id[],failed:Id[],externalUntouched:Id[]}` |
| `launch_restart`*（start） | `{launchRunId,replacementPlanId,planDigest,approved:boolean}` | 先校验已 prepare/批准的新计划，再 stop；完成后新 `{launchRunId}`；不复用旧 ID |
| `process_list` / kernel | `{projectId?:Id}` | `{items:ProcessInstance[]}`；最小宿主资源页也可用 |
| `process_stop`*（start） / kernel | `{processInstanceId,mode:"graceful"\|"force"}` | `{exited:boolean,forced:boolean,exitCode?:number}`；attached 返回 PERMISSION_DENIED |
| `terminal_create`* / terminal | `{shellRef?:Id,cwd:string}` | `{terminalSessionId,processInstanceId}` |
| `terminal_attach_view`（subscribe） / terminal | `{terminalSessionId,afterOffset?:ByteCount}` | `{viewSubscriptionId,bufferStart:ByteCount}` + TerminalOutput |
| `terminal_output_ack` / terminal | `{viewSubscriptionId,throughOffset:ByteCount}` | `{acceptedThroughOffset:ByteCount}`；只确认已连续处理字节 |
| `terminal_input` / terminal | `{terminalSessionId,data:string}` | `{acceptedBytes:number}`；上限64 KiB |
| `terminal_resize` / terminal | `{terminalSessionId,cols:number,rows:number}` | `{applied:boolean}`；1..1000 |
| `terminal_detach_view` / terminal | `{viewSubscriptionId}` | `{detached:true,processContinues:true}` |
| `terminal_stop`*（start） / terminal | `{terminalSessionId}` | process_stop 语义；停止真实实例 |

LaunchRunState `{launchRunId,profileId,profileRevision,state:"preparing"|"waitingPermission"|"starting"|"running"|"partial"|"failed"|"stopping"|"stopped",steps:{stepId,state,processInstanceId?,ready:boolean,error?}[]}`。启动任务的 terminal 代表启动计划完成/失败，不代表长期开发进程结束；后者继续通过 launch/process topic 更新。

同一 profile 的 active run 默认只能一个。双击相同 idempotencyKey 返回同 run；不同 key 仍检测 existing active run，返回 RESOURCE_BUSY 与 existingRunId，不隐式再开两组服务。依赖步骤按“ready”边而非“spawn 成功”启动。运行后配置修改不改变已有 argv；restart 基于新 revision 重新 prepare，若 plan 变更必须重新审查。

```ts
interface TerminalOutput {
  requestId: Id; viewSubscriptionId: Id; terminalSessionId: Id; seq: number;
  byteOffset: ByteCount; bufferStart: ByteCount; encoding: "base64"; data: string;
  gap: boolean; // 旧内容已越过环形缓冲，UI 明示历史截断
}
```

终端传输保留原始字节，base64 解码后由终端 decoder 跨包保留 UTF-8 余字节。单批原始数据最多64 KiB，未确认512 KiB时暂停向该视图发送；继续读取PTY到每实例2 MiB环形缓冲，覆盖旧内容时下一包 gap=true。低频退出状态走 process topic，不被输出背压阻塞。关闭 renderer 不停 PTY，也不无限保留 DOM。日志显示中断和退出码，不把 shell 仍存活当程序就绪。

## 9. Rust 形状与调度示例

以下展示可对应 TypeScript DTO 的 Rust 形状；省略具体服务实现，不使用 Tauri API 名称冒充已编译代码。完整错误 enum 与 schema 由同一 contracts 源生成/校验，避免手写两份漂移。

```rust
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Scope {
    App,
    Project { project_id: String, project_epoch: u32 },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SaveDocument {
    pub document_id: String,
    pub editor_revision: u64, // decode 后额外校验 <= JS MAX_SAFE_INTEGER
    pub expected_disk_revision: DiskRevision,
    pub text: String,
    pub encoding: String, // 最终实现用与 TS 同值的 enum
    pub eol: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiskRevision {
    pub token: String,
    pub content_hash: String,
    pub byte_length: String,
    pub modified_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub saved_editor_revision: u64,
    pub disk_revision: DiskRevision,
    pub recovery_checkpoint_id: Option<String>,
}

// 调用边界的概念签名：
// async fn save(caller: VerifiedCaller, request: SaveDocument,
//               cancellation: CancellationToken) -> Result<SaveResult, HorizonError>
// 服务从 caller 的 activation/window context 校验权限，不能从 request 获取可信身份。
```

锁顺序固定：extension registry lease → project registry → per-document/per-repo operation queue；不同时持有文件锁等待用户授权。permission plan 先冻结参数并释放短锁，得到批准后重新取锁校验版本，再执行。调用返回 FILE_CHANGED 时保留用户内容并进入比较，不能重用原批准绕过新基线。

## 10. 关键顺序示例

### 10.1 保存中继续输入

前端 revision=12，发送 save(12,disk=A,text12)；用户继续输入成为13；Rust 写成功返回 saved=12,disk=B。前端将 baseDiskRevision 更新为B，但 revision13 仍 dirty。若 Rust 看见 disk 已为C，返回 FILE_CHANGED，不写；前端仍保存 revision13 文本。

### 10.2 关闭面板与停止进程

终端 detach view → subscription_closed → PTY/process 仍 running。用户选择 stop → cancelRequested → interrupt/terminate → OS exit/wait → process.exited → terminal stopped。Agent/launch 同样用 owned instance，不因 panel unmount 直接 kill。

### 10.3 卸载编辑扩展

stop_prepare → 列出 dirty documents/依赖 → 用户保存或放弃 → stop_apply 再验 revision → suspend 新文档请求 → checkpoint → unregister commands/views → dispose EditorView → revoke leases → 扩展 stopped。ESM 尚缓存时 uiReclaim=reloadRequired；用户进行可恢复 renderer reload 后才 released。应用更新看到卸载 tombstone 不自动安装。

### 10.4 Pi 快速完成与取消交错

先订阅 → submit → 收到 agent_start/message events（可能先于 response）→ prompt disposition=started → agent_end → 可选 retry/compact → agent_settled → runSettled。取消在最后到达时可能收到 alreadyTerminal，不能把已完成 run 改为 cancelled。handled 路径直接结束 submission；没有对应 agent_settled 也不会卡住。

## 11. 错误呈现与恢复规则

| 错误 | UI 行为 | 禁止的自动处理 |
| --- | --- | --- |
| FILE_CHANGED / STALE_VERSION | 保留编辑/审查内容；刷新、比较、重算 | 强制覆盖、自动套用旧 patch |
| EXTENSION_DISABLED/MISSING | 显示具体扩展与启用/安装入口 | 因打开项目就悄悄重启被禁用扩展 |
| RESOURCE_BUSY | 列出 dirty 文档、run/终端与依赖 | 先隐藏扩展再留下失控进程 |
| AUTH_REQUIRED | 保留上下文与输入；显示认证归属/入口 | 自动登录、反复重发可能收费输入 |
| OUTCOME_UNKNOWN | 标记结果待核对，读取真实 Git/进程/磁盘 | 报“已撤回”或自动重试写操作 |
| PORT_IN_USE | 显示端口与对应步骤，编辑方案/重试 | 杀掉占用端口的外部程序 |
| AGENT_PROTOCOL_ERROR | 保留历史、停止受管实例、允许重新连接 | 把普通 stdout 文本猜成结构化结果 |

## 12. 契约验收清单

对应 TASK-ARCH-001/003/008/012 与 TASK-PI-002～006：

1. 请求 snake_case method、JSON camelCase、tagged unions、null 与 missing 含义一致；TS/Rust fixture 往返，未知字段被拒绝。
2. 事件早于 start 响应、重复 ack、丢失序号、terminal 后迟到包、窗口销毁、项目 epoch 改变均不会写错项目或重复终态。
3. 保存过程中继续输入、同 mtime 内容变化、编码/长行、外部 rename 与磁盘写满保留正确文本。
4. Git XY 两列、空仓库、中文/空格/换行/冒号 pathspec、部分暂存、hook 失败、取消 push 的效果真实可核对。
5. 默认扩展可以实际停止/卸载；依赖图有环拒绝；资源租约清零；共享 UI module cache 如实标注并通过重载回收。
6. Pi handled/queued/started、agent_end/settled、messageFinal、abort/clear_queue、未决权限、session 恢复各有独立 fixture；普通 CLI 文本不伪装适配。
7. 权限消息与操作 digest 绑定，回答过期/断桥拒绝；模型工具不能调用未开放 broker 能力；API secret 不进入工具进程环境或日志。
8. 双步骤启动只在依赖就绪后继续；失败策略生效；同一 profile 双击不重复 spawn；stop/restart 不碰外部服务；renderer 重载不重启进程。
9. 暂停跨重启保持，显式恢复不重放任务；恢复继承删除覆盖；停止后删除启动方案不留孤立实例；分类清理保护活动数据，代码扩展卸载后恢复稿仍可导出。
10. 上述定义只是实现验收条件；本轮未运行桌面/Agent 集成，不能在交付报告写成测试已通过。

## 12. 布局、主题与外观配置契约（0.4）

下列是 Horizon SDK v1 的设计类型；不对外暴露 Cordis 内部 Context 类型。Cordis `ctx.effect`/服务注册由宿主适配实现，第三方布局只能传声明数据。布局/主题包走既有 extension_install/enable/stop/uninstall，不另建安装器。`contributes.layouts` 为 `LayoutDefinition[]`，`contributes.themes` 为 `ThemeDefinition[]`；runtime.kind 为 declarative 且没有 entry。

```ts
type UiSlotId = "navigation" | "primarySidebar" | "editor" | "auxiliary"
  | "bottom" | "status" | "overlay";
type GeometryKey = "sidebarWidth" | "navigationWidth" | "topbarHeight"
  | "tabHeight" | "tabMinWidth" | "auxiliaryWidth" | "bottomHeight" | "statusHeight"
  | "uiFontSize" | "codeFontSize";
interface GeometryRule { initial: number; min: number; max: number; step: number }
type LayoutNode =
  | { id: Id; kind: "row" | "column"; children: LayoutNode[] }
  | { id: Id; kind: "slot"; slot: UiSlotId; sizing?: GeometryKey; grow?: number }
  | { id: Id; kind: "tabs"; slots: UiSlotId[] };
interface LayoutDefinition {
  id: Id; apiVersion: 1; label: string;
  navigation: "rail" | "unified" | "tabs" | "compact" | "drawer" | "expressive" | "expanded" | "dock";
  root: LayoutNode;
  requiredSlots: UiSlotId[];
  geometry: Partial<Record<GeometryKey, GeometryRule>>;
  narrow: { breakpoint: number; collapse: UiSlotId[]; minimumEditorWidth: number };
}
type ThemeToken = "background" | "surface" | "text" | "muted" | "border"
  | "accent" | "onAccent" | "selection" | "success" | "warning" | "error";
interface ThemeDefinition {
  id: Id; apiVersion: 1; label: string;
  light: Record<ThemeToken, string>; dark: Record<ThemeToken, string>;
  radius: number; density: "compact" | "standard" | "comfortable" | "spacious";
  rowHeight?: number; // 有限数且 >= 24 CSS px；standard 必填；显式 ui.density 优先。
}
interface BackgroundAppearance {
  assetId: Id | null;
  region: "workbench" | "sidebar" | "editor";
  fit: "cover" | "contain";
  position: { x: number; y: number }; // 0..1
  opacity: number; // 0..0.4
  overlay: number; // 0.4..1
}
interface AppearancePreferences {
  layoutId: Id; themeId: Id; mode: "system" | "light" | "dark";
  geometryByLayout: Record<Id, Partial<Record<GeometryKey, number>>>;
  colorsByTheme: Record<Id, { light?: Partial<Record<ThemeToken, string>>;
    dark?: Partial<Record<ThemeToken, string>> }>;
  background: BackgroundAppearance;
}
type AppearanceTarget = { kind: "global" } | { kind: "project"; projectId: Id };
type AppearanceField =
  | { kind: "mode" } | { kind: "themeId" } | { kind: "background" }
  | { kind: "geometry"; layoutId: Id; key: GeometryKey }
  | { kind: "color"; themeId: Id; mode: "light" | "dark"; token: ThemeToken };
type AppearanceChange =
  | { field: AppearanceField; operation: "unset" }
  | { field: AppearanceField; operation: "set"; value: string | number | BackgroundAppearance };
interface AppearanceSnapshot {
  revision: Revision; effective: AppearancePreferences;
  sources: { field: AppearanceField; source: "default" | "global" | "project" }[];
  layoutSource: "default" | "global" | "project";
  effectiveGeometry: Partial<Record<GeometryKey, number>>;
  notices: { code: string; message: string }[];
}
interface AppearancePatch {
  target: AppearanceTarget; expectedRevision: Revision; changes: AppearanceChange[];
}
interface BackgroundAsset {
  id: Id; revision: Revision; contentHash: string; mediaType: "image/png" | "image/jpeg" | "image/webp";
  width: number; height: number; bytes: ByteCount; previewToken: Id;
}
interface AppearancePreset {
  id: Id; revision: Revision; name: string; values: AppearancePreferences;
  packageRefs: { id: Id; apiVersion: 1 }[]; assetRefs: Id[];
}
```

校验：布局树节点 ID 唯一、无环、深度≤8、节点≤64；editor 恰好一个，overlay 是宿主管理层，不允许插件隐藏恢复命令。sizing 只能引用已声明的 geometry 项；必需 slot 缺失失败。navigation 选择宿主已注册的导航渲染构件，包本身不含 React 代码。非必需功能包未启用时，对应 slot 可空。默认八包也经过这些校验。

颜色仅接受可标准化的 HEX/RGB 值，不能含 url()/表达式；未知字段/令牌拒绝。AppearanceChange.value 在 schema 中由 field.kind 细化：mode/themeId/color 为合法字符串，geometry 为有范围的有限数字，background 为完整 BackgroundAppearance。unset 删除当前作用域字段。layoutId 变更只能走 prepare/apply 事务，不能用普通 patch 绕过。项目 target 必须与 Call.scope 相符；全局变更要求 app scope。

| 方法 / 所有者 | params | data / 错误 |
| --- | --- | --- |
| `appearance_get` / kernel | `{target,windowGeometry:{width,height,scale}}` | `AppearanceSnapshot`；窗口几何仅计算，不持久化 |
| `appearance_patch`* / kernel | `AppearancePatch` | `AppearanceSnapshot`；INVALID_ARGUMENT/STALE_VERSION/NOT_FOUND |
| `appearance_layout_prepare` / kernel+UI | `{target,expectedRevision,layoutId:Id\|null}` | `{planId,digest,fromLayoutId,toLayoutId,requiredSlots,waitingForComposition:boolean}`；null 恢复继承/默认；EXTENSION_DISABLED/LAYOUT_INCOMPATIBLE |
| `appearance_layout_apply`* / kernel+UI | `{planId,digest}` | `{status:"applied",snapshot:AppearanceSnapshot}`；挂载失败 LAYOUT_MOUNT_FAILED 且旧布局保留；计划过期 STALE_VERSION |
| `appearance_background_pick` / kernel | `{}` | `{selectionToken:Id\|null}`；取消为 null |
| `appearance_background_import`*（start）/ kernel | `{selectionToken}` | progress → `BackgroundAsset`；IMAGE_UNSUPPORTED/IMAGE_TOO_LARGE/IMAGE_DECODE_FAILED/DISK_FULL |
| `appearance_background_remove`* / kernel | `{assetId,expectedRevision}` | `{removed:boolean,references:Id[]}`；仍被引用则 RESOURCE_BUSY，须先解除引用 |
| `appearance_preset_list` / kernel | `{}` | `{items:AppearancePreset[]}` |
| `appearance_preset_save`* / kernel | `{id?:Id,expectedRevision?:Revision,name,values:AppearancePreferences}` | `AppearancePreset`；覆盖已有 ID 必须 revision |
| `appearance_preset_delete`* / kernel | `{id,expectedRevision}` | `{removedId:Id}`；不改变当前设置 |
| `appearance_preset_prepare` / kernel | `{target,presetId,expectedRevision}` | `{planId,digest,missingPackages:Id[],missingAssets:Id[]}`；不自动安装/启用包 |
| `appearance_preset_apply`* / kernel+UI | `{planId,digest}` | `AppearanceSnapshot`；复用布局切换事务；缺依赖 NOT_FOUND |
| `appearance_preset_pick` / kernel | `{purpose:"import"\|"export"}` | `{selectionToken:Id\|null}`；打开 JSON/资源包或保存目标选择器 |
| `appearance_preset_import`* / kernel | `{selectionToken}` | `{preset:AppearancePreset,warnings:string[]}`；只导入草稿，不应用或执行包 |
| `appearance_preset_export`（start）/ kernel | `{presetId,includeBackground:boolean,destinationSelectionToken}` | `{exportId,bytes:ByteCount}`；纯 JSON 不含绝对路径或图像；含图选项生成资产包 |

带 * 的写操作继承 Call.idempotencyKey；导入 start/取消、进度背压沿用公共任务协议。事务提交前同时检查配置 revision、安装包版本、activationId 与 scope，未成功不写新布局配置；失败注销本次新增的贡献。相同主题/尺寸编辑不重新激活功能扩展。

状态事件 `appearance.changed` 返回 revision/target/changedFields；`appearance.layoutFailed` 返回 planId、失败包及恢复入口。LayoutRegistry 对 React 公开只读稳定 snapshot 与 subscribe，登记函数返回 Disposable；只能由激活实例声明其包内贡献，卸载统一注销。previewToken 只允许宿主资产 URL 读取已批准缩图，不向主 WebView 暴露任意磁盘路径。

F10–F14 的组件输入为 snapshot、draft、busy、error、supportedFields；输出 patch/prepare/apply/import/remove 意图。文字/代码全文、Agent run 不是 AppearancePreferences 的成员。布局迁移保持文档身份与 EditorState；真实原生验证见 TASK-034–037。
