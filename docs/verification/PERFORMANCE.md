# macOS 性能实测记录

截至2026-11-01，已完成真实阅读A/B各125秒、32.15分钟项目/扩展/面板循环及返回阅读后的85.36秒观察、df1e包24次热文件切换，以及1万/10万路径、大文件/长行和Git大diff的实际检查。阅读均值144.291/151.627MB、CPU0.360/0.218%；热文件代理P95为26ms。证据与构建边界见下方新增记录。

当前剩余测量是全功能停用空宿主、十文件2000行diff、Pi剩余固定场景及第二实例、20次独立进程启动；活跃资源暂停/停用/退出的释放由对应模块与Q1继续补齐。已有阅读A/B、热24和30分钟循环不因后续包号变化自动重跑。当前342256包的唤醒/路由/标签/弹窗修改已有定向原生复验，未冒充该包重新测过资源预算。历史失败与原始数据保留，后续替代关系以[验收矩阵](MACOS_ACCEPTANCE.md)为准；不同构建或不同场景不计算提升倍率。

## SETTINGS-PROJECT-PANEL-A/B/C/D · 2026-11-01

同一release主二进制`95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6`、PID34128、1280×800欢迎页。每阶段实际125秒，前60秒预热，后至少64秒统计；无活动项目、Pi或终端，但插件策略保留，因此A不是全功能停用的空宿主预算。原生前后图、动作、全部身份与原始样本已归档。

| 阶段 | 实际动作后保持相同欢迎页 | 全关联CPU均值 | panel40868贡献 | physical footprint均值 | 后60秒有效样本 |
| --- | --- | ---: | ---: | ---: | ---: |
| [A](results/settings-project-panel-a-125s/audit.json) | 未打开选择器 | 0.221823% | 未启动 | 98.415MB | 61 |
| [B](results/settings-project-panel-b-125s/audit.json) | F09目录选择后1876B诊断导出成功 | 3.424934% | 3.190867% | 168.646MB | 61 |
| [C](results/settings-project-panel-c-125s/audit.json) | 列视图保存946B外观方案成功 | 6.430524% | 6.249457% | 173.899MB | 62 |
| [D](results/settings-project-panel-d-125s/audit.json) | 同目录改列表视图、另名保存成功 | 4.215005% | 3.998779% | 172.465MB | 61 |

B/C/D均超过单核1%建议。所有9个责任身份全程计入，没有杀helper或删除其成本；A的6个身份也全程存在。B诊断的`exportedAt`为打开选择器前的预览快照，不代表采样时实时计数。C/D内容SHA相同。D沿用同一helper和此前面板历史，不能从数值下降认定列表视图修复；原列视图偏好已恢复。

一次协调空档的8秒只读栈继续看到`TNode`目录枚举，未确定具体目录或保活原因。无效rfd生命周期实验已从源码撤回；这些测量对应的运行包仍含实验，撤回不等于修复。完整边界见[调查与撤回](results/settings-project-panel-source-audit/README.md)。候选6/7约13%的旧失败继续保留。

## DEBUG-RESOURCE-001 · 2026-10-31

- 机器：Apple M2 Pro / 10 核 / 32 GiB，macOS 26.3.1（25D2128），arm64。
- 构建：`apps/desktop/src-tauri/target/debug/bundle/macos/Horizon.app`；可执行文件 SHA-256 见 [metadata.json](results/debug-initial-60s/metadata.json)。
- 场景：初期原生窗口，主测试者继续真实操作并打开系统文件选择面板；不是固定空宿主/阅读场景，也不是稳定空闲。
- 采集：60.0008 秒、58 样本；全程主 PID 73467 存在。约 1 秒间隔，调用开销使样本数少于 61。
- 口径：libproc physical footprint；Mach CPU 时间按本机 125/3 转纳秒；逐进程相加；RSS 单列。十进制 MB。

| 指标 | 中位 | P95 | 峰值 / 均值 |
| --- | ---: | ---: | ---: |
| 全关联 physical footprint | 165.86 MB | 215.28 MB | 峰值 217.21 MB |
| 全关联 RSS | 276.07 MB | 474.20 MB | 峰值 481.54 MB |
| CPU（100% = 一核心） | 0.011% | 6.327% | 峰值 51.682%；均值 1.575% |

初始关联 10 个进程：Horizon、WebContent、Networking、GPU、4 个 Metal 编译 helper、Audio SandboxHelper、ThemeWidget。系统 responsibility 均指向此次 Horizon，PPID 为 1 的服务也纳入统计。

后段打开系统文件选择器，新增 3 个关联服务：openAndSavePanelService、QuickLookUIService、SafariPlatformSupport.Helper。结束时分别约 28.87 / 4.54 / 10.86 MB。其他应用的 WebKit 经责任进程核对后排除，候选列表仍保留在原始记录。

该轮过程有实际 UI 操作和服务新增，不能用斜率判泄漏，也不能拿均值与“空闲单核 1%”比较。没有预先稳定 60 秒、固定插件/数据快照及后续连续稳态区间，因此不能声明空宿主 200 MB 达标或超标。

原始证据：[samples.jsonl](results/debug-initial-60s/samples.jsonl)、[summary.json](results/debug-initial-60s/summary.json)、[metadata.json](results/debug-initial-60s/metadata.json)。

主测试者后续通过原生 Cmd+Q 退出；后台按采样中的 PID + 启动身份复核，13 个已归属进程均消失。见 [post-quit.json](results/debug-initial-60s/post-quit.json)。这是单次 debug 退出子项，不代替 release 的 30 分钟循环、监听/订阅及外部所有权测试。

## CANDIDATE4B-LIFECYCLE-DIAGNOSTIC-001

同一台 macOS 机器，候选 4b 主程序 SHA-256 `3889afae5e71e6f14a4a57297b30b6c0a65d07f0e426bddcdbadf1a261cd3d13`。原定 30 分钟采样因编辑器视图清理缺陷需要新构建而中止；实际保存 1,049.66 秒、508 个样本，其中 483 个样本主进程仍在。主测试者已执行真实插件安装、权限确认、A/B 激活与暂停、更新/回退、故障、停用/卸载、四种预设以及宿主恢复稿导出。

有进程样本的全关联 physical footprint 中位 363.65 MB、P95 394.94 MB、峰值 431.86 MB；RSS 中位 696.22 MB、峰值 743.23 MB。该轮含系统文件选择器、QuickLook、Metal helper 及插件实例的动态增加，属于交互诊断，不能与固定空闲/阅读预算比较，也不能把整体斜率当作泄漏结论。

主测试者 Cmd+Q → 处理并退出后，后台按 PID 和启动身份核对本轮曾归属的 22 个进程，全部消失。按显示名绑定时短暂误开的旧 debug PID 74411 及其 WebKit 已识别为另一责任进程，从未纳入上述总量；该区间保留在原始动作记录。监听/订阅诊断仍为 null，未用进程消失代替它们的回收结论。

此轮不满足 30 分钟条件，也不关闭已发现的编辑器生命周期问题。原始证据：[审核与归属](results/candidate4b-lifecycle-30m/audit.json)、[原始样本](results/candidate4b-lifecycle-30m/samples.jsonl)、[汇总](results/candidate4b-lifecycle-30m/summary.json)、[退出后核验](results/candidate4b-lifecycle-30m/post-quit.json)、[原生动作](results/candidate4b-lifecycle-30m/operator-actions.jsonl)。

## CANDIDATE5-LIFECYCLE-001

候选5主程序SHA-256 `8265d62143a81c380acd350dc8c261685f241a2bc3fd0cfbece65c81073b00b2`。2026-10-30 19:37:56–20:07:56 UTC，完整采样1,800.0044秒、871条，主PID91978全程存在。原生操作覆盖编辑器停用/唤醒、项目切换、真实PTY输入/resize/隐藏恢复、启动方案授权、双服务就绪与重启、失败/取消/外部服务/会话结束。阶段和操作原始记录分别保存。

| 指标 | 中位 | P95 | 峰值 |
| --- | ---: | ---: | ---: |
| 全关联physical footprint | 349.46 MB | 394.24 MB | 450.15 MB |
| 全关联RSS | 772.92 MB | 856.77 MB | 919.29 MB |
| CPU（100% = 一核心） | 0.763% | 35.273% | 205.917% |

footprint有865个有效总量样本；6次短命sleep/ps/node在读数前退出，整条总量保留null，不以部分进程和冒充完整值。CPU有813个有效总量样本，新出现进程需下一次delta。该轮包含系统文件选择器、SpeechSynthesis、PTY和开发服务，故中位CPU或去掉前60秒的数据均不代表固定空闲。原始首末分钟footprint从134.82MB到363.68MB，场景改变，不能据此判定持续泄漏或宣称没有增长。

实际GUI诊断仅两次：19:41:30时watchers1、subscriptions0、openDocuments1、editorViews0；20:05:19时watchers2、subscriptions2、openDocuments1、editorViews1。后者editor created5/destroyed4，活动导出任务1。采样行明确携带快照时间，未将旧快照当实时计数；两个时点的面板/项目条件不同，尚不能用计数差证明泄漏或完全回收。

真实Cmd+Q确认并退出后，按PID和启动身份核验本轮69个已归属进程，全部消失。Safari/CCSwitch/微信的8个WebKit候选均有其他responsible PID，未计入。取消启动方案PID16615原始默认分组horizon，现有操作证据将其解释为development；总量不变，原始数据不改。

仍有一个明确收尾缺口：03:50:54点击打开URL后，root直系PID6508以defunct保留495个样本，直到应用退出后消失。它的footprint为0，但未及时回收进程表项；该问题已在候选6通过三次原生重复打开URL和OS子进程核验修复，见下方补测。候选5另有手动项目休眠后的旧epoch错误，继续保留独立失败记录。因此本轮完成30分钟测量，但不关闭“无持续增长、监听/订阅完全释放”的完整需求。

证据：[独立审核](results/candidate5-lifecycle-30m/audit.json)、[原始样本](results/candidate5-lifecycle-30m/samples.jsonl)、[汇总](results/candidate5-lifecycle-30m/summary.json)、[退出后69身份核验](results/candidate5-lifecycle-30m/post-quit.json)、[原生操作](results/candidate5-lifecycle-30m/operator-actions.jsonl)、[最终实际诊断](results/processes-gui/candidate5-after-processes.json)。

候选6补测：三次原生打开已保存URL，每次只保留真实API/Web直系子进程，无open或Z状态；结束后41752/43698/43699/43703全部消失。前后实际诊断watchers1/subscriptions2相同。这只撤销旧URL辅助进程失败，不将整个NFR-004宣称通过。见 [原始URL检查](results/processes-gui/candidate6-open-url.jsonl)、[独立审计](results/processes-candidate6-audit/audit.json)。

## CANDIDATE6-LIFECYCLE-001 与 Pi 固定场景

候选6主程序 SHA-256 `25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5`。20:16:43–20:46:43 UTC 完整1,800.005秒、871样本，主PID33304全程存在，共26个进程身份。全关联footprint中位300.05MB、P95 442.90MB、峰460.60MB；RSS中位791.92MB、P95 1,086.62MB、峰1,099.14MB。总量包括实际宿主、原生helper、终端/开发服务、Pi及受控HTTP测试provider；没有本地模型推理。869条footprint有效，2条因node/bsdtar正在退出而保留总量null。

本轮实际操作为终端/启动方案定向回归、三次打开URL、Pi官方运行时安装/连接测试和长流/停止。未发现defunct。原定场景名中Git/编辑器流程尚未执行，不将名称当覆盖。GUI仅在20:16:55、20:27:52与20:28:05有实际诊断快照；同一快照被后续采样引用时仍标原捕获时间。30分钟结束时应用继续供Pi原生验收使用，尚无本轮退出后全身份核验。不同阶段内存增长不作为泄漏或无增长证明。

独立固定125秒场景如下，均先排除60秒，随后保留超过64秒的实际观测。窗口1280×800、Mist浅色，文件树/一个小TypeScript标签/320px AI面板，终端关闭；上下文文件含未保存检查点。受控本地provider每秒10块、每块20 ASCII字节，使用真实受管Pi1.4.0；不等同真实远程模型或标准50轮transcript。

| 固定场景/分组 | 后60秒footprint均值 | P95 / 峰值 | CPU均值（单核100%） |
| --- | ---: | ---: | ---: |
| 连续流：Horizon及全部关联helper | 326.65 MB | 332.55 / 333.72 MB | 28.496% |
| 连续流：单Pi60295 | 86.62 MB | 86.64 / 86.64 MB | 5.676% |
| 连续流：Horizon+Pi | 413.27 MB | 419.18 / 420.32 MB | 34.171% |
| 连续流：测试provider另列 | 24.38 MB | 24.38 / 24.38 MB | 0.192% |
| 连续流：所有以上进程 | 437.65 MB | 443.56 / 444.71 MB | 34.363% |
| 原生停止后静置：Horizon及全部helper | 293.07 MB | 293.07 / 293.07 MB | **13.858%** |
| 原生停止后静置：测试provider另列 | 24.42 MB | 24.42 / 24.42 MB | 0.001% |

连续流125.005秒中Pi119/119样本存在，后60秒62样本、64.1764秒，身份稳定。这个明确小场景Horizon+Pi低于建议600MB；标准审查/50轮长会话/第二实例仍未测。Pi进程本身86.62MB不是相同场景的整机增量，也不是空闲实例成本。第一次流测量在末8样本已自然完成，后60秒纯流仅56.5964秒，判为混合无效并保留全部原始数据，未截掉尾部冒充有效。

GUI停止后125.005秒内Pi进程始终为零，提示稿恢复，HTTP测试provider仍在。后60秒61样本、64.1062秒。该静置场景CPU均值13.858%，**未达到单核1%建议值**；归属Horizon的openAndSavePanelService PID35619贡献13.676%，其余Horizon约0.181%。不能删掉helper后宣布达标。后续只读4.22秒栈样本发现文件面板服务周期性目录枚举/属性与sandbox检查，具体目录与触发源未确认。复测将保留原失败，并区分首次未用选择器、专用空导出目录、必要时原目录；如果成本与大目录有关，保留大目录结果。

证据：[30分钟独立审计](results/candidate6-lifecycle-30m/audit.json)、[原始样本](results/candidate6-lifecycle-30m/samples.jsonl)、[连续流分组审计](results/candidate6-pi-one-stream-retest-125s/audit.json)、[首次混合测量](results/candidate6-pi-one-stream-125s/audit.json)、[停止后静置](results/candidate6-pi-dormant-125s/audit.json)、[文件面板定位](results/candidate6-pi-dormant-125s/panel-helper-investigation.json)。

## 当前测量状态与剩余动作

| 场景 | 条件 / 证据 | 状态 |
| --- | --- | --- |
| 空宿主 | 所有功能插件停用/卸载；Pi/PTY/启动任务为0；125秒含60秒预热 | 待插件末段实际宿主回退后测一次，预算200MB；普通欢迎页不替代此场景 |
| 阅读 | 1万tracked、五份184320B TS、Git就绪、无Agent/终端 | d77包同进程A/B各125秒已过350MB及CPU均值1%建议；复用原证据，不重复 |
| diff / 会话 | 十文件2000行diff；全部Horizon/helper计入，外部进程另列 | 待Git末段固定夹具125秒，预算450MB；已有大diff功能证据不替代预算 |
| Pi | 单实例/空闲增量/长会话；第二实例独立增量及总量 | 候选6真实单Pi受控流413.27MB及停止后零实例已测；剩余标准长会话、空闲增量、第二实例由Pi实际流程补齐；旧helper CPU失败已由新选择器A/B定向替代 |
| 启动 | 20次独立进程；CUA观察启用的“打开本地项目”；每次正常退出后再开 | 待最终固定包执行；记录所有尝试、PID/start、原生AX和自动化开销，OS文件缓存保留，不能称磁盘冷缓存 |
| 交互延迟 | 热文件、切换、滚动、搜索/Git刷新、取消 | df1e实际热24：median17/P95 26/max27ms代理，CUA上界单列；原生搜索Stop已取消并保查询。其余模块保留实际动作时序，不凭单次观察补造P95 |
| 压力 | 1万/10万路径、10/50/101MiB、100k字符边界、Git大diff/日志 | 应用已有真实懒树/末文件/搜索截断、只读分块/保存保护、Git大diff续页；[编辑器汇总](results/editor-resume-large-and-close-audit/audit.json)与[10万路径](results/editor-resume-e1-e2-audit/audit.json)已审。剩余模块日志/长会话等由owner归档，未单独覆盖的深目录条件不推定通过 |
| 30分钟循环 | 项目/面板/扩展真实动作、实际F09、返回阅读观察与退出 | abc31e6已32.15分钟/928样本，尾段85.36秒CPU0.322%/214.491MB；F09稳定或下降计数及7基线退出已核。时长和本轮循环完成，不新增30分钟；活跃资源释放组合仍待owner/Q1 |
| 优化复测 | 原失败、定位/修改与相关新包实测分别绑定 | 选择器高CPU已定位并以新生命周期+同包A/B复验；旧13%失败保留。编辑器滚动/恢复及chunked唤醒已组件与原生定向复验；不把不同构建/场景拼成性能倍率 |

工具口径已单独交叉校验：[工具自检](results/tool-selfcheck-2026-10-31.json)。工具通过不计应用预算通过。

## GIT-SIDECAR-PRESSURE-001 · release 子进程单样本

Git 实现者运行真实临时仓库压力脚本；后台独立检查脚本、结果、18 项测试输出及 release hash。计数只包含 sidecar 与同进程组 Git 子进程的 RSS，不包含桌面/WebView，不能与整机 physical footprint 预算比较。

| 场景 | 单次总耗时 | 峰值组 RSS | 实际结果 |
| --- | ---: | ---: | --- |
| 1 万未跟踪路径 | 1,897.04 ms | 23,552 KiB | 返回 10,000，未截断 |
| 10 万未跟踪路径 | 569.44 ms | 19,824 KiB | 返回 10,000，明确截断 |
| 52,505,775 字节文件 diff | 347.06 ms | 74,224 KiB | 首页 100,042 字节，有继续游标 |
| hook 进程组取消 | 412.82 ms 整个请求 | 13,712 KiB | 退出 -15，组内无残留，未产生 HEAD |

取消在请求开始约 350ms 后发送 SIGTERM；412.82ms 是请求总时间，**不是取消响应延迟**。每次 ps 采样与约 20ms 等待也计入耗时。1 万路径比 10 万慢，说明单样本/同时系统负载不能用于规模推断或 P95 结论。旧 before 记录没有旧二进制 hash，保留原数值，但不据此宣称可复现提升倍率。

证据：[当前压力原始记录](results/git-integration-final/benchmark-macos.json)、[历史单样本](results/git-integration-final/benchmark-macos-before.json)、[独立审核与 hash](results/git-integration-final/audit.json)、[18 项集成测试](results/git-integration-final/test-report.json)。未重跑测试或压力测量；主应用原生 stop、固定场景与生命周期仍待验收。

补充直接进程组取消样本：[cancel-macos.json](results/git-integration-final/cancel-macos.json) 使用同一 release hash，确认真实 pre-commit hook marker 出现后才发信号。请求 586.10ms 时发送 SIGTERM，25.09ms 后观察退出，总计 611.19ms；无组内残留、无 HEAD。该值包含轮询开销，只覆盖直接信号到退出观测，未经过原生按钮、task_cancel 与宿主取消链，也不是 P95。原来的 412.82ms 历史请求值保留。


候选6退出补证（2026-10-31 02:44 UTC）：根操作者正常CmdQ→退出计划→处理并退出；原窗口显示没有未保存文档，并列出运行中的Git扩展。02:44:30独立按PID+start检查，30分钟记录中的20个Horizon归属身份全部消失，退出前当前11个身份也全部消失，无任何responsibility→33304残留。6个外部测试provider身份单列，60170/60171按计划仍在，未被停止。高CPU的SavePanel35619随正常退出消失；这不撤销原静置CPU失败，也不替代候选7同条件复测。[退出核验](results/candidate6-lifecycle-30m/post-quit.json)。


## 候选7 · 选择器前A基线

同一候选7包、PID37993，固定01Git项目、一个三行TypeScript文件、Git暂存与提交草稿；Agent/终端关闭，根操作者尚未调用文件选择器。实际窗口2560×1337，原记录1280×800已纠正并保留原始副本；前后原图均独立核对场景一致。

连续125.005秒、118样本；后60秒有60个有效CPU样本，覆盖63.2881秒。全关联CPU平均0.43918%（单核100%），有效physical footprint平均203.513MB。8个持续进程全计入，SavePanel为0；末样捕获2个即退Git进程，对应CPU/footprint为null，未补零。这个固定小文件场景低于1%建议，不代替标准阅读或空宿主预算，也不撤销候选6的SavePanel失败。B阶段空目录选择器对照待执行。[A原始记录与审计](results/candidate7-panel-cpu-a-125s/audit.json)。


候选7 B对照已完成：F09原生SavePanel实际导航至专用空目录，随后Save关闭面板；预览超过5分钟被拒绝，未导出文件。返回相同2560×1337的01Git/编辑器/提交草稿，前后PNG独立核对一致。静置125.005秒、118样本，后预热60个有效总量样本跨63.9839秒：CPU平均**13.14150%**，未达1%建议；其中SavePanel55971贡献12.77183%，其余0.36967%。面板约每5秒出现65%CPU脉冲，三个新辅助进程完整计入。footprint均值312.243MB，比A高108.730MB。

一处Git子进程退出竞态使总量缺测，保持null。SavePanel自身61个样本平均13.05874%；上段贡献值采用与总量一致的60个样本，避免混用。A低、B高复现文件面板关闭后持续成本；具体枚举目录和应用侧根因仍待定位。旧候选6失败继续保留。未追加C、终止helper或重启应用。[B原始记录与逐PID审计](results/candidate7-panel-cpu-b-125s/audit.json)。


## SETTINGS-PROJECT-HOT24 · 2026-11-01

真实1万tracked、Git clean阅读夹具中，先预热五份184320B TypeScript文件，再于03:10:50.148Z至03:11:04.598Z执行24次原生标签点击。F09原始ID78–101均为warm、同view5、clean revision0，布局与高亮rAF均完整。独立核对每条时点位于其原生点击发出→可见观察之间，五文件SHA仍与夹具一致。

应用handler→可读/高亮rAF代理中位23ms、P95 26ms、峰27ms，在150ms建议内；它不是精确像素绘制时间。CUA发出→观察含工具开销的上界另为中位535.5ms/P95 552ms，不能混入应用指标。OS缓存保留；既有约2秒ACTIVE采样继续，其他GUI/构建/测试/夹具工作在14.45秒原生动作区间冻结。

[完整审计](results/editor-hot24-settings-project-audit/audit.json)、[统计](results/editor-hot24-settings-project-audit/summary.json)、[原始动作](results/editor-resume-20261101/hot24-actions.json)、[真实诊断](results/editor-resume-20261101/export-hot24/horizon-diagnostics.json)。此结果对应settings-project包，不冒充下一最终包；20次独立启动和固定内存场景仍单列。


## 2026-11-01 settings-project 包 30 分钟活动观察

原始归档：`results/settings-project-active-workflow-30m/`。采样进程实际 exit 0，02:49:41Z 开始，1800.0051 秒、867 样本，间隔中位数 2.08185 秒。根 PID 34128 全程在场，起止二进制 SHA256 均为 `95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6`。

16 个实际关联进程身份全部保留：11 个持续/后来出现的宿主与 helper，以及 5 个短暂 `horizon-rg`；OpenSavePanel 40868 全程计入，未终止任何 helper。8 个其他 WebKit 明确归属 CC Switch 645 / Safari 732，原始归属与父进程快照均已归档。9 个样本存在首次 CPU 差分或短进程退出导致的无效值，保留 null。

| 活动工作流描述统计 | 实测 |
| --- | --- |
| physical footprint 均值 / P95 / 峰值 | 389.320 / 695.115 / 781.394 MB |
| CPU 单核百分比均值 / P95 / 峰值 | 11.685% / 34.991% / 215.387% |
| 首分钟 / 末分钟 footprint 均值 | 214.863 / 429.783 MB |
| 全程线性回归斜率 | +9.878 MB/min |

本轮从欢迎页进入编辑、搜索、25 个干净文件、8×9MiB、五个阅读标签与八布局采图，起止场景不相同。以上斜率不能认定泄漏，也不能证明同状态无增长；不是空闲预算或最终包性能通过。4 份 F09 是真实时点快照，收到后带入后续行，早期 null 不回填；控制阶段标签为报告到达时间，热24采用其原生动作的03:10:50.148Z–03:11:04.598Z精确区间。后续新选择器包的循环、返回阅读和退出核验见下方，不能将它们混入本轮95deaa测量。

## NATIVE-PICKER-READING-A/B · 2026-11-01

主程序SHA256 `d77ced715ee3c3b78d87e552138fc37d33ad9f70027423c0368bdff1c6a53d20`、PID88219。同一干净1万tracked项目、五份184320B TypeScript标签、Git就绪，1280×800、卡片分区/雾蓝浅色，无Pi/PTY/启动任务。A在首次选择器前，B在七次真实选择/取消后；每次125秒，去掉前60秒后各61个样本，覆盖64.58/64.56秒。全部6个持续关联身份计入，7个选择器进程及21个Apple服务均自然退出，未终止helper。

| 场景 | physical footprint均值 / P95 | CPU均值 / P95（单核100%） |
| --- | --- | --- |
| A | 144.290889 / 144.592784MB | 0.360263% / 0.685174% |
| B | 151.626964 / 151.654360MB | 0.218225% / 0.588820% |

两场景均在阅读350MB与CPU均值1%建议内。B比A多7.336075MB，无旧面板持续高CPU身份；五条历史面板CPU失败由此精确范围的实际复验替代。A/B同包同进程，不把旧欢迎页/大窗口场景的差值当优化倍率。B期间只导入未应用的外观方案，后端数据未声称逐字节相同；后续helper菜单修改与重签名亦不回填本轮构建。见[联合审计](results/native-picker-product-ab-audit/audit.json)、[A原始审计](results/native-picker-reading-A-125s/audit.json)、[B原始审计](results/native-picker-reading-B-125s/audit.json)。

## NATIVE-PICKER-EDITOR-LIFECYCLE · 2026-11-01

主程序SHA256 `abc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b`、PID21917。连续1929.1371秒（32.15分钟）、928样本，从确认阅读基线算仍有1854.315秒；实际中位间隔2.084秒。原生流程覆盖项目、编辑器/扩展启停、八布局与面板，最后回到同活动阅读项目并冻结GUI/构建/测试85.3636秒。

尾段42个样本physical footprint均值214.490541MB、CPU均值0.321819%，尾段线性斜率约−0.357MB/min。实际F09首尾监听13→13、workers0→0、插件实例19→8、watchers5→2、订阅2→2、live editor view1→1；文档2→6、路径缓存0→10056明确保留。全程正斜率与端点增加35.63MB伴随不同缓存/文档状态，不能单独推成泄漏或全程零增长；尾段证明返回后趋稳，独立阅读预算仍以A/B125秒为准。

4个末尾picker身份在采样内自然消失；随后实际正常退出，05:04:48Z独立核验7个基线PID/start全部消失。该轮没有活动Pi/PTY/启动方案退出组合，NFR004仍部分通过；不因后续定向源修改重开30分钟。见[完整审计与真实F09](results/native-picker-editor-lifecycle-30m/audit.json)、[原始样本](results/native-picker-editor-lifecycle-30m/samples.jsonl)、[退出核验](results/native-picker-editor-lifecycle-30m/post-normal-quit.json)。

## EDITOR-HOT24-RECOVERY-RELEASE · 2026-11-01

df1e122d9d242dc364f5b36253879285a885d4f128ed95b54e19aad88b6b1733包、实际PID52226，05:14:40.395Z–05:14:55.099Z完成24次热标签操作。10000tracked/Git clean、五份184320B TypeScript均原SHA、clean revision0，同一view4。F09 IDs10–33的handler→layout/可见帧及高亮代理逐条落在对应CUA发出→观察区间：median17ms、P95 26ms、max27ms；CUA含工具开销上界另为median538ms、P95 552ms、max553ms。

本轮冻结其他GUI/构建/测试/采样，排除预热与恢复样本；代理不是精确像素绘制时间，也不代表20次启动或新资源预算。后续342256只做相关chunked唤醒与界面定向复验，没有重复热24。见[独立审计](results/editor-targeted-retest-audit/audit.json)、[原始操作与实际F09说明](results/editor-targeted-retest-20261101/hot24-audit.json)、[构建身份](results/editor-recovery-release-20261101/independent-bundle-audit.json)。
