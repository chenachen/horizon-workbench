# Pi 作为 Horizon 默认 Agent runtime 的评估

| 项目 | 内容 |
| --- | --- |
| 版本 / 日期 | 0.1.0 / 2026-10-31，Asia/Shanghai；官方资料于2026-10-30核验 |
| 状态 | 官方文档与 v1.4.0 源码核验完成；集成、资源、权限与双端运行尚未实测 |
| 结论 | 推荐 Pi 为首版唯一实现的默认 Agent 候选，采用官方 stdio RPC + 受控策略扩展；通过本文门槛后才转为发布默认 |
| 范围 | 默认附带的可卸载 Agent 适配扩展、按需 runtime、provider 配置、会话、权限、审查；其他 Agent 仅设计接入边界 |
| 依赖 | 插件优先基线、宿主进程管理、上下文快照、文件版本检查、项目启动/终端、系统凭据 |
| 配套 | [技术设计](TECHNICAL_DESIGN.md)、[接口契约](INTERFACES.md)、ADR-010/ADR-011，见 [决策记录](DECISIONS.md) |

## 1. 推荐与不采用的方案

Pi 值得作为默认候选：它已经提供模型接入、会话、工具循环、重试与压缩，官方提供双向 JSONL RPC，Rust 不必嵌入 Node 或重新实现 Agent。Horizon 负责发现/安装、连接配置、输入上下文、授权呈现、生命周期、变更审查；不编写计划循环、工具循环、Agent 记忆或自动多 Agent 调度。[Pi CLI 集成](https://pi.dev/docs/latest/cli-integration)

“默认”指新安装提供 `horizon.agent.pi` 扩展及受支持版本目录，用户首次使用 AI 时选择启用并安装/定位 runtime；不指开机常驻、自动下载模型、自动发送项目或强制绑定某个 provider。Pi 可暂停、禁用、卸载，Horizon 文件/Git 不因此失效。

首版只实现 Pi；Codex、Claude Code、ACP Agent 保留适配器契约与研究说明。原草案“先 Rust 直连模型 API，再做一个 ACP Agent”的顺序撤销：Pi 已覆盖 provider 层，首期再实现一套 Rust 模型协议、凭据路由和工具循环会形成重复路径。后续若有“完全不启动 Agent 进程的纯聊天”明确需求，可以单独发布纯 API 扩展，不进入不可卸载核心。

Pi 简洁的产品定位不能证明其内存更少。现有依赖包括 Agent core、模型 SDK、TUI、MCP、codemode 等；即便关闭功能仍有 runtime 和已加载代码开销。本轮仅做资料与源码研究，没有安装、执行模型请求或采集内存，因此没有“比 Codex/Claude 更轻”实测结论。

## 2. 核实版本、发行与许可证

2026-10-30 从 GitHub Releases API 和 npm 官方 registry 读取：

| 项目 | 核实值 | 实施含义 |
| --- | --- | --- |
| 官方仓库 | `earendil-works/pi` | 文档入口是 `pi.dev`；旧 `mariozechner/pi-mono` 资料不能直接当当前契约 |
| 稳定 release | `v1.4.0`，2026-10-21 22:49:48 UTC；release 对应短提交 `4a08025` | 首轮验证锁定此版本；禁止运行时跟随 `latest` |
| npm 包 | `@earendil-works/pi-coding-agent@1.4.0` | 与旧 `@mariozechner/pi-coding-agent` 区分，不混用 import、类型与 CLI 参数 |
| 许可证 | 仓库及包标记 MIT | 分发保留 LICENSE 与依赖 notices；不是把所有第三方依赖视为同一许可 |
| npm runtime | Node.js ≥ 22.19.0 | npm 安装需要宿主 Node；精确顶层版本不锁传递依赖，需 lockfile |
| 独立发行 | macOS arm64/x64、Windows x64/arm64，另有 Linux | Horizon 首版只取 macOS 两架构与 Windows x64 |
| 二进制构建 | 官方脚本使用 Bun `--compile`，附 native helpers、WASM、资源 | 不需要用户另装 Node；仍包含 JS runtime，并非 Rust 原生 Agent |
| 原生 Windows 命令 | 内置 bash 默认使用 Git Bash；可选 PowerShell 工具 | 要单独检测 shell，不能只检查 `pi.exe` 存在 |

依据：[v1.4.0 release](https://github.com/earendil-works/pi/releases/tag/v1.4.0)、[固定版本 package.json](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/package.json)、[LICENSE](https://github.com/earendil-works/pi/blob/v1.4.0/LICENSE)、[构建脚本](https://github.com/earendil-works/pi/blob/v1.4.0/scripts/build-binaries.sh)、[安装说明](https://pi.dev/docs/latest/quickstart)、[Windows 说明](https://pi.dev/docs/latest/windows)。

release API 报告的压缩下载大小：macOS arm64 31,098,931 B，macOS x64 33,558,360 B，Windows x64 45,136,547 B。这是发行资产元数据，不是本地安装体积或运行内存。官方同时提供 `SHA256SUMS` 和安装 package/lock 文件；下载应使用固定资产及内置摘要，不执行远程安装脚本字符串。

推荐 Horizon 管理安装到 `runtimes/pi/1.4.0/<target>/`，保留完整官方资源结构。安装/升级是扩展管理操作，展示来源、版本、下载大小和平台；验证 hash 后原子切换指针。runtime 升级和 Horizon 扩展升级分别锁版本，运行中的会话继续使用旧路径，空闲后升级。共享同版本 runtime 只占一份磁盘，引用计数归零后才能清理。已有用户安装的 Pi 可选择接入，但未知版本进入“未验证版本”，默认不开放写任务。

Horizon 管理的版本不运行 `pi update`，也不替用户升级全局 Pi。保留上一兼容版本和会话备份；新版本写出的 session 格式能否被旧版读取要验证，不能因 binary 可以回退就宣称会话可以无损降级。

## 3. stdio RPC 与 SDK 的选择

| 方案 | 优点 | 代价 / 限制 | 本次选择 |
| --- | --- | --- | --- |
| Rust → 官方 `pi --mode rpc` | 没有额外 Node 桥接；完整 runtime 可直接停止；官方结构化协议 | 命令面有限，模型/认证没有完整专用 RPC；受 CLI 资源加载规则影响 | 首版采用 |
| Rust → 独立 Node/Bun worker → Pi SDK | 可注入 CredentialStore、ResourceLoader、tools、session manager；更细粒度控制 | 要维护 worker 协议、runtime 包与 SDK 生命周期；不要把 worker 当自研 Agent | 如果 RPC 的配置/策略验证失败，作为有范围的替代 |
| Pi SDK 放 QuickJS 宿主 | 无 | SDK 依赖 Node/Bun 与模块生态，QuickJS 不是兼容运行时 | 不采用 |
| 普通 CLI TUI/stdout 解析 | 终端即可运行 | ANSI/文字输出不是会话、工具与授权契约 | 只作终端降级，不作结构化默认 |

SDK 的 `createAgentSession` 默认会发现配置与资源，`dispose` 会取消工作并移除订阅；切换会话会替换 AgentSession，订阅需重绑。若选择 SDK，必须显式注入资源与凭据存储，而不能认为调用 factory 自动拥有受控环境。[Pi SDK](https://pi.dev/docs/latest/sdk)

Pi runtime 与 Horizon QuickJS 宿主是两个独立产品层：前者负责 Agent；后者负责 Horizon 命令/列表等工作台扩展。Pi 自身扩展运行于 Pi 的 Node/Bun 权限环境，不能继承 Horizon QuickJS 的内存或 API 限制。Pi 中的 `quickjs-wasi`/codemode 依赖也不是 Horizon 扩展宿主，两者不共享生命周期。

## 4. RPC 的真实语义

### 4.1 帧与关联

RPC 不是 ACP，也不是 JSON-RPC 2.0。stdin 每条 JSON 以 LF 结束；stdout 是 `response`、会话事件和 `extension_ui_request`。命令使用唯一字符串 `id` 关联响应；普通会话事件通常没有 command ID。Rust 必须按 LF 分帧，不把字符串里的 U+2028/U+2029 当换行边界；持续读 stdout，stderr 只作诊断。[RPC](https://pi.dev/docs/latest/rpc)、[v1.4.0 rpc-types.ts](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/modes/rpc/rpc-types.ts)

Horizon 为每个 Pi 实例生成 `instanceId + instanceEpoch`，每个逻辑会话生成 `sessionId`，每次输入生成 `submissionId`。真正产生 Agent 工作时才分配/确认 `runId`。Pi 的 sessionId 和文件位置保存在适配器私有映射中，不能把文件名当外部稳定 ID。

首版同一 Pi 进程只绑定一个活动会话，每项目最多一个 run；不开放 steer/follow-up 排队，避免把无请求 ID 的流错误分配给多个同时输入。产品0.3允许用户显式启动另一个项目的第二实例，全局最多2个，不自动创建；双实例资源按两份完整 runtime 单列测量，不套用单实例600 MB建议。`get_state` 只作为状态探测，不是证明所有后台子进程已终止。

### 4.2 接收与完成

收到 `prompt` 成功：

- `started`：输入通过预检，继续等待流；UI 显示运行中。
- `handled`：输入被扩展处理，没有由该输入创建的 run；返回 `handled`，不永远等 `agent_settled`。若扩展自行触发独立运行，应独立观察，不能自动归为本次成功。
- `queued`：Pi 接受队列输入。本版 UI 不主动制造此状态；适配器若观察到它，标记队列并在取消时清理，不能显示已完成。

`agent_end` 是底层一轮结束，之后仍可能重试、压缩或继续。Horizon 以 `agent_settled` 判定不再自动继续，再依据 `aborted`、最终 assistant stopReason/错误与进程状态归一为 succeeded/failed/cancelled。`settled` 本身不保证业务成功。`message_end` 的最终内容用于校正流式增量，不能重复追加整条消息。[命令语义](https://pi.dev/docs/latest/rpc-commands)、[事件流](https://pi.dev/docs/latest/json)、[固定版本会话事件定义](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/core/agent-session.ts)

订阅必须在发送 prompt 之前建立。事件甚至可早于 prompt 响应到达；适配器暂存当前 submission 的有界事件，拿到 disposition 后确认关联。事件序号由适配器按读取顺序生成；同一会话有序，不承诺不同实例之间的全局顺序。

### 4.3 取消与结束

停止当前 run：关闭新的输入/工具授权，拒绝未决交互，先 `clear_queue` 后 `abort`。Pi 的 abort 响应等待会话 idle；如果不清队列，后续消息可能继续。原输入可能已执行工具，取消不能回滚文件。Horizon 的取消请求响应只是 `cancelRequested`，仅在收到取消终态/确认 idle 或进程退出后显示已停止。[RPC 取消命令](https://pi.dev/docs/latest/rpc-commands#abort)

关闭实例：先上述停止，再关闭 stdin 请求 orderly shutdown；读取最后事件并等待退出，超过 3 秒后终止 Horizon 拥有的进程组/Job，返回 `forced` 与 `effect: unknown`。仅隐藏 AI 面板时不执行此流程；空闲 60 秒可持久化 session 后退出 Pi，恢复时起新进程并重新绑定会话。stdin 关闭及 runtime dispose 行为已从源码核实，跨平台子进程回收仍须运行验证。[rpc-mode.ts](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/modes/rpc/rpc-mode.ts)

## 5. Provider、配置与凭据

统一设置呈现两层：**Agent runtime（Pi） → 模型连接（provider/model/endpoint）**。兼容 API、本地模型是 Pi provider 的配置来源，不是与 Pi 并列的另一套 Agent。未来选择其他 Agent 时只呈现该适配器实际支持的模型配置；不能假设 Horizon 的 API key 对所有 Agent 生效。

Pi `models.json` 支持 provider baseUrl、api、model 定义；API 类型区分 `openai-completions`、`openai-responses`、`anthropic-messages` 等。密钥可用 `$NAME` 环境插值。原生协议不同，不能把相同 base URL 当兼容证明。[模型配置](https://pi.dev/docs/latest/models-configuration)、[固定版本模型说明](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/docs/models.md)

建议专用 `PI_CODING_AGENT_DIR` 和显式 `--session-dir`；不更改用户的 HOME，也不读写用户全局 Pi 配置。设置 `PI_OFFLINE=1`、`PI_SKIP_VERSION_CHECK=1`、关闭安装遥测，避免启动时自动 catalog/update 网络。`PI_OFFLINE` 是自动网络控制，不是阻断模型请求的安全开关，验证时必须观察真实请求。[环境变量](https://pi.dev/docs/latest/environment-variables)

首版凭据路径：

1. Horizon 管理的 API key 存 Keychain/Credential Manager，只在启动拥有的 Pi 实例时注入必要环境变量；`models.json` 保存变量名，不保存明文。不开 `!command` 凭据表达式，不把密钥放 argv。
2. 本地模型默认 loopback endpoint；认证按该 endpoint 配置。Horizon 不启动/停止用户已有推理服务；只统计其组合资源。官方文档提供 llama.cpp/兼容服务路径，不等于已验证所有本地模型的工具调用。[本地模型](https://pi.dev/docs/latest/llama-cpp)
3. Pi OAuth/订阅认证由 Pi 管理，原生可存 `auth.json`。RPC 当前无完整 login/auth-status 命令族，不能凭空设计 `rpc.login`。首期可通过用户主动打开的认证终端使用同一受管 agent dir；UI 标明“凭据由 Pi 保存”，不声称已经迁入系统安全存储。导出/卸载分开处理这些数据。[Providers](https://pi.dev/docs/latest/providers)
4. `configured` 仅表示存在配置/引用，`verified` 必须经用户触发的无项目内容测试。provider 401/403 改为 needsAuthentication；不能从 `get_available_models` 有列表推断 key 已有效。

API key 在子进程环境中仍可能被其工具子进程继承。首个 task 模式必须用受控命令工具覆盖/包装 Pi 的 bash，使它通过 Horizon process broker 的脱敏环境启动，不继承 provider secrets；简单注入环境再运行原生 bash 不满足该验收。Pi 本身与受信任扩展仍能访问密钥，不将这一机制宣称为对恶意 Pi 代码的隔离。

## 6. 聊天只读、工具前授权与审查

### 6.1 两种运行 profile

`chat`：显式冻结的文件片段/未保存 buffer 文本作为 prompt，禁用全部模型工具和自动资源发现。runtime 仍会写自己的 session/config，因此“只读”指不执行项目工具写入，不能称为 OS 只读沙箱。

`task`：只加载 Horizon 提供且固定摘要的策略扩展；默认关闭自动发现的扩展、MCP、skills、prompt templates、主题与 context files，项目资源不自动批准。开启的工具集合必须可查询/测试；未知工具默认拒绝。切换 profile 在 idle 后重新建立实例，不能只在提示词里说“现在只读”。相关 flags 在 v1.4.0 已核实，包括 `--no-tools`、`--no-extensions`（显式 `-e` 仍可加载）、`--no-mcp`、`--no-context-files` 等。[固定版本 CLI 参数](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/cli/args.ts)

### 6.2 Pi 拦截能力是否足够

Pi 的 `tool_call` 在执行前运行，可以返回 `{block:true}`；`tool_execution_start` 是通知，出现在 gate 前，不能见到它就宣称操作已经发生。`ctx.ui.confirm/select` 经 RPC 转成 `extension_ui_request`，Horizon 可回答、拒绝或超时。官方提供 permission-gate 示例，但它只匹配几个危险 bash 字符串，不是可直接使用的完整权限策略。[工具 hook](https://pi.dev/docs/latest/extensions#tool_call)、[示例源码](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/examples/extensions/permission-gate.ts)

结论：**足以承接一个受控工具集合的“执行前询问”；不足以单独保证进程、文件范围和系统权限隔离。** 具体实现分两条：

- 简单交互用 Pi RPC 原生 confirm/select/input/editor。Horizon 只处理已知方法，超时/取消回复 `cancelled:true`；notify/setStatus 不等待应答。自定义 TUI component 不支持时明确拒绝/降级，不能将其 HTML 化注入主界面。[RPC UI](https://pi.dev/docs/latest/rpc-extension-ui)
- 写文件/执行命令使用 Horizon 自有 Pi 策略扩展的工具包装。文件工具走有版本的 FileBroker；命令工具走 ProcessSupervisor。扩展与 Rust 之间使用仅本实例可用的本地受限管道，结构化 `operationDigest`、cwd、argv、路径与 scope，不解析英文标题猜权限。Pi 的循环仍由 Pi 运行；这只是工具适配与授权边界。

模型仅可见包装后的 allowlist；原生 `bash/write/edit`、用户 bash RPC、`pi.exec` 的公开调用入口不对 Horizon UI/模型开放。策略桥连接失败、超时、未知 operation、错误 profile 均拒绝。只有这一条受信任策略扩展允许加载，避免后续扩展改写已批准参数。未来开放用户 Pi 扩展时必须重新评估边界。

工作目录限制、事件监听、提示词、独立进程、Git worktree 都不是 OS 沙箱。Pi 官方同样说明其默认使用启动用户的权限，项目 trust 只管部分资源加载。首期交互应如实显示“经 Horizon 工具请求授权”；不能写成“所有程序行为都被拦截”。[Pi 安全边界](https://pi.dev/docs/latest/security)

### 6.3 任务基线、已有修改与未保存内容

默认 task 在 Horizon 管理的隔离工作副本中运行。Git 项目有有效 HEAD 时创建 detached worktree，任务基线由用户可审查的当前磁盘差异叠加而成；不提交用户改动、不改变原 index、不自动 stash。tracked 的 staged/unstaged 最终磁盘内容都进入基线；untracked 文件需显式选择，ignored 默认不复制。复制中源文件变化使准备失败并重试，不制造混合时间点。

dirty buffer 可选择作为指定文件的任务基线覆盖；保存原磁盘 revision 和 editorRevision，文件文字来自冻结 buffer，不先自动保存。其它未保存文档保持在原窗口，明确告知任务读的是磁盘版本。准备工作副本不是“把所有未提交文件清干净后才能用 AI”。无有效 HEAD 或非 Git 项目首版仍能聊天；写任务需要后续独立快照实现，按钮说明能力限制。

审查比较任务的 **baseline → after**，不拿仓库 HEAD 直接当任务前版本。应用回原项目时：

- 原目标与 baseline 相同且 revision 匹配才允许接受。
- 打开的 dirty 文档通过编辑器 undo transaction 接受，保留未保存状态；磁盘变化另行检查。
- 原目标已被用户/工具改变时三方比较，停止自动覆盖。
- 多文件应用返回逐文件结果；失败不报整组成功。
- “放弃任务结果”清理任务副本，不能重置用户原工作树；如接入外部 Agent 直接写原项目，则只能标为“期间检测到的修改”，有可靠 before/after 才能条件化撤回。

## 7. 其他 Agent 的接入边界（首期不实现）

| 适配类别 | 已核实路径 | Horizon 能承诺什么 |
| --- | --- | --- |
| Codex | 官方 app-server 提供自己的双向 JSON-RPC 风格协议，stdio 默认；有 thread/turn、流式事件、审批、认证 | 单独适配并锁定 schema；不假设 ACP。当前官方说明 app-server/部分 transport 为实验性，发布前重新核对稳定性 |
| Claude Code | 官方 Agent SDK 支持 streaming input、canUseTool 与会话；可独立 worker 封装 | 工具授权通过正式 callback；不解析普通 CLI stdout，不声称原生 ACP |
| ACP v1 Agent | 初始化版本/能力协商、session、prompt、request_permission、cancel | 仅对实际支持 ACP 的 runtime/桥接扩展声明；桥接不是 Agent 本身的原生保证 |
| 只有 CLI/TUI | 可通过终端扩展启动或附着已支持连接 | 展示终端与进程状态；结构化消息、权限、文件归因能力设为 false/unknown |

来源：[Codex app-server](https://learn.chatgpt.com/docs/app-server)、[Claude 输入](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)、[Claude 授权](https://code.claude.com/docs/en/agent-sdk/user-input)、[ACP v1](https://agentclientprotocol.com/protocol/v1/overview)。Pi RPC 本身不能附着任意已经在终端运行的 Pi；首期 `attach=false`，只恢复持久会话或连接由 Horizon 启动的实例。PID 不足以构成可附着的协议端点。

## 8. 资源测量方案

本节是可复现方案与建议预算，不是测试报告。固定 Pi 1.4.0、Horizon 修订、策略扩展 hash、OS、WebView、架构、provider/model、输入样本、工具集和 session 文件。以官方 standalone 为默认测试对象；npm+Node 作为对照单列。

| 场景 | 操作与观测 | 建议门槛 |
| --- | --- | --- |
| PI-P01 无 AI | 启动 Horizon，不开 AI，静置 60 秒 | Pi/Node/Bun 子进程数量为 0 |
| PI-P02 首次激活 | 20 次启动 RPC 到 `get_state` 可响应；版本探测单列 | P95 ≤ 1.5 s；整个应用启动不被阻塞 |
| PI-P03 空闲实例 | 已认证、无输入，60 秒采样；列所有 helper | Pi 增量常驻建议 ≤ 120 MB；不达标则缩短空闲回收/调整默认 |
| PI-P04 长流与长会话 | 一个Pi，固定50轮transcript，2,000/8,000 token输出；分raw replay和真实provider | Horizon+Pi+WebView 总常驻建议 ≤ 600 MB；峰值另报；第二实例另测增量与组合总量 |
| PI-P05 工具 | 临时仓库 read/edit；受管命令产生子进程；授权允许/拒绝 | 拒绝前无文件变化；审查基线准确；工具输出有界 |
| PI-P06 停止 | 流式、工具运行、待授权、重试四状态各停止 20 次 | 常规停止 P95 ≤ 1 s；强制回收 3 s 后无 owned 子进程 |
| PI-P07 卸载恢复 | 连续启用/闲置回收/恢复 30 次 | 退出后 Pi PID=0，管道/监听无增长；恢复不重复发送 prompt |
| PI-P08 本地模型 | 同场景接本地推理服务 | 推理服务单列并给组合总量，不用 600 MB 掩盖模型 GB 开销 |

macOS 采全进程 footprint，Windows 采 private working set/private bytes，单独标识共享 GPU/映射页。30 分钟循环需报告稳定值、峰值、退出后的残留；进程退出不能保证系统文件缓存立刻下降，不能拿 OS cached pages 当 runtime 泄漏。

网络/token 成本不要混入集成延迟：测 request→RPC ack、ack→第一事件、第一事件→UI 首帧、settled→回收分别耗时。用录制的脱敏协议流验证渲染与背压，真实 provider 验证协议与取消；二者报告分开。测量前后不在任务范围外目录写入，不使用用户项目执行破坏性样本。

## 9. 最小验证与可编码验收

| 任务 | 内容 | 通过条件 / 失败影响 |
| --- | --- | --- |
| TASK-PI-001 固定发行 | 三个首期平台安装固定资产，核对版本/资源/helpers | 无系统 Node 也能启动；Windows Bash 缺失可准确检测；失败阻断该平台默认 |
| TASK-PI-002 RPC 转换 | replay 覆盖分片、CRLF、U+2028、事件早于响应、handled、retry、settled | 所有输入有唯一结果；无重复完成/无限等待；失败阻断结构化接入 |
| TASK-PI-003 策略与权限 | chat no-tools；task 策略工具；拒绝、过期、断桥、参数变更、嵌套调用 | 不存在授权后换参数执行；未授权工具无副作用；provider secret 不进入命令子环境 |
| TASK-PI-004 上下文与审查 | staged+unstaged+untracked+dirty buffer 基线，运行期间人工修改 | 原 index 不变；只应用符合版本的文件；变化无法归因时如实标注 |
| TASK-PI-005 取消与释放 | clear_queue→abort、交互取消、stdin EOF、超时 kill、恢复 | 只结束 owned instance；外部模型服务仍在；取消不声称撤回修改 |
| TASK-PI-006 配置与凭据 | 自定义 provider、本地 endpoint、API key、OAuth 归属 | 不落密钥到 models/session/log；状态 configured/verified 区分；无暗中项目资源加载 |
| TASK-PI-007 资源基线 | PI-P01–P08，含 30 分钟循环 | 形成原始采样与两端报告；超预算调整后重测或保留为可选候选 |

这些是工程验证门槛，不需要用户逐项选择。若 RPC 无法在受控 profile 下达到权限/凭据要求，改为 Pi SDK 独立 worker，只更换适配实现，不新增自研 Agent；若资源或平台门槛仍失败，则不把 Pi 宣称为默认已定稿。核心工作台与扩展宿主可继续编码。
