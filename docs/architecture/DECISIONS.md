# Horizon 技术决策记录

| 项目 | 内容 |
| --- | --- |
| 版本 / 日期 | 0.4.0 / 2026-10-31，Asia/Shanghai |
| 状态 | 设计建议基线；“采用”表示本稿据此设计，不表示用户已批准视觉或实现已验证 |
| 范围 | 插件优先桌面架构、技术栈、文件/Git、外部 Agent、启动器、发布与验证门槛 |
| 依赖 | [技术设计](TECHNICAL_DESIGN.md)、[接口契约](INTERFACES.md)、[Pi 调研](PI_AGENT_RESEARCH.md)；产品/交互文件持续更新 |
| 验收 | 每条 ADR 的可验证退出条件；对外性能结论必须另有真机测量 |

## 1. 决策总表

| ADR | 决策 | 状态 | 主要需求 / 页面 |
| --- | --- | --- | --- |
| ADR-001 | Tauri 2 + Rust + React + CodeMirror 6 | 采用为验证基线 | REQ-NFR-001/003；B01、G07 |
| ADR-002 | 最小宿主 + 可拆默认扩展 | 采用，最高架构约束 | REQ-HOST-001～005、REQ-EXT-001～012；E02、H01 |
| ADR-003 | Cordis 服务组织、受控贡献点与隔离宿主、诚实卸载 | 采用；宿主与 UI 回收待验证 | REQ-EXT-003/009/012；E02–E04、F04 |
| ADR-004 | 工作区分组、项目单根、项目会话 | 采用 | REQ-WS-001～006；A02–A06 |
| ADR-005 | 文本前端真源、条件保存、恢复草稿 | 采用；双端正确性门槛 | REQ-FILE-006～013；B06/B08/B09、G02 |
| ADR-006 | Git CLI 业务位于可卸载 Git 服务扩展 | 采用 | REQ-GIT-001～010；C01–C08 |
| ADR-007 | Rust 宿主调度 + 类型化 IPC + 有界 Channel | 采用 | REQ-STATE-002/003、REQ-HOST-004 |
| ADR-008 | 本地 JSON、版本迁移、系统凭据与 Agent 归属分开 | 采用 | REQ-SET-001/004/007；F01–F09 |
| ADR-009 | 大文件分级、全进程预算、按所有权回收 | 采用；数值待测 | REQ-FILE-011、REQ-RUN-006、REQ-NFR-001/002 |
| ADR-010 | 不自研 Agent；Pi 为首版唯一实现候选 | 推荐待小型验证 | REQ-AI-009；D01–D07、F05–F06 |
| ADR-011 | Pi 官方 RPC + 受控策略工具；SDK worker 备用 | 推荐待权限/双端验证 | REQ-AI-002/004/005/007/008/010 |
| ADR-012 | 项目启动器与终端共用进程所有权 | 采用 | REQ-LAUNCH-001～010、REQ-RUN-005；A06/E01/F04，新 I01–I03 建议 |
| ADR-013 | macOS/Windows 同步验证、签名更新、无业务后端 | 采用；最低系统版本建议 | REQ-NFR-003/005；G07、F09 |
| ADR-014 | 八套布局插件、独立主题与个人外观偏好 | 采用；原型与研究已验证，原生待 M0 | REQ-UI-006–011；F01/F02/F10–F14 |

REQ 编号取自 2026-10-31 读取的产品 REQUIREMENTS 0.4.0。产品已将首版收敛为 Pi 默认候选，新增 REQ-AI-012/013 覆盖 runtime 安装与凭据归属；与本稿一致。交互与 Agent 首版范围已对齐；本轮已统一产品、UX、架构与实施文档。

## ADR-001：桌面 UI 技术栈

**背景。** 用户要求轻量、性能与多种 Material 风格；已有 Web 原型不提供原生性能证据。

**决定。** Tauri 2、Rust、React 19.3.1 研究版本、CodeMirror 6；Vite/TypeScript 为构建工具。React/ReactDOM 共享单例；Cordis core 管服务与贡献点，布局与主题分别成包。CodeMirror 代码属于编辑扩展。

**依据。** Tauri 用系统 WebView；React 可通过外部快照与选择性订阅组织更新；CodeMirror 分离状态和视图并按视口渲染。这些有利于实现，但不能推出一个固定 RAM 数字。[Tauri](https://v2.tauri.app/concept/process-model/)、[React 外部 store](https://react.dev/reference/react/useSyncExternalStore)、[CodeMirror](https://codemirror.net/docs/guide/)

**取舍。** WebKit/WebView2 两条渲染路径必须双端测试。Electron 的统一渲染和 Node 生态有价值，但不作为轻量默认；原生 GPUI/Floem 会把编辑输入、无障碍和 UI 成本前移，只有实测 WebView 基线不满足目标时才重新评估。Monaco 不等于完整 VS Code 扩展宿主，因此没有因“mini VS Code”直接更换编辑器的理由。

**验收。** TASK-ARCH-001/003/010：两端 release 中文输入、字体/DPI、保存、大文件、全进程资源。失败先定位，不用更换框架掩盖缓存/生命周期问题。

## ADR-002：默认能力可拆，宿主保持最小

**决定。** 文件树、搜索、代码编辑、Git、终端、启动器、Agent 均有独立扩展身份与 manifest；前三类/ Git 默认附带。宿主仅持有项目登记、设置/恢复、扩展依赖/权限/贡献点、版本化文件原语和资源/进程管理。

**依据与边界。** 借鉴 DeepSeek Harness 的 Everything is a Plugin 思想，以能力可替换和生命周期为验收，不复制其 Agent loop 或整个平台。[官方入口](https://www.deepseek.com/en/harness/)

**取舍。** 文件保存和进程回收的低层能力保留宿主，防止负责该业务的扩展崩溃后数据和进程失控；业务策略不静态堆在宿主。默认扩展卸载后保留扩展管理、恢复稿和可信重新安装入口；不因“默认”而自动重装。

**验收。** 禁用全部默认扩展，仍能管理工作区/设置/扩展；删除 Git 活动包后没有 Git 服务/刷新；重装后继续使用原项目。仅隐藏 UI 或给原核心套 manifest 不算通过。

## ADR-003：运行边界与实际回收

**决定。** 声明式资源无代码宿主；普通 JS 扩展使用独立 QuickJS runtime；需要原生能力的第一方业务用独立服务进程。主 WebView 中第一方 UI 模块只保证 dispose 逻辑资源，彻底清 ESM cache 需要安全重载/重建 WebView。首期第三方 UI 为声明式视图，任意主 DOM 注入不开放。

**依据。** QuickJS 提供 per-runtime heap limit 与 interrupt；它不是 Node，也不是 OS 沙箱。[QuickJS](https://bellard.org/quickjs/quickjs.html#Memory-handling) Tauri capability 针对 window/webview，不自动区分同窗口扩展。[Tauri capability](https://v2.tauri.app/security/capabilities/)

**取舍。** 共享 QuickJS 进程减少常驻成本，但宿主崩溃影响其所有 runtime；不是逐扩展进程隔离。独立 sidecar 可真实退出但增加进程/打包成本。首次不做 arbitrary Rust dylib、WASM 第二套宿主或 VSIX 兼容。UI 标记 retainedModule/reloadRequired，不能虚报卸载即零内存。

**验收。** TASK-ARCH-008：死循环/超内存、激活失败回滚、依赖环、暂停持久语义、进程退出、30 次启停与 UI 重载；dirty 文档不能因回收丢失撤销/恢复状态。原生绑定或 UI 残留不达标时不宣称完全卸载。

## ADR-004：工作区与项目

**决定。** 工作区是分组；项目单根目录并只属于一个工作区；同一规范化目录去重。项目 ID 保持稳定，移动分组不改文件位置。会话/覆盖按项目；默认工作区不可删。单主窗口先行，多窗口后续但 IPC 保留 window/project scope。

**取舍。** 与旧研究的“单根工作区”不同，这是当前用户指令与页面模型的收敛。父仓库/嵌套仓库需要明确范围，不自动进行跨仓库提交。

**验收。** A02–A06：多项目切换、路径别名、Unicode/盘符、失效重定位、移除后源码仍在，恢复不自动重启脚本/Agent。

## ADR-005：文档一致性优先

**决定。** CodeMirror 持有编辑期间文本；宿主只保留版本、恢复记录和保存快照。保存比较 hash/身份，平台原子替换。dirty 圆点与 Git M 独立；外部更改不静默覆盖。

**限制。** 普通文件系统没有跨所有编辑器的原子比较交换；“检查后替换”仍有窄竞态。保留保存前副本、重验与冲突反馈，不许写成绝对防覆盖保证。恢复承诺到最后成功落盘检查点，不承诺每个按键跨断电恢复。

**验收。** TASK-ARCH-003：保存中继续输入、同 mtime 内容变化、文件锁/权限、CRLF/BOM、磁盘满、崩溃与重启。大文件部分加载绝不能按全文保存。

## ADR-006：Git CLI 服务扩展

**决定。** 第一方 Git 扩展的 Rust sidecar 复用系统 Git；状态 porcelain v2 + NUL，diff 区分 index/worktree/HEAD；按仓库及共享 commonDir 协调写队列。

**理由。** CLI 复用用户凭据、hooks、签名和配置；首期 libgit2/gix 会增加行为兼容责任。只有 profile 证明进程调用是主要瓶颈，才替换特定只读操作，不同时建设两套完整 Git。[git-status](https://git-scm.com/docs/git-status)、[git-diff](https://git-scm.com/docs/git-diff)

**验收。** TASK-ARCH-005：空仓库、detached、rename 特殊路径、部分暂存、hook/签名失败、外部 index 修改、取消 push 结果核对。禁用 Git 时 sidecar/队列/订阅释放；系统 Git 不被卸载。

## ADR-007：任务化 IPC

**决定。** 三个 Tauri 入口 + 方法注册；请求、短调用、长任务、状态订阅分开。任务带 scope、requestId、taskId、seq；写操作带版本与幂等键；终态一次。Channel 只承担传输，背压与清理由宿主控制。

**理由。** Tauri events 不适合高吞吐流，Channel 提供有序流；UI 仍必须处理切项目、迟到结果、取消竞态和订阅回收。[Tauri 通道](https://v2.tauri.app/develop/calling-frontend/#channels)

**验收。** 事件早于调用返回、慢 UI、seq gap、重复点击、窗口关闭、已产生外部效果后取消，均不能导致重复执行或错误项目显示。

## ADR-008：本地数据与凭据归属

**决定。** 版本化严格 JSON、原子替换、迁移前备份；全局→项目覆盖，无工作区设置层。宿主管理的密钥进 Keychain/Credential Manager；Pi OAuth/历史仍由 Pi 管理并明确显示归属。

**取舍。** 目前无查询规模需要 SQLite；不为会话元数据引入服务端。Rust 不读取并复制用户其它 Agent 的认证文件，不承诺删除 Horizon 记录等于删除外部历史。导出密钥、自动遥测、默认上传全仓不进入首期。

**验收。** 未来 schema 只读保护、损坏文件恢复、项目覆盖删除恢复继承、导出脱敏、API key 不进入模型配置/子命令环境、runtimeOwn auth 与 Horizon auth 分开清理。

## ADR-009：预算以场景和全进程为准

**决定。** 研究提出空 200 MB/阅读 350 MB，保留为基础模式建议目标；产品 0.4 的差异/会话显示 Horizon 部分 ≤450 MB 单列。一个 Pi 启用后新增 ≤600 MB 全进程总常驻候选目标，Pi 空闲增量 ≤120 MB 作为验证门槛，不宣称已达标。第二实例另测增量与组合总量。CodeMirror 大文件按分级进入简化/分块只读，缓存与并发都有上限。

**取舍。** 450 MB 是 Horizon 部分，600 MB 是含一个 Pi 的组合建议，不是同一个指标被放宽；两项同时记录。模型权重、Agent/helper、终端/LSP、共享 WebView/GPU 均列清楚；不统计到的共享资源不能记零。

**验收。** 技术设计 P01–P10、Pi PI-P01–P08。固定双端设备/版本/缓存条件，启动20次，交互50次，长时30分钟，报告原始采样与峰值。

## ADR-010：Pi 默认候选，不自研 Agent

**决定。** 推荐 Pi 1.4.0 作为首版唯一实现的 runtime 候选，可卸载、首次用 AI 再启动；模型 API、本地模型由 Pi provider 层管理。Codex/Claude/ACP 仅设计接口和能力映射，后续按具体需求实现。

**依据。** 当前官方仓库、MIT 标记、npm 包、双端 standalone、RPC/SDK 与固定源码均已核实；没有 RAM 实测。详见 [PI_AGENT_RESEARCH.md](PI_AGENT_RESEARCH.md)。

**被替代方案。** 初稿“Rust 直连 API + 一个 ACP Agent”、中间基线“首批 Codex/Claude 双实现”均被最新用户指令覆盖。用户举例不等于强制实现清单。

**验收。** TASK-PI-001～007；若失败，保留为可选 runtime 或改 SDK worker 适配，不改成自研 Agent，不凭轻量宣传预设结论。

## ADR-011：Pi RPC 与工具策略桥

**决定。** Rust 直接读写 Pi JSONL RPC；一个实例一个活动会话、每项目一个执行 run，全局最多两个 Pi 且不自动启动第二实例，与产品 0.4 一致。Agent 事件不带请求 ID 时由 instanceEpoch/session/run 映射；handled 与 started 分开，settled 仍需检查错误。chat 无模型工具；task 用固定策略扩展的受管工具、明确授权、隔离工作副本与条件接受。

**依据。** v1.4.0 `rpc-types.ts`、`rpc-mode.ts`、`agent-session.ts`、`extensions/runner.ts` 核实了 disposition、settled、abort 和执行前 gate。[RPC 类型](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/modes/rpc/rpc-types.ts)、[执行前 gate](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/core/extensions/runner.ts)

**限制。** RPC 无完整 auth API，Pi UI dialog 无 Horizon 原生 operation digest；需要小型策略扩展/受限管道。工具包装是集成边界，Pi 保有循环；进程分离与 worktree 不是 OS 沙箱。若必须使用更强资源/凭据注入控制，Pi SDK 独立 worker 可替代 RPC，仍不是新的 Agent。

**验收。** 拒绝/断桥/超时无工具副作用，原生写命令没有第二通道，秘密不传到工具进程，dirty/staged/untracked 基线准确，停止后 owned PID/句柄为零。

## ADR-012：启动器与终端的统一进程管理

**决定。** 可选启动器保存项目 LaunchProfile，显式发现→选择→保存→prepare→执行；多步骤按就绪依赖启动。终端视图和后台进程分离；所有停止针对 processInstanceId 的 OS 句柄，绝不扫描同名程序或端口并杀进程。

**取舍。** 不自动执行仓库脚本，不自动装依赖，不自动恢复进程。用户批准过的相同计划 digest 可一键运行；配置、脚本来源 hash、可执行身份或权限变化重新审查。一次性成功退出和长驻服务 ready 不混同。

**验收。** TASK-ARCH-009/012：两个进程、缺依赖、全局禁用、端口冲突、依赖超时、部分失败、stop/restart、隐藏面板、跨项目归属、外部进程不受影响。

## ADR-013：发布与系统支持

**决定。** macOS arm64/x64、Windows x64 同步验证；建议最低 macOS13、Windows11，正式支持范围待验证。签名、公证/安装器、WebView runtime、静态更新 manifest 分开验证。无账号或业务后端。

**依据。** Tauri2.12 提高 Rust MSRV；系统 WebView 行为依 OS；updater 签名不是 OS 代码签名。[版本公告](https://v2.tauri.app/blog/tauri-2.12/)、[Windows 安装](https://v2.tauri.app/distribute/windows-installer/)、[macOS 签名](https://v2.tauri.app/distribute/sign/macos/)、[Updater](https://v2.tauri.app/plugin/updater/)

**验收。** 安装/升级/卸载、WebView 缺失、dirty 文档阻止重启、坏签名拒绝、schema 恢复、Windows Job/ConPTY 与 macOS 进程组。公开分发需要可用签名身份；本地开发无需等待。

## 2. 官方版本与资料核验快照

核验发生于 2026-10-30；文档在 2026-10-31 完成整合。以下是当时官方 registry/release 的观察值，不是已经安装、互相兼容或完成构建的 lockfile。实现 TASK-ARCH-001 时固定精确依赖和 lockfile；不能仅用 major 范围复现。

| 组件 | 观察版本 | 官方依据 / 采用策略 |
| --- | --- | --- |
| tauri Rust crate | 2.12.5 | [crates.io 元数据](https://crates.io/api/v1/crates/tauri)；Tauri2 路线 |
| @tauri-apps/api / cli | 2.12.4 / 2.12.4 | [API registry](https://registry.npmjs.org/@tauri-apps/api)、[CLI registry](https://registry.npmjs.org/@tauri-apps/cli)；与 Rust crate 的小版本不必相同，实际组合需 build |
| React / ReactDOM / Cordis | 19.3.1 / 19.3.1 / 4.0.0-rc.12 | 研究样例已锁定并通过浏览器验证；桌面依赖组合在 TASK-001/034 固定，见 PLUGIN_SYSTEM_RESEARCH |
| CodeMirror 包 | state 6.7.6、view 6.43.15、merge 6.12.3 | [state](https://registry.npmjs.org/@codemirror/state)、[view](https://registry.npmjs.org/@codemirror/view)、[merge](https://registry.npmjs.org/@codemirror/merge)；分别版本化，不能统一写“6.0” |
| TypeScript / Vite | 7.0.2 / 8.3.5 | [TS registry](https://registry.npmjs.org/typescript)、[Vite registry](https://registry.npmjs.org/vite)；属于观察值，React compiler/plugin 组合在骨架任务验证 |
| notify | 文档 latest 8.2.1 | [crate 文档](https://docs.rs/notify/latest/notify/)；平台事件语义按真实后端测试 |
| ripgrep | 15.2.0 release | [官方 releases](https://github.com/BurntSushi/ripgrep/releases)；随包分发固定目标资产 |
| QuickJS | 官方最近公告 2026-06-04 | [官网](https://bellard.org/quickjs/)；binding/engine 组合尚未锁定，TASK-ARCH-008 决定，不将源码公告版本当 Rust crate 版本 |
| Pi | release/npm 1.4.0；Node≥22.19.0；standalone 含 Bun runtime | [release](https://github.com/earendil-works/pi/releases/tag/v1.4.0)、[npm](https://registry.npmjs.org/@earendil-works/pi-coding-agent/1.4.0)；首轮固定版本 |
| ACP | v1 标注 Latest，v2 标注 Draft | [官方概览](https://agentclientprotocol.com/protocol/v1/overview)；仅未来适配设计 |

CodeMirror GitHub mirror 的 main package.json 在核验中显示比 npm registry 更旧的版本；本表用发布 registry，不把 mirror main 的旧值当最新。产品文档保留各自读取的网页快照，依赖实现以本表的 registry 观察值作为起点，再通过实际 build 固定精确组合，不虚构已锁版本。

## 3. 设计整合与开放事项

| 编号 | 发现 / 推荐处理 | 是否阻塞当前编码 |
| --- | --- | --- |
| INT-001 | 旧研究单根工作区已被多项目模型替代；项目只属于一个工作区，已与 PRD 收敛 | 否 |
| INT-002 | 2026-10-31 最终整合已将交互0.4.0 的 D08、Agent 组件与验收同步为 Pi 唯一首版候选；Codex/Claude 仅接口，修正依据见 READINESS | 已收敛；Pi 发布仍需真实验证 |
| INT-003 | screens.json 当前为73页，含E05–E16及F10–F14。交互旧建议E05“影响确认”已映射E13/E14/E12，E06“项目扩展配置”已映射E09；当前清单E05是已安装、E06是本地安装。D08/I01–I03仍未落位 | 否；按语义映射编码，不能依旧编号误接页面 |
| INT-004 | styles.json 在23:54更新 mist radius16→18；最新 hash `485fd225cc119e6b94374391ffc73807c9b9da84d016f5f38d2c9406e9ca69af`；八套均为插件 | 已由最新要求替代择一方案 |
| INT-005 | 产品0.4将450MB明确为Horizon部分；本稿新增一个Pi组合600MB、Pi空闲增量120MB待测预算，基础200/350不变 | 不阻塞编码；发布同时报告分项和总量 |
| INT-006 | 产品 clean cache20份/64MiB 与技术初稿10份/32MiB冲突；本稿采用产品20/64为默认、32MiB作为极简预设候选 | 否 |
| INT-007 | 产品0.4已更新为每项目1任务/全局最多2个实例；技术/Pi研究/ADR现统一此值，不自动启动第二个 | 否；双实例需单列资源样本 |
| INT-009 | 新E15“没有已安装扩展”的note仍称基础文件/Git可用，和默认能力同样可卸载冲突；建议写成“宿主仍可用，重新安装所需默认扩展”，或明确仅筛选第三方扩展为空 | 不阻塞宿主契约；空状态文案验收前修正 |

当前无产品决策阻塞。默认雾蓝与八套布局交付已确定；旧系统兼容若新增约束再调整；签名/更新身份在公开发布前准备。Pi 是否成为默认应先看验证证据，不要求用户替代工程实验作选择。普通实现细节由 ADR 决定，不逐项请求批准。

真正阻止相应能力宣称完成的工程门槛：插件卸载后资源可验证回收；双端文件/IME正确性；Pi 工具授权、凭据与取消实测；全进程性能；发布签名。它们都不阻止从最小宿主与类型契约开始编码。

## 4. 文档验收与变更规则

- 设计文档必须能追溯稳定 REQ、页面和 TASK；引用还没落位的新页面标为建议。
- 每个默认扩展必须有拥有资源清单、激活/停止路径、安装/卸载与失败恢复，缺一项不能用“插件化完成”验收。
- 协议新增必填字段/改变取消结果需提高 major 或迁移适配；不只改一边的 TS/Rust 示例。
- 新依赖、预算与官方协议升级先更新本决策及锁定清单，再更新对应测量/fixture；不把旧原型截图作为新版本证据。
- 本轮交付为四份 Markdown 设计文件，未修改应用源码、视觉稿或根目录配置，未提交/推送；文档检查不替代应用测试。
- 2026-10-31 文档检查：5 个 JSON 示例可解析；INTERFACES 的16个 TypeScript 代码块合并后通过 `tsc --noEmit --strict --target es2022 --lib es2022`；相对文件链接、表格列数、代码围栏和直接 REQ 引用检查通过。未安装或运行 Pi，未执行桌面构建、模型请求或资源测量。

## ADR-014：布局插件与外观设置分层

**决定。**八个预设分别作为布局插件，主题独立；区域尺寸、图片与颜色由 AppearanceService 管。支持全局→项目字段继承，几何按 layoutId、颜色按 themeId+mode 保存。结构变化只通过布局插件，第三方首版为声明式布局/主题。

**依据。**2026-10-31 用户最终要求；Harness 固定源码及 Cordis 浏览器实验见 [PLUGIN_SYSTEM_RESEARCH](PLUGIN_SYSTEM_RESEARCH.md)。Rust 拥有权限/激活权威；Cordis 不作为沙箱。

**验收。**REQ-UI-006–011、TASK-034–037；CodeMirror/IME/卸载回收/双端资源仍待原生验证。默认雾蓝，不需要用户再从八套里选一套才能开工。
