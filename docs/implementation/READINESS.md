# Horizon 开工审查

本文保留编码开始前的准备快照。桌面实现现已进入 macOS 原生验收；当前状态见[需求验收矩阵](../verification/MACOS_ACCEPTANCE.md)、[原生操作记录](../verification/NATIVE_RUNS.md)与[性能报告](../verification/PERFORMANCE.md)。以下“未开始”“待验证”描述的是准备阶段。

版本 **0.4.0 / 2026-10-31，Asia/Shanghai**。结论：**可以开始 M0/S0 编码，无待用户补充的产品问题。**本轮完成研究、设计与执行准备，未开始桌面应用实现。

## 1. 已确认的范围

- 最小宿主保留窗口、项目登记、安装/权限、进程/任务、设置与数据恢复。文件树、编辑器、搜索、Git 都是可拆扩展。
- 首版 macOS / Windows；工作区包含多个项目，项目持有独立文件与任务上下文。
- UI 采用 React；技术验证基线为 Tauri 2 + Rust + React/TypeScript + CodeMirror 6 + Cordis core。
- 八个预设全部成为布局插件；主题独立。设置调整区域尺寸、背景图片、浅深颜色与命名组合；结构变化通过插件完成。默认雾蓝，可随时更换。
- Pi 是唯一首版外部 Agent 候选；Codex/Claude 只保留接口。Horizon 不自研 Agent 循环。
- 终端与项目快速启动为完整 MVP 必交能力，用户按需启用；不因“可选”而省略研发交付。

## 2. 本轮准备产物

| 产物 | 当前范围 | 证据 / 入口 |
| --- | --- | --- |
| 产品与需求 | 110 条需求：104 条首版、6 条后续；新增 REQ-UI-006–011 | [PRD](../product/PRD.md)、[REQUIREMENTS](../product/REQUIREMENTS.md) |
| 布局与外观设计 | 默认值、范围、继承、项目覆盖、图片资源、切换与恢复 | [CUSTOMIZATION_DESIGN](../ux/CUSTOMIZATION_DESIGN.md) |
| 插件研究 | Harness 固定源码、Cordis 职责、Rust 桥、包类型与采用限制 | [PLUGIN_SYSTEM_RESEARCH](../architecture/PLUGIN_SYSTEM_RESEARCH.md) |
| 协议 | 现有 IPC 保留；新增布局/主题/外观/资产/组合 DTO 与命令 | [INTERFACES](../architecture/INTERFACES.md) 第 12 节 |
| 实施与追踪 | 45 个任务：39 项首版、6 项后续；新增 TASK-034–037 | [IMPLEMENTATION_PLAN](IMPLEMENTATION_PLAN.md)、[TRACEABILITY](TRACEABILITY.md) |
| 原型 | 8 套布局/主题组合 × 73 场景；F01/F02 更新，新增 F10–F14 | [设计图集](../../design/index.html)、[设计规范](../../design/DESIGN_SYSTEM.md) |
| 研究样例 | React/DOM 19.3.1、Cordis 4.0.0-rc.12 的浏览器接入验证 | [可复现实验](../../research/experiments/cordis-react/README.md)、[原始结果](../../research/experiments/cordis-react/result.json) |

设计源中的八套样式是默认组合。外观设置已经允许跨布局选择主题，不能再把八套当作需要用户选出唯一胜出的候选。

## 3. 已知事实与未完成的验证

**已验证：**浏览器内 Cordis core 不依赖 process/require；依赖等待/恢复、消费者定时器与事件清理、React 退订；样例的主题/几何变化保留同一 textarea 节点和未保存文本。实验不是完整布局迁移或原生性能测量。

| 待验证 | 第一批任务 | 不通过时的处理 |
| --- | --- | --- |
| 精确依赖、WKWebView/WebView2、React/Cordis 单例与模块加载 | TASK-001、TASK-034 | 固定兼容组合；保持 Horizon SDK 边界，必要时替换内部生命周期适配 |
| CodeMirror 编辑、撤销、中文 IME、布局切换 | TASK-005、TASK-008、TASK-035 | 阻止失败切换，保留上个布局和 EditorState；问题解决前不扩展全部页面 |
| 默认能力真实可卸载、隔离 JS SDK、租约/进程回收 | TASK-025、TASK-020、TASK-034 | 修复宿主边界；不能以 UI 开关或静态主题替代插件验收 |
| 图片解码、纹理、背景切换与全进程预算 | TASK-037、TASK-022 | 调整资产尺寸/缓存并复测；不静默删除用户配置 |
| Pi 固定发行、工具前授权、取消与工作副本审查 | TASK-032、TASK-018、TASK-033、TASK-029 | 仅交付实测通过能力；未通过不宣称发布默认 |
| 真实文件/Git/进程行为与双端安装 | TASK-004–008、TASK-012–014、TASK-023 | 对应平台/功能保持待验收，原型结果不能补位 |

空宿主 200 MB、阅读 350 MB、Horizon 差异/会话 450 MB、单 Pi 组合 600 MB、Pi 空闲增量 120 MB 均为建议门槛；当前没有桌面内存实测。第二 Pi、开发进程和本地模型分别计量并报告总量。

## 4. 编码顺序

1. **TASK-001 → TASK-002 → TASK-003 / TASK-034 / TASK-025**：桌面骨架、共享协议、项目存储、Cordis 原生验证、真实扩展生命周期。任务自身更细依赖以实施计划为准。
2. **TASK-004–008**：打开文件、编辑保存、会话恢复、双端输入与资源门禁。
3. **TASK-009–016、019、030、035–037、101**：默认文件/Git 闭环、布局八包、主题/尺寸/图片/组合与本地安装管理。
4. **TASK-032 → 017 → 018 → 033 → 029**：Pi 运行时、模型连接、RPC、策略与审查；TASK-028 只交付后续适配接口。
5. **TASK-102、026–027、021、031**：按需终端、项目启动组、跨能力生命周期及基础预览。
6. **TASK-022–024**：全量性能、安装升级、恢复与发布检查。

完整 MVP 包含全部首版需求；只有默认文件/Git 能用时称核心 alpha。单一平台完成不等于双端完成。公开签名与更新身份在发布任务准备，不阻塞首批编码。

## 5. 文档与原型验收

执行记录见本仓库检查脚本及 `design/exports/manifest.json`。`npm run check` 检查全部场景和基础交互；`npm run check:plugins` 检查插件原型流程；`npm run check:customization` 检查独立布局/主题、尺寸记忆、继承、图片导入、组合保存与窄窗。检查全部通过。完整记录见 [验证报告](../../research/verification/pre-coding-2026-10-31.json)。

本轮未提交或推送。没有桌面构建、原生/Agent 集成、资源实测或发布结果；后续每个 TASK 都需记录自己的真实证据。


| 验证 | 结果 |
| --- | --- |
| 原型全场景与基础交互 | 584 个桌面场景、224 个响应式场景、8 套基础交互；无脚本错误/横向溢出 |
| 插件流程 | 8 套生命周期流程、15 个场景、360 个响应式组合；通过 |
| 新外观交互 | 布局/主题独立、尺寸按布局保存、全局/项目继承、浅深颜色独立、图片导入、组合导出/刷新恢复、失败恢复入口及28个响应式组合；通过 |
| 文档 | 110 产品需求、19 UX约束、73 场景、45任务映射完整；显式依赖无环；本地链接、表格、围栏与5个JSON样例有效 |
| 类型样例 | 接口与组件共26段TypeScript，以独立模块合并后通过 strict / noEmit / ES2022 / DOM 检查 |
| 导出与视觉 | 584 PNG、11 PDF；定制册8页；布局/尺寸/配色页面及PDF封面/内容页人工检查 |

浏览器原型会重新绘制示例 DOM，主要证明设置操作与状态关系；真正的 EditorView 迁移、IME与撤销链由 TASK-035 在原生宿主验证。Cordis 独立样例仅证明其样例 textarea 在几何/配色变化时保持同一节点，不能扩张为整个图集或桌面编辑器已具备此能力。
