# Horizon 需求、页面与实施追踪

| 项目 | 内容 |
| --- | --- |
| 版本 / 日期 | 0.4.0，2026-10-31，Asia/Shanghai；最终整合 |
| 状态 | 设计追踪；所有 TASK 尚待实现，映射存在不表示功能通过 |
| 范围 | 产品 REQ、UX 补充约束、页面、组件/接口、ADR、实施 TASK 与验收入口 |
| 依赖 | [REQUIREMENTS](../product/REQUIREMENTS.md)、[PRD](../product/PRD.md)、[交互](../ux/INTERACTION_SPEC.md)、[组件](../ux/COMPONENT_CONTRACTS.md)、[接口](../architecture/INTERFACES.md)、[决策](../architecture/DECISIONS.md)、[实施计划](IMPLEMENTATION_PLAN.md) |
| 验收 | 需求无遗漏、页面有范围、每个实施 TASK 有输入及验收、接口引用可定位、后续与首版分开 |

## 1. 编号与范围规则

产品需求以 REQUIREMENTS 中稳定 REQ 为主；交互的 `REQ-UXI-*` 保留交互细化身份，不另作产品范围授权。本文的 TASK 是实施入口；`TASK-PROD-*`、`TASK-UX-*`、`TASK-ARCH-*`、`TASK-PI-*` 为验收或专项工作包，最终映射到执行 TASK，不重复领取相同工作。

旧研究、旧页面备注若与用户最新扩展优先、外部 Agent、终端、项目启动方案冲突，以新基线为准。首版是默认安装组合与可选安装组合的交付范围；“可选”指用户可不用，不代表实现可以省略。H 组为规范页，G 组多数为状态，同一组件/扩展可以覆盖多个页面。

## 2. 产品需求到实施

逐条连接 REQUIREMENTS 0.4.0 的 110 条需求（104 条 v0.1、6 条后续）。完整验收语义以原需求“可验证验收条件”为准；这里保留实现与证据入口，避免复制第二套标准。TASK 内步骤和测试是需求验收的实现证据。组件来自 COMPONENT_CONTRACTS，方法与类型来自 INTERFACES；`xxx_*` 只表示该文档已有命令族。

| 需求 | 优先级 / 阶段 | 页面 | 组件 / 接口 | 实施及验收 TASK |
| --- | --- | --- | --- | --- |
| REQ-HOST-001 最小宿主保持可管理 | P0 / v0.1 | A02、E02、F04、F09、H01 | WorkbenchShell / ExtensionCenter；`app_bootstrap；extension_*；ResourceStopPlan` | TASK-001, TASK-003, TASK-025 |
| REQ-HOST-002 默认能力真实可拆 | P0 / v0.1 | B01、C01、E02、H01 | WorkbenchShell / ExtensionCenter；`app_bootstrap；extension_*；ResourceStopPlan` | TASK-004, TASK-005, TASK-011, TASK-012, TASK-016, TASK-025 |
| REQ-HOST-003 按激活事件运行 | P0 / v0.1 | B01、D01、E02、F04 | WorkbenchShell / ExtensionCenter；`app_bootstrap；extension_*；ResourceStopPlan` | TASK-025, TASK-021 |
| REQ-HOST-004 实例归属可追踪 | P0 / v0.1 | A02、E02、F04 | WorkbenchShell / ExtensionCenter；`app_bootstrap；extension_*；ResourceStopPlan` | TASK-002, TASK-007, TASK-021, TASK-025 |
| REQ-HOST-005 扩展状态与恢复接口 | P0 / v0.1 | B08、E03、G03 | WorkbenchShell / ExtensionCenter；`app_bootstrap；extension_*；ResourceStopPlan` | TASK-006, TASK-007, TASK-025 |
| REQ-EXT-001 安装与兼容校验 | P0 / v0.1 | E02、E03 | ExtensionCenter / ExtensionCard / LifecycleDialog；`extension_install_prepare/apply；extension_stop_prepare/apply；ExtensionModule` | TASK-019, TASK-025 |
| REQ-EXT-002 默认扩展恢复 | P0 / v0.1 | B01、E02、E03 | ExtensionCenter / ExtensionCard / LifecycleDialog；`extension_install_prepare/apply；extension_stop_prepare/apply；ExtensionModule` | TASK-019, TASK-025 |
| REQ-EXT-003 暂停与恢复 | P0 / v0.1 | E02、E03、F04 | ExtensionCenter / ExtensionCard / LifecycleDialog；`extension_install_prepare/apply；extension_stop_prepare/apply；ExtensionModule` | TASK-025, TASK-021 |
| REQ-EXT-004 全局/项目禁用 | P0 / v0.1 | E02、F04 | ExtensionCenter / ExtensionCard / LifecycleDialog；`extension_install_prepare/apply；extension_stop_prepare/apply；ExtensionModule` | TASK-015, TASK-025 |
| REQ-EXT-005 卸载语义 | P0 / v0.1 | E02、E03、F09 | ExtensionCenter / ExtensionCard / LifecycleDialog；`extension_install_prepare/apply；extension_stop_prepare/apply；ExtensionModule` | TASK-019, TASK-025 |
| REQ-EXT-006 依赖影响与冲突 | P0 / v0.1 | E03、E04、F04 | ExtensionCenter / ExtensionCard / LifecycleDialog；`extension_install_prepare/apply；extension_stop_prepare/apply；ExtensionModule` | TASK-025, TASK-027 |
| REQ-EXT-007 权限与来源透明 | P0 / v0.1 | E03、D05 | ExtensionCenter / ExtensionCard / LifecycleDialog；`extension_install_prepare/apply；extension_stop_prepare/apply；ExtensionModule` | TASK-002, TASK-020, TASK-025 |
| REQ-EXT-008 更新可恢复 | P1 / v0.1 | E03、E04 | ExtensionCenter / ExtensionCard / LifecycleDialog；`extension_install_prepare/apply；extension_stop_prepare/apply；ExtensionModule` | TASK-019 |
| REQ-EXT-009 状态真实区分 | P0 / v0.1 | E02、E04、F04、H03 | ExtensionCenter / ExtensionCard / LifecycleDialog；`extension_install_prepare/apply；extension_stop_prepare/apply；ExtensionModule` | TASK-009, TASK-021, TASK-025 |
| REQ-EXT-010 轻量预设 | P0 / v0.1 | F04、E02、F02 | ExtensionCenter / ExtensionCard / LifecycleDialog；`extension_install_prepare/apply；extension_stop_prepare/apply；ExtensionModule` | TASK-015, TASK-025 |
| REQ-EXT-011 外部扩展真实闭环 | P0 / v0.1 | E02、E03、C01 | ExtensionCenter / ExtensionCard / LifecycleDialog；`extension_install_prepare/apply；extension_stop_prepare/apply；ExtensionModule` | TASK-020 |
| REQ-EXT-012 故障隔离 | P0 / v0.1 | E04、B01 | ExtensionCenter / ExtensionCard / LifecycleDialog；`extension_install_prepare/apply；extension_stop_prepare/apply；ExtensionModule` | TASK-020, TASK-025 |
| REQ-WS-001 工作区组织 | P0 / v0.1 | A01、A02、A03、H01 | ProjectNavigator；`workspace_*；project_*；ProjectSession` | TASK-003 |
| REQ-WS-002 添加本地项目与去重 | P0 / v0.1 | A04、A02、G01、G02 | ProjectNavigator；`workspace_*；project_*；ProjectSession` | TASK-003, TASK-004 |
| REQ-WS-003 克隆仓库 | P1 / v0.1 | A05、C07 | ProjectNavigator；`workspace_*；project_*；ProjectSession` | TASK-101 |
| REQ-WS-004 项目操作 | P0 / v0.1 | A06、A02、B08 | ProjectNavigator；`workspace_*；project_*；ProjectSession` | TASK-003, TASK-007 |
| REQ-WS-005 切换与会话归属 | P0 / v0.1 | A02、B01、G03 | ProjectNavigator；`workspace_*；project_*；ProjectSession` | TASK-007, TASK-016 |
| REQ-WS-006 单根与仓库范围 | P0 / v0.1 | A04、C01、H01 | ProjectNavigator；`workspace_*；project_*；ProjectSession` | TASK-004, TASK-012 |
| REQ-FILE-001 按层文件树 | P0 / v0.1 | B01、G01、G02 | FileTree / DocumentTabs / CodeSurface；`directory_list；document_open/save/checkpoint；DiskRevision` | TASK-004 |
| REQ-FILE-002 文件操作 | P0 / v0.1 | B02、G02、B08 | FileTree / DocumentTabs / CodeSurface；`directory_list；document_open/save/checkpoint；DiskRevision` | TASK-010 |
| REQ-FILE-003 标签与预览 | P0 / v0.1 | B01、B06 | FileTree / DocumentTabs / CodeSurface；`directory_list；document_open/save/checkpoint；DiskRevision` | TASK-005 |
| REQ-FILE-004 快速打开/命令 | P0 / v0.1 | B03、F08 | FileTree / DocumentTabs / CodeSurface；`directory_list；document_open/save/checkpoint；DiskRevision` | TASK-011 |
| REQ-FILE-005 项目文本搜索 | P0 / v0.1 | B04、B05 | FileTree / DocumentTabs / CodeSurface；`directory_list；document_open/save/checkpoint；DiskRevision` | TASK-011 |
| REQ-FILE-006 基础编辑 | P0 / v0.1 | B06、F03、G07 | FileTree / DocumentTabs / CodeSurface；`directory_list；document_open/save/checkpoint；DiskRevision` | TASK-005, TASK-006 |
| REQ-FILE-007 保存版本校验 | P0 / v0.1 | B06、G02 | FileTree / DocumentTabs / CodeSurface；`directory_list；document_open/save/checkpoint；DiskRevision` | TASK-006 |
| REQ-FILE-008 外部变更 | P0 / v0.1 | B06、G02 | FileTree / DocumentTabs / CodeSurface；`directory_list；document_open/save/checkpoint；DiskRevision` | TASK-006, TASK-007 |
| REQ-FILE-009 未保存与关闭 | P0 / v0.1 | B08、B06 | FileTree / DocumentTabs / CodeSurface；`directory_list；document_open/save/checkpoint；DiskRevision` | TASK-006 |
| REQ-FILE-010 可选预览与基础结构 | P1 / v0.1 | B07、B10、E03 | FileTree / DocumentTabs / CodeSurface；`directory_list；document_open/save/checkpoint；DiskRevision` | TASK-031 |
| REQ-FILE-011 大文件和二进制 | P0 / v0.1 | B09、G02 | FileTree / DocumentTabs / CodeSurface；`directory_list；document_open/save/checkpoint；DiskRevision` | TASK-005, TASK-008 |
| REQ-FILE-012 编码与换行 | P0 / v0.1 | B06、F03 | FileTree / DocumentTabs / CodeSurface；`directory_list；document_open/save/checkpoint；DiskRevision` | TASK-005, TASK-006, TASK-015 |
| REQ-FILE-013 草稿与崩溃恢复 | P0 / v0.1 | B08、G03、F09 | FileTree / DocumentTabs / CodeSurface；`directory_list；document_open/save/checkpoint；DiskRevision` | TASK-007 |
| REQ-GIT-001 Git 检测与状态 | P0 / v0.1 | C01、F07、G02 | GitPanel / CommitComposer / DiffSurface；`git_status/diff/history/branches/mutate；GitMutation` | TASK-012 |
| REQ-GIT-002 双基线差异 | P0 / v0.1 | C01、C08 | GitPanel / CommitComposer / DiffSurface；`git_status/diff/history/branches/mutate；GitMutation` | TASK-012 |
| REQ-GIT-003 文件级暂存/取消 | P0 / v0.1 | C02、C01 | GitPanel / CommitComposer / DiffSurface；`git_status/diff/history/branches/mutate；GitMutation` | TASK-013 |
| REQ-GIT-004 提交准确与失败恢复 | P0 / v0.1 | C02、C07 | GitPanel / CommitComposer / DiffSurface；`git_status/diff/history/branches/mutate；GitMutation` | TASK-013 |
| REQ-GIT-005 提交历史 | P1 / v0.1 | C03 | GitPanel / CommitComposer / DiffSurface；`git_status/diff/history/branches/mutate；GitMutation` | TASK-030 |
| REQ-GIT-006 分支操作 | P0 / v0.1 | C04 | GitPanel / CommitComposer / DiffSurface；`git_status/diff/history/branches/mutate；GitMutation` | TASK-014 |
| REQ-GIT-007 获取/拉取/推送 | P0 / v0.1 | C04、C07、F07 | GitPanel / CommitComposer / DiffSurface；`git_status/diff/history/branches/mutate；GitMutation` | TASK-014 |
| REQ-GIT-008 最小冲突处理 | P0 / v0.1 | C05、B06、C07 | GitPanel / CommitComposer / DiffSurface；`git_status/diff/history/branches/mutate；GitMutation` | TASK-030 |
| REQ-GIT-009 放弃更改范围 | P0 / v0.1 | C06、B08 | GitPanel / CommitComposer / DiffSurface；`git_status/diff/history/branches/mutate；GitMutation` | TASK-014 |
| REQ-GIT-010 串行操作与取消核对 | P0 / v0.1 | C02、C04、C07 | GitPanel / CommitComposer / DiffSurface；`git_status/diff/history/branches/mutate；GitMutation` | TASK-012, TASK-013, TASK-014 |
| REQ-AI-001 程序检测与连接配置 | P0 / v0.1 | D01、F05、F06 | AgentConnection / AgentSession / AgentRun / AgentReview；`AgentAdapter；agent_*；review_*` | TASK-017, TASK-032 |
| REQ-AI-002 上下文显式交付 | P0 / v0.1 | D03、D02 | AgentConnection / AgentSession / AgentRun / AgentReview；`AgentAdapter；agent_*；review_*` | TASK-029 |
| REQ-AI-003 附件上限 | P1 / v0.1 | D03、D07 | AgentConnection / AgentSession / AgentRun / AgentReview；`AgentAdapter；agent_*；review_*` | TASK-029 |
| REQ-AI-004 真实消息与模式 | P0 / v0.1 | D02、D04、D07 | AgentConnection / AgentSession / AgentRun / AgentReview；`AgentAdapter；agent_*；review_*` | TASK-018, TASK-033 |
| REQ-AI-005 取消、断连与停止 | P0 / v0.1 | D04、D07、E04 | AgentConnection / AgentSession / AgentRun / AgentReview；`AgentAdapter；agent_*；review_*` | TASK-018, TASK-021 |
| REQ-AI-006 启动/恢复与能力表 | P0 / v0.1 | D01、D02、F05 | AgentConnection / AgentSession / AgentRun / AgentReview；`AgentAdapter；agent_*；review_*` | TASK-017, TASK-018 |
| REQ-AI-007 授权转接 | P0 / v0.1 | D05、D04 | AgentConnection / AgentSession / AgentRun / AgentReview；`AgentAdapter；agent_*；review_*` | TASK-033 |
| REQ-AI-008 修改审查与版本检查 | P0 / v0.1 | D06、C01、B06 | AgentConnection / AgentSession / AgentRun / AgentReview；`AgentAdapter；agent_*；review_*` | TASK-029, TASK-107 |
| REQ-AI-009 不自研 Agent | P0 / v0.1 | H01、D04、F05 | AgentConnection / AgentSession / AgentRun / AgentReview；`AgentAdapter；agent_*；review_*` | TASK-017, TASK-018, TASK-028, TASK-033 |
| REQ-AI-010 项目会话与恢复 | P0 / v0.1 | D02、D04、G03 | AgentConnection / AgentSession / AgentRun / AgentReview；`AgentAdapter；agent_*；review_*` | TASK-007, TASK-018 |
| REQ-AI-011 Pi 与其他 Agent 分期 | P0 / v0.1 | D01、F05、E01 | AgentConnection / AgentSession / AgentRun / AgentReview；`AgentAdapter；agent_*；review_*` | TASK-017, TASK-018, TASK-028, TASK-032, TASK-033, TASK-022 |
| REQ-AI-012 运行时安装与所有权 | P0 / v0.1 | E03、F05、D01 | AgentConnection / AgentSession / AgentRun / AgentReview；`AgentAdapter；agent_*；review_*` | TASK-032 |
| REQ-AI-013 模型连接与凭据归属 | P0 / v0.1 | F05、F06、F09 | AgentConnection / AgentSession / AgentRun / AgentReview；`AgentAdapter；agent_*；review_*` | TASK-017, TASK-033 |
| REQ-LAUNCH-001 可选扩展与项目入口 | P0 / v0.1 | A06、F04、E02、B01 | LaunchProfileEditor / ProjectRunPanel；`LaunchProfile/LaunchPlan；launch_*；ProcessInstance` | TASK-025, TASK-026 |
| REQ-LAUNCH-002 发现但不执行 | P0 / v0.1 | F04、A06 | LaunchProfileEditor / ProjectRunPanel；`LaunchProfile/LaunchPlan；launch_*；ProcessInstance` | TASK-026 |
| REQ-LAUNCH-003 保存运行方案 | P0 / v0.1 | F04 | LaunchProfileEditor / ProjectRunPanel；`LaunchProfile/LaunchPlan；launch_*；ProcessInstance` | TASK-026 |
| REQ-LAUNCH-004 启动预检与授权 | P0 / v0.1 | F04、A06、E03 | LaunchProfileEditor / ProjectRunPanel；`LaunchProfile/LaunchPlan；launch_*；ProcessInstance` | TASK-026, TASK-027 |
| REQ-LAUNCH-005 多进程与就绪 | P0 / v0.1 | E01、A06、G01 | LaunchProfileEditor / ProjectRunPanel；`LaunchProfile/LaunchPlan；launch_*；ProcessInstance` | TASK-027 |
| REQ-LAUNCH-006 失败策略 | P0 / v0.1 | E01、E04 | LaunchProfileEditor / ProjectRunPanel；`LaunchProfile/LaunchPlan；launch_*；ProcessInstance` | TASK-027 |
| REQ-LAUNCH-007 停止与重启 | P0 / v0.1 | A06、E01、F04 | LaunchProfileEditor / ProjectRunPanel；`LaunchProfile/LaunchPlan；launch_*；ProcessInstance` | TASK-027 |
| REQ-LAUNCH-008 打开终端与 URL | P0 / v0.1 | E01、F04、B01 | LaunchProfileEditor / ProjectRunPanel；`LaunchProfile/LaunchPlan；launch_*；ProcessInstance` | TASK-027, TASK-102 |
| REQ-LAUNCH-009 所有权与跨项目生命周期 | P0 / v0.1 | A02、G03、E01、E02 | LaunchProfileEditor / ProjectRunPanel；`LaunchProfile/LaunchPlan；launch_*；ProcessInstance` | TASK-021, TASK-027 |
| REQ-LAUNCH-010 删除与平台差异 | P1 / v0.1 | F04、G07 | LaunchProfileEditor / ProjectRunPanel；`LaunchProfile/LaunchPlan；launch_*；ProcessInstance` | TASK-026, TASK-027 |
| REQ-RUN-001 隐藏不停止 | P0 / v0.1 | D04、E01、C04、G04 | TerminalPanel / LifecycleDialog / ProjectRunPanel；`terminal_*；process_list/stop；project_close_plan/apply；TaskEvent` | TASK-009, TASK-021 |
| REQ-RUN-002 停止有真实结果 | P0 / v0.1 | D04、E01、E04、C07 | TerminalPanel / LifecycleDialog / ProjectRunPanel；`terminal_*；process_list/stop；project_close_plan/apply；TaskEvent` | TASK-002, TASK-021, TASK-027, TASK-102 |
| REQ-RUN-003 项目休眠与唤醒 | P0 / v0.1 | G03、F04、A02 | TerminalPanel / LifecycleDialog / ProjectRunPanel；`terminal_*；process_list/stop；project_close_plan/apply；TaskEvent` | TASK-007, TASK-021 |
| REQ-RUN-004 关闭/退出 | P0 / v0.1 | B08、A06、F04 | TerminalPanel / LifecycleDialog / ProjectRunPanel；`terminal_*；process_list/stop；project_close_plan/apply；TaskEvent` | TASK-007, TASK-021, TASK-025 |
| REQ-RUN-005 按需终端 | P0 / v0.1 | E01、E03、G07 | TerminalPanel / LifecycleDialog / ProjectRunPanel；`terminal_*；process_list/stop；project_close_plan/apply；TaskEvent` | TASK-102 |
| REQ-RUN-006 有界资源 | P0 / v0.1 | F04、B09、E01、D02 | TerminalPanel / LifecycleDialog / ProjectRunPanel；`terminal_*；process_list/stop；project_close_plan/apply；TaskEvent` | TASK-005, TASK-007, TASK-011, TASK-021, TASK-022 |
| REQ-SET-001 全局与项目继承 | P0 / v0.1 | F02、F03、F04、F05 | SettingsDialog / SettingsField；`settings_get/patch；credential_set/remove；扩展贡献 schema` | TASK-003, TASK-015 |
| REQ-SET-002 布局与会话分离 | P0 / v0.1 | F02、B01、G04 | SettingsDialog / SettingsField；`settings_get/patch；credential_set/remove；扩展贡献 schema` | TASK-009, TASK-015 |
| REQ-SET-003 编辑偏好与自动保存 | P0 / v0.1 | F03、B06、B08 | SettingsDialog / SettingsField；`settings_get/patch；credential_set/remove；扩展贡献 schema` | TASK-015 |
| REQ-SET-004 Agent 设置范围 | P0 / v0.1 | F05、F06 | SettingsDialog / SettingsField；`settings_get/patch；credential_set/remove；扩展贡献 schema` | TASK-017 |
| REQ-SET-005 Git 偏好 | P1 / v0.1 | F07 | SettingsDialog / SettingsField；`settings_get/patch；credential_set/remove；扩展贡献 schema` | TASK-015 |
| REQ-SET-006 快捷键 | P1 / v0.1 | F08、B03、G07 | SettingsDialog / SettingsField；`settings_get/patch；credential_set/remove；扩展贡献 schema` | TASK-011, TASK-015 |
| REQ-SET-007 表单有效性与保存 | P0 / v0.1 | F01、F06、F04 | SettingsDialog / SettingsField；`settings_get/patch；credential_set/remove；扩展贡献 schema` | TASK-015, TASK-017, TASK-026 |
| REQ-SET-008 数据清理与导出 | P0 / v0.1 | F09 | SettingsDialog / SettingsField；`settings_get/patch；credential_set/remove；扩展贡献 schema` | TASK-015 |
| REQ-UI-001 默认界面聚焦 | P0 / v0.1 | B01、A02、D01、E01、F01 | WorkbenchShell / Dialog / Menu / Notification；`组件意图事件；settings_get/patch；贡献槽位` | TASK-009, TASK-015, TASK-025 |
| REQ-UI-002 共用主题行为 | P0 / v0.1 | F01、G05、H02、H03 | WorkbenchShell / Dialog / Menu / Notification；`组件意图事件；settings_get/patch；贡献槽位` | TASK-009, TASK-019 |
| REQ-UI-003 窄窗与缩放 | P0 / v0.1 | G06、H04、C08、G07 | WorkbenchShell / Dialog / Menu / Notification；`组件意图事件；settings_get/patch；贡献槽位` | TASK-009, TASK-008 |
| REQ-UI-004 键盘与可访问状态 | P0 / v0.1 | H03、B03、B08、D05 | WorkbenchShell / Dialog / Menu / Notification；`组件意图事件；settings_get/patch；贡献槽位` | TASK-009, TASK-015 |
| REQ-UI-005 流程映射完整 | P1 / v0.1 | H01、H05、A04、C02、D06、E03、A06、F04、E01 | WorkbenchShell / Dialog / Menu / Notification；`组件意图事件；settings_get/patch；贡献槽位` | TASK-016, TASK-021, TASK-024 |
| REQ-STATE-001 空与不可用状态 | P0 / v0.1 | A01、B05、D01、G02、E04 | Notification / 各功能局部反馈；`HorizonError；TaskState/TaskEvent；horizon_subscribe` | TASK-009, TASK-004, TASK-025 |
| REQ-STATE-002 渐进加载与过期数据 | P0 / v0.1 | G01、C07、B04 | Notification / 各功能局部反馈；`HorizonError；TaskState/TaskEvent；horizon_subscribe` | TASK-002, TASK-004, TASK-011, TASK-012 |
| REQ-STATE-003 取消请求与完成分离 | P0 / v0.1 | D04、C07、A05、E01 | Notification / 各功能局部反馈；`HorizonError；TaskState/TaskEvent；horizon_subscribe` | TASK-002, TASK-021 |
| REQ-STATE-004 错误可恢复 | P0 / v0.1 | D07、C07、E04、G02 | Notification / 各功能局部反馈；`HorizonError；TaskState/TaskEvent；horizon_subscribe` | TASK-002, TASK-009, TASK-021 |
| REQ-NFR-001 基础资源测量 | P0 / v0.1 | F04、G03 | 原生壳 / 采集与验收工具；`TaskRegistry/ProcessSupervisor；构建/进程/文件证据` | TASK-008, TASK-022 |
| REQ-NFR-002 响应与压力场景 | P0 / v0.1 | G01、B09、B04 | 原生壳 / 采集与验收工具；`TaskRegistry/ProcessSupervisor；构建/进程/文件证据` | TASK-008, TASK-022 |
| REQ-NFR-003 双端实际行为 | P0 / v0.1 | G07、B06、G02、E01 | 原生壳 / 采集与验收工具；`TaskRegistry/ProcessSupervisor；构建/进程/文件证据` | TASK-001, TASK-008, TASK-023 |
| REQ-NFR-004 运行资源释放 | P0 / v0.1 | F04、E02、G03 | 原生壳 / 采集与验收工具；`TaskRegistry/ProcessSupervisor；构建/进程/文件证据` | TASK-008, TASK-021, TASK-022 |
| REQ-NFR-005 本地数据与凭据 | P0 / v0.1 | F09、F06、E04 | 原生壳 / 采集与验收工具；`TaskRegistry/ProcessSupervisor；构建/进程/文件证据` | TASK-003, TASK-015, TASK-017 |
| REQ-NFR-006 安装、升级与离线 | P0 / v0.1 | A01、F04、G07 | 原生壳 / 采集与验收工具；`TaskRegistry/ProcessSupervisor；构建/进程/文件证据` | TASK-023, TASK-024 |
| REQ-NEXT-001 新窗口与多窗口会话 | P2 / v0.2 | A06、G07 | 对应独立扩展/适配器；`现有扩展/AgentAdapter 边界；新增 API 另经 ADR` | TASK-108 |
| REQ-NEXT-002 块级/行级暂存 | P2 / v0.2 | C01、C02、C08 | 对应独立扩展/适配器；`现有扩展/AgentAdapter 边界；新增 API 另经 ADR` | TASK-105 |
| REQ-NEXT-003 完整三栏合并器 | P2 / v0.2 | C05 | 对应独立扩展/适配器；`现有扩展/AgentAdapter 边界；新增 API 另经 ADR` | TASK-105 |
| REQ-NEXT-004 语义语言能力 | P2 / v0.2 | B10、F03、E03 | 对应独立扩展/适配器；`现有扩展/AgentAdapter 边界；新增 API 另经 ADR` | TASK-103 |
| REQ-NEXT-005 更多适配与开放市场 | P2 / 后续立项 | E02、F05 | 对应独立扩展/适配器；`现有扩展/AgentAdapter 边界；新增 API 另经 ADR` | TASK-104, TASK-106 |
| REQ-NEXT-006 扩展开发者模式 | P2 / v0.2 | E16 | ExtensionCenter / ExtensionCard；`扩展生命周期与权限边界；开发目录接口后续另经 ADR` | TASK-106 |


## 2.1 五条主流程的成功、取消与失败恢复

2026-10-31 对齐 INTERACTION_SPEC H05 的五路径基线：补入快速启动，明确四条旧路径的取消与失败出口。仅补映射；沿用全部现有产品需求和页面 ID。D08、I01–I03 仍是建议状态，分别由 D02/F05、A06/F04/E01 承载。已有导出 PNG 保留原版本，不以重绘替代差异记录。

| 路径 / 产品需求 | 成功页面链 | 取消与返回 | 失败恢复 / 组件事件 |
| --- | --- | --- | --- |
| 打开项目；REQ-WS-002、REQ-FILE-001、REQ-WS-005 | A01/A02 → A04 系统目录选择 → B01 读取 → 保留项目会话 | 取消目录选择不登记；返回原项目/欢迎页，恢复入口焦点 | G02 重试读取/重新定位失效根；App 项目入口 `project_register`、`project_relocate`，FileExplorer `document_open` |
| Git 交付；REQ-GIT-002/003/004/007 | C01 双基线 → C02 暂存与提交 → C03 提交核对 → C04 显式推送 | 取消脏文件/提交确认保留文档和说明；取消任务等待结束，再回 C01 | C07 展示项目与实际错误；修正身份/hook/远端后显式重试；GitPanel `git_mutate`（stage / commit / push），旧基线先刷新 |
| 外部 Agent 审查；REQ-AI-002/005/007/008 | D03 固定附件快照 → D04 Pi 执行 → D05 工具前授权 → D06 条件应用 | D05 拒绝不执行；D04 停止等待终态，保留已有结果与修改；返回原项目会话 | D07 修正连接后验证；D06 版本冲突重新比较，不能盲目重试写入；AgentPanel `agent_context_prepare`、`agent_submit`、`agent_interaction_answer`、`review_apply` |
| 扩展恢复；REQ-EXT-002/005/007/008/012 | E02 默认包目录 → E03 安装/恢复 → E08 新权限确认 → E12 按需激活 | E13/E14 取消生命周期影响确认保持原策略/文档；E08 拒绝则不激活新增权限 | E04 重试/停用；E10/E11 更新失败保留旧可用版本；PluginCenter `extension_install_prepare/apply`、`extension_stop_prepare/apply` |
| 快速启动；REQ-LAUNCH-001/003/004/005/006 | A06 项目入口 → F04 保存方案/预检授权 → E01 本次运行日志与终端 | 取消预检不启动；运行中停止按逆序清本组自有资源，附着资源只断开；回 F04 | F04/E01 保留步骤失败、就绪超时及外部端口归属；修改方案后显式重试；LauncherToolbar/LauncherPanel `launch_prepare/start/stop/restart` |

以上为可追溯设计映射；各路径真实运行是否通过仍由验收矩阵中的功能证据决定。

## 3. 页面到需求与实施

2026-10-31 复核 screens.json 已由 56 页扩为 **73 页**（新增 E05–E16、F10–F14）。以下按实际源清单列出，所有页面均有产品需求与任务，不将页面数量当作功能完成比例。D/F 旧标题按 Pi 新基线解释；F05/F06 为 runtime→模型连接两层。

| 页面 | 源标题 | 产品需求 | 实施 TASK | 交付范围 |
| --- | --- | --- | --- | --- |
| A01 | 首次打开 | REQ-WS-001, REQ-STATE-001, REQ-NFR-006 | TASK-003, TASK-004, TASK-009, TASK-023, TASK-024, TASK-025 | 首版功能/共用状态 |
| A02 | 工作区与项目总览 | REQ-HOST-001, REQ-HOST-004, REQ-WS-001, REQ-WS-002, REQ-WS-004, REQ-WS-005, REQ-LAUNCH-009, REQ-RUN-003, REQ-UI-001 | TASK-001, TASK-002, TASK-003, TASK-004, TASK-007, TASK-009, TASK-015, TASK-016, TASK-021, TASK-025, TASK-027 | 首版功能/共用状态 |
| A03 | 创建工作区 | REQ-WS-001 | TASK-003 | 首版功能/共用状态 |
| A04 | 添加本地项目 | REQ-WS-002, REQ-WS-006, REQ-UI-005 | TASK-003, TASK-004, TASK-012, TASK-016, TASK-021, TASK-024 | 首版功能/共用状态 |
| A05 | 克隆仓库 | REQ-WS-003, REQ-STATE-003 | TASK-002, TASK-021, TASK-101 | 首版功能/共用状态 |
| A06 | 项目操作菜单 | REQ-WS-004, REQ-LAUNCH-001, REQ-LAUNCH-002, REQ-LAUNCH-004, REQ-LAUNCH-005, REQ-LAUNCH-007, REQ-RUN-004, REQ-NEXT-001, REQ-UI-005 | TASK-003, TASK-007, TASK-016, TASK-021, TASK-024, TASK-025, TASK-026, TASK-027, TASK-108 | 首版基础；高级子项后续 |
| B01 | 默认工作台 | REQ-HOST-002, REQ-HOST-003, REQ-EXT-002, REQ-EXT-012, REQ-WS-005, REQ-FILE-001, REQ-FILE-003, REQ-LAUNCH-001, REQ-LAUNCH-008, REQ-SET-002, REQ-UI-001 | TASK-004, TASK-005, TASK-007, TASK-009, TASK-011, TASK-012, TASK-015, TASK-016, TASK-019, TASK-020, TASK-021, TASK-025, TASK-026, TASK-027, TASK-102 | 首版功能/共用状态 |
| B02 | 文件操作 | REQ-FILE-002 | TASK-010 | 首版功能/共用状态 |
| B03 | 快速打开与命令 | REQ-FILE-004, REQ-SET-006, REQ-UI-004 | TASK-009, TASK-011, TASK-015 | 首版功能/共用状态 |
| B04 | 项目内搜索 | REQ-FILE-005, REQ-STATE-002, REQ-NFR-002 | TASK-002, TASK-004, TASK-008, TASK-011, TASK-012, TASK-022 | 首版功能/共用状态 |
| B05 | 搜索无结果 | REQ-FILE-005, REQ-STATE-001 | TASK-004, TASK-009, TASK-011, TASK-025 | 首版功能/共用状态 |
| B06 | 轻量编辑与未保存 | REQ-FILE-003, REQ-FILE-006, REQ-FILE-007, REQ-FILE-008, REQ-FILE-009, REQ-FILE-012, REQ-GIT-008, REQ-AI-008, REQ-SET-003, REQ-NFR-003 | TASK-001, TASK-005, TASK-006, TASK-007, TASK-008, TASK-015, TASK-023, TASK-029, TASK-030, TASK-107 | 首版功能/共用状态 |
| B07 | 分栏预览 | REQ-FILE-010 | TASK-031 | 首版补齐（按需启用） |
| B08 | 关闭未保存文件 | REQ-HOST-005, REQ-WS-004, REQ-FILE-002, REQ-FILE-009, REQ-FILE-013, REQ-GIT-009, REQ-RUN-004, REQ-SET-003, REQ-UI-004 | TASK-003, TASK-006, TASK-007, TASK-009, TASK-010, TASK-014, TASK-015, TASK-021, TASK-025 | 首版功能/共用状态 |
| B09 | 大文件阅读 | REQ-FILE-011, REQ-RUN-006, REQ-NFR-002 | TASK-005, TASK-007, TASK-008, TASK-011, TASK-021, TASK-022 | 首版功能/共用状态 |
| B10 | 文件结构与符号 | REQ-FILE-010, REQ-NEXT-004 | TASK-031, TASK-103 | 首版基础；高级子项后续 |
| C01 | 更改与行内差异 | REQ-HOST-002, REQ-EXT-011, REQ-WS-006, REQ-GIT-001, REQ-GIT-002, REQ-GIT-003, REQ-AI-008, REQ-NEXT-002 | TASK-004, TASK-005, TASK-011, TASK-012, TASK-013, TASK-016, TASK-020, TASK-025, TASK-029, TASK-105, TASK-107 | 首版功能/共用状态 |
| C02 | 暂存与提交 | REQ-GIT-003, REQ-GIT-004, REQ-GIT-010, REQ-UI-005, REQ-NEXT-002 | TASK-012, TASK-013, TASK-014, TASK-016, TASK-021, TASK-024, TASK-105 | 首版基础；高级子项后续 |
| C03 | 提交历史 | REQ-GIT-005 | TASK-030 | 首版基础；高级子项后续 |
| C04 | 分支与远端同步 | REQ-GIT-006, REQ-GIT-007, REQ-GIT-010, REQ-RUN-001 | TASK-009, TASK-012, TASK-013, TASK-014, TASK-021 | 首版功能/共用状态 |
| C05 | 合并冲突处理 | REQ-GIT-008, REQ-NEXT-003 | TASK-030, TASK-105 | 首版基础；高级子项后续 |
| C06 | 放弃更改确认 | REQ-GIT-009 | TASK-014 | 首版功能/共用状态 |
| C07 | 同步失败与重试 | REQ-WS-003, REQ-GIT-004, REQ-GIT-007, REQ-GIT-008, REQ-GIT-010, REQ-RUN-002, REQ-STATE-002, REQ-STATE-003, REQ-STATE-004 | TASK-002, TASK-004, TASK-009, TASK-011, TASK-012, TASK-013, TASK-014, TASK-021, TASK-027, TASK-030, TASK-101, TASK-102 | 首版功能/共用状态 |
| C08 | 并排差异 | REQ-GIT-002, REQ-UI-003, REQ-NEXT-002 | TASK-008, TASK-009, TASK-012, TASK-105 | 首版功能/共用状态 |
| D01 | AI 尚未连接 | REQ-HOST-003, REQ-AI-001, REQ-AI-006, REQ-AI-011, REQ-AI-012, REQ-UI-001, REQ-STATE-001 | TASK-004, TASK-009, TASK-015, TASK-017, TASK-018, TASK-021, TASK-022, TASK-025, TASK-028, TASK-032, TASK-033 | 首版补齐（按需启用） |
| D02 | 按项目对话 | REQ-AI-002, REQ-AI-004, REQ-AI-006, REQ-AI-010, REQ-RUN-006 | TASK-005, TASK-007, TASK-011, TASK-017, TASK-018, TASK-021, TASK-022, TASK-029, TASK-033 | 首版补齐（按需启用） |
| D03 | 上下文选择 | REQ-AI-002, REQ-AI-003 | TASK-029 | 首版补齐（按需启用） |
| D04 | 任务执行中 | REQ-AI-004, REQ-AI-005, REQ-AI-007, REQ-AI-009, REQ-AI-010, REQ-RUN-001, REQ-RUN-002, REQ-STATE-003 | TASK-002, TASK-007, TASK-009, TASK-017, TASK-018, TASK-021, TASK-027, TASK-028, TASK-033, TASK-102 | 首版补齐（按需启用） |
| D05 | 待授权操作 | REQ-EXT-007, REQ-AI-007, REQ-UI-004 | TASK-002, TASK-009, TASK-015, TASK-020, TASK-025, TASK-033 | 首版补齐（按需启用） |
| D06 | 审查 AI 修改 | REQ-AI-008, REQ-UI-005 | TASK-016, TASK-021, TASK-024, TASK-029, TASK-107 | 首版补齐（按需启用） |
| D07 | 连接失败与重试 | REQ-AI-003, REQ-AI-004, REQ-AI-005, REQ-STATE-004 | TASK-002, TASK-009, TASK-018, TASK-021, TASK-029, TASK-033 | 首版补齐（按需启用） |
| E01 | 按需终端 | REQ-AI-011, REQ-LAUNCH-005, REQ-LAUNCH-006, REQ-LAUNCH-007, REQ-LAUNCH-008, REQ-LAUNCH-009, REQ-RUN-001, REQ-RUN-002, REQ-RUN-005, REQ-RUN-006, REQ-UI-001, REQ-STATE-003, REQ-NFR-003, REQ-UI-005 | TASK-001, TASK-002, TASK-005, TASK-007, TASK-008, TASK-009, TASK-011, TASK-015, TASK-016, TASK-017, TASK-018, TASK-021, TASK-022, TASK-023, TASK-024, TASK-025, TASK-027, TASK-028, TASK-032, TASK-033, TASK-102 | 首版补齐（按需启用） |
| E02 | 插件中心 · 发现扩展 | REQ-HOST-001, REQ-HOST-002, REQ-HOST-003, REQ-HOST-004, REQ-EXT-002, REQ-LAUNCH-001, REQ-LAUNCH-009, REQ-NFR-004, REQ-NEXT-005 | TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-007, TASK-008, TASK-011, TASK-012, TASK-016, TASK-019, TASK-021, TASK-022, TASK-025, TASK-026, TASK-027, TASK-104, TASK-106 | 首版功能/共用状态 |
| E03 | 插件详情与贡献点 | REQ-HOST-005, REQ-EXT-001, REQ-EXT-006, REQ-FILE-010, REQ-AI-012, REQ-LAUNCH-004, REQ-RUN-005, REQ-UI-005, REQ-NEXT-004 | TASK-006, TASK-007, TASK-016, TASK-019, TASK-021, TASK-024, TASK-025, TASK-026, TASK-027, TASK-031, TASK-032, TASK-102, TASK-103 | 首版功能/共用状态 |
| E04 | 扩展失败与诊断 | REQ-EXT-006, REQ-EXT-008, REQ-EXT-009, REQ-EXT-012, REQ-AI-005, REQ-LAUNCH-006, REQ-RUN-002, REQ-STATE-001, REQ-STATE-004, REQ-NFR-005 | TASK-002, TASK-003, TASK-004, TASK-009, TASK-015, TASK-017, TASK-018, TASK-019, TASK-020, TASK-021, TASK-025, TASK-027, TASK-102 | 首版功能/共用状态 |
| E05 | 已安装与作用域 | REQ-EXT-003, REQ-EXT-004, REQ-EXT-009, REQ-EXT-010 | TASK-009, TASK-015, TASK-021, TASK-025 | 首版功能/共用状态 |
| E06 | 本地扩展包安装 | REQ-EXT-001, REQ-EXT-011 | TASK-019, TASK-020, TASK-025 | 首版功能/共用状态 |
| E07 | 安装进度与取消 | REQ-EXT-001, REQ-AI-012 | TASK-019, TASK-025, TASK-032 | 首版功能/共用状态 |
| E08 | 首次安装授权 | REQ-EXT-001, REQ-EXT-007 | TASK-002, TASK-019, TASK-020, TASK-025 | 首版功能/共用状态 |
| E09 | 插件设置与项目覆盖 | REQ-EXT-004, REQ-SET-001 | TASK-003, TASK-015, TASK-025 | 首版功能/共用状态 |
| E10 | 更新管理 | REQ-EXT-008 | TASK-019 | 首版功能/共用状态 |
| E11 | 更新权限变化 | REQ-EXT-007, REQ-EXT-008 | TASK-002, TASK-019, TASK-020, TASK-025 | 首版功能/共用状态 |
| E12 | 运行与休眠管理 | REQ-EXT-003, REQ-EXT-009, REQ-EXT-011 | TASK-009, TASK-020, TASK-021, TASK-025 | 首版功能/共用状态 |
| E13 | 停用范围确认 | REQ-EXT-004, REQ-EXT-006 | TASK-015, TASK-025, TASK-027 | 首版功能/共用状态 |
| E14 | 卸载与配置保留 | REQ-EXT-005, REQ-EXT-006, REQ-EXT-011 | TASK-019, TASK-020, TASK-025, TASK-027 | 首版功能/共用状态 |
| E15 | 没有已安装扩展 | REQ-HOST-001, REQ-EXT-002, REQ-STATE-001 | TASK-001, TASK-003, TASK-004, TASK-009, TASK-019, TASK-025 | 空态分两类，见下方约束 |
| E16 | 开发者模式与贡献点 | REQ-NEXT-006 | TASK-106 | v0.2 开发者模式 |
| F01 | 外观设置 | REQ-SET-007, REQ-UI-001, REQ-UI-002 | TASK-009, TASK-015, TASK-017, TASK-019, TASK-025, TASK-026 | 首版功能/共用状态 |
| F02 | 布局与面板 | REQ-EXT-010, REQ-SET-001, REQ-SET-002 | TASK-003, TASK-009, TASK-015, TASK-025 | 首版功能/共用状态 |
| F03 | 编辑器偏好 | REQ-FILE-006, REQ-FILE-012, REQ-SET-001, REQ-SET-003, REQ-NEXT-004 | TASK-003, TASK-005, TASK-006, TASK-015, TASK-103 | 首版功能/共用状态 |
| F04 | 项目与资源 | REQ-HOST-001, REQ-HOST-003, REQ-HOST-004, REQ-EXT-003, REQ-EXT-004, REQ-EXT-009, REQ-EXT-010, REQ-LAUNCH-001, REQ-LAUNCH-002, REQ-LAUNCH-003, REQ-LAUNCH-004, REQ-LAUNCH-007, REQ-LAUNCH-008, REQ-LAUNCH-010, REQ-RUN-003, REQ-RUN-004, REQ-RUN-006, REQ-SET-001, REQ-SET-007, REQ-NFR-001, REQ-NFR-004, REQ-NFR-006, REQ-UI-005 | TASK-001, TASK-002, TASK-003, TASK-005, TASK-007, TASK-008, TASK-009, TASK-011, TASK-015, TASK-016, TASK-017, TASK-021, TASK-022, TASK-023, TASK-024, TASK-025, TASK-026, TASK-027, TASK-102 | 首版功能/共用状态 |
| F05 | AI 连接管理 | REQ-AI-001, REQ-AI-006, REQ-AI-009, REQ-AI-011, REQ-AI-012, REQ-AI-013, REQ-SET-001, REQ-SET-004, REQ-NEXT-005 | TASK-003, TASK-015, TASK-017, TASK-018, TASK-022, TASK-028, TASK-032, TASK-033, TASK-104, TASK-106 | 首版补齐（按需启用） |
| F06 | 新增 AI 连接 | REQ-AI-001, REQ-AI-013, REQ-SET-004, REQ-SET-007, REQ-NFR-005 | TASK-003, TASK-015, TASK-017, TASK-026, TASK-032, TASK-033 | 首版补齐（按需启用） |
| F07 | Git 偏好 | REQ-GIT-001, REQ-GIT-007, REQ-SET-005 | TASK-012, TASK-014, TASK-015 | 首版功能/共用状态 |
| F08 | 快捷键 | REQ-FILE-004, REQ-SET-006 | TASK-011, TASK-015 | 首版功能/共用状态 |
| F09 | 数据与隐私 | REQ-HOST-001, REQ-EXT-005, REQ-FILE-013, REQ-AI-013, REQ-SET-008, REQ-NFR-005 | TASK-001, TASK-003, TASK-007, TASK-015, TASK-017, TASK-019, TASK-025, TASK-033 | 首版功能/共用状态 |
| G01 | 工作区加载中 | REQ-WS-002, REQ-FILE-001, REQ-LAUNCH-005, REQ-STATE-002, REQ-NFR-002 | TASK-002, TASK-003, TASK-004, TASK-008, TASK-011, TASK-012, TASK-022, TASK-027 | 首版功能/共用状态 |
| G02 | 文件不可用 | REQ-WS-002, REQ-FILE-001, REQ-FILE-002, REQ-FILE-007, REQ-FILE-008, REQ-FILE-011, REQ-GIT-001, REQ-STATE-001, REQ-STATE-004, REQ-NFR-003 | TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-006, TASK-007, TASK-008, TASK-009, TASK-010, TASK-012, TASK-021, TASK-023, TASK-025 | 首版功能/共用状态 |
| G03 | 后台项目休眠 | REQ-HOST-005, REQ-WS-005, REQ-FILE-013, REQ-AI-010, REQ-LAUNCH-009, REQ-RUN-003, REQ-NFR-001, REQ-NFR-004 | TASK-006, TASK-007, TASK-008, TASK-016, TASK-018, TASK-021, TASK-022, TASK-025, TASK-027 | 首版功能/共用状态 |
| G04 | 专注模式 | REQ-RUN-001, REQ-SET-002 | TASK-009, TASK-015, TASK-021 | 首版功能/共用状态 |
| G05 | 深色主题 | REQ-UI-002 | TASK-009, TASK-019 | 首版功能/共用状态 |
| G06 | 窄窗口 | REQ-UI-003 | TASK-008, TASK-009 | 首版功能/共用状态 |
| G07 | Windows 窗口 | REQ-FILE-006, REQ-LAUNCH-010, REQ-RUN-005, REQ-SET-006, REQ-UI-003, REQ-NFR-003, REQ-NFR-006, REQ-NEXT-001 | TASK-001, TASK-005, TASK-006, TASK-008, TASK-009, TASK-011, TASK-015, TASK-023, TASK-024, TASK-026, TASK-027, TASK-102, TASK-108 | 首版功能/共用状态 |
| H01 | 信息架构 | REQ-HOST-001, REQ-HOST-002, REQ-WS-001, REQ-WS-006, REQ-AI-009, REQ-UI-005 | TASK-001, TASK-003, TASK-004, TASK-005, TASK-011, TASK-012, TASK-016, TASK-017, TASK-018, TASK-021, TASK-024, TASK-025, TASK-028, TASK-033 | 设计规范，不创建路由 |
| H02 | 视觉令牌 | REQ-UI-002 | TASK-009, TASK-019 | 设计规范，不创建路由 |
| H03 | 组件与反馈状态 | REQ-UI-002, REQ-UI-004 | TASK-009, TASK-015, TASK-019 | 设计规范，不创建路由 |
| H04 | 响应式布局规则 | REQ-UI-003 | TASK-008, TASK-009 | 设计规范，不创建路由 |
| H05 | 关键操作流程 | REQ-UI-005 | TASK-016, TASK-021, TASK-024 | 设计规范，不创建路由 |

**E15 空态约束：**若只是没有第三方/可选扩展，已安装默认文件/代码/Git 能力仍可用；若全部默认扩展已卸载，只有宿主的项目、设置、扩展恢复与草稿导出入口。源备注“基础文件和 Git 仍可用”不能用来固化不可卸载核心。产品 PRD/REQ-HOST-001、REQ-EXT-002 已规定此区别。

**未登记的建议页面：**D08（会话选择）及 I01/I02/I03（启动方案、运行、失败）尚不在源清单。其行为分别由现有 D02/F05、A06/F04、E01/E04 承载，关联 TASK-018、TASK-026、TASK-027、TASK-102。UX 早期建议 E05“影响确认”映射到现有 E13/E14/E12；早期 E06“项目扩展配置”映射 E09，禁止沿用旧提议覆盖现在 E05/E06 的真实含义。

## 4. 交互补充需求映射

以下约束直接来自交互规格。产品界面需求已采用 REQ-UI-*，交互补充采用 REQ-UXI-*，两组含义不同且无编号碰撞。

| 交互需求 | 约束 | 实施 TASK | 验收入口 |
| --- | --- | --- | --- |
| REQ-UXI-001 | 工作区是项目集合；添加、重命名显示名、移除均不搬动或删除磁盘根目录 | TASK-003 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-002 | 项目切换恢复该项目标签、光标、侧栏与草稿；文件标签从属于项目 | TASK-007 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-003 | 默认只展示项目导航、文件侧栏、代码区与精简状态；AI、终端按需打开 | TASK-009, TASK-025 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-004 | 未保存、Git 修改、外部磁盘变化三种状态独立；任何关闭或覆盖不得静默丢稿 | TASK-006, TASK-010, TASK-029 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-005 | 文件树按目录加载，搜索可取消，过期结果不覆盖当前项目结果 | TASK-004, TASK-005, TASK-011, TASK-031 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-006 | Git 未暂存/已暂存的来源明确；提交只含已暂存文件；失败保持用户输入 | TASK-012, TASK-013, TASK-014, TASK-030 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-007 | Agent 明示项目、会话、适配器与权限模式；上下文附件和 Agent 可自主读取的范围分开；仅展示实际支持的授权/审查能力 | TASK-017, TASK-018, TASK-028, TASK-029 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-008 | 隐藏面板、停止任务、结束进程、停用扩展是四种不同操作 | TASK-007, TASK-021, TASK-027, TASK-102 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-009 | 代码区空间不足时切换或覆盖辅助面板；退出专注模式恢复用户布局意图 | TASK-009, TASK-012, TASK-031 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-010 | 设置以弹窗集中呈现；继承和项目覆盖可辨认；凭据不回显、不进入导出 | TASK-003, TASK-015, TASK-017, TASK-026 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-011 | 主流程全键盘可达；焦点可见且不被遮挡；模态关闭后返回合理位置 | TASK-009, TASK-011, TASK-015 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-012 | 八种皮肤保持相同命令、状态语义、数据边界与无障碍目标 | TASK-009, TASK-019 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-013 | 局部失败局部展示；可用文件和代码区域保持响应；不伪造进度与资源数字 | TASK-002, TASK-009, TASK-021 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-014 | macOS/Windows 功能一致；保留各自窗口、路径、快捷键和系统交互习惯 | TASK-001, TASK-008, TASK-023 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-015 | 扩展的安装、启用、运行状态分开；新增权限先说明再启用 | TASK-019, TASK-020, TASK-025 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-016 | 每次异步写操作绑定项目与版本；切换视图、重试、取消不会重复提交或写入 | TASK-002, TASK-006, TASK-013, TASK-027 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-017 | 默认附带扩展同样可暂停/恢复、按项目禁用与全局卸载；操作前列出依赖及活动资源 | TASK-025, TASK-016, TASK-021 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-018 | 项目保存启动方案；用户一键启用所需扩展、启动进程并查看就绪/失败；支持停止与重启 | TASK-026, TASK-027 | 对应 TASK 的交互/集成验收 |
| REQ-UXI-019 | Agent 适配只负责检测、配置、启动/附着、事件与生命周期；终端模式不冒充结构化协议 | TASK-017, TASK-018, TASK-028, TASK-029 | 对应 TASK 的交互/集成验收 |

## 5. 组件、接口与生命周期边界

组件契约是 view model 和用户意图，INTERFACES 是跨进程 DTO；二者通过控制器适配，不把组件示例类型复制成第二份 IPC。宿主只提供通用能力；文件、编辑、搜索、Git、Agent、终端和启动器业务归扩展。写操作绑定项目/对象版本，异步事件绑定所属实例/运行。

| 组件与职责 | 正式接口 / 类型 | 关键转换与验收 | TASK |
| --- | --- | --- | --- |
| WorkbenchShell、ProjectNavigator | `app_bootstrap`、`workspace_*`、`project_*`、`Scope` | 当前项目改变 UI 上下文，旧任务仍归原 scope；移除先生成停止计划 | TASK-002、TASK-003、TASK-007、TASK-009 |
| FileTree | `directory_list`、`DirectoryPage`、`file_create/rename/trash` | 不透明文件 ID 执行，displayPath 只展示；延迟目录结果不串项目 | TASK-004、TASK-010 |
| DocumentTabs、CodeSurface、LargeFileSurface | `OpenDocument`、`SaveDocument`、`SaveResult`、`document_checkpoint`、`file_read_chunk` | EditorRevision 与 DiskRevision 分开；保存完成不能清除保存期间的新编辑 | TASK-005–007 |
| QuickOpen、CommandPalette、ProjectSearch | `path_query`、`search_start`、`commands.register`、`TaskEvent` | 查询 generation 过滤迟到结果；命令走扩展激活/权限；取消不清输入 | TASK-011、TASK-025 |
| GitPanel、CommitComposer、DiffSurface | `GitSnapshot`、`GitDiff`、`GitMutation`、`git_mutate` | 同文件双 diff 基线明确；写前重验 repoToken；提交不自动保存/推送 | TASK-012–014、TASK-030 |
| AgentConnection、AgentContext、AgentSession、AgentRun | `AgentAdapter`、`AgentCapabilities`、`agent_detect/connect/submit/cancel`、`InteractionAnswer` | UI 只显示实际能力；接收输入不等于任务完成；授权绑定原请求/实例 | TASK-017、TASK-018、TASK-033 |
| AgentReview | `ContextSnapshot`、`review_get/apply/discard`、`FileOutcome` | proposed/taskCopy/observedDisk 区分；任务前基线含用户修改；逐文件版本校验 | TASK-029、TASK-107 |
| TerminalPanel | `terminal_create/attach_view/detach_view/input/resize/stop`、`ProcessInstance` | 关闭面板调用 detach；结束会话才 stop；进程归属与视图分离 | TASK-102、TASK-021 |
| SettingsDialog、SettingsField | `settings_get/patch`、`credential_set/remove`、`data_export/clear_prepare/clear_apply`、`recovery_list/export` | 即时偏好与显式保存表单分开；恢复继承用 unset；不返回 secret | TASK-003、TASK-015、TASK-017 |
| ExtensionCenter、ExtensionCard、LifecycleDialog | `extension_*`、`ExtensionModule`、`ResourceStopPlan`、`renderer_reload_prepare/apply` | 三轴状态；停止先校验影响摘要；默认包与外部包同生命周期；资源和模块缓存分报 | TASK-019、TASK-020、TASK-025 |
| LaunchProfileEditor、ProjectRunPanel | `LaunchProfile`、`LaunchPlan`、`launch_profile_save/list/delete`、`launch_detect/prepare/start/get/stop/restart` | 发现只读；运行绑定保存版本；端口响应须归本次实例；停止只回收 owned 资源 | TASK-026、TASK-027 |
| Dialog、Menu、Notification | `HorizonError`、`TaskState`、局部组件事件 | 焦点恢复、局部错误、终态和取消请求分开；无伪造百分比 | TASK-002、TASK-009、TASK-024 |

接口 0.4.0 已补齐 extension_resume、extension_project_override、launch_profile_delete、recovery_list/export 与 data_export/clear_prepare/clear_apply。UI 复用正式契约，不绕过宿主；修正依据与验证记录见 READINESS。

## 6. 任务反向覆盖与专项工作包

全部 45 个执行任务的完整输入和验收见 IMPLEMENTATION_PLAN。每项都有需求来源；后续任务不计入首版完成率。TASK-028 首版只交接口设计，不运行 Codex/Claude；TASK-104 才是其后续实现。

| 执行任务 | 批次 | 需求来源 | 验收状态 |
| --- | --- | --- | --- |
| TASK-001 桌面骨架与可复现构建 | S0 | REQ-HOST-001, REQ-NFR-003 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-002 共享 DTO、IPC 错误、取消与事件归属 | S0 | REQ-HOST-004, REQ-EXT-007, REQ-RUN-002, REQ-STATE-002, REQ-STATE-003, REQ-STATE-004 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-003 工作区、项目与配置持久化 | S0 | REQ-HOST-001, REQ-WS-001, REQ-WS-002, REQ-WS-004, REQ-SET-001, REQ-NFR-005 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-004 文件根授权、目录懒加载与只读树 | S1 | REQ-HOST-002, REQ-WS-002, REQ-WS-006, REQ-FILE-001, REQ-STATE-001, REQ-STATE-002 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-005 文档打开与最小 CodeMirror 视图 | S1 | REQ-HOST-002, REQ-FILE-003, REQ-FILE-006, REQ-FILE-011, REQ-FILE-012, REQ-RUN-006 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-006 编辑、保存、外部修改与未保存保护 | S1 | REQ-HOST-005, REQ-FILE-006, REQ-FILE-007, REQ-FILE-008, REQ-FILE-009, REQ-FILE-012 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-007 监听、会话恢复与后台项目生命周期 | S1 | REQ-HOST-004, REQ-HOST-005, REQ-WS-004, REQ-WS-005, REQ-FILE-008, REQ-FILE-013, REQ-AI-010, REQ-RUN-003, REQ-RUN-004, REQ-RUN-006 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-008 纵向切片风险门禁 | S1 | REQ-FILE-011, REQ-UI-003, REQ-NFR-001, REQ-NFR-002, REQ-NFR-003, REQ-NFR-004 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-009 工作台布局、令牌与基础组件 | S2 | REQ-EXT-009, REQ-RUN-001, REQ-SET-002, REQ-UI-001, REQ-UI-002, REQ-UI-003, REQ-UI-004, REQ-STATE-001, REQ-STATE-004 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-010 文件操作与错误恢复 | S2 | REQ-FILE-002 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-011 快速打开、项目搜索与命令入口 | S2 | REQ-HOST-002, REQ-FILE-004, REQ-FILE-005, REQ-RUN-006, REQ-SET-006, REQ-STATE-002 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-012 Git 执行器、状态与两类 diff | S2 | REQ-HOST-002, REQ-WS-006, REQ-GIT-001, REQ-GIT-002, REQ-GIT-010, REQ-STATE-002 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-013 暂存、取消暂存与本地提交 | S2 | REQ-GIT-003, REQ-GIT-004, REQ-GIT-010 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-014 分支、远端同步、丢弃与失败恢复 | S2 | REQ-GIT-006, REQ-GIT-007, REQ-GIT-009, REQ-GIT-010 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-015 编辑器、资源、快捷键与数据设置 | S2 | REQ-EXT-004, REQ-EXT-010, REQ-FILE-012, REQ-SET-001, REQ-SET-002, REQ-SET-003, REQ-SET-005, REQ-SET-006, REQ-SET-007, REQ-SET-008, REQ-UI-001, REQ-UI-004, REQ-NFR-005 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-016 核心工作流集成验收 | S2 | REQ-HOST-002, REQ-WS-005, REQ-UI-005 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-017 Pi 检测、模型连接与凭据配置 | S3 | REQ-AI-001, REQ-AI-006, REQ-AI-009, REQ-AI-011, REQ-AI-013, REQ-SET-004, REQ-SET-007, REQ-NFR-005 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-018 Pi 官方 RPC 与外部会话状态 | S3 | REQ-AI-004, REQ-AI-005, REQ-AI-006, REQ-AI-009, REQ-AI-010, REQ-AI-011 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-019 扩展本地安装、主题与分发目录 | S2 | REQ-EXT-001, REQ-EXT-002, REQ-EXT-005, REQ-EXT-008, REQ-UI-002 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-020 第三方可执行扩展运行时风险验证 | S3 | REQ-EXT-007, REQ-EXT-011, REQ-EXT-012 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-021 可选能力的生命周期整合 | S3 | REQ-HOST-003, REQ-HOST-004, REQ-EXT-003, REQ-EXT-009, REQ-AI-005, REQ-LAUNCH-009, REQ-RUN-001, REQ-RUN-002, REQ-RUN-003, REQ-RUN-004, REQ-RUN-006, REQ-UI-005, REQ-STATE-003, REQ-STATE-004, REQ-NFR-004 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-022 资源预算、性能回归与诊断 | S4 | REQ-AI-011, REQ-RUN-006, REQ-NFR-001, REQ-NFR-002, REQ-NFR-004 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-023 macOS / Windows 安装与升级恢复 | S4 | REQ-NFR-003, REQ-NFR-006 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-024 MVP 需求与双端验收收口 | S4 | REQ-UI-005, REQ-NFR-006 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-025 最小宿主与默认扩展完整生命周期（S0 门禁） | S0 | REQ-HOST-001, REQ-HOST-002, REQ-HOST-003, REQ-HOST-004, REQ-HOST-005, REQ-EXT-001, REQ-EXT-002, REQ-EXT-003, REQ-EXT-004, REQ-EXT-005, REQ-EXT-006, REQ-EXT-007, REQ-EXT-009, REQ-EXT-010, REQ-EXT-012, REQ-LAUNCH-001, REQ-RUN-004, REQ-UI-001, REQ-STATE-001 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-026 项目运行配置、候选发现与启动计划预览（首版补齐） | S3 | REQ-LAUNCH-001, REQ-LAUNCH-002, REQ-LAUNCH-003, REQ-LAUNCH-004, REQ-LAUNCH-010, REQ-SET-007 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-027 启动方案执行、就绪、失败、停止与重启（首版补齐） | S3 | REQ-EXT-006, REQ-LAUNCH-004, REQ-LAUNCH-005, REQ-LAUNCH-006, REQ-LAUNCH-007, REQ-LAUNCH-008, REQ-LAUNCH-009, REQ-LAUNCH-010, REQ-RUN-002 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-028 Codex / Claude Code 后续适配接口设计（首版仅设计） | 首版仅接口设计 | REQ-AI-009, REQ-AI-011 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-029 外部 Agent 上下文、变化归因与审查（首版补齐） | S3 | REQ-AI-002, REQ-AI-003, REQ-AI-008 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-030 基础 Git 历史与手动冲突闭环（核心里程碑） | S2 | REQ-GIT-005, REQ-GIT-008 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-031 可选 Markdown 预览与基础标题导航（MVP） | S3 | REQ-FILE-010 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-032 Pi 固定运行时分发、安装与回退 | S3 | REQ-AI-001, REQ-AI-011, REQ-AI-012 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-033 Pi 只读/任务 profile 与工具前授权适配 | S3 | REQ-AI-004, REQ-AI-007, REQ-AI-009, REQ-AI-011, REQ-AI-013 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-101 克隆与项目登记（核心里程碑） | S2 | REQ-WS-003 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-102 按需终端扩展（首版补齐） | S3 | REQ-LAUNCH-008, REQ-RUN-002, REQ-RUN-005 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-103 更多预览格式与语义语言能力（后续） | 后续 | REQ-NEXT-004 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-104 Codex / Claude / 其他外部 Agent 的真实适配（后续） | 后续 | REQ-NEXT-005 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-105 增强 Git 历史、复杂冲突与细粒度暂存 | 后续 | REQ-NEXT-002, REQ-NEXT-003 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-106 扩展生态与高级布局 | 后续 | REQ-NEXT-005, REQ-NEXT-006 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-107 补丁建议预览与版本化应用 | 后续 | REQ-AI-008 | 任务内验收步骤、必要测试和完成定义；待实现 |
| TASK-108 多窗口会话协调（v0.2） | 后续 | REQ-NEXT-001 | 任务内验收步骤、必要测试和完成定义；待实现 |


### 6.1 专项工作包与执行任务

| 专项入口 | 执行 TASK | 证据职责 |
| --- | --- | --- |
| TASK-PROD-001 / TASK-UX-003 / TASK-ARCH-003 | TASK-005、TASK-006、TASK-007、TASK-008、TASK-016 | 文件字节、版本、dirty 状态和恢复文本 |
| TASK-PROD-002 / TASK-UX-004 / TASK-ARCH-005 | TASK-012、TASK-013、TASK-014、TASK-030 | 真实仓库 HEAD/index/worktree 与失败恢复 |
| TASK-PROD-003 / TASK-UX-006 / TASK-UX-C04 / TASK-ARCH-006/007 | TASK-017、TASK-018、TASK-028、TASK-029、TASK-032、TASK-033 | Pi 实际协议/权限/取消；Codex/Claude 仅接口证据 |
| TASK-PROD-004 / TASK-UX-001/005 / TASK-UX-C03 / TASK-ARCH-008 | TASK-025、TASK-019、TASK-020、TASK-021、TASK-016 | 可拆默认包、依赖、资源回收和重装 |
| TASK-PROD-005 / TASK-UX-002/008 / TASK-UX-C01/C06 | TASK-009、TASK-015、TASK-024 | 主题、布局、继承、焦点与原生辅助技术 |
| TASK-PROD-006 / TASK-ARCH-010/011 | TASK-008、TASK-022、TASK-023、TASK-024 | 双端原生与性能原始记录、安装产物 |
| TASK-PROD-007 / TASK-UX-007 / TASK-UX-C05 / TASK-ARCH-009/012 | TASK-026、TASK-027、TASK-102、TASK-021 | 进程归属、就绪证据、逆序停止、外部进程未误杀 |
| TASK-UX-C02 / TASK-ARCH-002/004 | TASK-003–007、TASK-011、TASK-012 | 默认扩展及项目/树/搜索/持久化真实服务 |
| TASK-ARCH-001 | TASK-001、TASK-002 | 精确工具链、双端空壳、协议样例 |
| TASK-PI-001 | TASK-032 | 固定发行与平台依赖 |
| TASK-PI-002 | TASK-018 | RPC 帧、早到事件、handled/settled |
| TASK-PI-003 | TASK-033 | 工具执行前授权、断桥拒绝、密钥环境边界 |
| TASK-PI-004 | TASK-029 | 原有修改与 dirty buffer 基线、条件应用 |
| TASK-PI-005 | TASK-018、TASK-021 | 队列清理、abort、stdin EOF、owned 进程回收 |
| TASK-PI-006 | TASK-017、TASK-033 | provider/凭据/认证归属与实际验证 |
| TASK-PI-007 | TASK-022 | PI-P01–PI-P08 原始测量 |

### 6.2 ADR 到任务

| 决策 | 实施入口 | 通过门槛 |
| --- | --- | --- |
| ADR-001 技术栈 | TASK-001、TASK-005、TASK-008 | 双端真实壳、输入、文件与资源基线 |
| ADR-002 最小宿主 | TASK-025、TASK-016 | 默认能力可卸载、宿主恢复入口仍在 |
| ADR-003 运行边界 | TASK-019、TASK-020、TASK-025 | 默认 sidecar/第三方 runtime 与 UI 缓存分别回收 |
| ADR-004 工作区/项目 | TASK-003、TASK-007 | 单归属分组、单根与独立会话 |
| ADR-005 文档 | TASK-005–008 | 条件保存、恢复与双端输入 |
| ADR-006 Git | TASK-012–014、TASK-030 | 可卸载 Git 服务与真实仓库闭环 |
| ADR-007 IPC | TASK-002、TASK-021 | 身份/版本/幂等/取消/背压与终态 |
| ADR-008 数据/凭据 | TASK-003、TASK-015、TASK-017、TASK-033 | 迁移、继承、认证归属和脱敏 |
| ADR-009 资源 | TASK-008、TASK-022 | 场景与全进程口径；不拿原型代替 |
| ADR-010 Pi 候选 | TASK-017、TASK-018、TASK-028、TASK-032 | 一条默认候选链路；其他 Agent 仅设计 |
| ADR-011 Pi 策略 | TASK-018、TASK-029、TASK-033 | 授权、基线、取消与无自研循环 |
| ADR-012 启动器/终端 | TASK-026、TASK-027、TASK-102 | 用户保存计划、真实就绪、所有权回收 |
| ADR-013 平台/发行 | TASK-001、TASK-023、TASK-024 | 原生安装/升级/卸载，签名是发布门槛 |

## 7. 缺口与收口记录

| 缺口 | 影响 | 处理 |
| --- | --- | --- |
| 最终跨文档状态与引用收口 | 产品 110 条、UX 19 条、73 个页面、45 个 TASK | 本轮按当前基线逐表核对；最终计数与检查见 READINESS |
| 老页面未覆盖扩展可拆与启动方案 | 容易漏掉宿主主线 | 已加入 TASK-025/026/027；E05–E16 已映射，D08/I01–I03 仍为建议状态 |
| 外部 Agent 默认范围已确认 | Pi 首版唯一候选，Codex/Claude 先留接口 | 已依据 2026-10-31 用户确认更新任务；已同步 UX 残留、任务副本与并发规则 |
| 性能只有建议目标 | 不能填写已通过 | TASK-008/022 产出原始数据后再更新状态 |

矩阵审查通过只是设计关系完整。所有应用验收状态目前都是“待实现/待测”，不存在实际功能已通过的暗示。

## 10. UI 定制新增追踪（0.4）

| 需求 | 页面 | 组件 / 接口 | 实施任务 |
| --- | --- | --- | --- |
| REQ-UI-006 布局均为插件 | F02、F14、E03 | AppearanceService / LayoutRegistry；appearance_* | TASK-034、TASK-035 |
| REQ-UI-007 区域尺寸设置 | F10、G06 | AppearanceService / LayoutRegistry；appearance_* | TASK-036 |
| REQ-UI-008 本地图片背景 | F11、F09 | AppearanceService / LayoutRegistry；appearance_* | TASK-037 |
| REQ-UI-009 自定义主题颜色 | F01、F12 | AppearanceService / LayoutRegistry；appearance_* | TASK-036 |
| REQ-UI-010 外观组合与继承 | F13、F10、F12 | AppearanceService / LayoutRegistry；appearance_* | TASK-036 |
| REQ-UI-011 外观切换保留工作 | F02、F14、B06、D04 | AppearanceService / LayoutRegistry；appearance_* | TASK-034、TASK-035 |

| 新页面 | 组件 | TASK / 验收 |
| --- | --- | --- |
| F10 区域尺寸 | GeometryEditor | TASK-036；首选/有效尺寸、继承 |
| F11 背景图片 | BackgroundEditor | TASK-037；导入/释放/缺失 |
| F12 自定义配色 | TokenEditor | TASK-036；浅深独立与重置 |
| F13 外观组合 | AppearancePresetManager | TASK-036；导入/缺包 |
| F14 布局恢复 | LayoutRecovery | TASK-035；故障/草稿保留 |

TASK-034 对应 ADR-003/014、REQ-EXT-006/012 与 REQ-UI-006/011；TASK-035 对应 REQ-UI-006/011；TASK-036 对应 REQ-UI-007/009/010；TASK-037 对应 REQ-UI-008/NFR-001。四项全部为首版，完整依赖与完成定义见实施计划第 13 节。
