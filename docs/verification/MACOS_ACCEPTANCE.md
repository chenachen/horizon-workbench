# macOS 首版验收矩阵

范围：104 条首版需求、39 项首版任务。来源为产品 0.4.0；本次仅验收 macOS。
已有构建、单元测试、原型或静态审查不能替代真实行为证据；平台原文保留，未测平台不计通过。

状态：已证实＝该条全部条件有证据；部分证实＝仅覆盖子项；失败＝已有反例；受限＝有具体阻断；未证实＝未运行或无足够证据。

## 计数

- 需求 104：未证实 0；部分证实 45；已证实 57；失败 2；受限 0
- 任务 39：未证实 2；部分证实 19；已证实 16；失败 2；受限 0

## 需求待办

| 编号 / 需求 | 优先级 | 任务 | 实现位置 | 状态 / 证据 | 验收条件 |
| --- | --- | --- | --- | --- | --- |
| REQ-HOST-001 最小宿主保持可管理 | P0 | TASK-001, TASK-003, TASK-025 | apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src/components/RecoveryPanel.tsx, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx | 部分证实 / MAC-HOST-RECOVERY-PRESET-GUI-4B-001 | 停用全部功能扩展后仍能管理工作区/项目、打开设置、安装恢复扩展、查看/导出恢复草稿；无文件树/Git/Agent 常驻实例 |
| REQ-HOST-002 默认能力真实可拆 | P0 | TASK-004, TASK-005, TASK-011, TASK-012, TASK-016, TASK-025 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src/components/RecoveryPanel.tsx, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx | 部分证实 / MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-HOST-RECOVERY-PRESET-GUI-4B-001 | 文件树、代码、搜索、Git 分别作为默认附带扩展；Git 卸载后无 Git 刷新，恢复安装后原项目可继续；代码停用不丢恢复数据 |
| REQ-HOST-003 按激活事件运行 | P0 | TASK-021, TASK-025 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 部分证实 / MAC-PLUGIN-POLICY-001, MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-PLUGIN-GUI-4B-001 | 新装未启用、已启用休眠、打开扩展详情均不启动服务；仅相应命令/文件类型/视图触发实例，重复打开不重复启动 |
| REQ-HOST-004 实例归属可追踪 | P0 | TASK-002, TASK-007, TASK-021, TASK-025 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 部分证实 / MAC-PLUGIN-POLICY-001, MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-PLUGIN-GUI-4B-001, MAC-LAUNCH-GUI-CANDIDATE5-001 | 同扩展在 A/B 两项目运行时，暂停 A 只释放 A 的资源；显示自有与外部附着进程；全局停用列全量影响 |
| REQ-HOST-005 扩展状态与恢复接口 | P0 | TASK-006, TASK-007, TASK-025 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src/components/RecoveryPanel.tsx, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx | 部分证实 / MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-HOST-RECOVERY-PRESET-GUI-4B-001 | 编辑扩展退出前交出恢复数据；不支持状态导出时阻止危险停用并列具体文档；仅有包目录或 UI 开关不能通过验收 |
| REQ-EXT-001 安装与兼容校验 | P0 | TASK-019, TASK-025 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx, apps/desktop/src/features/plugins/PluginInstallDialog.tsx, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 部分证实 / MAC-PLUGIN-POLICY-001, MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-PLUGIN-GUI-4B-001, MAC-UNINSTALLED-EXTENSION-PERMISSION-PREVIEW-RETEST-001 | 本地包显示来源、版本、能力、兼容范围；损坏包/依赖环/不兼容在激活前失败，既有版本仍可用；安装本身不执行扩展代码 |
| REQ-EXT-002 默认扩展恢复 | P0 | TASK-019, TASK-025 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src/components/RecoveryPanel.tsx, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 部分证实 / MAC-PLUGIN-POLICY-001, MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-HOST-RECOVERY-PRESET-GUI-4B-001 | 文件树/Git 卸载后从宿主入口恢复可信默认包；不要求重新安装整个应用；用户项目和配置仍在；默认包同样经过依赖/权限检查 |
| REQ-EXT-003 暂停与恢复 | P0 | TASK-021, TASK-025 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 部分证实 / MAC-PLUGIN-POLICY-001, MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-PLUGIN-GUI-4B-001 | 当前项目/所有项目暂停范围明确；活动资源释放，重启后仍不自动激活；显式恢复才按需重建；保留启用策略与配置；有活动任务先处理 |
| REQ-EXT-004 全局/项目禁用 | P0 | TASK-015, TASK-025 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 失败 / MAC-PLUGIN-POLICY-001, MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-PLUGIN-GUI-4B-001, MAC-PLUGIN-PROJECT-ENABLE-SCOPE-C6-FAIL-001 | 项目禁用跨重启保留且不影响其他项目；全局禁用停止所有实例并禁止项目覆盖绕过；UI 展示实际生效来源 |
| REQ-EXT-005 卸载语义 | P0 | TASK-019, TASK-025 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx | 部分证实 / MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-PLUGIN-GUI-4B-001 | 卸载全局移除活动包与注册，先列项目/依赖影响；取消不改状态；配置清理另选；不删除源码或卸载系统 Git/Agent CLI |
| REQ-EXT-006 依赖影响与冲突 | P0 | TASK-025, TASK-027 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 部分证实 / MAC-PLUGIN-POLICY-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003 | 必需依赖缺失不能激活；可选依赖只降级；禁用依赖提供同时停用依赖者/取消；用户禁用的依赖不自动重启；循环与版本冲突可定位 |
| REQ-EXT-007 权限与来源透明 | P0 | TASK-002, TASK-020, TASK-025 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx, apps/desktop/src/features/plugins/PluginInstallDialog.tsx, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 部分证实 / MAC-PLUGIN-POLICY-001, MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-PLUGIN-GUI-4B-001, MAC-UNINSTALLED-EXTENSION-PERMISSION-PREVIEW-RETEST-001 | 安装前说明权限/作用域，拒绝取消安装；已安装包启用权限不足则不激活；未授权调用被拒绝；更新新增权限重新确认；不宣称 OS 强沙箱 |
| REQ-EXT-008 更新可恢复 | P1 | TASK-019 | apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx | 部分证实 / MAC-PLUGIN-GUI-4B-001 | 本地安装新版本先停止旧实例、校验兼容与权限；失败保留旧配置与可恢复版本，不同时运行两版；不要求公共市场 |
| REQ-EXT-009 状态真实区分 | P0 | TASK-009, TASK-021, TASK-025 | apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx | 部分证实 / MAC-PLUGIN-GUI-4B-001, MAC-EXTENSION-STOP-FAILURE-NATIVE-001 | 已安装未启用/休眠/运行/暂停/禁用/停止中/异常分别显示；停止超时仍显示占用资源，不因为面板消失标已停止 |
| REQ-EXT-010 轻量预设 | P0 | TASK-015, TASK-025 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src/components/RecoveryPanel.tsx, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx | 已证实 / MAC-EXTENSION-NATIVE-003, MAC-HOST-RECOVERY-PRESET-GUI-4B-001, MAC-CAPABILITY-PRESET-CONSOLIDATED-001 | 极简阅读、代码审查、项目开发、自定义可选择；默认代码审查不启动 Agent/终端；应用前列停止/新增能力；缺包不自动联网安装 |
| REQ-EXT-011 外部扩展真实闭环 | P0 | TASK-020 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx | 部分证实 / MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-PLUGIN-GUI-4B-001 | 本地安装只读更改列表扩展，命令首次激活读取真实状态；暂停/恢复/禁用/卸载后分别验证命令、视图、订阅、进程；不是内置假数据 |
| REQ-EXT-012 故障隔离 | P0 | TASK-020, TASK-025 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 部分证实 / MAC-PLUGIN-POLICY-001, MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-PLUGIN-GUI-4B-001 | 让可选扩展异常退出，宿主及独立文件/代码扩展仍响应；错误归属清楚，有脱敏日志与重试/停用，不无限自动重启 |
| REQ-WS-001 工作区组织 | P0 | TASK-003 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx | 已证实 / MAC-FILES-INTEGRATION-002, MAC-WORKSPACE-GUI-001 | 创建/改名/排序只改分组信息；默认工作区自动存在；删其他工作区明确迁移项目到默认工作区，不删除磁盘目录 |
| REQ-WS-002 添加本地项目与去重 | P0 | TASK-003, TASK-004 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileExplorer.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx | 已证实 / MAC-NATIVE-INITIAL-001, MAC-NATIVE-BOM-CRLF-001, MAC-FILES-INTEGRATION-001, MAC-FILES-INTEGRATION-002, MAC-WORKSPACE-ADD-ALIAS-READONLY-RESUME-001, MAC-WORKSPACE-PERMISSION-RECOVERY-SETTINGS-PROJECT-FAIL-001, MAC-WORKSPACE-NORMALIZATION-RECOVERY-FULL-001 | 同规范化路径再次添加定位已有项目；路径别名不产生冲突编辑；只读/非 Git 项目能打开；权限/路径失效有分别恢复入口 |
| REQ-WS-003 克隆仓库 | P1 | TASK-101 | apps/desktop/src-tauri/src/git.rs, apps/desktop/src-tauri/src/picker.rs, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/features/git/Modal.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/workflow.rs, apps/picker-service/Picker.swift | 已证实 / MAC-GIT-INTEGRATION-001, MAC-GIT-INTEGRATION-002, MAC-GIT-NATIVE-GUI-CANDIDATE6-FINAL-001, MAC-GIT-CLONE-RESIDUE-CANDIDATE6-FAIL-001, MAC-GIT-NATIVE-CANDIDATE7-001, MAC-CLONE-PARENT-PICKER-DISABLED-NATIVE-FAIL-001, MAC-GIT-CLONE-ABSENT-TRASH-WORDING-NATIVE-FAIL-001, MAC-GIT-CLONE-CANCEL-AUTH-PICKER-COMPOSITE-001 | 显示地址、目标、进度；非空目标不覆盖；成功才注册项目；取消展示本次新建残留目录，删除须显式选择；认证失败保留表单 |
| REQ-WS-004 项目操作 | P0 | TASK-003, TASK-007 | apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src/App.tsx | 部分证实 / MAC-PROJECT-MEMBERSHIP-001, MAC-WORKSPACE-REMOVE-RETAIN-DRAFT-001 | 固定只改排序、改名只改显示名；移除处理未保存与活跃服务后移除关联，不删源码；保留历史可在 F09 单独清理 |
| REQ-WS-005 切换与会话归属 | P0 | TASK-007, TASK-016 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/git.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/bridge.ts, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileRecovery.tsx, apps/desktop/src/features/editor/RecoveryNotice.tsx, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/editor/file-recovery.css, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/styles.css, apps/git-service/src/lib.rs, packages/editor/src/store.test.ts, packages/editor/src/store.ts, packages/editor/src/types.ts, packages/editor/tests/view-lifecycle.mjs, packages/pi-policy/horizon-policy.ts | 已证实 / MAC-FILES-INTEGRATION-001, MAC-NATIVE-PROJECT-SEARCH-001, MAC-FILES-INTEGRATION-002, MAC-RECOVERY-RELAUNCH-FAIL-001, MAC-CLOSE-STALE-SESSION-001, MAC-RECOVERY-RELAUNCH-002, MAC-SLEEP-QUIT-002, MAC-EDITOR-BLANK-001, MAC-EDITOR-VIEW-RESTORE-002, MAC-EDITOR-SLEEP-STALE-SCOPE-001, MAC-GIT-NATIVE-GUI-CANDIDATE6-FINAL-001, MAC-EDITOR-SLEEP-RETURN-CANDIDATE7-001, MAC-EDITOR-SLEEP-RECOVERY-SETTINGS-PROJECT-001, MAC-THREE-PROJECT-SCROLL-NATIVE-PICKER-FAIL-001, MAC-EDITOR-SCROLL-COMPONENT-NATIVE-REMAINDER-001, MAC-FILE-RECOVERY-COMPONENT-20261101-001, MAC-EDITOR-THREE-PROJECT-SCROLL-SELECTION-RETEST-001, MAC-OVERVIEW-CURRENT-PROJECT-STALE-LAUNCHER-NATIVE-FAIL-001, MAC-OVERVIEW-ACTIVATION-ORDER-NATIVE-RETEST-001, MAC-PI-TASK-HIDE-CROSSPROJECT-IDENTITY-NATIVE-001, MAC-SEARCH-SNAPSHOT-PARAMETERS-NATIVE-RETEST-001, MAC-PI-ALLOW-NATURAL-REVIEW-CROSSPROJECT-NATIVE-001, MAC-GIT-WRITE-STOP-SETTINGS-SESSION-COMPOSITE-001 | 三个项目往返后标签/选区/滚动/树展开/搜索/提交草稿/聊天各自恢复；切换不强制保存、不切分支、不把新项目上下文送给旧 Agent |
| REQ-WS-006 单根与仓库范围 | P0 | TASK-004, TASK-012 | apps/desktop/src-tauri/src/projects.rs, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/workflow.rs | 已证实 / MAC-GIT-INTEGRATION-002, MAC-WORKSPACE-ROOT-SCOPE-WORKTREE-FULL-001 | 一个项目一个根；父仓库/嵌套仓库明确提示并可单独添加；不无提示在父目录提交；不同 worktree 可独立添加 |
| REQ-FILE-001 按层文件树 | P0 | TASK-004 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileExplorer.tsx, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/settings/SettingsPanel.tsx, packages/editor/src/store.ts, packages/editor/tests/view-lifecycle.mjs | 已证实 / MAC-NATIVE-INITIAL-001, MAC-NATIVE-BOM-CRLF-001, MAC-FILES-INTEGRATION-001, MAC-FILES-INTEGRATION-002, MAC-EDITOR-BLANK-001, MAC-EDITOR-VIEW-RESTORE-002, MAC-EDITOR-FILEOPS-PREVIEW-PATHS-RESUME-001, MAC-FILE-TREE-NATIVE-REMAINDER-001 | 打开只读必要层；展开才读子项；单目录失败不清空全树；刷新保留有效选中；符号链接不无限递归；隐藏项可显式查看 |
| REQ-FILE-002 文件操作 | P0 | TASK-010 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/features/editor/FileExplorer.tsx, apps/desktop/src/features/editor/SearchPanel.tsx, packages/editor/src/store.ts | 已证实 / MAC-FILES-INTEGRATION-001, MAC-FILES-INTEGRATION-002, MAC-HOST-TRASH-NATIVE-CANDIDATE7-001, MAC-EDITOR-FILEOPS-PREVIEW-PATHS-RESUME-001, MAC-FILE-OPERATIONS-NATIVE-REMAINDER-001 | 新建/重命名不覆盖冲突路径；打开标签随改名更新；复制路径、系统中显示可用；删除走废纸篓，失败不降为永久删除；脏文件先处理 |
| REQ-FILE-003 标签与预览 | P0 | TASK-005 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileExplorer.tsx, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, packages/editor/src/store.ts | 已证实 / MAC-NATIVE-INITIAL-001, MAC-NATIVE-PROJECT-SEARCH-001, MAC-EDITOR-FILEOPS-PREVIEW-PATHS-RESUME-001, MAC-FILE-TABS-CLEAN-CLOSE-NATIVE-REMAINDER-001 | 单击复用一个干净预览标签；编辑即固定；同一文件定位已有标签；项目标签隔离；关闭干净标签不丢其他项目状态 |
| REQ-FILE-004 快速打开/命令 | P0 | TASK-011 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/tests/search_workflow.rs, apps/desktop/src/features/editor/SearchPanel.tsx, packages/editor/src/store.ts | 已证实 / MAC-SEARCH-INTEGRATION-001, MAC-SEARCH-INTEGRATION-002, MAC-EDITOR-QUICKOPEN-CANDIDATE7-001, MAC-EDITOR-FILEOPS-PREVIEW-PATHS-RESUME-001, MAC-QUICKOPEN-NATIVE-REMAINDER-001 | 文件搜索限定当前项目；`>` 切到命令；键盘选择、快捷键提示和取消返回焦点；未启用扩展的命令不暗中运行 |
| REQ-FILE-005 项目文本搜索 | P0 | TASK-011 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/tests/search_workflow.rs, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/SearchPanel.tsx, packages/editor/tests/quick-open.mjs | 已证实 / MAC-SEARCH-INTEGRATION-001, MAC-NATIVE-PROJECT-SEARCH-001, MAC-SEARCH-INTEGRATION-002, MAC-SEARCH-PENDING-STOP-SETTINGS-PROJECT-OBSERVATION-001, MAC-SEARCH-STOP-COMPONENT-RESUME-001, MAC-EDITOR-SEARCH-CONSOLIDATED-20261101-001 | 查询按文件分组并定位行；支持大小写/全词/正则/路径范围；新查询取消旧结果；错误正则不启动；无结果不清输入；明确搜索磁盘内容 |
| REQ-FILE-006 基础编辑 | P0 | TASK-005, TASK-006 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileExplorer.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, packages/editor/src/store.ts | 已证实 / MAC-NATIVE-INITIAL-001, MAC-NATIVE-BOM-CRLF-001, MAC-NATIVE-PROJECT-SEARCH-001, MAC-EDITOR-UNDO-DIRTY-001, MAC-FILES-INTEGRATION-002, MAC-APPEARANCE-ROUNDTRIP-001, MAC-EDITOR-IME-CANDIDATE7-001, MAC-EDITOR-BASIC-EDIT-RESUME-001, MAC-BASIC-EDIT-COPY-IME-NATIVE-REMAINDER-001 | UTF-8 文件可输入、撤销/重做、查找/替换、复制粘贴、保存；中文组合输入不拆坏字符；未知语言纯文本可读；无需 LSP |
| REQ-FILE-007 保存版本校验 | P0 | TASK-006 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileExplorer.tsx, apps/desktop/src/features/editor/RecoveryNotice.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/settings/SettingsPanel.tsx, packages/editor/src/store.test.ts, packages/editor/src/store.ts | 已证实 / MAC-NATIVE-INITIAL-001, MAC-FILES-INTEGRATION-001, MAC-FILES-INTEGRATION-002, MAC-RECOVERY-NATIVE-001, MAC-EDITOR-IME-CANDIDATE7-001, MAC-EDITOR-SAVE-VERSION-CONSOLIDATED-001 | 只在磁盘基线匹配时保存；失败保留全文/圆点；保存期间继续输入后新编辑仍脏；同文件重复保存不交错覆盖 |
| REQ-FILE-008 外部变更 | P0 | TASK-006, TASK-007 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/src/watch.rs, apps/desktop/src-tauri/tests/file_recovery.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileRecovery.tsx, apps/desktop/src/features/editor/file-recovery.css, packages/editor/src/store.test.ts, packages/editor/src/store.ts, packages/editor/src/types.ts, packages/editor/tests/view-lifecycle.mjs | 已证实 / MAC-FILES-INTEGRATION-001, MAC-FILES-INTEGRATION-002, MAC-EDITOR-EXTERNAL-CHANGE-CONSOLIDATED-20261101-001, MAC-FILE-RECOVERY-COMPONENT-20261101-001, MAC-FILE-RECOVERY-NATIVE-DISPATCH-20261101-001, MAC-FILE-RECOVERY-NATIVE-GUI-20261101-001 | 干净文件外变可刷新；脏文件外变保留双方并进入比较/重载/另存；自动保存暂停；删除仍保留打开内容，不能静默覆盖 |
| REQ-FILE-009 未保存与关闭 | P0 | TASK-006 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, packages/editor/src/store.test.ts, packages/editor/src/store.ts | 已证实 / MAC-NATIVE-PROJECT-SEARCH-001, MAC-EDITOR-UNDO-DIRTY-001, MAC-EDITOR-CLOSE-FOCUS-001, MAC-FILES-INTEGRATION-002, MAC-EDITOR-CLOSE-FOCUS-CANDIDATE7-002, MAC-EDITOR-CLOSE-CONSOLIDATED-20261101-001 | 保存/放弃本次编辑/取消语义独立；保存失败不关闭；取消恢复原上下文；放弃缓冲区不执行 Git 放弃更改；批量关闭逐项报告 |
| REQ-FILE-010 可选预览与基础结构 | P1 | TASK-031 | apps/desktop/src/App.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/Preview.tsx, packages/editor/src/store.ts, packages/plugins/src/runtime.ts | 已证实 / MAC-MARKDOWN-PREVIEW-CONSOLIDATED-CANDIDATE7-001, MAC-MARKDOWN-NARROW-NATIVE-PICKER-001 | 启用预览后 Markdown 分栏/标题定位可用，源码始终可读；脚本及默认远程资源禁用；暂停扩展释放预览，不启动语义服务 |
| REQ-FILE-011 大文件和二进制 | P0 | TASK-005, TASK-008 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, packages/editor/src/store.ts | 已证实 / MAC-FILES-INTEGRATION-001, MAC-FILES-INTEGRATION-002, MAC-EDITOR-LARGEFILES-CANDIDATE7-001, MAC-EDITOR-READONLY-REASON-CANDIDATE7-FAIL-001, MAC-EDITOR-LARGEFILES-CONSOLIDATED-20261101-001 | 10 MiB、50 MiB、100k 字符单行边界分别验证降级；显示大小、加载范围和只读原因；部分加载不可保存覆盖全文件；二进制可系统打开 |
| REQ-FILE-012 编码与换行 | P0 | TASK-005, TASK-006, TASK-015 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, packages/editor/src/store.ts | 已证实 / MAC-NATIVE-BOM-CRLF-001, MAC-FILES-INTEGRATION-001, MAC-FILES-INTEGRATION-002, MAC-EDITOR-ENCODING-CONSOLIDATED-20261101-001 | UTF-8 BOM、LF/CRLF、末行换行保存保持；新文件默认 UTF-8/LF；非支持编码只读提示，不乱码保存；配置变化不批量改写文件 |
| REQ-FILE-013 草稿与崩溃恢复 | P0 | TASK-007 | apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/src/watch.rs, apps/desktop/src-tauri/tests/file_recovery.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/RecoveryPanel.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileRecovery.tsx, apps/desktop/src/features/editor/RecoveryNotice.tsx, apps/desktop/src/features/editor/file-recovery.css, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, packages/editor/src/store.test.ts, packages/editor/src/store.ts, packages/editor/src/types.ts, packages/editor/tests/recovery-notice.mjs, packages/editor/tests/view-lifecycle.mjs | 部分证实 / MAC-FILES-INTEGRATION-001, MAC-FILES-INTEGRATION-002, MAC-RECOVERY-NATIVE-001, MAC-RECOVERY-RELAUNCH-FAIL-001, MAC-RECOVERY-RELAUNCH-002, MAC-HOST-RECOVERY-PRESET-GUI-4B-001, MAC-EDITOR-SLEEP-RETURN-CANDIDATE7-001, MAC-EDITOR-RECOVERY-STALE-CANDIDATE7-FAIL-001, MAC-EDITOR-SLEEP-RECOVERY-SETTINGS-PROJECT-001, MAC-EDITOR-CLEAN-UNDO-RECOVERY-NATIVE-PICKER-FAIL-001, MAC-RECOVERY-NOTICE-UNDO-COMPONENT-001, MAC-FILE-RECOVERY-COMPONENT-20261101-001, MAC-FILE-RECOVERY-NATIVE-DISPATCH-20261101-001, MAC-EDITOR-CLEAN-UNDO-RECOVERY-RETEST-001, MAC-FILE-RECOVERY-NATIVE-GUI-20261101-001, MAC-EDITOR-CHECKPOINT-CADENCE-AND-RELEASE-COMPONENT-001, MAC-CACHE-CLEAR-PRESERVES-UNRESOLVED-DRAFT-NATIVE-001 | 草稿按 PRD 节奏持久化；切换/休眠前确保恢复数据；模拟异常退出能恢复最后落盘文本；恢复先比较磁盘，不自动覆盖；清缓存不删未解决草稿 |
| REQ-GIT-001 Git 检测与状态 | P0 | TASK-012 | apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/DiffViewer.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/benchmark.py, apps/git-service/tests/workflow.rs | 部分证实 / MAC-NATIVE-GIT-001, MAC-GIT-INTEGRATION-001, MAC-GIT-INTEGRATION-002, MAC-GIT-PRESSURE-001, MAC-GIT-NATIVE-GUI-CANDIDATE6-FINAL-001, MAC-GIT-BRANCH-LIST-SAME-OID-NATIVE-FAIL-001, MAC-GIT-DETECTION-STAGED-HISTORY-NATIVE-001, MAC-GIT-BRANCH-LIST-SAME-OID-NATIVE-RETEST-001 | 缺 Git/非仓库/空仓库/detached HEAD 状态不同；可配置路径；展示仓库根/分支；失败快照标过期；停用 Git 扩展后不刷新 |
| REQ-GIT-002 双基线差异 | P0 | TASK-012 | apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/DiffViewer.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/features/git/Modal.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/benchmark.py, apps/git-service/tests/workflow.rs | 已证实 / MAC-NATIVE-GIT-001, MAC-GIT-STALE-DIFF-001, MAC-GIT-INTEGRATION-001, MAC-GIT-INTEGRATION-002, MAC-GIT-PRESSURE-001, MAC-GIT-NATIVE-GUI-CANDIDATE6-INITIAL-001, MAC-GIT-STALE-DIFF-CANDIDATE6-002, MAC-GIT-NATIVE-GUI-CANDIDATE6-FINAL-001, MAC-GIT-NATIVE-CANDIDATE7-001, MAC-GIT-DIFF-REBASE-EXISTING-COMPOSITE-001 | A→B 已暂存、B→C 未暂存样例同时正确；脏缓冲区 D 不混入磁盘 diff；未跟踪/删除/重命名/二进制/大 diff 有明确呈现；窄窗行内 |
| REQ-GIT-003 文件级暂存/取消 | P0 | TASK-013 | apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/DiffViewer.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/workflow.rs | 已证实 / MAC-NATIVE-GIT-001, MAC-GIT-INTEGRATION-001, MAC-GIT-INTEGRATION-002, MAC-GIT-NATIVE-GUI-CANDIDATE6-INITIAL-001, MAC-GIT-NATIVE-GUI-CANDIDATE6-FINAL-001, MAC-GIT-STAGING-CONSOLIDATED-001 | 暂存只取磁盘；脏文件明确保存后暂存/仅磁盘/取消；取消暂存不改磁盘；空仓库首次暂存可取消；已有部分暂存正确保留 |
| REQ-GIT-004 提交准确与失败恢复 | P0 | TASK-013 | apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/DiffViewer.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/workflow.rs | 已证实 / MAC-NATIVE-GIT-001, MAC-GIT-INTEGRATION-001, MAC-GIT-INTEGRATION-002, MAC-GIT-NATIVE-GUI-CANDIDATE6-INITIAL-001, MAC-GIT-COMMIT-CONSOLIDATED-001, MAC-GIT-DETECTION-STAGED-HISTORY-NATIVE-001 | 空说明/无暂存/冲突禁用；提交前范围变化须再次核对；提交只含已暂存；hooks/签名失败保留说明与真实状态；成功显示提交标识，不自动推送 |
| REQ-GIT-005 提交历史 | P1 | TASK-030 | apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/workflow.rs | 已证实 / MAC-GIT-INTEGRATION-001, MAC-GIT-INTEGRATION-002, MAC-GIT-NATIVE-GUI-CANDIDATE6-FINAL-001, MAC-GIT-HISTORY-CONSOLIDATED-001, MAC-GIT-DETECTION-STAGED-HISTORY-NATIVE-001 | 分页历史、提交详情及父提交差异可用；浅历史显示范围；读取历史不改当前分支、缓冲区或暂存区 |
| REQ-GIT-006 分支操作 | P0 | TASK-014 | apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/workflow.rs | 已证实 / MAC-GIT-INTEGRATION-001, MAC-GIT-INTEGRATION-002, MAC-GIT-NATIVE-GUI-CANDIDATE6-INITIAL-001, MAC-GIT-BRANCH-REMOTE-SAFETY-COMPOSITE-001 | 新分支显示起点，默认当前 HEAD；切换要求无脏缓冲区且磁盘/暂存干净；同名/锁失败可恢复；不自动 stash、丢弃或改分支 |
| REQ-GIT-007 获取/拉取/推送 | P0 | TASK-014 | apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/features/git/Modal.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/workflow.rs | 已证实 / MAC-GIT-INTEGRATION-001, MAC-GIT-INTEGRATION-002, MAC-GIT-NATIVE-GUI-CANDIDATE6-INITIAL-001, MAC-GIT-NATIVE-CANDIDATE7-001, MAC-GIT-BRANCH-REMOTE-SAFETY-COMPOSITE-001 | fetch 不改文件；pull 明示仅快进；push 明确 remote/branch，上游缺失先选择；非快进不自动 force；认证沿用系统流程；失败不丢本地改动 |
| REQ-GIT-008 最小冲突处理 | P0 | TASK-030 | apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/workflow.rs | 已证实 / MAC-GIT-INTEGRATION-001, MAC-GIT-INTEGRATION-002, MAC-GIT-NATIVE-GUI-CANDIDATE6-INITIAL-001, MAC-GIT-DIFF-REBASE-EXISTING-COMPOSITE-001 | 冲突列表与标记可定位，手动结果先保存再明确暂存标已解决；Git 仍冲突不能显示成功；外部 merge/rebase 模式可见并可外部处理 |
| REQ-GIT-009 放弃更改范围 | P0 | TASK-014 | apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/features/git/Modal.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/workflow.rs | 已证实 / MAC-GIT-INTEGRATION-001, MAC-GIT-INTEGRATION-002, MAC-GIT-NATIVE-GUI-CANDIDATE6-INITIAL-001, MAC-GIT-TRASH-CANDIDATE6-FAIL-001, MAC-GIT-NATIVE-CANDIDATE7-001, MAC-GIT-TRASH-RECOVERY-NATIVE-RETEST-001 | 对已跟踪文件恢复到暂存区，保留已暂存内容；未跟踪文件移废纸篓；显示清单与后果；先处理未保存；危险按钮不默认聚焦 |
| REQ-GIT-010 串行操作与取消核对 | P0 | TASK-012, TASK-013, TASK-014 | apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/workflow.rs | 部分证实 / MAC-GIT-INTEGRATION-001, MAC-GIT-INTEGRATION-002, MAC-GIT-NATIVE-GUI-CANDIDATE6-FINAL-001 | 同仓库写操作排队并重验，重复点击不重复提交；取消后核对 HEAD/暂存/远端再定结果；不把杀进程等同回滚，不自动删除未知锁 |
| REQ-AI-001 程序检测与连接配置 | P0 | TASK-017, TASK-032 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, packages/pi-policy/horizon-policy.ts, scripts/desktop/mac_metrics.py | 已证实 / MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-MAIN-SETTINGS-CONNECTION-DELETE-STALE-PANEL-NATIVE-FAIL-001, MAC-MAIN-SETTINGS-CONNECTION-CACHE-COMPONENT-RETEST-001, MAC-MAIN-SETTINGS-CONNECTION-CACHE-NATIVE-RETEST-001, MAC-PI-RUNTIME-DETECTION-AND-CONNECTION-STATE-COMPOSITE-001, MAC-PI-MAIN-CONNECTION-EXPLICIT-TEST-NATIVE-001, MAC-PI-AUTH-FAILURE-EXPLICIT-RETRY-NATIVE-001, MAC-PI-SYSTEM-SESSION-CREDENTIAL-OWNERSHIP-NATIVE-001 | Pi 显示受管/自有路径、版本、兼容范围；未安装/未配置/未验证/认证失败分别呈现；检测不生成请求或改用户全局配置；已配置不冒充已验证 |
| REQ-AI-002 上下文显式交付 | P0 | TASK-029 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, packages/pi-policy/horizon-policy.ts, scripts/test-pi-native.mjs, scripts/test-pi-rpc.mjs | 已证实 / MAC-PI-INTEGRATION-001, MAC-PI-INTEGRATION-002, MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-PI-CONTEXT-LINES-REMOVAL-HTTP-COMPOSITE-001 | 发送前显示项目、文件/行/差异基线；未保存文本标注来源；可移除；发送固定快照；不自动附整仓；附件范围与 Agent 实际访问范围分别说明 |
| REQ-AI-003 附件上限 | P1 | TASK-029 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, packages/pi-policy/horizon-policy.ts, scripts/test-pi-native.mjs, scripts/test-pi-rpc.mjs | 已证实 / MAC-PI-INTEGRATION-002, MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-PI-CONTEXT-BUDGET-CONSOLIDATED-001 | 20 文件/256 KiB 初始预算超限时要求删减或分批；不静默截断；不代替 Agent 改写记忆；无精确 token 计数时标估算 |
| REQ-AI-004 真实消息与模式 | P0 | TASK-018, TASK-033 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, packages/pi-policy/horizon-policy.ts, scripts/test-pi-native.mjs, scripts/test-pi-policy.mjs, scripts/test-pi-rpc.mjs | 已证实 / MAC-PI-INTEGRATION-001, MAC-PI-STREAM-001, MAC-PI-INTEGRATION-002, MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-PI-MESSAGE-MODE-CONSOLIDATED-001 | 同会话不并发/排队新回合；聊天关闭项目工具与自动资源发现；收到输入成功不等于完成，重试/压缩结束后才判终态；普通 stdout 不伪造成结构化记录 |
| REQ-AI-005 取消、断连与停止 | P0 | TASK-018, TASK-021 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, packages/pi-policy/horizon-policy.ts, scripts/desktop/mac_metrics.py, scripts/test-pi-native.mjs, scripts/test-pi-rpc.mjs | 已证实 / MAC-PI-INTEGRATION-001, MAC-PI-INTEGRATION-002, MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-PI-UNACKNOWLEDGED-STOP-OWNED-REAP-NATIVE-001, MAC-PI-DISCONNECT-MANUAL-RESUME-COMPOSITE-001, MAC-PI-TWO-INSTANCE-STOP-CHECKPOINT-CLASSIFICATION-NATIVE-001 | 停止清理待发队列与授权并请求中断，结束证据后才停止；超时可结束自有进程；断连先核对原任务；保留已有修改，不稍后续跑旧输入 |
| REQ-AI-006 启动/恢复与能力表 | P0 | TASK-017, TASK-018 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, packages/pi-policy/horizon-policy.ts, scripts/test-pi-native.mjs, scripts/test-pi-policy.mjs, scripts/test-pi-rpc.mjs | 已证实 / MAC-PI-INTEGRATION-001, MAC-PI-STREAM-001, MAC-PI-INTEGRATION-002, MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-PI-CAPABILITIES-RESUME-CONSOLIDATED-001 | 固定 Pi 版本的 RPC 消息/授权/取消/恢复逐项验证；首版附着任意 TUI 为不支持；运行时与实例归属可见；空闲退出可恢复会话但不重发任务 |
| REQ-AI-007 授权转接 | P0 | TASK-033 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/styles.css, packages/pi-policy/horizon-policy.ts, scripts/test-pi-native.mjs, scripts/test-pi-policy.mjs, scripts/test-pi-rpc.mjs | 已证实 / MAC-PI-INTEGRATION-001, MAC-PI-STREAM-001, MAC-PI-INTEGRATION-002, MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-PI-AUTHORIZATION-CONSOLIDATED-001, MAC-PI-PERMISSION-EXPIRED-WITHOUT-WRITE-NATIVE-001, MAC-PI-ALLOW-NATURAL-REVIEW-CROSSPROJECT-NATIVE-001 | Pi 原生不等于逐操作审批；受控任务工具在执行前请求，显示动作/路径/目录/来源；拒绝无副作用，过期/断桥拒绝；未知工具不可绕过；不宣称 OS 沙箱 |
| REQ-AI-008 修改审查与版本检查 | P0 | TASK-029, TASK-107 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, packages/pi-policy/horizon-policy.ts, scripts/test-pi-native.mjs, scripts/test-pi-rpc.mjs | 已证实 / MAC-PI-INTEGRATION-001, MAC-PI-INTEGRATION-002, MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-PI-WRITE-REVIEW-STALE-UNBORN-COMPOSITE-001 | Pi 任务副本含原磁盘改动及用户选取的未保存快照，不改原分支/index；无有效 HEAD 只聊天；应用检查原磁盘/编辑版本，打开文档保留可撤销未保存状态；不自动提交 |
| REQ-AI-009 不自研 Agent | P0 | TASK-017, TASK-018, TASK-028, TASK-033 | apps/desktop/package.json, apps/desktop/src-tauri/Cargo.toml, apps/desktop/src-tauri/src/agent.rs, packages/pi-policy/horizon-policy.ts, packages/pi-policy/package.json, scripts/test-pi-native.mjs, scripts/test-pi-rpc.mjs | 已证实 / MAC-PI-INTEGRATION-001, MAC-PI-ARCHITECTURE-001, MAC-PI-INTEGRATION-002 | 实现与依赖检查确认规划、工具执行循环、记忆由外部工具承担；Horizon 仅适配；无“模型 API 自动循环执行工具”路径；不假设统一 ACP |
| REQ-AI-010 项目会话与恢复 | P0 | TASK-007, TASK-018 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/processes/index.tsx, packages/pi-policy/horizon-policy.ts, scripts/desktop/mac_metrics.py, scripts/test-pi-native.mjs, scripts/test-pi-rpc.mjs | 已证实 / MAC-PI-INTEGRATION-001, MAC-PI-INTEGRATION-002, MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-MAIN-SETTINGS-CONNECTION-CACHE-COMPONENT-RETEST-001, MAC-MAIN-SETTINGS-CONNECTION-CACHE-NATIVE-RETEST-001, MAC-PI-TASK-HIDE-CROSSPROJECT-IDENTITY-NATIVE-001, MAC-PI-ALLOW-NATURAL-REVIEW-CROSSPROJECT-NATIVE-001, MAC-PI-TWO-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-TWO-INSTANCE-STOP-CHECKPOINT-CLASSIFICATION-NATIVE-001, MAC-PI-SESSION-RECOVERY-OWNERSHIP-COMPOSITE-001 | 切换项目不改变旧目录/上下文；每项目一个任务、全局最多2个运行实例且不自动启动第二个；恢复不重放命令；删除 Horizon 记录不声称删除外部认证/历史 |
| REQ-AI-011 Pi 与其他 Agent 分期 | P0 | TASK-017, TASK-018, TASK-022, TASK-028, TASK-032, TASK-033 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, scripts/desktop/mac_metrics.py | 部分证实 / MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-PI-SINGLE-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-TWO-INSTANCE-FIXED-RESOURCE-12ED-001 | 本次 macOS 发布中 Pi 通过本机版本/策略/资源门槛后才标发布默认；Windows/macOS x64 保留覆盖计划及未实测声明，不阻塞本次 macOS 交付；Codex/Claude 首期只交付能力/接口设计，不出现假可用入口；Pi 未通过不转为自研 Agent 或悄然扩大首期适配 |
| REQ-AI-012 运行时安装与所有权 | P0 | TASK-032 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, scripts/desktop/mac_metrics.py, scripts/desktop/sample_macos.py | 已证实 / MAC-PI-FIXED-STREAM-CANDIDATE6-001, MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-PI-RUNTIME-CORRUPT-ARCHIVE-PRODUCTION-TRANSACTION-001, MAC-PI-FIXED-RUNTIME-INSTALL-OWNERSHIP-COMPOSITE-001 | 首次使用明确安装/定位；显示固定版本/来源/大小，校验失败不激活；升级不切正在运行实例；卸载只清无人使用的受管运行时，不删用户全局 Pi；不用时进程为零 |
| REQ-AI-013 模型连接与凭据归属 | P0 | TASK-017, TASK-033 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/credentials_workflow.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/processes/index.tsx, packages/pi-policy/horizon-policy.ts, scripts/desktop/mac_metrics.py, scripts/test-pi-native.mjs, scripts/test-pi-rpc.mjs | 已证实 / MAC-PI-INTEGRATION-001, MAC-PI-INTEGRATION-002, MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-KEYRING-EXPORT-NATIVE-CANDIDATE7-001, MAC-MAIN-SETTINGS-CONNECTION-DELETE-STALE-PANEL-NATIVE-FAIL-001, MAC-MAIN-SETTINGS-CONNECTION-CACHE-COMPONENT-RETEST-001, MAC-MAIN-SETTINGS-CONNECTION-CACHE-NATIVE-RETEST-001, MAC-PI-MAIN-CONNECTION-EXPLICIT-TEST-NATIVE-001, MAC-PI-AUTH-FAILURE-EXPLICIT-RETRY-NATIVE-001, MAC-PI-SYSTEM-SESSION-CREDENTIAL-OWNERSHIP-NATIVE-001, MAC-PI-SESSION-CREDENTIAL-EDIT-METADATA-NATIVE-FAIL-001, MAC-PI-CREDENTIAL-OWNERSHIP-SETTINGS-COMPOSITE-001 | 配置 provider/协议/endpoint/model，测试不发项目内容；API key 系统存储且不进入任务命令环境/日志；Pi OAuth 另标归属；模型调用由 Pi 执行，本地服务不被擅自启动/停止 |
| REQ-LAUNCH-001 可选扩展与项目入口 | P0 | TASK-025, TASK-026 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css | 部分证实 / MAC-LAUNCH-GUI-CANDIDATE5-001, MAC-PROCESSES-CANDIDATE6-REGRESSION-001, MAC-WORKSPACE-ADD-ALIAS-READONLY-RESUME-001 | 快速启动独立扩展，可停用/卸载；工作台只显示方案选择与启动/停止；详细配置进设置；打开项目不启动进程 |
| REQ-LAUNCH-002 发现但不执行 | P0 | TASK-026 | apps/desktop/src-tauri/src/processes.rs, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css | 部分证实 / MAC-PROCESSES-SERVICE-001, MAC-LAUNCH-GUI-CANDIDATE5-001 | 用户点击发现后只读取脚本声明并显示原始命令/来源/目录；必须选择和保存；检测、添加/克隆项目均不执行脚本或自动安装依赖 |
| REQ-LAUNCH-003 保存运行方案 | P0 | TASK-026 | apps/desktop/src-tauri/src/processes.rs, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css | 部分证实 / MAC-PROCESSES-SERVICE-001, MAC-LAUNCH-GUI-CANDIDATE5-001, MAC-PROCESSES-NATIVE-CANDIDATE7-001 | 可保存名称、所需扩展、多个进程、参数/显式 shell、目录、环境引用、顺序/依赖、就绪条件、超时、URL；拒绝依赖环；运行实例持有配置快照 |
| REQ-LAUNCH-004 启动预检与授权 | P0 | TASK-026, TASK-027 | apps/desktop/src-tauri/src/processes.rs, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css | 部分证实 / MAC-PROCESSES-SERVICE-001, MAC-LAUNCH-GUI-CANDIDATE5-001, MAC-PROCESSES-NATIVE-CANDIDATE7-001 | 缺扩展、全局禁用、暂停、无程序、端口占用分别可处理；不静默启用/安装/杀别的进程；命令或脚本来源变化需重新审阅；未变方案可一键复用授权 |
| REQ-LAUNCH-005 多进程与就绪 | P0 | TASK-027 | apps/desktop/src-tauri/src/processes.rs, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css | 部分证实 / MAC-PROCESSES-SERVICE-001, MAC-LAUNCH-GUI-CANDIDATE5-001, MAC-PROCESSES-NATIVE-CANDIDATE7-001 | 两进程按依赖启动并显示各自 PID/状态/日志；一次性命令成功退出与常驻就绪区分；无探针只标运行未验证；不能把旧进程端口响应当本次就绪 |
| REQ-LAUNCH-006 失败策略 | P0 | TASK-027 | apps/desktop/src-tauri/src/processes.rs, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css | 已证实 / MAC-PROCESSES-SERVICE-001, MAC-LAUNCH-GUI-CANDIDATE5-001, MAC-PROCESSES-NATIVE-CANDIDATE7-001, MAC-PROCESS-CONTROLLED-STOP-FAILURE-001, MAC-LAUNCH-FAILURE-POLICY-CONSOLIDATED-001 | 必需进程失败后不启动其依赖者，默认停止本次新启动进程；原有外部进程不受影响；停止失败显示部分失败仍运行；保留排错可显式配置 |
| REQ-LAUNCH-007 停止与重启 | P0 | TASK-027 | apps/desktop/src-tauri/src/processes.rs, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css | 部分证实 / MAC-PROCESSES-SERVICE-001, MAC-LAUNCH-GUI-CANDIDATE5-001, MAC-PROCESSES-NATIVE-CANDIDATE7-001, MAC-PROCESS-CONTROLLED-STOP-FAILURE-001 | 按依赖逆序停止自有进程树，停止未确认不启动重复实例；重启使用已保存配置并展示变更；重复点击定位/合并现有操作；不回滚脚本副作用 |
| REQ-LAUNCH-008 打开终端与 URL | P0 | TASK-027, TASK-102 | apps/desktop/src-tauri/src/processes.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css | 部分证实 / MAC-LAUNCH-GUI-CANDIDATE5-001, MAC-PROCESSES-CANDIDATE6-REGRESSION-001, MAC-PROCESSES-NATIVE-CANDIDATE7-001 | 终端定位本次进程；只有明确保存的 URL 可打开；默认手动，选择自动后仅就绪时开一次；不自动打开任意日志 URL；无终端可看日志 |
| REQ-LAUNCH-009 所有权与跨项目生命周期 | P0 | TASK-021, TASK-027 | apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 部分证实 / MAC-PROCESSES-SERVICE-001, MAC-PLUGIN-POLICY-001, MAC-LAUNCH-GUI-CANDIDATE5-001 | 切换/隐藏不停止，活跃方案阻止休眠；退出/禁用先处理自有组；结束仅释放本次使用权，无其他使用者/人为改设置才恢复扩展原策略；不误杀共享/外部进程 |
| REQ-LAUNCH-010 删除与平台差异 | P1 | TASK-026, TASK-027 | apps/desktop/src-tauri/src/processes.rs, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css | 部分证实 / MAC-PROCESSES-SERVICE-001, MAC-LAUNCH-GUI-CANDIDATE5-001, MAC-PROCESSES-NATIVE-CANDIDATE7-001, MAC-PROCESS-CONTROLLED-STOP-FAILURE-001 | 活跃方案删除前停止或取消；只删配置不删代码；Windows/macOS 命令差异启动前可见；导入方案默认未授权，密钥导出脱敏 |
| REQ-RUN-001 隐藏不停止 | P0 | TASK-009, TASK-021 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css | 部分证实 / MAC-TERMINAL-GUI-CANDIDATE5-001, MAC-PI-TASK-HIDE-CROSSPROJECT-IDENTITY-NATIVE-001 | 隐藏 AI/终端/Git 或进入专注后运行任务继续且项目有标记；再开定位原实例，不重复启动；空面板展开不启动 Agent |
| REQ-RUN-002 停止有真实结果 | P0 | TASK-002, TASK-021, TASK-027, TASK-102 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/tests/search_workflow.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/benchmark.py, scripts/desktop/mac_metrics.py | 部分证实 / MAC-DEBUG-QUIT-001, MAC-SEARCH-INTEGRATION-001, MAC-GIT-PRESSURE-001, MAC-GIT-CANCEL-PROBE-001, MAC-PROCESSES-SERVICE-001, MAC-SEARCH-INTEGRATION-002, MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-TERMINAL-GUI-CANDIDATE5-001, MAC-EXTENSION-STOP-FAILURE-NATIVE-001, MAC-PROCESS-CONTROLLED-STOP-FAILURE-001, MAC-PI-UNACKNOWLEDGED-STOP-OWNED-REAP-NATIVE-001 | 自有服务收到停止后显示停止中；退出/协议确认后才完成；超时可进一步处理；断开附着不杀外部进程；不把停止等同撤回 |
| REQ-RUN-003 项目休眠与唤醒 | P0 | TASK-007, TASK-021 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/SleepingProjectPage.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/RecoveryNotice.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/plugins/service.test.ts, apps/desktop/src/features/plugins/service.ts, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/styles.css, packages/editor/src/store.test.ts, packages/editor/src/store.ts, packages/editor/tests/chunked-wake.mjs | 部分证实 / MAC-FILES-INTEGRATION-002, MAC-CLOSE-STALE-SESSION-001, MAC-SLEEP-QUIT-002, MAC-EDITOR-SLEEP-STALE-SCOPE-001, MAC-EDITOR-SLEEP-RETURN-CANDIDATE7-001, MAC-EDITOR-SLEEP-RECOVERY-SETTINGS-PROJECT-001, MAC-EDITOR-AUTOSAVE-AUTOSLEEP-RESUME-001, MAC-AUTOSLEEP-WAKE-NATIVE-REMAINDER-001, MAC-CHUNKED-SLEEP-WAKE-RECOVERY-NATIVE-FAIL-001, MAC-CHUNKED-WAKE-LIFECYCLE-COMPONENT-20261101-001, MAC-CHUNKED-WAKE-MISSING-AND-QUIT-RETEST-001, MAC-CHUNKED-VALID-WAKE-FIRST-READ-FAIL-001, MAC-CHUNKED-VALID-WAKE-AND-QUIT-RETEST-001, MAC-APPEARANCE-MAIN-SLEEP-G03-EIGHT-LAYOUT-RETEST-001 | 后台 5 分钟无阻止项可休眠；监听/扫描/可恢复服务停止；未落盘草稿、活跃进程阻止；唤醒重验磁盘；手动暂停/禁用不被唤醒覆盖 |
| REQ-RUN-004 关闭/退出 | P0 | TASK-007, TASK-021, TASK-025 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/picker.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/components/SleepingProjectPage.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/RecoveryNotice.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/plugins/service.ts, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/styles.css, apps/picker-service/Picker.swift, packages/editor/src/store.ts, scripts/desktop/mac_metrics.py, scripts/desktop/sample_macos.py | 已证实 / MAC-DEBUG-QUIT-001, MAC-RECOVERY-NATIVE-001, MAC-RECOVERY-RELAUNCH-FAIL-001, MAC-CLOSE-STALE-SESSION-001, MAC-RECOVERY-RELAUNCH-002, MAC-SLEEP-QUIT-002, MAC-LIFECYCLE-CANDIDATE5-001, MAC-TERMINAL-GUI-CANDIDATE5-001, MAC-NORMAL-QUIT-CANDIDATE7-001, MAC-WORKSPACE-MISSING-ROOT-EXIT-SETTINGS-PROJECT-FAIL-001, MAC-NORMAL-QUIT-SETTINGS-PROJECT-IDENTITIES-001, MAC-NATIVE-PICKER-CMDQ-FAIL-001, MAC-WORKSPACE-MISSING-ROOT-NORMAL-QUIT-001, MAC-NATIVE-PICKER-CMDQ-SCOPE-OBSERVATION-001, MAC-NATIVE-PICKER-MENU-QUIT-CHAIN-001, MAC-NATIVE-PICKER-EDITOR-LIFECYCLE-NORMAL-QUIT-001, MAC-EDITOR-THREE-PROJECT-SCROLL-SELECTION-RETEST-001, MAC-FILE-RECOVERY-NORMAL-QUIT-20261101-001, MAC-CHUNKED-WAKE-MISSING-AND-QUIT-RETEST-001, MAC-CHUNKED-VALID-WAKE-AND-QUIT-RETEST-001, MAC-OWNED-PTY-STOP-AND-NORMAL-QUIT-AFTER-MAIN-TOUR-001, MAC-UNIFIED-QUIT-CANCEL-SAVEFAIL-REAP-REOPEN-COMPOSITE-001 | 退出列全部未保存与自有运行组/终端/Agent；保存失败或取消留在应用；自有进程停妥，附着断开；重启不自动执行原命令 |
| REQ-RUN-005 按需终端 | P0 | TASK-102 | apps/desktop/src-tauri/src/processes.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/ResizeHandle.tsx, apps/desktop/src/components/SleepingProjectPage.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/styles.css | 已证实 / MAC-PROCESSES-SERVICE-001, MAC-TERMINAL-GUI-CANDIDATE5-001, MAC-TERMINAL-CONSOLIDATED-001, MAC-PROCESSES-CANDIDATE6-REGRESSION-001, MAC-TERMINAL-EXPLICIT-STOP-AFTER-LAYOUT-50-NATIVE-001, MAC-TERMINAL-CLOSED-REOPEN-NOPTY-NATIVE-FAIL-001, MAC-TERMINAL-EXIT-THEME-PRODUCTION-COMPONENT-001, MAC-TERMINAL-CLOSED-HISTORY-REOPEN-NATIVE-RETEST-001, MAC-OWNED-PTY-STOP-AND-NORMAL-QUIT-AFTER-MAIN-TOUR-001 | 首次新建才启动 shell，显示项目/目录；中文输入输出与 resize 可用；切项目不改旧 cwd；面板隐藏继续，结束会话结束受管进程；日志有界 |
| REQ-RUN-006 有界资源 | P0 | TASK-005, TASK-007, TASK-011, TASK-021, TASK-022 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/search_workflow.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/benchmark.py, packages/editor/src/store.ts, packages/pi-policy/horizon-policy.ts, scripts/test-pi-native.mjs, scripts/test-pi-policy.mjs, scripts/test-pi-rpc.mjs | 已证实 / MAC-SEARCH-INTEGRATION-001, MAC-GIT-PRESSURE-001, MAC-PROCESSES-SERVICE-001, MAC-SEARCH-INTEGRATION-002, MAC-PI-STREAM-001, MAC-PI-INTEGRATION-002, MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-RESOURCE-BOUNDS-CONSOLIDATED-20261101-001 | 搜索 10,000 匹配截断可见；干净文档 20 份/64 MiB 初始上限可验证；聊天/终端/日志有界；未保存不淘汰；无伪造内存仪表 |
| REQ-SET-001 全局与项目继承 | P0 | TASK-003, TASK-015 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileExplorer.tsx, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/styles.css | 已证实 / MAC-NATIVE-INITIAL-001, MAC-APPEARANCE-INHERIT-001, MAC-PLUGIN-GUI-4B-001, MAC-SETTINGS-GLOBAL-SCOPE-AND-PROJECT-SELECTOR-001, MAC-APPEARANCE-GLOBAL-FONTS-PROJECT-BEHAVIOR-NATIVE-001, MAC-SETTINGS-EXACT-INDENT-AND-WRAP-INHERITANCE-NATIVE-001, MAC-SAVE-DELAY-RESET-AND-INHERITANCE-COMPOSITE-NATIVE-001 | 允许项目覆盖的编辑与仓库行为遵循默认→全局→项目，每覆盖项有来源与“使用全局设置”；全局缩进宽度 2→4、A 覆盖 8 时 A 不变，使用全局设置后 A=4；外观与字体仅全局共用，没有隐含工作区层 |
| REQ-SET-002 布局与会话分离 | P0 | TASK-009, TASK-015 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/styles.css, packages/appearance/src/index.ts | 已证实 / MAC-APPEARANCE-INHERIT-001, MAC-SETTINGS-GLOBAL-SCOPE-AND-PROJECT-SELECTOR-001, MAC-APPEARANCE-LAYOUT-50-NATIVE-001, MAC-APPEARANCE-GLOBAL-FONTS-PROJECT-BEHAVIOR-NATIVE-001, MAC-APPEARANCE-GEOMETRY-INPUT-PERSIST-NATIVE-001, MAC-LAYOUT-SESSION-SEPARATION-EXISTING-EVIDENCE-COMPOSITE-001 | 布局插件/该布局尺寸全局共用，拖动更新全局首选值；显示/隐藏和光标归会话；切预设不重建文档/发请求；专注退出恢复原布局 |
| REQ-SET-003 编辑偏好与自动保存 | P0 | TASK-015 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, packages/editor/src/store.ts | 已证实 / MAC-SETTINGS-GLOBAL-SCOPE-AND-PROJECT-SELECTOR-001, MAC-EDITOR-AUTOSAVE-AUTOSLEEP-RESUME-001, MAC-IME-AUTOSAVE-PAUSE-NATIVE-REMAINDER-001, MAC-APPEARANCE-GLOBAL-FONTS-PROJECT-BEHAVIOR-NATIVE-001, MAC-EDITOR-PREFERENCES-COMPOSITE-NATIVE-CLOSED-001 | 字体全局共用，缩进/折行可项目覆盖；默认自动保存关；开启延迟保存不立刻批量写已有脏文件；IME/外部冲突期间暂停，不暗改换行 |
| REQ-SET-004 Agent 设置范围 | P0 | TASK-017 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/processes/index.tsx | 已证实 / MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-PI-SESSION-CREDENTIAL-EDIT-METADATA-NATIVE-FAIL-001, MAC-PI-CREDENTIAL-OWNERSHIP-SETTINGS-COMPOSITE-001 | 运行时→模型连接两层；全局配置与项目引用分离，删引用列影响；Pi provider 配置与OAuth/系统密钥归属清楚；未支持字段不伪造；检测/验证/运行分开 |
| REQ-SET-005 Git 偏好 | P1 | TASK-015 | apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/git-service/src/lib.rs | 已证实 / MAC-GIT-WRITE-STOP-SETTINGS-SESSION-COMPOSITE-001 | Git 路径/差异/刷新来源可见；自动 fetch 默认关；身份沿用仓库配置；改设置不改变运行中 Git 命令，拉取策略显示明确 |
| REQ-SET-006 快捷键 | P1 | TASK-011, TASK-015 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx | 已证实 / MAC-EDITOR-QUICKOPEN-CANDIDATE7-001, MAC-SETTINGS-SHORTCUTS-NATIVE-MACOS-001 | 按操作搜索、录入、冲突显示替换/取消、单项恢复默认；macOS Cmd 与 Windows Ctrl 显示正确，鼠标与键盘触发同一动作 |
| REQ-SET-007 表单有效性与保存 | P0 | TASK-015, TASK-017, TASK-026 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/components/UnsavedChanges.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css, apps/desktop/src/features/settings/SettingsPanel.tsx | 已证实 / MAC-FILES-INTEGRATION-001, MAC-FILES-INTEGRATION-002, MAC-LAUNCH-GUI-CANDIDATE5-001, MAC-PROCESSES-CANDIDATE6-REGRESSION-001, MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-UNSAVED-SETTINGS-FORM-CLOSE-SOURCE-FAIL-001, MAC-UNSAVED-SETTINGS-FORM-SAVE-DISCARD-NATIVE-COMPOSITE-001 | 偏好即时生效，连接/启动方案显式保存；无效表单不破坏上一配置；关闭未保存表单可继续编辑，代码内容不受影响 |
| REQ-SET-008 数据清理与导出 | P0 | TASK-015 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/credentials_workflow.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/components/RecoveryPanel.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/features/settings/diagnostics.ts | 部分证实 / MAC-HOST-RECOVERY-PRESET-GUI-4B-001, MAC-DIAGNOSTIC-EXPORT-001, MAC-KEYRING-EXPORT-NATIVE-CANDIDATE7-001, MAC-DIAGNOSTICS-GUI-CANDIDATE7-002, MAC-WORKSPACE-REMOVE-RETAIN-DRAFT-001, MAC-CACHE-CLEAR-PRESERVES-UNRESOLVED-DRAFT-NATIVE-001, MAC-SETTINGS-EXPORT-FROZEN-PREVIEW-NATIVE-001, MAC-PI-SELECTIVE-CREDENTIAL-HISTORY-CLEAR-NATIVE-001 | 设置导出默认无密钥/正文/绝对路径；缓存、聊天、草稿、凭据可分开清理；未解决草稿不作缓存删除；外部 Agent 数据未清理须说明 |
| REQ-UI-001 默认界面聚焦 | P0 | TASK-009, TASK-015, TASK-025 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileExplorer.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx | 已证实 / MAC-NATIVE-INITIAL-001, MAC-PROCESSES-CANDIDATE6-REGRESSION-001, MAC-DEFAULT-WORKBENCH-CONSOLIDATED-001 | 默认附带扩展启用时主界面显示项目/文件/代码，AI/终端收起；配置集中设置；快速启动只保留紧凑入口；无需登录即可阅读 |
| REQ-UI-002 共用主题行为 | P0 | TASK-009, TASK-019 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/SleepingProjectPage.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/editor.css, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/features/settings/settings.css, apps/desktop/src/styles.css, packages/plugins/builtins, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 部分证实 / MAC-PLUGIN-POLICY-001, MAC-APPEARANCE-ROUNDTRIP-001, MAC-APPEARANCE-B01-SETTINGS-PROJECT-REVIEW-001, MAC-TERMINAL-EXIT-THEME-PRODUCTION-COMPONENT-001, MAC-APPEARANCE-MAIN-MIST-PAPER-VISUAL-RETEST-001, MAC-APPEARANCE-MAIN-ORBIT-GRAPHITE-VISUAL-RETEST-001, MAC-APPEARANCE-MAIN-CELADON-IRIS-VISUAL-RETEST-001, MAC-APPEARANCE-MAIN-SAND-AURORA-VISUAL-RETEST-001, MAC-APPEARANCE-MAIN-SLEEP-G03-EIGHT-LAYOUT-RETEST-001, MAC-SHARED-PROJECT-FORM-AND-EDITOR-OVERLAY-REPAIR-COMPOSITE-001 | 八套布局共用浅深主题、密度与字体；第二套主题资源不改业务代码；同一编辑/Git/Agent 状态在主题间语义一致；八套布局插件与独立主题全部交付 |
| REQ-UI-003 窄窗与缩放 | P0 | TASK-008, TASK-009 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/components/UnsavedChanges.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/styles.css, packages/editor/src/store.ts | 部分证实 / MAC-MARKDOWN-NARROW-NATIVE-PICKER-001, MAC-APPEARANCE-NARROW-SETTINGS-NATIVE-001, MAC-NATIVE-PAGE-ZOOM-200-REACHABILITY-PARTIAL-001, MAC-PAGE-ZOOM-200-HEADING-NATIVE-RETEST-001, MAC-NARROW-AI-ONBOARDING-SEARCH-FOCUS-NATIVE-001 | 窄窗侧栏浮层/AI 覆盖、diff 行内；关键操作可达；长中文名、200% 字体及 Windows 125%/150% 缩放不遮挡主要内容 |
| REQ-UI-004 键盘与可访问状态 | P0 | TASK-009, TASK-015 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/git.rs, apps/desktop/src-tauri/src/picker.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/components/UnsavedChanges.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/agent.css, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/editor/editor.css, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/features/git/git.css, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/styles.css, apps/git-service/src/lib.rs, apps/picker-service/Picker.swift | 失败 / MAC-GIT-NESTED-MODAL-CANDIDATE6-FAIL-001, MAC-EDITOR-CLOSE-FOCUS-CANDIDATE7-002, MAC-EDITOR-QUICKOPEN-CANDIDATE7-001, MAC-NATIVE-PICKER-PRODUCT-LIFECYCLE-001, MAC-NATIVE-PICKER-CMDQ-FAIL-001, MAC-NATIVE-PICKER-CMDQ-SCOPE-OBSERVATION-001, MAC-NATIVE-PICKER-MENU-QUIT-CHAIN-001, MAC-APPEARANCE-REAL-IME-BASIC-NATIVE-001, MAC-REDUCED-MOTION-PAGER-NAMES-COMPONENT-SOURCE-001, MAC-REDUCED-MOTION-SETTING-NATIVE-COMPOSITE-001, MAC-NARROW-QUICK-OPEN-NAME-NATIVE-FAIL-001, MAC-UNSAVED-FORM-CONFIRMATION-AX-NATIVE-FAIL-001, MAC-NARROW-AI-ONBOARDING-SEARCH-FOCUS-NATIVE-001, MAC-GIT-SINGLE-MODAL-FOCUS-NATIVE-RETEST-001 | 核心操作键盘可达；弹窗聚焦与恢复正确；图标有名称；圆点/M/冲突不只靠颜色；减少动画有效；Esc 不暗中停止任务 |
| REQ-UI-005 流程映射完整 | P1 | TASK-016, TASK-021, TASK-024 | design/SCREEN_INDEX.md, design/source/app.js, design/source/screens.json, docs/implementation/TRACEABILITY.md, docs/ux/INTERACTION_SPEC.md | 已证实 / MAC-FLOW-MAPPING-001 | 打开项目、Git 交付、外部 Agent 审查、扩展恢复、快速启动五条路径均能追到需求/页面/失败恢复；新增 ID 更新映射不重排需求编号 |
| REQ-UI-006 布局均为插件 | P0 | TASK-034, TASK-035 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx | 部分证实 / MAC-LAYOUT-APPLY-FAIL-001, MAC-APPEARANCE-ROUNDTRIP-001 | 八套预装布局经相同安装/启停/卸载接口；换布局不换主题；停用当前布局有替代或宿主恢复页 |
| REQ-UI-007 区域尺寸设置 | P0 | TASK-036 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/ResizeHandle.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx | 部分证实 / MAC-APPEARANCE-INHERIT-001, MAC-SETTINGS-GLOBAL-SCOPE-AND-PROJECT-SELECTOR-001, MAC-APPEARANCE-GEOMETRY-INPUT-PERSIST-NATIVE-001, MAC-APPEARANCE-GEOMETRY-ESC-AX-NATIVE-FAIL-001, MAC-APPEARANCE-GEOMETRY-DOUBLECLICK-NATIVE-FAIL-001, MAC-RESIZE-GEOMETRY-PRODUCTION-COMPONENT-001, MAC-TERMINAL-CLOSED-HISTORY-REOPEN-NATIVE-RETEST-001, MAC-SIDEBAR-ORDINARY-ESC-SYNCHRONIZED-NATIVE-RETEST-001, MAC-SIDEBAR-DOUBLECLICK-DEFAULT-NATIVE-RETEST-001 | 侧栏/顶部/标签/辅助/底部/状态区依布局可调；范围校验、键盘拖动、重启恢复；窄窗钳制不反写首选值 |
| REQ-UI-008 本地图片背景 | P1 | TASK-037 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/features/settings/background.ts, packages/appearance/src/index.ts | 已证实 / MAC-APPEARANCE-ASSET-PRESET-001, MAC-APPEARANCE-BACKGROUND-FAIL-001, MAC-APPEARANCE-RAPID-FAIL-001, MAC-APPEARANCE-BACKGROUND-002, MAC-APPEARANCE-BACKGROUND-REGIONS-NATIVE-20261101-001, MAC-BACKGROUND-OWNED-RESOURCE-CLEANUP-COMPOSITE-001 | 导入本地静态图片并复制资产、缩放；区域/显示方式/透明度/遮罩可调；原文件移动后仍可显示，关闭释放解码资源 |
| REQ-UI-009 自定义主题颜色 | P0 | TASK-036 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx | 已证实 / MAC-APPEARANCE-INHERIT-001, MAC-APPEARANCE-COLOR-MODES-NATIVE-001 | 布局与配色独立；浅深色分别覆盖语义令牌，非法输入不破坏旧值；单项恢复、对比提示可用 |
| REQ-UI-010 外观组合与继承 | P1 | TASK-036 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/picker.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/picker-service/Picker.swift | 已证实 / MAC-APPEARANCE-INHERIT-001, MAC-APPEARANCE-ASSET-PRESET-001, MAC-APPEARANCE-RAPID-FAIL-001, MAC-APPEARANCE-BACKGROUND-002, MAC-SETTINGS-GLOBAL-SCOPE-AND-PROJECT-SELECTOR-001, MAC-NATIVE-PICKER-PRODUCT-LIFECYCLE-001, MAC-APPEARANCE-PRESET-GLOBAL-COMPOSITE-NATIVE-001 | 按 layoutId/themeId 保留全局偏好，所有项目共用；组合保存/应用/导入导出有全局范围和缺依赖提示 |
| REQ-UI-011 外观切换保留工作 | P0 | TASK-034, TASK-035 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/SleepingProjectPage.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/features/settings/background.ts, apps/desktop/src/styles.css, packages/appearance/src/index.ts | 已证实 / MAC-APPEARANCE-ROUNDTRIP-001, MAC-APPEARANCE-LAYOUT-50-NATIVE-001, MAC-APPEARANCE-REAL-IME-BASIC-NATIVE-001, MAC-APPEARANCE-EIGHT-LAYOUT-WORK-STATE-COMPOSITE-NATIVE-001, MAC-APPEARANCE-WORK-STATE-IME-FAILURE-COMPOSITE-001 | 切布局保留 EditorState/撤销/滚动/Git 草稿/任务；IME 期间延后，失败恢复上个布局；换色/尺寸不重开文件或发请求 |
| REQ-STATE-001 空与不可用状态 | P0 | TASK-004, TASK-009, TASK-025 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/src/watch.rs, apps/desktop/src-tauri/tests/file_recovery.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileRecovery.tsx, apps/desktop/src/features/editor/file-recovery.css, packages/editor/src/store.test.ts, packages/editor/src/store.ts, packages/editor/src/types.ts, packages/editor/tests/view-lifecycle.mjs | 部分证实 / MAC-FILES-INTEGRATION-002, MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-WORKSPACE-PERMISSION-MISSING-STATES-001, MAC-FILE-RECOVERY-COMPONENT-20261101-001, MAC-FILE-RECOVERY-NATIVE-DISPATCH-20261101-001, MAC-FILE-RECOVERY-NATIVE-GUI-20261101-001 | 空工作区/空项目/无更改/无 Agent/缺扩展各有正确入口；权限与路径失效分开；无数据不生成假示例；错误不清用户输入 |
| REQ-STATE-002 渐进加载与过期数据 | P0 | TASK-002, TASK-004, TASK-011, TASK-012 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileRecovery.tsx, apps/desktop/src/features/editor/RecoveryNotice.tsx, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/DiffViewer.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/features/plugins/service.test.ts, apps/desktop/src/features/plugins/service.ts, apps/desktop/src/styles.css, apps/git-service/src/lib.rs, packages/editor/src/store.test.ts, packages/editor/src/store.ts, packages/editor/tests/chunked-wake.mjs, packages/editor/tests/recovery-notice.mjs | 已证实 / MAC-GIT-STALE-DIFF-001, MAC-GIT-STALE-DIFF-CANDIDATE6-002, MAC-GIT-TRASH-CANDIDATE6-FAIL-001, MAC-EDITOR-RECOVERY-STALE-CANDIDATE7-FAIL-001, MAC-EDITOR-SLEEP-RECOVERY-SETTINGS-PROJECT-001, MAC-EDITOR-CLEAN-UNDO-RECOVERY-NATIVE-PICKER-FAIL-001, MAC-RECOVERY-NOTICE-UNDO-COMPONENT-001, MAC-EDITOR-CLEAN-UNDO-RECOVERY-RETEST-001, MAC-FILE-RECOVERY-NATIVE-GUI-20261101-001, MAC-CHUNKED-WAKE-LIFECYCLE-COMPONENT-20261101-001, MAC-SEARCH-SNAPSHOT-STALE-GENERATION-COMPONENT-001, MAC-SEARCH-SNAPSHOT-PARAMETERS-NATIVE-RETEST-001, MAC-GIT-BRANCH-LIST-SAME-OID-NATIVE-FAIL-001, MAC-GIT-WRITE-CONTROL-PROJECT-RETURN-NATIVE-FAIL-001, MAC-GIT-BRANCH-LIST-SAME-OID-NATIVE-RETEST-001, MAC-GIT-WRITE-STOP-SETTINGS-SESSION-COMPOSITE-001 | 局部任务先显示结构，真实进度或不定进度；取消可用；旧结果标时间/过期；依赖最新基线的写入不可直接执行 |
| REQ-STATE-003 取消请求与完成分离 | P0 | TASK-002, TASK-021 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/tests/search_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/bridge.ts, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/RecoveryNotice.tsx, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/styles.css, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/benchmark.py, packages/editor/src/store.ts, packages/editor/tests/quick-open.mjs | 部分证实 / MAC-SEARCH-INTEGRATION-001, MAC-GIT-CANCEL-PROBE-001, MAC-SEARCH-INTEGRATION-002, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-EDITOR-SLEEP-STALE-SCOPE-001, MAC-EDITOR-SLEEP-RECOVERY-SETTINGS-PROJECT-001, MAC-SEARCH-PENDING-STOP-SETTINGS-PROJECT-OBSERVATION-001, MAC-SEARCH-STOP-COMPONENT-RESUME-001, MAC-SEARCH-STOP-NATIVE-PICKER-001, MAC-PI-PASSIVE-HYDRATION-ERROR-COMPONENT-RETEST-001, MAC-SEARCH-SNAPSHOT-STALE-GENERATION-COMPONENT-001, MAC-SEARCH-SNAPSHOT-PARAMETERS-NATIVE-RETEST-001 | 点击停止立即反馈，但等实际完成再变终态；已产生文件/远端结果不承诺回滚；过晚回调不覆盖新项目/新查询状态 |
| REQ-STATE-004 错误可恢复 | P0 | TASK-002, TASK-009, TASK-021 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/git.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/src/watch.rs, apps/desktop/src-tauri/tests/file_recovery.rs, apps/desktop/src/App.tsx, apps/desktop/src/bridge.ts, apps/desktop/src/components/Modal.tsx, apps/desktop/src/components/ResizeHandle.tsx, apps/desktop/src/components/SleepingProjectPage.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileRecovery.tsx, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/editor/file-recovery.css, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/features/plugins/service.test.ts, apps/desktop/src/features/plugins/service.ts, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/styles.css, apps/git-service/src/lib.rs, packages/editor/src/store.test.ts, packages/editor/src/store.ts, packages/editor/src/types.ts, packages/editor/tests/chunked-wake.mjs, packages/editor/tests/view-lifecycle.mjs | 已证实 / MAC-LAUNCH-GUI-CANDIDATE5-001, MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-FILE-RECOVERY-COMPONENT-20261101-001, MAC-FILE-RECOVERY-NATIVE-DISPATCH-20261101-001, MAC-FILE-RECOVERY-NATIVE-GUI-20261101-001, MAC-CHUNKED-SLEEP-WAKE-RECOVERY-NATIVE-FAIL-001, MAC-CHUNKED-WAKE-LIFECYCLE-COMPONENT-20261101-001, MAC-CHUNKED-WAKE-MISSING-AND-QUIT-RETEST-001, MAC-TERMINAL-CLOSED-REOPEN-NOPTY-NATIVE-FAIL-001, MAC-APPEARANCE-GEOMETRY-ESC-AX-NATIVE-FAIL-001, MAC-APPEARANCE-GEOMETRY-DOUBLECLICK-NATIVE-FAIL-001, MAC-RESIZE-GEOMETRY-PRODUCTION-COMPONENT-001, MAC-TERMINAL-EXIT-THEME-PRODUCTION-COMPONENT-001, MAC-TERMINAL-CLOSED-HISTORY-REOPEN-NATIVE-RETEST-001, MAC-SIDEBAR-ORDINARY-ESC-SYNCHRONIZED-NATIVE-RETEST-001, MAC-SIDEBAR-DOUBLECLICK-DEFAULT-NATIVE-RETEST-001, MAC-OVERVIEW-CURRENT-PROJECT-STALE-LAUNCHER-NATIVE-FAIL-001, MAC-OVERVIEW-ACTIVATION-ORDER-NATIVE-RETEST-001, MAC-PI-CONTEXT-PREPARE-ERROR-SWALLOWED-NATIVE-FAIL-001, MAC-PI-PASSIVE-HYDRATION-ERROR-COMPONENT-RETEST-001, MAC-PI-CONTEXT-ERROR-RECOVERY-NATIVE-COMPOSITE-001, MAC-QUIT-SAVE-RECOVERY-STALE-GLOBAL-ERROR-NATIVE-FAIL-001, MAC-QUIT-OPERATION-ERROR-LOCALITY-NATIVE-RETEST-001, MAC-GIT-CLONE-ABSENT-TRASH-WORDING-NATIVE-FAIL-001 | 用户能选择重试、修改配置、重新定位、打开日志或关闭；危险写操作不盲目自动重试；错误归属到项目/扩展/运行实例 |
| REQ-NFR-001 基础资源测量 | P0 | TASK-008, TASK-022 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/git.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/picker.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/git-service/src/lib.rs, scripts/desktop/mac_metrics.py, scripts/desktop/sample_macos.py | 部分证实 / MAC-DEBUG-RESOURCE-001, MAC-LIFECYCLE-DIAGNOSTIC-4B-001, MAC-LIFECYCLE-CANDIDATE5-001, MAC-LIFECYCLE-CANDIDATE6-001, MAC-PI-FIXED-STREAM-CANDIDATE6-001, MAC-IDLE-CPU-CANDIDATE7-A-001, MAC-PANEL-SETTINGS-PROJECT-A-125S-001, MAC-ACTIVE-WORKFLOW-SETTINGS-PROJECT-30M-001, MAC-NATIVE-PICKER-READING-A-125S-001, MAC-NATIVE-PICKER-READING-B-125S-001, MAC-PI-ZERO-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-SINGLE-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-TWO-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-GIT-2000-LINE-FIXED-RESOURCE-NATIVE-001 | 按 PRD 12 统计全关联进程；建议空≤200 MB、阅读≤350 MB、Horizon 差异+会话≤450 MB；单 Pi 工作流总量建议≤600 MB；第二实例/开发进程/本地模型另报总量；未测不填实测数 |
| REQ-NFR-002 响应与压力场景 | P0 | TASK-008, TASK-022 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/benchmark.py, packages/editor/src/metrics.ts, packages/editor/src/store.ts, scripts/desktop/summarize_editor_metrics.py | 部分证实 / MAC-GIT-PRESSURE-001, MAC-GIT-NATIVE-GUI-CANDIDATE6-FINAL-001, MAC-EDITOR-LARGEFILES-CANDIDATE7-001, MAC-EDITOR-HOT24-SETTINGS-PROJECT-001, MAC-EDITOR-FILEOPS-PREVIEW-PATHS-RESUME-001, MAC-EDITOR-HOT24-RECOVERY-RELEASE-001 | 20 次冷启动记录中位数/P95，建议≤2s；≤200 KB 热文件打开建议 P95≤150ms；1万/10万路径、大文件/长行均有测试记录；原型不计证据 |
| REQ-NFR-003 双端实际行为 | P0 | TASK-001, TASK-008, TASK-023 | apps/desktop/src-tauri/src/processes.rs, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css, packages/editor/src/store.ts | 部分证实 / MAC-TERMINAL-GUI-CANDIDATE5-001, MAC-EDITOR-IME-CANDIDATE7-001 | macOS arm64/x64、Windows x64 覆盖计划与实测状态明确；IME、路径、换行、占用、凭据、进程树停止通过；最低系统版本在 M0 固定；本次按本机 macOS 实测交付，未测架构单列，Windows 最后可选且不阻塞 macOS |
| REQ-NFR-004 运行资源释放 | P0 | TASK-008, TASK-021, TASK-022 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/picker.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/credentials_workflow.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/components/SleepingProjectPage.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/plugins/service.ts, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/styles.css, apps/picker-service/Picker.swift, packages/editor/src/store.ts, scripts/desktop/mac_metrics.py, scripts/desktop/sample_macos.py | 部分证实 / MAC-DEBUG-QUIT-001, MAC-LIFECYCLE-DIAGNOSTIC-4B-001, MAC-LIFECYCLE-CANDIDATE5-001, MAC-URL-CHILD-REAP-FAIL-001, MAC-PROCESSES-CANDIDATE6-REGRESSION-001, MAC-LIFECYCLE-CANDIDATE6-001, MAC-IDLE-CPU-PANEL-CANDIDATE6-FAIL-001, MAC-KEYRING-EXPORT-NATIVE-CANDIDATE7-001, MAC-IDLE-CPU-CANDIDATE7-A-001, MAC-IDLE-CPU-PANEL-CANDIDATE7-B-FAIL-001, MAC-DIAGNOSTICS-GUI-CANDIDATE7-002, MAC-NORMAL-QUIT-CANDIDATE7-001, MAC-PANEL-SETTINGS-PROJECT-A-125S-001, MAC-PANEL-SETTINGS-PROJECT-B-125S-001, MAC-PANEL-SETTINGS-PROJECT-C-125S-001, MAC-PANEL-SETTINGS-PROJECT-D-125S-001, MAC-ACTIVE-WORKFLOW-SETTINGS-PROJECT-30M-001, MAC-PICKER-LIFETIME-ISOLATED-PROBE-001, MAC-NORMAL-QUIT-SETTINGS-PROJECT-IDENTITIES-001, MAC-NATIVE-PICKER-READING-A-125S-001, MAC-NATIVE-PICKER-READING-B-125S-001, MAC-NATIVE-PICKER-PRODUCT-LIFECYCLE-001, MAC-WORKSPACE-MISSING-ROOT-NORMAL-QUIT-001, MAC-NATIVE-PICKER-MENU-QUIT-CHAIN-001, MAC-NATIVE-PICKER-EDITOR-LIFECYCLE-30M-001, MAC-NATIVE-PICKER-EDITOR-LIFECYCLE-NORMAL-QUIT-001, MAC-FILE-RECOVERY-NORMAL-QUIT-20261101-001, MAC-CHUNKED-WAKE-MISSING-AND-QUIT-RETEST-001, MAC-CHUNKED-VALID-WAKE-AND-QUIT-RETEST-001, MAC-APPEARANCE-LAYOUT-50-NATIVE-001, MAC-TERMINAL-EXPLICIT-STOP-AFTER-LAYOUT-50-NATIVE-001, MAC-OWNED-PTY-STOP-AND-NORMAL-QUIT-AFTER-MAIN-TOUR-001, MAC-PI-ZERO-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-TWO-INSTANCE-STOP-CHECKPOINT-CLASSIFICATION-NATIVE-001, MAC-Q1-ALL-OWNED-IDENTITIES-AND-INSTALLED-REOPEN-001 | 30 分钟项目/扩展/面板循环无持续增长趋势；暂停/停用/退出后的自有进程、监听、订阅实测消失；空闲 CPU 建议≤单核1% |
| REQ-NFR-005 本地数据与凭据 | P0 | TASK-003, TASK-015, TASK-017 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/credentials_workflow.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/features/settings/diagnostics.ts | 部分证实 / MAC-DIAGNOSTIC-EXPORT-001, MAC-KEYRING-EXPORT-NATIVE-CANDIDATE7-001, MAC-DIAGNOSTICS-GUI-CANDIDATE7-002, MAC-WORKSPACE-REMOVE-RETAIN-DRAFT-001, MAC-PI-SELECTIVE-CREDENTIAL-HISTORY-CLEAR-NATIVE-001 | Horizon 不默认上传源码或采集遥测；自管密钥系统安全存储、失败不落明文；诊断日志脱敏；输出导出可预览；会话/草稿清理边界明确 |
| REQ-NFR-006 安装、升级与离线 | P0 | TASK-023, TASK-024 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/tauri.conf.json, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/styles.css, scripts/desktop-run.mjs, scripts/package-macos.mjs | 部分证实 / MAC-RELEASE-BUNDLE-PERSISTENCE-001, MAC-PACKAGE-CANDIDATE7-001, MAC-USABLE-CANDIDATE-MACOS-ARM64-PACKAGE-001, MAC-INSTALLED-CANDIDATE-PERSISTED-STARTUP-NATIVE-001, MAC-Q1-ALL-OWNED-IDENTITIES-AND-INSTALLED-REOPEN-001 | 双端安装运行时依赖可见；升级保留配置/草稿/扩展状态；卸载不删项目；默认扩展可恢复；离线文件与本地 Git 工作，远程能力单独失败；本次交付要求本机 macOS 条件实测，其他平台/架构单列未测，Windows 最后可选 |

## 任务待办

| 编号 / 任务 | 实现位置 | 状态 / 证据 | 验收步骤 | 完成条件 |
| --- | --- | --- | --- | --- |
| TASK-001 桌面骨架与可复现构建 | apps/desktop/src-tauri/tauri.conf.json, scripts/desktop-run.mjs | 部分证实 / MAC-RELEASE-BUNDLE-PERSISTENCE-001 | 在 macOS 与 Windows 构建相同修订的开发包和 release 包；离开开发服务器后启动 release 包；显示窗口、版本和可关闭操作；重复启动/退出五次。 | 双端最小程序真实运行，安装/运行环境与锁定版本有记录。只有一端可用时标为部分完成，并明确 S1 双端门禁未通过。 |
| TASK-002 共享 DTO、IPC 错误、取消与事件归属 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/git.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src-tauri/tests/search_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/bridge.ts, apps/desktop/src/components/Modal.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/styles.css, apps/git-service/src/lib.rs, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 已证实 / MAC-SEARCH-INTEGRATION-001, MAC-PROCESSES-SERVICE-001, MAC-PLUGIN-POLICY-001, MAC-SEARCH-INTEGRATION-002, MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-PI-UNACKNOWLEDGED-STOP-OWNED-REAP-NATIVE-001, MAC-PI-CONTEXT-PREPARE-ERROR-SWALLOWED-NATIVE-FAIL-001, MAC-PI-PASSIVE-HYDRATION-ERROR-COMPONENT-RETEST-001, MAC-SEARCH-SNAPSHOT-STALE-GENERATION-COMPONENT-001, MAC-SEARCH-SNAPSHOT-PARAMETERS-NATIVE-RETEST-001, MAC-PI-CONTEXT-ERROR-RECOVERY-NATIVE-COMPOSITE-001, MAC-QUIT-SAVE-RECOVERY-STALE-GLOBAL-ERROR-NATIVE-FAIL-001, MAC-QUIT-OPERATION-ERROR-LOCALITY-NATIVE-RETEST-001, MAC-GIT-BRANCH-LIST-SAME-OID-NATIVE-FAIL-001, MAC-GIT-WRITE-CONTROL-PROJECT-RETURN-NATIVE-FAIL-001, MAC-GIT-CLONE-ABSENT-TRASH-WORDING-NATIVE-FAIL-001, MAC-GIT-BRANCH-LIST-SAME-OID-NATIVE-RETEST-001, MAC-GIT-WRITE-STOP-SETTINGS-SESSION-COMPOSITE-001 | 发送合法、未知字段/非法值、未知项目、取消后到达及旧版本响应；切换项目时让原请求晚完成；检查结果只更新所属项目；错误含用户可操作信息且不泄漏密钥。 | 后续任务能复用请求与订阅封装，不自行拼装 IPC；版本和取消语义有可运行测试。 |
| TASK-003 工作区、项目与配置持久化 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileExplorer.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx | 部分证实 / MAC-NATIVE-INITIAL-001, MAC-NATIVE-BOM-CRLF-001, MAC-FILES-INTEGRATION-001, MAC-FILES-INTEGRATION-002, MAC-APPEARANCE-INHERIT-001, MAC-PROJECT-MEMBERSHIP-001, MAC-PI-SELECTIVE-CREDENTIAL-HISTORY-CLEAR-NATIVE-001 | 创建两个工作区、加入两个项目、同一路径重复加入、重命名显示名、移除后再次加入、退出重开；模拟配置写入中断和旧版 schema；确认项目文件未被移动或删除。 | 数据可恢复且字段权威归属清楚；未知未来 schema 不被旧版本静默覆盖；凭据不存入普通配置。 |
| TASK-004 文件根授权、目录懒加载与只读树 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/git.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileExplorer.tsx, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/styles.css, apps/git-service/src/lib.rs | 已证实 / MAC-NATIVE-INITIAL-001, MAC-NATIVE-BOM-CRLF-001, MAC-FILES-INTEGRATION-001, MAC-FILES-INTEGRATION-002, MAC-EDITOR-BLANK-001, MAC-SEARCH-SNAPSHOT-STALE-GENERATION-COMPONENT-001, MAC-SEARCH-SNAPSHOT-PARAMETERS-NATIVE-RETEST-001, MAC-GIT-BRANCH-LIST-SAME-OID-NATIVE-FAIL-001, MAC-GIT-WRITE-CONTROL-PROJECT-RETURN-NATIVE-FAIL-001, MAC-GIT-BRANCH-LIST-SAME-OID-NATIVE-RETEST-001, MAC-GIT-WRITE-STOP-SETTINGS-SESSION-COMPOSITE-001 | 打开含 Unicode、空格、重名大小写、无权限子目录和符号链接的样本；展开一万路径项目，滚动时列表只渲染可视项；切项目后原目录结果不得串入新树。 | 根与文件身份可被后续文档/Git 接口共享，目录错误局部呈现，关闭项目后缓存和订阅按策略释放。 |
| TASK-005 文档打开与最小 CodeMirror 视图 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src-tauri/tests/search_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileExplorer.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, packages/editor/src/store.ts, packages/editor/tests/view-lifecycle.mjs | 部分证实 / MAC-NATIVE-INITIAL-001, MAC-NATIVE-BOM-CRLF-001, MAC-FILES-INTEGRATION-001, MAC-SEARCH-INTEGRATION-001, MAC-NATIVE-PROJECT-SEARCH-001, MAC-PROCESSES-SERVICE-001, MAC-FILES-INTEGRATION-002, MAC-SEARCH-INTEGRATION-002, MAC-APPEARANCE-ROUNDTRIP-001, MAC-EDITOR-BLANK-001, MAC-EDITOR-VIEW-RESTORE-002, MAC-EDITOR-IME-CANDIDATE7-001 | 打开小文本、空文件、CRLF、UTF-8 BOM、二进制、大文件和长行样本；切换五个标签、再切项目，内容、选区和滚动位置正确；不存在文件显示 G02。 | 默认代码扩展可独立启停；只读查看链路真实可用；UI 明确完整加载或受限阅读，不把截断文本误当完整文档。 |
| TASK-006 编辑、保存、外部修改与未保存保护 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileExplorer.tsx, apps/desktop/src/features/editor/RecoveryNotice.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx | 部分证实 / MAC-NATIVE-INITIAL-001, MAC-NATIVE-BOM-CRLF-001, MAC-FILES-INTEGRATION-001, MAC-NATIVE-PROJECT-SEARCH-001, MAC-EDITOR-UNDO-DIRTY-001, MAC-EDITOR-CLOSE-FOCUS-001, MAC-FILES-INTEGRATION-002, MAC-RECOVERY-NATIVE-001, MAC-RECOVERY-RELAUNCH-FAIL-001, MAC-EXTENSION-NATIVE-002, MAC-APPEARANCE-ROUNDTRIP-001, MAC-EXTENSION-NATIVE-003, MAC-RECOVERY-RELAUNCH-002, MAC-EDITOR-CLOSE-FOCUS-CANDIDATE7-002 | 修改后保存并校验磁盘字节；保存期间继续输入；外部程序同时改文件；只读目录/磁盘写入失败；在关闭标签、移除项目、切换工作区、退出窗口时分别选保存、放弃和取消。 | 未保存内容不静默丢失，冲突不得被普通重试覆盖；失败后 buffer 和编辑上下文仍在；状态中的未保存圆点与 Git 的 M 独立。 |
| TASK-007 监听、会话恢复与后台项目生命周期 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/git.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src-tauri/tests/search_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/styles.css, apps/git-service/src/lib.rs, packages/editor/tests/view-lifecycle.mjs, packages/pi-policy/horizon-policy.ts, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts, scripts/desktop/mac_metrics.py | 已证实 / MAC-FILES-INTEGRATION-001, MAC-SEARCH-INTEGRATION-001, MAC-NATIVE-PROJECT-SEARCH-001, MAC-PROCESSES-SERVICE-001, MAC-PLUGIN-POLICY-001, MAC-FILES-INTEGRATION-002, MAC-SEARCH-INTEGRATION-002, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-EDITOR-VIEW-RESTORE-002, MAC-EDITOR-SLEEP-STALE-SCOPE-001, MAC-NORMAL-QUIT-CANDIDATE7-001, MAC-PI-TASK-HIDE-CROSSPROJECT-IDENTITY-NATIVE-001, MAC-SEARCH-SNAPSHOT-PARAMETERS-NATIVE-RETEST-001, MAC-PI-ALLOW-NATURAL-REVIEW-CROSSPROJECT-NATIVE-001, MAC-PI-TWO-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-TWO-INSTANCE-STOP-CHECKPOINT-CLASSIFICATION-NATIVE-001, MAC-UNIFIED-QUIT-CANCEL-SAVEFAIL-REAP-REOPEN-COMPOSITE-001, MAC-PI-SESSION-RECOVERY-OWNERSHIP-COMPOSITE-001, MAC-GIT-WRITE-STOP-SETTINGS-SESSION-COMPOSITE-001 | 两个项目分别保留标签与未保存内容；切换、休眠、唤醒、外部批量修改、退出重开和模拟异常退出；路径失效时保持可恢复状态并提供重新定位。 | 每个项目资源有归属、创建和释放点；恢复策略真实执行；异常退出恢复以可用快照为准，不宣称零数据丢失。 |
| TASK-008 纵向切片风险门禁 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/git.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/components/UnsavedChanges.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/RecoveryNotice.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/git-service/src/lib.rs, packages/editor/tests/view-lifecycle.mjs, scripts/desktop/mac_metrics.py | 部分证实 / MAC-FILES-INTEGRATION-001, MAC-NATIVE-PROJECT-SEARCH-001, MAC-FILES-INTEGRATION-002, MAC-RECOVERY-NATIVE-001, MAC-RECOVERY-RELAUNCH-FAIL-001, MAC-CLOSE-STALE-SESSION-001, MAC-RECOVERY-RELAUNCH-002, MAC-SLEEP-QUIT-002, MAC-EDITOR-BLANK-001, MAC-EDITOR-VIEW-RESTORE-002, MAC-PI-ZERO-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-SINGLE-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-TWO-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-TWO-INSTANCE-STOP-CHECKPOINT-CLASSIFICATION-NATIVE-001, MAC-Q1-ALL-OWNED-IDENTITIES-AND-INSTALLED-REOPEN-001, MAC-NARROW-AI-ONBOARDING-SEARCH-FOCUS-NATIVE-001, MAC-GIT-2000-LINE-FIXED-RESOURCE-NATIVE-001 | 两端完成打开目录→打开文件→中文编辑→保存→外部冲突→切项目→重开恢复；20 次启动、60 秒稳定资源观察及 30 分钟标签/项目循环；记录进程明细。并做 Pi 固定版本/协议与只读 profile 探测，以及一组受控开发进程启动/停止试验，先暴露 PATH、协议和进程归属风险；完整适配与终端 UI 仍由 S3 任务完成。 | 报告通过/失败及原因。扩展不能卸载/资源未回收、数据丢失或 IME 阻断则暂停上层功能，修复后重测；资源超目标先剖析并减少常驻资源，仍失败才按 ADR 重新评估编辑器/框架，禁止把目标改成“已达到”。 |
| TASK-009 工作台布局、令牌与基础组件 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/git.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src/App.tsx, apps/desktop/src/bridge.ts, apps/desktop/src/components/Modal.tsx, apps/desktop/src/components/UnsavedChanges.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/agent.css, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/editor/editor.css, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/features/git/git.css, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/styles.css, apps/git-service/src/lib.rs, packages/appearance/src/index.ts, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 失败 / MAC-PLUGIN-POLICY-001, MAC-EXTENSION-NATIVE-001, MAC-APPEARANCE-INHERIT-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-PI-TASK-HIDE-CROSSPROJECT-IDENTITY-NATIVE-001, MAC-PI-CONTEXT-PREPARE-ERROR-SWALLOWED-NATIVE-FAIL-001, MAC-PI-PASSIVE-HYDRATION-ERROR-COMPONENT-RETEST-001, MAC-REDUCED-MOTION-PAGER-NAMES-COMPONENT-SOURCE-001, MAC-REDUCED-MOTION-SETTING-NATIVE-COMPOSITE-001, MAC-PI-CONTEXT-ERROR-RECOVERY-NATIVE-COMPOSITE-001, MAC-QUIT-SAVE-RECOVERY-STALE-GLOBAL-ERROR-NATIVE-FAIL-001, MAC-QUIT-OPERATION-ERROR-LOCALITY-NATIVE-RETEST-001, MAC-LAYOUT-SESSION-SEPARATION-EXISTING-EVIDENCE-COMPOSITE-001, MAC-NARROW-QUICK-OPEN-NAME-NATIVE-FAIL-001, MAC-UNSAVED-FORM-CONFIRMATION-AX-NATIVE-FAIL-001, MAC-NARROW-AI-ONBOARDING-SEARCH-FOCUS-NATIVE-001, MAC-GIT-CLONE-ABSENT-TRASH-WORDING-NATIVE-FAIL-001, MAC-GIT-SINGLE-MODAL-FOCUS-NATIVE-RETEST-001 | 默认关闭 AI/终端；切主题/密度/字号，调整面板、进入退出专注模式、窄窗口展开侧栏，再重启验证；设置弹窗打开/关闭后焦点回到触发入口。 | 业务状态不依赖视觉候选；最小宽度下主编辑区仍可操作；八个布局插件分别完成视觉验收。 |
| TASK-010 文件操作与错误恢复 | apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs | 部分证实 / MAC-FILES-INTEGRATION-001, MAC-FILES-INTEGRATION-002 | 对已打开/未打开文件重命名；制造目标重名、Windows 占用和无权限；删除含未保存标签的目录；取消后内容、选区和树保持；成功后标签和树一致。 | 磁盘结果、文档身份和树状态一致；所有危险操作显示真实对象与后果，无静默永久删除。 |
| TASK-011 快速打开、项目搜索与命令入口 | apps/desktop/src-tauri/src/git.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/tests/search_workflow.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/styles.css, apps/git-service/src/lib.rs | 已证实 / MAC-SEARCH-INTEGRATION-001, MAC-PROCESSES-SERVICE-001, MAC-SEARCH-INTEGRATION-002, MAC-SEARCH-SNAPSHOT-STALE-GENERATION-COMPONENT-001, MAC-SEARCH-SNAPSHOT-PARAMETERS-NATIVE-RETEST-001, MAC-GIT-BRANCH-LIST-SAME-OID-NATIVE-FAIL-001, MAC-GIT-WRITE-CONTROL-PROJECT-RETURN-NATIVE-FAIL-001, MAC-GIT-BRANCH-LIST-SAME-OID-NATIVE-RETEST-001, MAC-GIT-WRITE-STOP-SETTINGS-SESSION-COMPOSITE-001 | 一万文件样本中连续修改查询、取消和切项目；结果点击跳到正确行列；显示截断/忽略范围；无结果保留查询并允许解除筛选；命令遵守当前上下文可用性。 | 快速打开和正文搜索不互相混淆；搜索不阻塞编辑；实际磁盘结果与 UI 的位置和范围一致。 |
| TASK-012 Git 执行器、状态与两类 diff | apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/DiffViewer.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/styles.css, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/benchmark.py, apps/git-service/tests/workflow.rs | 已证实 / MAC-NATIVE-GIT-001, MAC-GIT-STALE-DIFF-001, MAC-GIT-INTEGRATION-001, MAC-GIT-INTEGRATION-002, MAC-GIT-PRESSURE-001, MAC-SEARCH-SNAPSHOT-STALE-GENERATION-COMPONENT-001, MAC-SEARCH-SNAPSHOT-PARAMETERS-NATIVE-RETEST-001, MAC-GIT-BRANCH-LIST-SAME-OID-NATIVE-FAIL-001, MAC-GIT-WRITE-CONTROL-PROJECT-RETURN-NATIVE-FAIL-001, MAC-GIT-DETECTION-STAGED-HISTORY-NATIVE-001, MAC-GIT-DIFF-REBASE-EXISTING-COMPOSITE-001, MAC-GIT-BRANCH-LIST-SAME-OID-NATIVE-RETEST-001, MAC-GIT-WRITE-STOP-SETTINGS-SESSION-COMPOSITE-001 | 临时仓库造出新增、修改、删除、重命名、未跟踪、部分已暂存、二进制与空仓库；同一文件点已暂存/未暂存组，检查内容分别正确；缺 Git 时文件能力继续可用。 | 不把全部修改塞进单一 diff；外部 Git 写入刷新后快照一致；没有仓库时显示可理解状态。 |
| TASK-013 暂存、取消暂存与本地提交 | apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/DiffViewer.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/workflow.rs | 部分证实 / MAC-NATIVE-GIT-001, MAC-GIT-INTEGRATION-001, MAC-GIT-INTEGRATION-002, MAC-GIT-DETECTION-STAGED-HISTORY-NATIVE-001 | 部分暂存文件再次编辑，提交后检查 commit 只含 index 内容；提交信息为空/无暂存禁用；运行失败 hook、缺身份、签名失败、外部 index 更新，检查草稿和更改保留。 | 提交范围与结果可证明，失败不丢草稿，不把 CLI 退出后未经刷新的旧状态显示成成功。 |
| TASK-014 分支、远端同步、丢弃与失败恢复 | apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/workflow.rs | 已证实 / MAC-GIT-INTEGRATION-001, MAC-GIT-INTEGRATION-002, MAC-GIT-BRANCH-REMOTE-SAFETY-COMPOSITE-001, MAC-GIT-TRASH-RECOVERY-NATIVE-RETEST-001 | 本地 bare remote 配两工作副本，验证正常同步、无上游、非快进、网络失败/取消；切分支遇脏文档；丢弃前展示文件集合，外部变化后重新确认；失败不改变用户已有更改。 | 每次远端/破坏动作由用户明确发起，返回状态真实；冲突可识别并引导处理，不以未实现的合并器阻断其他仓库操作。 |
| TASK-015 编辑器、资源、快捷键与数据设置 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/git.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/credentials_workflow.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/components/UnsavedChanges.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/agent.css, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/FileExplorer.tsx, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/editor/editor.css, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/features/git/git.css, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/features/settings/diagnostics.ts, apps/desktop/src/styles.css, apps/git-service/src/lib.rs, packages/appearance/src/index.ts, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 失败 / MAC-NATIVE-INITIAL-001, MAC-FILES-INTEGRATION-001, MAC-PLUGIN-POLICY-001, MAC-FILES-INTEGRATION-002, MAC-APPEARANCE-INHERIT-001, MAC-APPEARANCE-ROUNDTRIP-001, MAC-DIAGNOSTIC-EXPORT-001, MAC-KEYRING-EXPORT-NATIVE-CANDIDATE7-001, MAC-REDUCED-MOTION-PAGER-NAMES-COMPONENT-SOURCE-001, MAC-REDUCED-MOTION-SETTING-NATIVE-COMPOSITE-001, MAC-UNSAVED-SETTINGS-FORM-CLOSE-SOURCE-FAIL-001, MAC-PI-SELECTIVE-CREDENTIAL-HISTORY-CLEAR-NATIVE-001, MAC-LAYOUT-SESSION-SEPARATION-EXISTING-EVIDENCE-COMPOSITE-001, MAC-NARROW-QUICK-OPEN-NAME-NATIVE-FAIL-001, MAC-UNSAVED-FORM-CONFIRMATION-AX-NATIVE-FAIL-001, MAC-UNSAVED-SETTINGS-FORM-SAVE-DISCARD-NATIVE-COMPOSITE-001, MAC-NARROW-AI-ONBOARDING-SEARCH-FOCUS-NATIVE-001, MAC-GIT-WRITE-STOP-SETTINGS-SESSION-COMPOSITE-001, MAC-GIT-SINGLE-MODAL-FOCUS-NATIVE-RETEST-001 | 全局改字号后各项目一致；项目编辑偏好覆盖与使用全局设置；设置非法值；自动保存与外部修改冲突；快捷键碰撞选择替换/取消；通过 data_export 导出后扫描密钥字段和敏感日志；分类清理先 prepare 后 apply，验证清缓存不删未解决恢复稿，删除聊天不清外部 Agent 自有数据。 | 显示值与生效值一致；更改不需重启的项即时生效；需重新打开的项明确提示；数据操作不影响项目文件。缓存、会话、草稿和凭据分别清理；未解决草稿不当作缓存删除；外部 Agent 历史未被清理时明确说明。 |
| TASK-016 核心工作流集成验收 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/git.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/RecoveryNotice.tsx, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/styles.css, apps/git-service/src/lib.rs, packages/pi-policy/horizon-policy.ts | 已证实 / MAC-FILES-INTEGRATION-001, MAC-FILES-INTEGRATION-002, MAC-RECOVERY-NATIVE-001, MAC-RECOVERY-RELAUNCH-FAIL-001, MAC-RECOVERY-RELAUNCH-002, MAC-PI-TASK-HIDE-CROSSPROJECT-IDENTITY-NATIVE-001, MAC-SEARCH-SNAPSHOT-PARAMETERS-NATIVE-RETEST-001, MAC-PI-ALLOW-NATURAL-REVIEW-CROSSPROJECT-NATIVE-001, MAC-GIT-WRITE-STOP-SETTINGS-SESSION-COMPOSITE-001 | 工作区含三个项目（含相同相对路径文件）；分别编辑未保存文件、搜索、查看各自 diff、暂存/提交其中一项目、同步、切换与重启；全过程检查路径、草稿、标签、分支归属与全局布局一致。 | 默认能力作为独立可用里程碑；逐项禁用/卸载文件树、代码、Git 后，宿主与剩余扩展可用，草稿有恢复/导出入口。Agent/终端未启用时没有附加进程。 |
| TASK-017 Pi 检测、模型连接与凭据配置 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/components/UnsavedChanges.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, packages/pi-policy/horizon-policy.ts, scripts/desktop/mac_metrics.py, scripts/test-pi-policy.mjs, scripts/test-pi-rpc.mjs | 已证实 / MAC-FILES-INTEGRATION-001, MAC-FILES-INTEGRATION-002, MAC-PI-STREAM-001, MAC-PI-MAIN-CONNECTION-EXPLICIT-TEST-NATIVE-001, MAC-PI-AUTH-FAILURE-EXPLICIT-RETRY-NATIVE-001, MAC-PI-SYSTEM-SESSION-CREDENTIAL-OWNERSHIP-NATIVE-001, MAC-PI-SINGLE-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-TWO-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-SESSION-CREDENTIAL-EDIT-METADATA-NATIVE-FAIL-001, MAC-UNSAVED-SETTINGS-FORM-CLOSE-SOURCE-FAIL-001, MAC-PI-CREDENTIAL-OWNERSHIP-SETTINGS-COMPOSITE-001, MAC-PI-SELECTIVE-CREDENTIAL-HISTORY-CLEAR-NATIVE-001, MAC-UNSAVED-SETTINGS-FORM-SAVE-DISCARD-NATIVE-COMPOSITE-001 | 检测未安装、固定版本、未验证版本、缺 Windows shell、缺模型配置；选择自定义兼容 provider 与本地 endpoint；用户触发无项目内容测试后才从 configured 改 verified；未知认证不伪称登录。导出/日志不出现 secret。 | runtime、provider 和模型能力可辨；打开面板/检测不执行任务；只使用已核验官方配置面，没有臆造 rpc.login。无 Pi 或模型连接时其他扩展仍可用。 |
| TASK-018 Pi 官方 RPC 与外部会话状态 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/processes/index.tsx, packages/pi-policy/horizon-policy.ts, scripts/desktop/mac_metrics.py, scripts/test-pi-native.mjs, scripts/test-pi-policy.mjs, scripts/test-pi-rpc.mjs | 已证实 / MAC-PI-INTEGRATION-001, MAC-PI-STREAM-001, MAC-PI-INTEGRATION-002, MAC-PI-TASK-HIDE-CROSSPROJECT-IDENTITY-NATIVE-001, MAC-PI-UNACKNOWLEDGED-STOP-OWNED-REAP-NATIVE-001, MAC-PI-DISCONNECT-MANUAL-RESUME-COMPOSITE-001, MAC-PI-ALLOW-NATURAL-REVIEW-CROSSPROJECT-NATIVE-001, MAC-PI-SINGLE-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-TWO-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-TWO-INSTANCE-STOP-CHECKPOINT-CLASSIFICATION-NATIVE-001, MAC-PI-SESSION-RECOVERY-OWNERSHIP-COMPOSITE-001 | 订阅先于发送；事件可早于响应；started/handled/queued 分别处理；agent_end 后仍可能继续，以 agent_settled 联合错误/aborted 判终态；message_end 校准增量。停止执行清队列→abort，结束实例关闭 stdin并等待退出，超时才回收 owned 进程树；恢复会话不重发 prompt。 | 输入接收不等于成功；取消响应不等于停止；官方不支持的 attach 显式为 false；未知执行结果不自动重试。真实终态与资源释放可核对后才交付结构化会话。 |
| TASK-019 扩展本地安装、主题与分发目录 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 部分证实 / MAC-PLUGIN-POLICY-001, MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003 | 安装一个本地主题，切换、重启、停用和卸载；本地更新在停止旧实例并校验后切换，失败可恢复原版本；坏 schema、不兼容 engine、重复 ID 和非法路径给出明确状态；异常只影响该扩展。 | 默认附带包可从随包目录重新安装，不自动复活用户已卸载的扩展。无需改核心源码即可增加主题，扩展状态和真实生命周期一致；静态安装不增加常驻宿主。 |
| TASK-020 第三方可执行扩展运行时风险验证 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 部分证实 / MAC-PLUGIN-POLICY-001, MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-PLUGIN-GUI-4B-001 | 首次激活才启动宿主；执行命令展示真实数据；测试越权读取、无限循环、内存超限、宿主崩溃；停用后命令/订阅/请求释放，核心阅读继续。 | 真实本地扩展安装→授权→激活→执行→停用闭环有证据。若隔离/回收失败，阻断可执行扩展交付，先保留声明式扩展；是否调整首版承诺按需求范围记录，不静默删项。 |
| TASK-021 可选能力的生命周期整合 | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/git.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src-tauri/tests/search_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/bridge.ts, apps/desktop/src/components/Modal.tsx, apps/desktop/src/components/RecoveryPanel.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/styles.css, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/benchmark.py, packages/pi-policy/horizon-policy.ts, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts, scripts/desktop/mac_metrics.py | 已证实 / MAC-DEBUG-QUIT-001, MAC-SEARCH-INTEGRATION-001, MAC-GIT-CANCEL-PROBE-001, MAC-PROCESSES-SERVICE-001, MAC-PLUGIN-POLICY-001, MAC-SEARCH-INTEGRATION-002, MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-CLOSE-STALE-SESSION-001, MAC-EXTENSION-NATIVE-003, MAC-SLEEP-QUIT-002, MAC-HOST-RECOVERY-PRESET-GUI-4B-001, MAC-EDITOR-SLEEP-STALE-SCOPE-001, MAC-TERMINAL-GUI-CANDIDATE5-001, MAC-PROCESSES-CANDIDATE6-REGRESSION-001, MAC-NORMAL-QUIT-CANDIDATE7-001, MAC-PI-TASK-HIDE-CROSSPROJECT-IDENTITY-NATIVE-001, MAC-PI-UNACKNOWLEDGED-STOP-OWNED-REAP-NATIVE-001, MAC-PI-CONTEXT-PREPARE-ERROR-SWALLOWED-NATIVE-FAIL-001, MAC-PI-PASSIVE-HYDRATION-ERROR-COMPONENT-RETEST-001, MAC-SEARCH-SNAPSHOT-STALE-GENERATION-COMPONENT-001, MAC-SEARCH-SNAPSHOT-PARAMETERS-NATIVE-RETEST-001, MAC-PI-CONTEXT-ERROR-RECOVERY-NATIVE-COMPOSITE-001, MAC-PI-DISCONNECT-MANUAL-RESUME-COMPOSITE-001, MAC-PI-ZERO-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-TWO-INSTANCE-STOP-CHECKPOINT-CLASSIFICATION-NATIVE-001, MAC-QUIT-SAVE-RECOVERY-STALE-GLOBAL-ERROR-NATIVE-FAIL-001, MAC-UNIFIED-QUIT-CANCEL-SAVEFAIL-REAP-REOPEN-COMPOSITE-001, MAC-QUIT-OPERATION-ERROR-LOCALITY-NATIVE-RETEST-001, MAC-Q1-ALL-OWNED-IDENTITIES-AND-INSTALLED-REOPEN-001, MAC-GIT-CLONE-ABSENT-TRASH-WORDING-NATIVE-FAIL-001 | 未配置启动、打开但不启动 Agent、任务开始后关面板、取消、切项目、休眠和退出；安装但不激活扩展、激活再停用；记录进程与订阅增减。 | 隐藏、取消、休眠、禁用和结束动作含义一致；长时间循环后无持续新增活动资源。 |
| TASK-022 资源预算、性能回归与诊断 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/git.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/credentials_workflow.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src-tauri/tests/search_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx, apps/desktop/src/features/settings/diagnostics.ts, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/benchmark.py, packages/pi-policy/horizon-policy.ts, scripts/desktop/mac_metrics.py, scripts/desktop/sample_macos.py, scripts/test-pi-policy.mjs, scripts/test-pi-rpc.mjs | 部分证实 / MAC-DEBUG-RESOURCE-001, MAC-DEBUG-QUIT-001, MAC-SEARCH-INTEGRATION-001, MAC-GIT-PRESSURE-001, MAC-GIT-CANCEL-PROBE-001, MAC-PROCESSES-SERVICE-001, MAC-SEARCH-INTEGRATION-002, MAC-PI-STREAM-001, MAC-LIFECYCLE-DIAGNOSTIC-4B-001, MAC-DIAGNOSTIC-EXPORT-001, MAC-LIFECYCLE-CANDIDATE5-001, MAC-URL-CHILD-REAP-FAIL-001, MAC-PROCESSES-CANDIDATE6-REGRESSION-001, MAC-LIFECYCLE-CANDIDATE6-001, MAC-PI-FIXED-STREAM-CANDIDATE6-001, MAC-IDLE-CPU-PANEL-CANDIDATE6-FAIL-001, MAC-KEYRING-EXPORT-NATIVE-CANDIDATE7-001, MAC-IDLE-CPU-CANDIDATE7-A-001, MAC-IDLE-CPU-PANEL-CANDIDATE7-B-FAIL-001, MAC-DIAGNOSTICS-GUI-CANDIDATE7-002, MAC-PI-ZERO-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-SINGLE-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-TWO-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-TWO-INSTANCE-STOP-CHECKPOINT-CLASSIFICATION-NATIVE-001, MAC-Q1-ALL-OWNED-IDENTITIES-AND-INSTALLED-REOPEN-001, MAC-GIT-2000-LINE-FIXED-RESOURCE-NATIVE-001 | 同修订、同 fixture、两端 release；20 次启动、60 秒稳定测量、30 分钟循环，分别记录中位数/P95、稳定值/峰值、进程明细与缓存条件。 | 每项标记实测通过、实测失败或未测；超预算有剖析结果与处置，未测项不能填写绿色通过。 |
| TASK-023 macOS / Windows 安装与升级恢复 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/tauri.conf.json, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/styles.css, scripts/desktop-run.mjs, scripts/package-macos.mjs | 部分证实 / MAC-RELEASE-BUNDLE-PERSISTENCE-001, MAC-PACKAGE-CANDIDATE7-001, MAC-INSTALLED-CANDIDATE-PERSISTED-STARTUP-NATIVE-001, MAC-Q1-ALL-OWNED-IDENTITIES-AND-INSTALLED-REOPEN-001 | 干净环境安装、启动、创建数据、升级、重开、卸载；Windows 缺 WebView2 时安装路径明确；macOS 两种 CPU 架构按产品承诺验证；低版本 OS 按发布基线实测。 | 产物与源码修订可对应，包大小口径一致；缺证书只阻断正式分发，不回溯阻断文件/Git 开发。 |
| TASK-024 MVP 需求与双端验收收口 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/styles.css | 部分证实 / MAC-INSTALLED-CANDIDATE-PERSISTED-STARTUP-NATIVE-001, MAC-Q1-ALL-OWNED-IDENTITIES-AND-INSTALLED-REOPEN-001 | 检查每条 REQ 的正向与失败路径；复跑两条关键工作流；检查未完成项、无映射任务、实际资源数据和已选 UI；由需求验收确定候选包是否可发布。 | 所有 MVP 必须项已通过，或由用户明确接受范围调整；对外说明与实际产物一致；真正阻塞项不得用“设计已完成”关闭。 |
| TASK-025 最小宿主与默认扩展完整生命周期（S0 门禁） | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/components/RecoveryPanel.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentReview.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/plugins/PluginCenter.tsx, apps/desktop/src/features/plugins/PluginImpact.tsx, apps/desktop/src/features/processes/index.tsx, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts, scripts/desktop/mac_metrics.py, scripts/desktop/sample_macos.py | 已证实 / MAC-PLUGIN-POLICY-001, MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-PLUGIN-GUI-4B-001, MAC-HOST-RECOVERY-PRESET-GUI-4B-001, MAC-PI-FIXED-STREAM-CANDIDATE6-001, MAC-PI-NATIVE-GUI-CANDIDATE6-001, MAC-EXTENSION-STOP-FAILURE-NATIVE-001, MAC-UNIFIED-QUIT-CANCEL-SAVEFAIL-REAP-REOPEN-COMPOSITE-001 | 记录空宿主进程/句柄；安装包，显示树并创建 watcher；暂停后查询和监听停止，恢复重新校准磁盘；禁用后重开项目不激活；卸载后槽位/命令/任务消失，宿主还能重新安装。本任务以最小可用文件树包验证全链路；完整代码扩展的脏文档保护在 TASK-006/016、Git 活动写操作的保护在 TASK-013/016 收口，避免把后续功能反向设成本任务前置。 | 同一能力完整链路有证据；卸载不会在重启时自动恢复，重装可由用户触发；默认附带包不获得绕过权限/生命周期的专用通道。已 dispose 的同 WebView ESM 模块可能仍有代码缓存；需重载才能完全释放时返回/显示重载需求，先保护草稿再重载，不宣称暂停或卸载后内存绝对为零。暂停/停止未确认时显示真实过渡或失败状态。未通过本任务不得宣称“Everything is a Plugin 已实现”。 |
| TASK-026 项目运行配置、候选发现与启动计划预览（首版补齐） | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/files.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/projects.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src-tauri/src/state.rs, apps/desktop/src-tauri/tests/files_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/components/UnsavedChanges.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/RecoveryNotice.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css, apps/desktop/src/features/settings/SettingsPanel.tsx | 已证实 / MAC-FILES-INTEGRATION-001, MAC-PROCESSES-SERVICE-001, MAC-FILES-INTEGRATION-002, MAC-RECOVERY-NATIVE-001, MAC-RECOVERY-RELAUNCH-FAIL-001, MAC-RECOVERY-RELAUNCH-002, MAC-LAUNCH-GUI-CANDIDATE5-001, MAC-PROCESSES-CANDIDATE6-REGRESSION-001, MAC-PROCESSES-NATIVE-CANDIDATE7-001, MAC-UNSAVED-SETTINGS-FORM-CLOSE-SOURCE-FAIL-001, MAC-UNSAVED-SETTINGS-FORM-SAVE-DISCARD-NATIVE-COMPOSITE-001 | 从含 package scripts 的目录读取候选，检查未产生进程；选择前后端命令、指定依赖扩展和端口/日志/进程就绪条件，保存重开；无运行实例时删除仅移除配置，存在实例时先停止成功再删除，删除失败仍保留管理入口；无配置/无效 cwd/缺命令/依赖禁用/URL 非法时有可修正错误。 | 同一项目可有多个方案，启动前能准确列出将启用的扩展和将执行的命令；全局禁用依赖先提示用户处理，不由方案暗中覆盖；未变化的已保存授权无需每次重复确认；保存配置不自动启动，扫描发现不等于用户授权执行。 |
| TASK-027 启动方案执行、就绪、失败、停止与重启（首版补齐） | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/tests/extensions_policy.rs, apps/desktop/src-tauri/tests/search_workflow.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/features/processes/processes.css, packages/plugins/src/runtime.ts, packages/plugins/src/validation.ts, packages/plugins/tests/runtime.test.ts | 部分证实 / MAC-SEARCH-INTEGRATION-001, MAC-PROCESSES-SERVICE-001, MAC-PLUGIN-POLICY-001, MAC-SEARCH-INTEGRATION-002, MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-URL-CHILD-REAP-FAIL-001, MAC-LAUNCH-GUI-CANDIDATE5-001, MAC-PROCESSES-CANDIDATE6-REGRESSION-001, MAC-PROCESSES-NATIVE-CANDIDATE7-001, MAC-PI-UNACKNOWLEDGED-STOP-OWNED-REAP-NATIVE-001 | 前后端两个进程正常就绪；前置进程失败、后置未开始；就绪超时；重复点击启动；启动中停止；停止后重启；面板隐藏和项目切换时任务继续；应用重启只恢复记录，不默默重跑。任务停止后按租约恢复本次临时启用策略，不覆盖用户期间的新设置。禁用纯终端视图时启动器拥有的后台进程继续并转日志；真正依赖 PTY 的进程列入停止影响。 | 每个步骤有 queued/starting/running/ready/failed/stopping/stopped 等真实状态；错误保留命令、阶段与脱敏输出；资源无法回收时不显示已停止。重启是停止确认后重新执行已保存方案。 |
| TASK-028 Codex / Claude Code 后续适配接口设计（首版仅设计） | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/features/agent/AgentSettings.tsx, packages/pi-policy/horizon-policy.ts, scripts/desktop/mac_metrics.py, scripts/test-pi-policy.mjs, scripts/test-pi-rpc.mjs | 部分证实 / MAC-PI-STREAM-001, MAC-PI-SINGLE-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-TWO-INSTANCE-FIXED-RESOURCE-12ED-001 | 用官方示例将会话、消息、权限、取消、恢复字段映射到抽象；不能映射的能力明确 unsupported/unknown；检查默认安装和 UI 没有声称两者已接通。 | 两种接口路径有官方来源与已知限制；首版无需完成其认证、启动或实际运行；不会为了统一 API 丢失 Pi 真实语义。 |
| TASK-029 外部 Agent 上下文、变化归因与审查（首版补齐） | apps/desktop/src-tauri/examples/extension_smoke.rs, apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/extension_host.rs, apps/desktop/src-tauri/src/extensions.rs, apps/desktop/src-tauri/src/extensions/presets.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, packages/pi-policy/horizon-policy.ts, scripts/test-pi-native.mjs, scripts/test-pi-rpc.mjs | 已证实 / MAC-PI-INTEGRATION-001, MAC-EXTENSION-NATIVE-001, MAC-EXTENSION-NATIVE-002, MAC-EXTENSION-NATIVE-003, MAC-PI-INTEGRATION-002, MAC-PI-CONTEXT-LINES-REMOVAL-HTTP-COMPOSITE-001, MAC-PI-WRITE-REVIEW-STALE-UNBORN-COMPOSITE-001 | 任务前已有未提交/未保存内容；Agent 和用户并发改同文件；外部新增/删除；上下文超限；任务完成后又人工编辑；默认副本按 baseline→after 审查，应用回原项目时逐文件验证磁盘/编辑版本；脏文档用 undo transaction 并保留 dirty。无 HEAD/非 Git 项目首版只交付聊天，写任务明确受限。未来 observedDisk 只有可靠基线且当前版本匹配才允许恢复，否则仅比较和手工处理。 | 审查不会丢用户工作；Agent 取消不被当作磁盘回滚；没有自动 Git 提交；不声称能够拦截外部 runtime 的全部磁盘操作。 |
| TASK-030 基础 Git 历史与手动冲突闭环（核心里程碑） | apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/workflow.rs | 已证实 / MAC-GIT-INTEGRATION-001, MAC-GIT-INTEGRATION-002, MAC-GIT-DETECTION-STAGED-HISTORY-NATIVE-001, MAC-GIT-DIFF-REBASE-EXISTING-COMPOSITE-001 | 根提交、删除文件历史、分页失败；真实 merge 冲突中编辑并保存，仍有未处理冲突/保存失败不能标完成；标记解决明确暂存范围。 | 基础冲突可通过现有编辑能力闭环，不等待完整合并器；记录结果和 Git 状态可验证。 |
| TASK-031 可选 Markdown 预览与基础标题导航（MVP） | apps/desktop/src/App.tsx, apps/desktop/src/features/editor/EditorWorkbench.tsx, apps/desktop/src/features/editor/Preview.tsx, packages/plugins/src/runtime.ts | 部分证实 / MAC-MARKDOWN-TASK-GUI-CANDIDATE7-001 | 打开含标题、代码块、内部链接、外部资源和 HTML 的 Markdown；编辑源码后更新预览；窄窗切换不丢选区；标题跳到正确文档版本；暂停/卸载后订阅和视图释放。 | 无需 LSP 提供真实标题导航；默认不会执行文档脚本或自动获取远程资源；启停和核心生命周期一致。 |
| TASK-032 Pi 固定运行时分发、安装与回退 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, packages/pi-policy/horizon-policy.ts, scripts/desktop/mac_metrics.py | 部分证实 / MAC-PI-MAIN-CONNECTION-EXPLICIT-TEST-NATIVE-001, MAC-PI-AUTH-FAILURE-EXPLICIT-RETRY-NATIVE-001, MAC-PI-SYSTEM-SESSION-CREDENTIAL-OWNERSHIP-NATIVE-001, MAC-PI-SINGLE-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-TWO-INSTANCE-FIXED-RESOURCE-12ED-001 | macOS arm64/x64、Windows x64 安装固定资产并校验摘要；无系统 Node 仍启动版本探测；下载失败/取消/校验失败不覆盖当前可用版本；在用 runtime 升级时旧会话仍使用旧路径；卸载最后引用后可清理安装数据。 | 扩展包、runtime、会话格式版本分别可定位；binary 回退不被当作会话无损回退；Pi 资料核验值与运行实测分开记录。 |
| TASK-033 Pi 只读/任务 profile 与工具前授权适配 | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/settings.rs, apps/desktop/src/App.tsx, apps/desktop/src/components/Modal.tsx, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/AgentSettings.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts, apps/desktop/src/features/editor/SearchPanel.tsx, apps/desktop/src/features/processes/index.tsx, apps/desktop/src/styles.css, packages/pi-policy/horizon-policy.ts, scripts/desktop/mac_metrics.py, scripts/test-pi-native.mjs, scripts/test-pi-rpc.mjs | 已证实 / MAC-PI-INTEGRATION-001, MAC-PI-INTEGRATION-002, MAC-PROCESS-CONTROLLED-STOP-FAILURE-001, MAC-PI-MAIN-CONNECTION-EXPLICIT-TEST-NATIVE-001, MAC-PI-PERMISSION-EXPIRED-WITHOUT-WRITE-NATIVE-001, MAC-PI-ALLOW-NATURAL-REVIEW-CROSSPROJECT-NATIVE-001, MAC-PI-AUTH-FAILURE-EXPLICIT-RETRY-NATIVE-001, MAC-PI-SYSTEM-SESSION-CREDENTIAL-OWNERSHIP-NATIVE-001, MAC-PI-SINGLE-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-TWO-INSTANCE-FIXED-RESOURCE-12ED-001, MAC-PI-SESSION-CREDENTIAL-EDIT-METADATA-NATIVE-FAIL-001, MAC-PI-CREDENTIAL-OWNERSHIP-SETTINGS-COMPOSITE-001 | chat 尝试文件/命令工具应不可用；task 生成结构化 operationDigest/cwd/argv/路径，允许/拒绝后行为一致；批准后参数改变、请求过期、断桥、未知工具均拒绝；命令子进程环境不继承 provider secrets；取消先拒绝待授权再停止 run。 | 已证明的拦截范围如实呈现；策略失败保持任务不可用，已验证聊天可继续。若 RPC 策略/凭据无法满足，按 ADR 改用独立 Pi SDK worker，仅替换适配实现；不补写自研规划/工具循环。 |
| TASK-101 克隆与项目登记（核心里程碑） | apps/desktop/src-tauri/src/git.rs, apps/desktop/src/features/git/CloneForm.tsx, apps/desktop/src/features/git/GitPanel.tsx, apps/git-service/src/lib.rs, apps/git-service/src/main.rs, apps/git-service/tests/workflow.rs | 已证实 / MAC-GIT-INTEGRATION-001, MAC-GIT-INTEGRATION-002, MAC-GIT-CLONE-ABSENT-TRASH-WORDING-NATIVE-FAIL-001, MAC-GIT-CLONE-CANCEL-AUTH-PICKER-COMPOSITE-001 | 见实施计划对应任务 | 成功才登记完整项目，失败/取消说明实际保留内容；两端凭据与路径流程通过。 |
| TASK-102 按需终端扩展（首版补齐） | apps/desktop/src-tauri/src/agent.rs, apps/desktop/src-tauri/src/processes.rs, apps/desktop/src-tauri/src/search.rs, apps/desktop/src-tauri/tests/search_workflow.rs, apps/desktop/src/features/agent/AgentPanel.tsx, apps/desktop/src/features/agent/ContextPicker.tsx, apps/desktop/src/features/agent/store.ts | 部分证实 / MAC-SEARCH-INTEGRATION-001, MAC-PROCESSES-SERVICE-001, MAC-SEARCH-INTEGRATION-002, MAC-PI-UNACKNOWLEDGED-STOP-OWNED-REAP-NATIVE-001 | 见实施计划对应任务 | 进程状态与界面一致；后台运行可见；退出后不遗留进程。 |
| TASK-034 Cordis 与 React 原生门禁 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src/features/settings/SettingsPanel.tsx | 未证实 / MAC-LAYOUT-APPLY-FAIL-001 | 提供者移除时消费者停用且不再收事件，禁用状态不被自动依赖恢复；50 次启停无租约增长；隔离 JS 只通过消息代理。 | 双端真实 WebView 证据及可复现锁文件；不加载 Node Loader。 |
| TASK-035 八个布局插件与稳定视图迁移 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src/features/settings/SettingsPanel.tsx | 未证实 / MAC-LAYOUT-APPLY-FAIL-001 | 八包安装/启停/卸载/恢复；脏文档、撤销、选区、滚动、Git 草稿与任务保留；中文组词期间延后；失败回旧布局。 | 八套真实布局可用且不复制业务逻辑，功能扩展状态独立于布局。 |
| TASK-036 区域尺寸、主题颜色与组合 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx | 部分证实 / MAC-APPEARANCE-INHERIT-001, MAC-APPEARANCE-ASSET-PRESET-001, MAC-APPEARANCE-RAPID-FAIL-001, MAC-APPEARANCE-ROUNDTRIP-001, MAC-APPEARANCE-BACKGROUND-002 | 全局外观跨项目共用、单项重置、非法值、切包保留对应全局偏好、窗口钳制不反写；键盘调尺寸；缺依赖不执行包。 | 尺寸/颜色重启恢复；两系统缩放可操作；组合不带凭据与绝对路径。 |
| TASK-037 图片背景导入与资源验收 | apps/desktop/src-tauri/src/appearance.rs, apps/desktop/src/App.tsx, apps/desktop/src/features/editor/CodeSurface.tsx, apps/desktop/src/features/editor/store.ts, apps/desktop/src/features/settings/AppearanceProvider.tsx, apps/desktop/src/features/settings/SettingsPanel.tsx | 部分证实 / MAC-APPEARANCE-ASSET-PRESET-001, MAC-APPEARANCE-BACKGROUND-FAIL-001, MAC-APPEARANCE-RAPID-FAIL-001, MAC-APPEARANCE-BACKGROUND-002 | 移动原文件后仍可显示；透明度与遮罩不影响文字；切项目保持全局背景，关闭或更换时释放旧图；清理保留被引用资产；超限/损坏维持旧背景。 | 双端解码/纹理与全进程增量报告；原型截图不替代资源验收。 |

## 证据记录

### MAC-DEBUG-RESOURCE-001

macOS 26.3.1 (25D2128), arm64, Apple M2 Pro, 32 GiB / bundled debug initial; exact executable SHA-256 in metadata.json / native-process-accounting during genuine native GUI operation / pass / partial

实现：scripts/desktop/mac_metrics.py、scripts/desktop/sample_macos.py

步骤：Root launched the actual bundled macOS app through native computer use; PID 73467 → Collected 60 seconds of read-only libproc CPU/physical footprint and ps RSS while root continued native operation → Attributed WebKit, Metal and native dialog helpers through macOS responsibility; inspected excluded WebKit owners → Retained per-process samples, binary hash, environment, summary and explicit debug limitations

58 real samples over 60.0008 seconds; no missing root. Physical footprint median 165.86 MB, P95 215.28 MB, peak 217.21 MB. Native file-dialog helpers increased attributed process count from 10 to 13. Only the accounting/early diagnostic sub-scope is established.

证据：docs/verification/results/debug-initial-60s/metadata.json、docs/verification/results/debug-initial-60s/samples.jsonl、docs/verification/results/debug-initial-60s/summary.json、docs/verification/PERFORMANCE.md

限制：Debug build under active development; not release acceptance.；Real UI activity and native dialog opening occurred; not an idle-CPU or empty-host budget scenario.；No fixed plugin/fixture snapshot, 20-launch series, latency series or 30-minute lifecycle loop yet.；No conclusion on suggested budgets, leaks or final release performance.

### MAC-NATIVE-INITIAL-001

macOS 26.3.1 arm64 / bundled debug initial, PID 73467; active development / root native computer use + independent disk-byte observation / pass / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src/features/editor/FileExplorer.tsx、apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src-tauri/src/files.rs、apps/desktop/src-tauri/src/projects.rs

步骤：Native project picker selected dedicated temporary aurora-web project → Expanded src and opened workspace.ts → Entered ASCII and pasted Chinese; native save followed by disk-byte check → Applied project light theme override in F01

Native project open, real file display/edit/save and project light override succeeded in this path. Independent file read confirms the full pasted Chinese text. Only happy-path subconditions covered.

证据：docs/verification/NATIVE_RUNS.md、docs/verification/screenshots/dev/001-welcome-mist-dark.png、docs/verification/screenshots/dev/002-settings-before-layout-fix.png、docs/verification/screenshots/dev/003-editor-mist-light-before.png、docs/verification/results/native-file-initial/disk-observation.json、docs/verification/results/native-file-initial/workspace.saved.ts

限制：Debug only; visual deviations remain and are being fixed.；Real IME composition untested; automation direct CJK injection dropped characters while paste succeeded.；Save race/external-change/recovery/undo/search/path errors and inheritance persistence remain untested.

### MAC-NATIVE-GIT-001

macOS 26.3.1 arm64 / bundled debug initial; PID 73467 / native GUI operation + independent read-only Git CLI and screenshot review / pass / partial

实现：apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/DiffViewer.tsx、apps/desktop/src-tauri/src/git.rs、apps/git-service/src/lib.rs

步骤：Native Git tab opened theme.css working-tree diff → Native single-file stage and HEAD-to-index review → Entered commit message and invoked commit → Independent Git CLI checked HEAD, committed paths, remaining worktree/index and remotes

HEAD 9a51a595e5654a85725dd522dbb07a8d51c95414 contains only src/theme.css. Index empty; src/workspace.ts remains modified and notes.txt remains untracked. No remote/push.

证据：docs/verification/NATIVE_RUNS.md、docs/verification/screenshots/dev/004-git-staged-commit.png、docs/verification/results/native-git-initial/git-observation.json

限制：Debug build; happy path only.；Selected diff becomes stale after successful commit; separate failure record retained.；Hook/signature errors, scope changes, cancellation and concurrent mutation not covered by this native run.

### MAC-GIT-STALE-DIFF-001

macOS 26.3.1 arm64 / bundled debug initial; PID 73467 / native GUI operation + independent read-only Git CLI and screenshot review / fail / partial

实现：apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/DiffViewer.tsx、apps/desktop/src-tauri/src/git.rs、apps/git-service/src/lib.rs

步骤：Commit staged theme.css through native UI → Observe staged count becomes zero → Compare still-visible HEAD-to-index diff with actual empty index diff

Old debug screenshot retains a nonempty diff labeled current staged changes after commit although actual HEAD-to-index diff is empty; no stale/historical label. Reported to Git implementation agent for invalidation/reload fix.

证据：docs/verification/NATIVE_RUNS.md、docs/verification/screenshots/dev/004-git-staged-commit.png、docs/verification/results/native-git-initial/git-observation.json

限制：Failure observed in old debug bundle; newer source may differ and requires native retest.；Underlying commit contents are correct; failure concerns stale selected diff presentation.

### MAC-PI-INTEGRATION-001

macOS 26.3.1 arm64 / official Pi 1.4.0 runtime plus native Rust adapter integration test; controlled loopback model fixture / agent-run real-process protocol/integration tests; independent evidence and assertion review / pass / partial

实现：apps/desktop/src-tauri/src/agent.rs、packages/pi-policy/horizon-policy.ts、scripts/test-pi-rpc.mjs、scripts/test-pi-native.mjs

步骤：Run real Pi RPC chat with tools disabled against explicit controlled service → Restore session without replay, clear queue/abort, and exercise authentication failure → Run actual Rust broker with allow/deny/unknown-tool and secret-environment checks → Verify task-copy baseline, preserved original index, conditional apply, dirty-buffer proposal and stale disk/editor rejection → Cancel while awaiting permission and await adapter-owned process cleanup

Real Pi 1.4.0 produced RPC response/agent_settled events; cancellation terminal aborted=true; controlled auth failure ends with error. Native integration evidence contains 16 checks backed by assertions for broker authorization, task-copy-only writes, original index preservation, full dirty-buffer baseline, stale apply rejection and cleanup.

证据：research/verification/pi-rpc.json、research/verification/pi-native.json、research/verification/pi-provenance.json、scripts/test-pi-rpc.mjs、scripts/test-pi-native.mjs、apps/desktop/src-tauri/src/agent.rs

限制：Controlled local OpenAI protocol fixture; no real provider credential or live-provider end-to-end result.；Tests call adapter methods and test approval broker directly; native GUI authorization/streaming/review still required.；No macOS keychain UI, runtime installer/upgrade, two-instance or full-workflow resource conclusion from these records.；This record reviews existing agent-run tests and does not claim a second test execution.

### MAC-GIT-INTEGRATION-001

macOS 26.3.1 arm64; Git 2.50.1 Apple Git-155 / horizon-git test profile, 2026-10-31 02:10:33+0800 / agent-run real temporary Git repository integration tests; independent stdout and test-source review / pass / partial

实现：apps/git-service/src/lib.rs、apps/git-service/src/main.rs、apps/git-service/tests/workflow.rs

步骤：cargo test --manifest-path apps/git-service/Cargo.toml -- --nocapture → Inspect retained raw output and assertions for all 12 passing tests → Confirm temporary repositories/local bare remotes own all writes

12 tests passed, 0 failed, exit 0. Covers A/B/C double baselines, index-only commit, unborn/rename unstage, stale token and commit-scope rejection, hook failure preserving index, index-based discard, merge stage sources and explicit stage, history/ref/blob paging including >16MiB UTF-8 boundary, safe clone and local fetch/ffOnly pull/push with non-fast-forward rejection.

证据：apps/git-service/evidence/test-report.json、apps/git-service/tests/workflow.rs、apps/git-service/README.md

限制：Sidecar/service integration evidence, not full native GUI or host lifecycle acceptance.；Clone test checks repository creation/non-overwrite; host project-registration UI remains separately tested.；No network credential/signature integration, native trash interaction, concurrent GUI writes or all error branches proven.；Existing selected-diff GUI failure remains active until a new native retest supersedes it.；No duplicate test execution claimed; evidence produced by Git agent and reviewed here.

### MAC-DEBUG-QUIT-001

macOS 26.3.1 arm64 / bundled debug initial; PID 73467 / native Cmd+Q followed by independent process-table identity check / pass / partial

实现：apps/desktop/src-tauri/src/lib.rs、scripts/desktop/mac_metrics.py

步骤：Root quit bundled debug app using native Cmd+Q → Match all 13 previously observed associated PIDs and start identities against current OS process table

Root PID and all 12 previously associated helper processes absent after native quit. No PID from the recorded set remained with its original start identity.

证据：docs/verification/results/debug-initial-60s/post-quit.json、docs/verification/results/debug-initial-60s/samples.jsonl、docs/verification/PERFORMANCE.md

限制：Single post-quit observation, debug only.；No active Pi/terminal/development processes, unsaved-close branching or external ownership checked in this step.；30-minute lifecycle, listener/subscription/cache counts and release behavior remain untested.

### MAC-NATIVE-BOM-CRLF-001

macOS 26.3.1 arm64 / release candidate 2; native PID 72108, window 13201; not final release / root native computer use + independent disk-byte observation / pass / partial

实现：apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src-tauri/src/files.rs、apps/desktop/src-tauri/src/projects.rs

步骤：Root registered UI Kit as second project through native system picker → Opened src/换行测试.txt; native status showed UTF8BOM and CRLF → Pasted 第三行：中文保存 followed by newline, then native Cmd+S → Independent disk read checked complete decoded contents, BOM and newline bytes

Actual saved file is 51 bytes with UTF-8 BOM, exactly three CRLF sequences, zero bare LF, trailing CRLF, and all expected Chinese text. Second project registers and file opens in this path.

证据：docs/verification/NATIVE_RUNS.md、docs/verification/screenshots/release-candidate/006-ui-kit-bom-crlf.png、docs/verification/results/native-file-release-candidate/disk-observation.json、docs/verification/results/native-file-release-candidate/saved-file.txt

限制：Candidate bundle, not final release.；Single BOM/CRLF paste-save case; no full LF/new-file/no-final-newline or unsupported-encoding native coverage.；Real IME composition, race/external-change behavior and complete project-state isolation remain untested.

### MAC-FILES-INTEGRATION-001

macOS 26.3.1 arm64 / native Rust test profile; agent-run log reviewed 2026-10-31 / real temporary-file/process service integration tests; independent log/assertion review / pass / partial

实现：apps/desktop/src-tauri/tests/files_workflow.rs、apps/desktop/src-tauri/src/files.rs、apps/desktop/src-tauri/src/projects.rs、apps/desktop/src-tauri/src/settings.rs、apps/desktop/src-tauri/src/state.rs

步骤：Review 13 successful files_workflow tests and their complete assertions → Confirm real temporary file bytes, revision errors, recovery data and HostState restart are asserted → Retain APFS early-return and in-process-restart limitations

13 files integration tests pass. Asserts conditional BOM/CRLF save; external disk rejection; older save keeps newer checkpoint dirty; save-as copy preserves original disk/document; rename collision and stable descendant IDs; symlink containment; stale directory cursor; UTF16/mixed-EOL read-only; 55 MB chunked UTF-8 boundary reads and stale-file rejection; normalized project dedup and persisted session; atomic invalid setting rejection.

证据：docs/verification/results/native-integration/native-tests.log、docs/verification/results/native-integration/audit.json

限制：Service integration evidence, not final bundled release/native GUI acceptance.；No second test execution claimed; native_core produced the retained run.；APFS invalid-byte filename branch verifies only lossless path codec after EILSEQ; later real-path/project-scope assertions are skipped on that branch.；HostState recreation is in-process; real abnormal app exit/relaunch, recovery cadence and GUI recovery comparison remain untested.；No file-trash, unsaved-close dialog, IME or complete three-project GUI state acceptance from this suite.

### MAC-SEARCH-INTEGRATION-001

macOS 26.3.1 arm64 / native Rust test profile; agent-run log reviewed 2026-10-31 / real temporary-file/process service integration tests; independent log/assertion review / pass / partial

实现：apps/desktop/src-tauri/tests/search_workflow.rs、apps/desktop/src-tauri/src/search.rs

步骤：Review all six passing search tests and actual bundled-rg launch path → Check Unicode UTF-16 and invalid-UTF8 byte coordinate assertions, ignore handling, truncation/paging and bounded path-index reuse → Review cancellation test and implementation kill/wait before ownership lease releases

Six tests pass. Real rg reports Unicode UTF-16 range 3..5 and invalid-UTF8 byte range 3..9, respects ignore, returns configured 125 matches as 100+25 pages with truncation, cancels within asserted three seconds, and clears owned search resources. Invalid regex returns before spawning; fuzzy path query reuses one bounded cache entry.

证据：docs/verification/results/native-integration/native-tests.log、docs/verification/results/native-integration/audit.json

限制：Service integration evidence, not final bundled release/native GUI acceptance.；No second test execution claimed; native_core produced the retained run.；Configured 125-match cap is covered; default 10,000-match display and complete cache-size limits are not measured here.；Cancellation tests exercise service state directly; immediate GUI feedback, late callback isolation, keyboard focus and project-switch behavior remain separate.；No native on-screen search interaction is represented by these service tests.

### MAC-NATIVE-PROJECT-SEARCH-001

macOS 26.3.1 arm64 / release candidate 2; PID 72108/window 13201; not final release / root native operation report, unchanged native screenshot review and independent disk read / pass / partial

实现：apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src-tauri/src/files.rs、apps/desktop/src-tauri/src/search.rs

步骤：Append unsaved fourth line 未保存：跨项目保留 plus newline to UI Kit file → Switch to Aurora; workspace.ts restored → Switch back to UI Kit; dirty buffer, cursor at line 5 column 1 and expanded tree restored → Cmd+Z removes fourth line; Cmd+Shift+Z restores it → Cmd+W opens three-way unsaved confirmation; cancel retains editor contents → Search disk content 中文保存 and press Return; one result in one file; clicking line 3 result returns to existing dirty buffer at line 3 column 5

Two-project switch retains the unsaved UI Kit fourth line, cursor and tree state. Undo/redo affects the fourth line; close cancellation retains buffer. Real disk search finds one Chinese match in one file and navigation retains the dirty buffer at line 3 column 5. Independent disk bytes remain the prior three-line 51-byte BOM/CRLF file, proving the visible fourth line was not implicitly saved by those actions.

证据：docs/verification/NATIVE_RUNS.md、docs/verification/screenshots/release-candidate/007-search-dirty-project.png、docs/verification/results/native-project-search/observation.json

限制：Candidate only; three-project selection/scroll/drafts/chat and full search option coverage remain untested.；Undo-to-baseline dirty indicator and close-cancel keyboard focus have separate active failure records.；Screenshot captures final search state; earlier transition observations are reported by root.

### MAC-EDITOR-UNDO-DIRTY-001

macOS 26.3.1 arm64 / release candidate 2; PID 72108/window 13201; not final release / root native operation report, unchanged native screenshot review and independent disk read / fail / partial

实现：apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src-tauri/src/files.rs、apps/desktop/src-tauri/src/search.rs

步骤：Undo to saved baseline → Record operator observation and request native retest after editor fix

Root observed native Cmd+Z restore text identical to saved disk baseline while the tab remained marked dirty. Reported to editor implementation for correction and native retest.

证据：docs/verification/NATIVE_RUNS.md、docs/verification/screenshots/release-candidate/007-search-dirty-project.png、docs/verification/results/native-project-search/observation.json

限制：Failure reported in candidate 2; final release may differ and requires actual native retest.；Screenshot 007 is subsequent state, not the exact failure moment; operator report is retained in observation.json.

### MAC-EDITOR-CLOSE-FOCUS-001

macOS 26.3.1 arm64 / release candidate 2; PID 72108/window 13201; not final release / root native operation report, unchanged native screenshot review and independent disk read / fail / partial

实现：apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src-tauri/src/files.rs、apps/desktop/src-tauri/src/search.rs

步骤：Cancel unsaved close → Record operator observation and request native retest after editor fix

Root observed canceling native unsaved-close confirmation preserve contents but return keyboard focus to HTML root rather than the editor context. Reported to editor implementation for correction and native retest.

证据：docs/verification/NATIVE_RUNS.md、docs/verification/screenshots/release-candidate/007-search-dirty-project.png、docs/verification/results/native-project-search/observation.json

限制：Failure reported in candidate 2; final release may differ and requires actual native retest.；Screenshot 007 is subsequent state, not the exact failure moment; operator report is retained in observation.json.

### MAC-GIT-INTEGRATION-002

macOS 26.3.1 arm64; Git 2.50.1 Apple Git-155 / horizon-git test profile, 2026-10-31 02:23:06+0800 / agent-run real temporary Git repository integration tests; independent stdout and test-source review / pass / partial

实现：apps/git-service/src/lib.rs、apps/git-service/src/main.rs、apps/git-service/tests/workflow.rs

步骤：Review retained cargo-test output: 18 tests passed, 0 failed, exit 0 → Inspect six new tests for lock ownership, dirty switch, root/state errors, modify/delete conflict, merge history and repository-bound diff cache → Combine with previously reviewed 12-test A/B/C, commit, remote and paging scope

18 tests pass. Adds index.lock ownership preserved and explicit GIT_LOCKED; dirty branch switch rejected without auto-stash; unborn/detached/non-root/missing-Git distinctions; missing merge stage represented as null and explicit later stage; first-parent merge history and stale cursor; diff cache repository isolation and renamed old-path preservation. Earlier tested A/B/C/index-only commit, hooks, local remotes, paging and conflicts remain passing.

证据：docs/verification/results/git-integration-final/test-report.json、docs/verification/results/git-integration-final/audit.json、apps/git-service/tests/workflow.rs、apps/git-service/README.md

限制：Sidecar/service integration, not full native GUI or host lifecycle acceptance.；New 18-test snapshot supersedes earlier 12-test integration record only; it does not supersede the native stale-selected-diff failure.；Native credential/signature/trash integration and complete GUI error/cancellation paths remain untested.；This is independent evidence review, not a duplicate execution.

### MAC-GIT-PRESSURE-001

macOS 26.3.1 arm64; Git 2.50.1 Apple Git-155 / release horizon-git sidecar SHA-256 e7a37feb1c0e7176bfeeb72116bcabb777e955bc4dada9535fcb13a1cba75206 / agent-run real temporary repository sidecar pressure; independent script/result/hash review / pass / partial

实现：apps/git-service/tests/benchmark.py、apps/git-service/src/lib.rs、apps/git-service/src/main.rs

步骤：Create real 10,000/100,000 untracked paths and request status from release sidecar → Request paginated diff for 52,505,775-byte file → Start real commit hook process then terminate owned process group after approximately 350ms; check no survivors and no HEAD → Audit retained measurements and current release hash

Single samples: 10k status 1,897.04ms / peak group RSS 23,552KiB; 100k status 569.44ms / 19,824KiB, returning 10k with explicit truncation; 52.5MB diff 347.06ms / 74,224KiB, first page 100,042 bytes and continuation cursor. Cancel case whole request duration 412.82ms, exit -15, no remaining group PIDs and no created HEAD.

证据：docs/verification/results/git-integration-final/benchmark-macos.json、docs/verification/results/git-integration-final/benchmark-macos-before.json、docs/verification/results/git-integration-final/audit.json、apps/git-service/tests/benchmark.py、docs/verification/PERFORMANCE.md

限制：One sample per size; no percentile or whole-app memory conclusion.；RSS sums only sidecar process group, not physical footprint/desktop/WebView.；durationMs includes requested 20ms sampling sleep and ps overhead.；Cancel case starts timing before launch, sends SIGTERM after approximately 350ms, then records whole request duration 412.82ms; exact cancellation latency is not measured.；Before sample does not retain prior binary hash; conditions/load are not matched sufficiently for a causal or stable speedup claim.；Process-group stop performed by benchmark harness; native host stop UI/lifecycle are separate.；No formal release host benchmark, 20 launches or 30-minute loop represented here.

### MAC-GIT-CANCEL-PROBE-001

macOS 26.3.1 arm64; Git 2.50.1 Apple Git-155 / release horizon-git sidecar SHA-256 e7a37feb1c0e7176bfeeb72116bcabb777e955bc4dada9535fcb13a1cba75206 / agent-run marker-gated real hook process-group cancellation; independent script/result review / pass / partial

实现：apps/git-service/tests/benchmark.py、apps/git-service/src/lib.rs、apps/git-service/src/main.rs

步骤：Actual pre-commit hook writes a marker then runs sleep → Harness waits for marker before sending SIGTERM to owned process group → Measure signal-to-observed-exit and independently inspect no-survivor/no-HEAD assertions

Same release sidecar hash; hook marker present before signal. Signal sent at request elapsed 586.10ms; observed exit after 25.09ms; whole request 611.19ms. Exit -15, no remaining process-group PIDs, no HEAD created.

证据：docs/verification/results/git-integration-final/cancel-macos.json、docs/verification/results/git-integration-final/cancel-audit.json、apps/git-service/tests/benchmark.py、docs/verification/PERFORMANCE.md

限制：25.09ms is direct SIGTERM process-group call to observed process exit/reader completion, with polling overhead.；Single sample; does not include native UI/task_cancel/host broker path or prove P95.；This supplements the earlier whole-request measurement; it does not replace its historical values.

### MAC-PI-ARCHITECTURE-001

macOS implementation and package dependency boundary / Current source hashes retained in pi-architecture-audit/audit.json; official Pi 1.4.0 integration evidence / independent implementation/dependency audit plus genuine official Pi process integration evidence / pass / full

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/Cargo.toml、apps/desktop/package.json、packages/pi-policy/horizon-policy.ts、packages/pi-policy/package.json

步骤：Read run_pi process launch, configuration, event pump and shutdown paths → Read complete fixed Pi policy extension and inspect product network/API call sites and dependencies → Cross-check official Pi provenance and actual RPC/native broker assertions against architectural boundary

REQ-AI-009 explicitly asks implementation/dependency review. Official Pi owns model calls, planning/tool loop and session memory. Horizon launches fixed Pi RPC, adapts structured events/lifecycle, brokers explicit tool permissions and reviews changes. No host model-API auto-tool loop or universal ACP implementation exists in the reviewed product code. These conditions are fully established without a GUI requirement.

证据：docs/verification/results/pi-architecture-audit/audit.json、docs/verification/results/pi-architecture-audit/pi-native.json、docs/verification/results/pi-architecture-audit/pi-rpc.json、docs/verification/results/pi-architecture-audit/pi-provenance.json

限制：This full verdict is only the architectural prohibition REQ-AI-009; it does not close Pi GUI, provider credentials, installer, performance or other functional requirements.；Controlled model fixture supplies deterministic responses; integration evidence is not a live-provider test.

### MAC-PROCESSES-SERVICE-001

macOS 26.3.1 arm64 / native Rust test profile; 21 tests passed in 5.16s; source/log hash retained / real-process/PTY/HTTP integration tests with independent log/assertion review / pass / partial

实现：apps/desktop/src-tauri/src/processes.rs

步骤：Inspect 21 passing native process tests and child-fixture handling → Check real Chinese PTY bytes, stty 37×99, 8MiB output/2MiB retention, reverse-order stop and other-project survival assertions → Check real owned HTTP port, external listener protection, failure/timeout/cancel/lease cleanup, script discovery/approval/export assertions → Check Tauri MockRuntime AppHandle delivery of four colon-named event topics and rejection of dotted topic

21 tests pass, one HTTP child helper is intentionally ignored by outer test enumeration and spawned by HTTP parent test. Real PTY accepts Chinese input/output and 37×99 size. Background reader consumes 8MiB with 2MiB retained. Dependency start, reverse stop, failures/cancellation, external-port protection, A/B isolation, lease ownership, changed-script authorization, read-only nested discovery and export redaction have explicit assertions. Colon event names deliver original Chinese payload through actual AppHandle event API.

证据：docs/verification/results/processes-service-audit/service-tests.log、docs/verification/results/processes-service-audit/audit.json、docs/verification/PROCESSES_GUI.md

限制：Service/headless tests do not show native Wry terminal display, actual hidden-panel retention, click/input focus, URL opening or lifecycle UI.；AppHandle event test uses MockRuntime; fixed candidate package must prove WebView event reception.；No duplicated execution claimed; owner produced this retained run.

### MAC-PLUGIN-POLICY-001

macOS 26.3.1 arm64 / TS runtime and native policy/package test profiles; fixed raw logs retained / agent-run tests; independent raw-output and assertion review / pass / partial

实现：packages/plugins/tests/runtime.test.ts、apps/desktop/src-tauri/tests/extensions_policy.rs、apps/desktop/src-tauri/src/extensions.rs、packages/plugins/src/runtime.ts、packages/plugins/src/validation.ts

步骤：Read TS six-test runtime output and assertions for eight topology/manifest validation, repeated activation, A/B disposal, dependency order and failure rollback → Read native twelve-test policy output and assertions for persistent pause/global gates, permissions, dependency version/cycle, tombstones and lease release → Inspect four ZIP tests for packaged sample parity, traversal/case collisions, symlinks and size limits

All 6 TS, 12 native policy and 4 package tests pass. Establishes tested gate/ownership/package-validation branches and Cordis cleanup behavior, including project A pause preserving B, restart keeping pauses and uninstall tombstone, missing permission/version/cycle rejection, lease-last-user cleanup and reverse activation-failure disposal.

证据：docs/verification/results/plugin-policy-audit/summary.json、docs/verification/results/plugin-policy-audit/runtime.log、docs/verification/results/plugin-policy-audit/policy.log、docs/verification/results/plugin-policy-audit/package.log、docs/verification/results/plugin-policy-audit/audit.json

限制：Native policy tests directly populate registry fixtures; not installation through desktop AppHandle.；Cordis lifecycle tests use explicit hook fixtures; not native GUI lifecycle.；Required versus optional dependency UI choices, actual install/update rollback and desktop lifecycle remain separate; no full requirement closed from these records.；Eight distinct layout topologies validate structurally; actual eight-layout rendering is not proven by that test.

### MAC-LAYOUT-APPLY-FAIL-001

macOS 26.3.1 arm64 / release candidate 2; prior to fromLayoutId request correction / appearance agent genuine native click report plus independent unchanged screenshot review / fail / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src-tauri/src/appearance.rs

步骤：Open native settings layout page while UI Kit dirty buffer is present → Click paper layout from mist → Observe strict-native-parameter rejection 未知字段 fromLayoutId

Actual layout apply fails with unknown fromLayoutId field; prior mist layout and dirty editor contents remain. Owner corrected payload to planId/digest and typecheck passes, but candidate 3 native retest is pending.

证据：docs/verification/APPEARANCE_GUI.md、docs/verification/screenshots/release-candidate/appearance-01-mist.png、docs/verification/screenshots/release-candidate/appearance-02-layout-apply-error.png

限制：Failure retained until genuine new-package retest supersedes it.；Static payload correction/typecheck does not by itself establish successful layout switch.

### MAC-FILES-INTEGRATION-002

macOS 26.3.1 arm64 / native Rust test profile; retained run: 40 unit / 18 file workflow / 7 search workflow pass / real temporary-file/process service integration tests; independent log/assertion review / pass / partial

实现：apps/desktop/src-tauri/tests/files_workflow.rs、apps/desktop/src-tauri/src/files.rs、apps/desktop/src-tauri/src/projects.rs、apps/desktop/src-tauri/src/settings.rs、apps/desktop/src-tauri/src/state.rs

步骤：Review retained complete 65-pass native output → Read five added file assertions and inherited 13-test scope → Retain explicit scope/HostState/GUI limitations

18 file workflow tests pass, retaining the earlier 13 cases. Added clean-marker checkpoint removal with unchanged disk/baseline and stale-revision rejection; close-plan decisions/retained draft/A-B resource isolation; persisted empty-workspace selection; active-project workspace move; oversized image rejection and real small PNG metadata; stale scope epoch after explicit invalidation/reactivation.

证据：docs/verification/results/native-integration-final/native-close-cache-tests.log、docs/verification/results/native-integration-final/audit.json

限制：Service integration evidence, not final bundled release/native GUI acceptance.；No second test execution claimed; native_core produced the retained run.；APFS invalid-byte filename branch verifies only lossless path codec after EILSEQ; later real-path/project-scope assertions are skipped on that branch.；HostState recreation is in-process; real abnormal app exit/relaunch, recovery cadence and GUI recovery comparison remain untested.；No file-trash, unsaved-close dialog, IME or complete three-project GUI state acceptance from this suite.；The undo test calls document_mark_dirty directly; it does not prove frontend undo computes dirty=false. Existing GUI undo/focus failure records remain.；Scope invalidation is called directly; five-minute auto-sleep is not exercised.；Workspace move is asserted in current state; this test rereads only empty-workspace selection from newly constructed HostState.

### MAC-SEARCH-INTEGRATION-002

macOS 26.3.1 arm64 / native Rust test profile; retained seven-test search workflow output / real temporary-file/process service integration tests; independent log/assertion review / pass / partial

实现：apps/desktop/src-tauri/tests/search_workflow.rs、apps/desktop/src-tauri/src/search.rs

步骤：Review seven passing search tests and retained earlier six cases → Inspect result-set, project-path and terminal-task cache eviction assertions

Seven search workflow tests pass. Earlier Unicode/invalid-byte coordinates, ignore handling, configured 125-match pagination, owned cancellation and invalid-regex assertions remain. Additional eight search completions retain four result sets; eight project cache insertions retain four path indexes; 40 terminal tasks trim to 32 while a live task remains.

证据：docs/verification/results/native-integration-final/native-close-cache-tests.log、docs/verification/results/native-integration-final/audit.json

限制：Service integration evidence, not final bundled release/native GUI acceptance.；No second test execution claimed; native_core produced the retained run.；Cancellation tests exercise service state directly; immediate GUI feedback, late callback isolation, keyboard focus and project-switch behavior remain separate.；No native on-screen search interaction is represented by these service tests.；Configured 125-match cap is covered; default 10,000-match on-screen truncation is not measured.；Path-cache cross-project entries are inserted directly and terminal task states set by test; no GUI lifecycle inference.

### MAC-EXTENSION-NATIVE-001

macOS arm64 / windowless native integration run recorded 2026-10-30T18:37:27Z; exact executable hash unavailable / agent-run actual native AppHandle/QuickJS/Git lifecycle; independent raw report and complete driver assertion review / pass / partial

实现：apps/desktop/src-tauri/examples/extension_smoke.rs、apps/desktop/src-tauri/src/extension_host.rs、apps/desktop/src-tauri/src/extensions.rs

步骤：Explicit grants required for ZIP install; installed/stopped has zero runtime processes → A/B distinct native QuickJS activations receive true project-specific Git view events → Pause A reaps its PID, preserves B refresh; resume gives new activation ID → HostState recreation plus extensions::initialize reload persisted pause; blocks implicit activation until resume → Global disable clears both processes; project enabled override cannot bypass it → Infinite CPU loop faults A while its actual slow Git request and two descendants are in flight; all owned request processes exit; same extension B echo and read-only-change refresh stay working → Uninstall removes sample package/tombstone and all tracked PIDs → Default Git package deletion persists initialize; explicit restore reads original project status

All nine native phases pass in 2,182 ms. Explicit-grant ZIP installation starts no process; real project A/B Git data arrives through colon-named native AppHandle events. Project pause/restart-policy/global disable, new activation IDs, SDK CPU failure with in-flight owned Git cleanup, unaffected B commands, sample uninstall and default Git removal/explicit restore are asserted. Final tracked sidecar/Git/PID lists are empty.

证据：docs/verification/results/extension-native-audit/native-smoke.json、docs/verification/results/extension-native-audit/audit.json

限制：HostState/registry reinitialization occurs inside one smoke process; not OS app quit/relaunch；Event listener is native AppHandle; no WebView view rendering, browser subscriptions or visible command lifecycle proved；197 ms includes failure command, cleanup wait, B echo/refresh and reporting; single sample, not isolated cancellation latency/P95；Git wrapper injects 20-second status delay then delegates to real system Git；Failure isolation proves other QuickJS project and Git call survive; independent native file/editor GUI responsiveness remains untested；Source hash records reviewed version; native report does not bind exact executable hash

### MAC-PI-STREAM-001

macOS arm64 / Official Pi 1.4.0; RPC run 2026-10-30T18:40:11Z and policy transport test 18:42:28Z / Independent retained outputs and complete driver assertions; no repeat execution / pass / partial

实现：scripts/test-pi-rpc.mjs、scripts/test-pi-policy.mjs、packages/pi-policy/horizon-policy.ts

步骤：Real official Pi 1.4.0 RPC waits agent_settled and normal exit for each conversation → 327680-byte Unicode response equals expected repeated text both in deltas and final message; sha256 63d18a6d135b8dcb10ececc549fbb4100097343d1acbad47a482ade7aef85472 → Compaction start/end observed before settled, with successful final stopReason → Existing resume, abort clear_queue, authentication failure and no tools/context/auto-extensions remain passing → Actual checked-in policy transport receives Chinese/emoji over one-byte local Unix socket writes; corrected decoder matches; removing setEncoding reproduces corruption

Real Pi delivers 327,680 UTF-8 bytes with complete streamed/final equality and expected SHA-256, completes compaction, then agent_settled and normal exit. Actual fixed policy transport preserves Chinese and emoji across one-byte Unix socket writes; prior decoder variant reproducibly corrupts those bytes.

证据：docs/verification/results/pi-stream-audit/pi-rpc.json、docs/verification/results/pi-stream-audit/pi-rpc.log、docs/verification/results/pi-stream-audit/pi-policy-unicode.json、docs/verification/results/pi-stream-audit/audit.json

限制：Controlled local model service, no live provider credentials；Pi RPC test bypasses native Horizon broker and visible chat pagination; not GUI long-conversation evidence；Policy transport test transpiles real implementation but stubs schema constructors and tool registration；Reported elapsed values are individual protocol-test durations, not product performance budgets

### MAC-APPEARANCE-INHERIT-001

macOS 26.3.1 arm64 / release candidate 2; native PID 72108/window 13201; before candidate-3 fixes / appearance agent genuine native GUI operations; independent unchanged screenshot and exported-byte review / pass / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/appearance.rs

步骤：Set project sidebar 280 while global remains 240 → Change global to 260; project remains 280; reset project inheritance to 260 and then global reset to plugin 240 → Choose paper theme while retaining mist layout

Real project/global sidebar override and restore-inheritance sequence succeeds. Screenshots independently show project override 280 and inherited global 260. Operator also confirms independent paper theme while mist layout remains selected.

证据：docs/verification/APPEARANCE_GUI.md、docs/verification/results/appearance-candidate2/observation.json、docs/verification/results/appearance-candidate2/pixels.json、docs/verification/results/appearance-candidate2/appearance-with-background.json、docs/verification/screenshots/release-candidate/appearance-03-size-project-override.png、docs/verification/screenshots/release-candidate/appearance-04-size-inherited.png

限制：Candidate-2 scoped sequence; keyboard resize, actual drag, restart persistence, narrow clamping and all layout fields remain untested；Independent-theme switch is operator report, not retained screenshot；Does not close background/rapid-input/layout failures

### MAC-APPEARANCE-ASSET-PRESET-001

macOS 26.3.1 arm64 / release candidate 2; native PID 72108/window 13201; before candidate-3 fixes / appearance agent genuine native GUI operations; independent unchanged screenshot and exported-byte review / pass / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/appearance.rs

步骤：Import local 320x180 PNG, move original, close/reopen settings and observe retained preview → Save named appearance preset, export with asset, import without auto-apply, explicitly apply to project → Independently decode embedded PNG, verify SHA-256/assetId and compare every sRGB RGBA pixel with moved source

Native source-move preview and named preset export/import/explicit apply succeed for this fixture. Export is 3,452 bytes; embedded asset sha256 613103d6e17e2e449cd5043665877a3b7192e48dc14b11a623acf4e6f64cc690 matches assetId. Embedded and moved original are both 320x180 with identical pixels after import normalization.

证据：docs/verification/APPEARANCE_GUI.md、docs/verification/results/appearance-candidate2/observation.json、docs/verification/results/appearance-candidate2/pixels.json、docs/verification/results/appearance-candidate2/appearance-with-background.json、docs/verification/screenshots/release-candidate/appearance-06-background-source-moved.png、docs/verification/screenshots/release-candidate/appearance-07-preset-import-apply.png

限制：Actual editor background remains occluded; separate failure record retained；No app restart, complete display regions/fit combinations, asset decoding cleanup or missing-dependency case covered；Temporary exported filename normalized after native save; bytes unchanged

### MAC-APPEARANCE-BACKGROUND-FAIL-001

macOS 26.3.1 arm64 / release candidate 2; native PID 72108/window 13201; before candidate-3 fixes / appearance agent genuine native GUI operations; independent unchanged screenshot and exported-byte review / fail / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/appearance.rs

步骤：Select editor region, contain fit, 40% image visibility and 40% overlay → Close settings and observe real editor surface

Imported asset preview is visible but actual editor surface remains opaque with no background image. Source CSS fix is pending candidate-3 native retest.

证据：docs/verification/APPEARANCE_GUI.md、docs/verification/results/appearance-candidate2/observation.json、docs/verification/results/appearance-candidate2/pixels.json、docs/verification/results/appearance-candidate2/appearance-with-background.json、docs/verification/screenshots/release-candidate/appearance-05-background-editor.png、docs/verification/screenshots/release-candidate/appearance-06-background-source-moved.png

限制：Screenshots capture actual occlusion and matching background setting; source patch alone does not supersede failure

### MAC-APPEARANCE-RAPID-FAIL-001

macOS 26.3.1 arm64 / release candidate 2; native PID 72108/window 13201; before candidate-3 fixes / appearance agent genuine native GUI operations; independent unchanged screenshot and exported-byte review / fail / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/appearance.rs

步骤：Change background region, fit and opacity rapidly in candidate 2 → Observe an earlier setting revert after delayed save response

Operator reproduces earlier background fields reverting during rapid changes. Owner added overlapping optimistic-change tracking and passing regression cases; candidate-3 native replay remains pending.

证据：docs/verification/APPEARANCE_GUI.md、docs/verification/results/appearance-candidate2/observation.json、docs/verification/results/appearance-candidate2/pixels.json、docs/verification/results/appearance-candidate2/appearance-with-background.json、docs/verification/screenshots/release-candidate/appearance-06-background-source-moved.png

限制：Reported by actual operator; no screenshot shows the exact intermediate revert；Unit/type checks do not replace native retest

### MAC-RECOVERY-NATIVE-001

macOS 26.3.1 arm64 / release candidate 3; first restart recovery and subsequent retained-quit relaunch / root actual native click/input report plus independent disk-byte read / pass / partial

实现：apps/desktop/src/features/editor/store.ts、apps/desktop/src/features/editor/RecoveryNotice.tsx、apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src-tauri/src/files.rs、apps/desktop/src-tauri/src/state.rs

步骤：Candidate-2 native Cmd+Q exits, retained draft remains → Candidate-3 cold start offers recovery; root opens read-only draft/disk comparison → Root explicitly restores fourth line to dirty editor → Independent disk read confirms prior baseline unchanged → Cmd+Q now displays unified close plan; cancel remains in app

Candidate-3 exposes persisted draft and disk comparison, then explicit restoration produces dirty fourth-line buffer. Disk remains exact 51-byte BOM/CRLF baseline with sha256 77fbe3adb6b5117f9ce42396a4c93f542b608fa0d7f4d9c5c55667bbe64b32d3. Native Cmd+Q now enters shared decision dialog and cancel works in this run.

证据：docs/verification/results/native-recovery-before-candidate3/checkpoint.json、docs/verification/results/native-recovery-before-candidate3/observation.json、docs/verification/results/native-recovery-candidate3/observation.json、docs/verification/results/native-recovery-candidate3/disk-after-restoration.txt

限制：Only initial restoration/no-write and close-cancel subpaths; subsequent retained-quit relaunch fails and is recorded separately；No screenshot captured in this short transition; UI observations are root operator report；Previous candidate-2 quit was a normal process exit bypassing dirty confirmation; not a forced-crash test

### MAC-RECOVERY-RELAUNCH-FAIL-001

macOS 26.3.1 arm64 / release candidate 3; first restart recovery and subsequent retained-quit relaunch / root actual native click/input report plus independent disk-byte read / fail / partial

实现：apps/desktop/src/features/editor/store.ts、apps/desktop/src/features/editor/RecoveryNotice.tsx、apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src-tauri/src/files.rs、apps/desktop/src-tauri/src/state.rs

步骤：After restored dirty buffer, native Cmd+Q → Choose retain checkpoint and process exit; root ps confirms absence → Relaunch candidate 3 and retry failed editor

Relaunch after successful retain-checkpoint exit reports exact error Selection points outside of document. Retry also fails. Editor owner is correcting session/recovery CRLF and selection boundaries; no post-fix native evidence yet.

证据：docs/verification/results/native-recovery-before-candidate3/checkpoint.json、docs/verification/results/native-recovery-before-candidate3/observation.json、docs/verification/results/native-recovery-candidate3/observation.json、docs/verification/results/native-recovery-candidate3/disk-after-restoration.txt

限制：Failure is actual native operator report; capture of the exact error was not retained by this background verifier；Initial recovery display/explicit restoration still valid as partial evidence; complete recovery lifecycle remains failed until new-package retest

### MAC-EXTENSION-NATIVE-002

macOS arm64 / windowless native integration run recorded 2026-10-30T18:50:14Z; exact executable hash unavailable / agent-run actual native AppHandle/QuickJS/Git lifecycle; independent raw report and complete driver assertion review / pass / partial

实现：apps/desktop/src-tauri/examples/extension_smoke.rs、apps/desktop/src-tauri/src/extension_host.rs、apps/desktop/src-tauri/src/extensions.rs

步骤：Explicit grants required for ZIP install; installed/stopped has zero runtime processes → A/B distinct native QuickJS activations receive true project-specific Git view events → Pause A reaps its PID, preserves B refresh; resume gives new activation ID → HostState recreation plus extensions::initialize reload persisted pause; blocks implicit activation until resume → Global disable clears both processes; project enabled override cannot bypass it → Infinite CPU loop faults A while its actual slow Git request and two descendants are in flight; all owned request processes exit; same extension B echo and read-only-change refresh stay working → Uninstall removes sample package/tombstone and all tracked PIDs → Default Git package deletion persists initialize; explicit restore reads original project status → Production ZIP dependency fixture genuinely activates editor dependent process → stopDependents=false with discard decision returns DEPENDENCY_UNAVAILABLE; entire A/B open document metadata, checkpoint bytes and source bytes unchanged; dependent command still alive → Injected B discard decision returns PERMISSION_DENIED; exact A/B snapshots unchanged → Edit+newcheckpoint after prepare makes earlier plan fail STALE_VERSION even though checkpoint is up to date; current snapshot unchanged → Fresh valid retainCheckpoint closes A, preserves exact latest revision-2 checkpoint and original source, leaves B exact snapshot unchanged and reaps dependent process

All fourteen actual native phases pass in 2,261 ms with zero remaining tracked sidecar/Git/PIDs. Earlier install/runtime/ownership lifecycle remains passing. New real ZIP editor-dependent fixture proves dependency refusal, out-of-plan B discard, and stale document plans all reject before changing exact A/B documents/checkpoint/source snapshots; fresh valid retain closes A and dependent process while retaining latest revision-2 recovery bytes and preserving B.

证据：docs/verification/results/extension-native-final/native-smoke.json、docs/verification/results/extension-native-final/audit.json

限制：HostState/registry reinitialization occurs inside one smoke process; not OS app quit/relaunch；Event listener is native AppHandle; no WebView view rendering, browser subscriptions or visible command lifecycle proved；177 ms includes failure command, cleanup wait, B echo/refresh and reporting; single sample, not isolated cancellation latency/P95；Git wrapper injects 20-second status delay then delegates to real system Git；Failure isolation proves other QuickJS project and Git call survive; independent native file/editor GUI responsiveness remains untested；Source hash records reviewed version; native report does not bind exact executable hash；Document edits/checkpoints are production file API calls inside the native driver; frontend prepareDeactivate/export and visible confirmation remain separate

### MAC-APPEARANCE-ROUNDTRIP-001

macOS 26.3.1 arm64 / release candidate 3; native PID 33639/window 13433; not final release / appearance agent native GUI operation, independent original PNG/reference review / pass / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src/features/editor/store.ts、apps/desktop/src-tauri/src/appearance.rs

步骤：Append unsaved // layout-switch-undo-check to Aurora workspace.ts and move caret to line 1 column 1 → Choose all eight actual layout plugins and independent same-name themes; return to mist → Verify marker, dirty state and caret retained in each layout → Native Cmd+Z removes marker and returns to saved state with existing Chinese text intact

Eight layouts switch successfully through native controls, preserving tested dirty text and caret; undo after roundtrip returns to clean baseline. Candidate-2 fromLayoutId rejection and dirty-after-undo subcase are resolved in this actual run. Independent visual review still finds palette/geometry/structure differences.

证据：docs/verification/APPEARANCE_GUI.md、docs/verification/APPEARANCE_VISUAL_REVIEW.md、docs/verification/screenshots/appearance-candidate3/01-mist.png、docs/verification/screenshots/appearance-candidate3/02-paper.png、docs/verification/screenshots/appearance-candidate3/03-orbit.png、docs/verification/screenshots/appearance-candidate3/04-graphite.png、docs/verification/screenshots/appearance-candidate3/05-celadon.png、docs/verification/screenshots/appearance-candidate3/06-iris.png、docs/verification/screenshots/appearance-candidate3/07-sand.png、docs/verification/screenshots/appearance-candidate3/08-aurora.png

限制：One file/project; no full three-project editor/Git/Agent state proof；No IME-composition, layout-disable/fallback or package uninstall behavior tested here；End-of-roundtrip undo outcome is operator report; per-layout PNGs capture the pre-undo marker and caret；Functional sub-scope only; no whole visual requirement closed

### MAC-APPEARANCE-BACKGROUND-002

macOS 26.3.1 arm64 / release candidate 3; native PID 33639/window 13433; not final release / appearance agent native GUI operation, independent original PNG/reference review / pass / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src/features/editor/store.ts、apps/desktop/src-tauri/src/appearance.rs

步骤：Apply prior imported image preset in candidate 3 → Choose editor/sidebar/workbench regions and record original native PNGs → With confirmed number-field focus, rapidly enter visibility 30 and overlay 65, then position 25 and 75 → Close and reopen settings: sidebar/cover/30/65/25/75 persist → Turn background off and observe solid workbench

Original PNGs show imported image in each chosen region, with code text and gutter readable. Reliable native keyboard path retains all six changed settings after reopen; old occlusion and rapid-update rollback failures no longer reproduce.

证据：docs/verification/APPEARANCE_GUI.md、docs/verification/APPEARANCE_VISUAL_REVIEW.md、docs/verification/screenshots/appearance-candidate3/09-background-editor.png、docs/verification/screenshots/appearance-candidate3/10-background-sidebar.png、docs/verification/screenshots/appearance-candidate3/11-background-workbench.png

限制：Setting persistence/rapid input comes from native operator report; PNGs show rendered region outcomes；No process/resource measurement establishes decoded-image release；Controlled image fixture differs from G05 reference; no full visual pass

### MAC-CLOSE-STALE-SESSION-001

macOS 26.3.1 arm64 / release candidate 3; native PID 33639/window 13433; not final release / root native Cmd+Q operation plus independent original screenshot review / fail / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src/features/editor/store.ts、apps/desktop/src-tauri/src/appearance.rs

步骤：After candidate-3 layout/background sequence, request normal quit with Cmd+Q → Observe app remains open and displays 项目上下文已过期 instead of exit flow → Root stops exact owned PID after preserving failed-state capture

Candidate 3 cannot complete requested normal quit after project/session epoch drift; toast explicitly reports 项目上下文已过期. Screenshot retains the app and clean workspace editor. New source changes await candidate-4 native retest.

证据：docs/verification/screenshots/appearance-candidate3/14-close-stale-session.png、docs/verification/APPEARANCE_VISUAL_REVIEW.md

限制：Single actual sequence; screenshot itself does not identify the exact epoch transition；Subsequent targeted process termination is cleanup, not a successful application quit

### MAC-EXTENSION-NATIVE-003

macOS arm64 / windowless native integration run recorded 2026-10-30T19:03:25.755767+00:00; exact executable hash unavailable / agent-run actual native AppHandle/QuickJS/Git lifecycle; independent raw report and complete driver assertion review / pass / partial

实现：apps/desktop/src-tauri/examples/extension_smoke.rs、apps/desktop/src-tauri/src/extension_host.rs、apps/desktop/src-tauri/src/extensions.rs、apps/desktop/src-tauri/src/extensions/presets.rs

步骤：Explicit grants required for ZIP install; installed/stopped has zero runtime processes → A/B distinct native QuickJS activations receive true project-specific Git view events → Pause A reaps its PID, preserves B refresh; resume gives new activation ID → HostState recreation plus extensions::initialize reload persisted pause; blocks implicit activation until resume → Global disable clears both processes; project enabled override cannot bypass it → Infinite CPU loop faults A while its actual slow Git request and two descendants are in flight; all owned request processes exit; same extension B echo and read-only-change refresh stay working → Uninstall removes sample package/tombstone and all tracked PIDs → Default Git package deletion persists initialize; explicit restore reads original project status → Production ZIP dependency fixture genuinely activates editor dependent process → stopDependents=false with discard decision returns DEPENDENCY_UNAVAILABLE; entire A/B open document metadata, checkpoint bytes and source bytes unchanged; dependent command still alive → Injected B discard decision returns PERMISSION_DENIED; exact A/B snapshots unchanged → Edit+newcheckpoint after prepare makes earlier plan fail STALE_VERSION even though checkpoint is up to date; current snapshot unchanged → Fresh valid retainCheckpoint closes A, preserves exact latest revision-2 checkpoint and original source, leaves B exact snapshot unchanged and reaps dependent process → Production task_cancel and preset apply reject a pre-cancelled request before policy/document mutation; only task registration is controlled transport bookkeeping → Development preset enables terminal and launch while native resource tables and QuickJS remain zero; layout/theme policy unchanged → Minimal preset stops actual Git activation and dependent QuickJS PID, removes leases, preserves editor metadata/recovery/source bytes and layout/theme policy → Missing custom package rejects without install or policy/doc changes; selected dependency closure includes Git → Project preset cannot bypass global disabled terminal; rejected apply preserves policy/documents

All twenty native phases pass in 2,905 ms; zero remaining tracked sidecars, Git or owned PIDs. Prior lifecycle and document-stop assertions remain passing. Five added capability-preset cases establish prepare/cancel side-effect refusal, lazy development enablement, real minimal-preset process/lease stop, missing-package/dependency behavior, and global-disable precedence.

证据：docs/verification/results/extension-native-presets/native-smoke.json、docs/verification/results/extension-native-presets/audit.json

限制：HostState/registry reinitialization occurs inside one smoke process; not OS app quit/relaunch；Event listener is native AppHandle; no WebView view rendering, browser subscriptions or visible command lifecycle proved；272 ms includes failure command, cleanup wait, B echo/refresh and reporting; single sample, not isolated cancellation latency/P95；Git wrapper injects 20-second status delay then delegates to real system Git；Failure isolation proves other QuickJS project and Git call survive; independent native file/editor GUI responsiveness remains untested；Source hash records reviewed version; native report does not bind exact executable hash；Document edits/checkpoints are production file API calls inside the native driver; frontend prepareDeactivate/export and visible confirmation remain separate；Cancellation task bookkeeping is seeded by the windowless harness; production task_cancel and preset apply execute normally, not WebView horizon_start；No visible preset impact dialog or default review-profile GUI observed

### MAC-RECOVERY-RELAUNCH-002

macOS 26.3.1 arm64 / release candidate4a; horizon-desktop SHA256 52aa5d3af6b69c0c07c7f808ffd9606e57af324b6809fab72050d7f17b716b09; non-final / root genuine native GUI report plus independent disk/registry and original final-state PNG review / pass / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/features/editor/store.ts、apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src-tauri/src/state.rs、apps/desktop/src-tauri/src/projects.rs、apps/desktop/src-tauri/src/lib.rs

步骤：Start candidate4a Aurora then switch formerly sleeping UI Kit; disk 3 lines displayed normally, cursor line4, no Selection error → Click restore: dirty fourth line returns and recovery saved indicator → Cmd+Q retain, apply, root ps confirms no Horizon process → Relaunch UI Kit: original disk 3 lines plus one recovery notice, cursor line4, no Selection error

Candidate4a shows stored recovery, restores fourth line dirty, retains it on normal quit, and relaunches without Selection points outside of document. Disk remains exact51B BOM/3CRLF baseline SHA77fbe3adb6b5117f9ce42396a4c93f542b608fa0d7f4d9c5c55667bbe64b32d3. Subsequent display correctly offers pending draft rather than silently writing it.

证据：docs/verification/results/native-recovery-candidate4a/observation.json、docs/verification/results/native-recovery-candidate4a/disk-after-relaunch.txt、docs/verification/results/bundle-candidate4a/audit.json

限制：Native operation sequence supplied by root; verifier only captures and reads disk；Retained-quit/relaunch path, not abnormal crash proof；Candidate4a awaits separate theme registry/Pi changes; not final build；Recovery prompt screenshot missed: by capture time window13510 no longer existed; no image artifact claimed

### MAC-SLEEP-QUIT-002

macOS 26.3.1 arm64 / release candidate4a; horizon-desktop SHA256 52aa5d3af6b69c0c07c7f808ffd9606e57af324b6809fab72050d7f17b716b09; non-final / root genuine native GUI report plus independent disk/registry and original final-state PNG review / pass / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/features/editor/store.ts、apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src-tauri/src/state.rs、apps/desktop/src-tauri/src/projects.rs、apps/desktop/src-tauri/src/lib.rs

步骤：UI Kit shows disk3lines and pending recovery draft → Project settings > sleep plan contains no dirty document; apply returns welcome → Cmd+Q opens normal exit dialog without stale scope; apply exits; root ps confirms absence → Relaunch remains welcome and does not reactivate UI Kit

Manual project sleep returns welcome; normal Cmd+Q then exits through shared dialog without stale-context error. Relaunch PNG shows welcome with both registered projects. Independently read registry app session has activeProjectId=null, retaining UI Kit tab/selection metadata without reactivating it.

证据：docs/verification/results/native-recovery-candidate4a/sleep-observation.json、docs/verification/screenshots/recovery-candidate4a/02-sleep-relaunch-welcome.png、docs/verification/results/bundle-candidate4a/audit.json

限制：Screenshot proves final welcome state; intervening native sleep/quit sequence is root operator report；No active terminal, Pi or development process tested in this path；Manual sleep path; 30-minute idle auto-sleep threshold not exercised

### MAC-PI-INTEGRATION-002

macOS 26.3.1 arm64 / Official Pi1.4.0 actual native Rust broker; controlled localhost provider;2026-10-30T19:07:48Z / Agent-run real Pi/Rust broker test; independent raw log, fixture and assertion review / pass / partial

实现：apps/desktop/src-tauri/src/agent.rs、packages/pi-policy/horizon-policy.ts、scripts/test-pi-rpc.mjs、scripts/test-pi-native.mjs

步骤：Run real Pi RPC chat with tools disabled against explicit controlled service → Restore session without replay, clear queue/abort, and exercise authentication failure → Run actual Rust broker with allow/deny/unknown-tool and secret-environment checks → Verify task-copy baseline, preserved original index, conditional apply, dirty-buffer proposal and stale disk/editor rejection → Cancel while awaiting permission and await adapter-owned process cleanup → Actual context_prepare rejects21items and >256KiB, accepts exact256KiB, rejects stale disk/editor versions and split UTF16 surrogate → Real Pi receives327680byte Unicode response while a native Channel never acknowledges; canonical disk body exact, final reference/preview bounded and event ring<=512KiB → Three real Pi auth-owner variants use isolated configuration directories; controlled HTTP fixture rejects incorrect Authorization and all three succeed; original legacy auth.json unchanged → Native cache tests: 32KiB UTF8 pages reassemble327680bytes; history206messages pages100/100/6; cancelled read retains partialUTF8 record; >4MiB record rejected without oversize pending buffer;32MiB disk limit preserves prior history

Actual Pi/native integration succeeds with32named assertions (9.11s test execution). Context limits and stale versions reject correctly; unacknowledged native Channel still persists exact327680byte Unicode body, returning bounded final reference. Runtime/Horizon/external auth-owner directories remain separate and actual controlled HTTP Authorization matches each expected fake credential, preserving legacy auth. Four native cache tests also pass in retained49pass/2ignored lib log.

证据：docs/verification/results/pi-native-final/pi-native.json、docs/verification/results/pi-native-final/pi-native.log、docs/verification/results/pi-native-final/pi-cache-tests.json、docs/verification/results/pi-native-final/candidate4-lib-tests.log、docs/verification/results/pi-native-final/audit.json

限制：Controlled local OpenAI-protocol fixture; fake test credentials only, no live-provider or macOS keychain UI proof；Adapter methods, seeded test task registration and native Channel; GUI authorization/streaming/review/scroll remain separate；The named checks are assertions within one native integration test, not32separate test cases；Cache tests are native/unit scope; no whole-app memory/CPU or30minute behavior claim；No runtime installer/upgrade/uninstall GUI proof from these records；Existing data copies preserve raw producer output; no second execution claimed

### MAC-WORKSPACE-GUI-001

macOS26.3.1 arm64 / candidate4a; main executableSHA25652aa5d3af6b69c0c07c7f808ffd9606e57af324b6809fab72050d7f17b716b09 / Actual native workspace management; independent PNG/registry/root-directory check and write-path review / pass / full

实现：apps/desktop/src/App.tsx、apps/desktop/src-tauri/src/projects.rs、apps/desktop/src-tauri/src/state.rs

步骤：Welcome > overview > create 验收·空工作区; empty group becomes current → Rename group 验收·项目分组 → Manage UI Kit: move to new group and pin; save: one project only in group/navigation → Remove new group with explicit migration-to-default and preserve-disk notice → Default group now contains2projects; move UI Kit upward to order UI Kit,Aurora Web

Default workspace exists. Native create/rename of temporary workspace, project membership move, explicit delete-to-default migration and project ordering all work. Independent final registry contains one default workspace with UI Kit then Aurora, pinned UI Kit; both exact root paths still exist. Reviewed create/update/remove methods persist only grouping/reference metadata, never move/delete source roots. This closes workspace-organization requirement only.

证据：docs/verification/results/workspace-candidate4a/observation.json、docs/verification/results/workspace-candidate4a/registry.json、docs/verification/screenshots/recovery-candidate4a/03-workspace-moved-project.png、docs/verification/screenshots/recovery-candidate4a/04-workspace-remove-reorder.png

限制：Screenshots retain moved-group and final-order states; intervening native actions supplied by root operator；No claim for separate project removal, dirty/resource-close or file operation requirements

### MAC-PROJECT-MEMBERSHIP-001

macOS26.3.1 arm64 / candidate4a; main executableSHA25652aa5d3af6b69c0c07c7f808ffd9606e57af324b6809fab72050d7f17b716b09 / Actual native workspace management; independent PNG/registry/root-directory check and write-path review / pass / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src-tauri/src/projects.rs、apps/desktop/src-tauri/src/state.rs

步骤：Welcome > overview > create 验收·空工作区; empty group becomes current → Rename group 验收·项目分组 → Manage UI Kit: move to new group and pin; save: one project only in group/navigation → Remove new group with explicit migration-to-default and preserve-disk notice → Default group now contains2projects; move UI Kit upward to order UI Kit,Aurora Web

Native project membership move and pin/order succeed; final registry and navigation agree. Project removal and display-name rename are separate untested subcases.

证据：docs/verification/results/workspace-candidate4a/observation.json、docs/verification/results/workspace-candidate4a/registry.json、docs/verification/screenshots/recovery-candidate4a/03-workspace-moved-project.png、docs/verification/screenshots/recovery-candidate4a/04-workspace-remove-reorder.png

限制：Screenshots show moved project and final group/order, intermediate create/rename/confirmation supplied by native operator；Project removal, display-name rename and retained-history cleanup not tested by workspace deletion；Full project-directory contents not rehashed; both roots exist and independent prior51byte document baseline retained

### MAC-FLOW-MAPPING-001

Platform-independent design traceability; reviewed for macOS scope / 0.4baseline design/document update; unchanged104requirement/73pageIDs / Independent source/document traceability audit plus generated design navigation check / pass / full

实现：docs/implementation/TRACEABILITY.md、docs/ux/INTERACTION_SPEC.md、design/SCREEN_INDEX.md、design/source/screens.json、design/source/app.js

步骤：Each path maps product requirement IDs, concrete current page IDs, cancel/return and failure/recovery → Concrete frontend method names checked: git_mutate(stage/commit/push), agent_interaction_answer, launch_prepare/start/stop/restart → All30H05navigation links render and lead to known screen keys → All8H05style containers fit horizontal bounds → Original8H05referencePNG hashes unchanged

Five required paths now each link requirement→currentpages→success/cancel/failure recovery. Added launch mapping uses existing A06/F04/E01. All30H05links work across knownscreenkeys;8style layouts fit. All73screen IDs and8referencePNG hashes unchanged. Closes mapping deliverable, not runtime behavior of those paths.

证据：docs/verification/results/flow-mapping-audit/audit.json、docs/verification/results/flow-mapping-audit/before.json、docs/verification/results/flow-mapping-audit/render-check.json、docs/implementation/TRACEABILITY.md

限制：This requirement is a mapping deliverable; actual product path execution remains in separate GUI evidence；Historical H05referencePNGs still show4paths and are retained unchanged as prior design evidence

### MAC-EDITOR-BLANK-001

macOS26.3.1 arm64 / candidate4b; horizon-desktop SHA2563889afae5e71e6f14a4a57297b30b6c0a65d07f0e426bddcdbadf1a261cd3d13 / Independent inspection of three original native captures separated by actual project/extension actions; disk byte copy / fail / partial

实现：apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src/features/editor/store.ts、apps/desktop/src/App.tsx

步骤：Activate sample extension across Aurora and UI Kit projects using actual native controls → Inspect selected files in captured main workbench after multiple subsequent lifecycle actions → Independently read both actual source files and preserve byte copies

UI Kit and Aurora selected tabs, breadcrumb, recovery/status indicators render but body area contains neither text nor line numbers. Repeated later captures show same result, including Aurora without background image. Both captured footers show line4column1. Disk files remain nonempty with original expected contents.

证据：docs/verification/results/editor-blank-candidate4b/observation.json、docs/verification/screenshots/plugins-candidate4b/005-live-git-b.png、docs/verification/screenshots/plugins-candidate4b/011-rollback-live.png、docs/verification/screenshots/plugins-candidate4b/015-b-survives-a-failure.png

限制：Underlying cause not determined by screenshot; renderer/cache attachment under owner investigation；No typing/saving/recovery action issued by verifier; not evidence of disk data loss；Current lifecycle sample remains valid diagnosis of this known-defect build, not successful final editor acceptance

### MAC-LIFECYCLE-DIAGNOSTIC-4B-001

macOS26.3.1 arm64; Apple M2 Pro 10 cores /32GiB / candidate4b; main SHA256 3889afae5e71e6f14a4a57297b30b6c0a65d07f0e426bddcdbadf1a261cd3d13 / Passive full attributed-process sampling during actual native plugin GUI; independent postquit PID/start-identity audit / pass / partial

实现：scripts/desktop/sample_macos.py、scripts/desktop/mac_metrics.py、apps/desktop/src-tauri/src/extensions.rs

步骤：Collect actual native plugin lifecycle actions, phase changes and per-process physical footprint/CPU at2s interval → Root native Cmd+Q and confirm process-and-exit → Independently compare every22observed owned PID/start identities against current process table → Interrupt collector by SIGINT after coordinated rebuild decision; preserve summary and raw samples

508samples/1049.66s retained;483samples with root present. Whole attributed footprint peak431858016bytes. Native quit followed by22/22known owned process identities absent; stale debug74411 anditsWebKit never included. Actual plugin workload and known editor blank-view defect are retained asdiagnosis.

证据：docs/verification/results/candidate4b-lifecycle-30m/metadata.json、docs/verification/results/candidate4b-lifecycle-30m/samples.jsonl、docs/verification/results/candidate4b-lifecycle-30m/summary.json、docs/verification/results/candidate4b-lifecycle-30m/audit.json、docs/verification/results/candidate4b-lifecycle-30m/post-quit.json、docs/verification/results/candidate4b-lifecycle-30m/operator-actions.jsonl

限制：Run intentionally stopped before30minutes to rebuild known editor defect; not lifecycle acceptance；Dynamic UI/file-picker/plugin workload, not steady idle/read/diff/Pi budget；No live listener/subscription counters inthisbuild; not measured；Sampling can miss processes withlifetimes shorter than2s; exactquitlatency notmeasured

### MAC-PLUGIN-GUI-4B-001

macOS26.3.1 arm64;1280×800 native window / candidate4b; main SHA256 3889afae5e71e6f14a4a57297b30b6c0a65d07f0e426bddcdbadf1a261cd3d13 / Actual native GUI by plugin operator; independent original PNG/registry/source/recovery-byte audit and passive process correlation / pass / partial

实现：apps/desktop/src/features/plugins/PluginCenter.tsx、apps/desktop/src/features/plugins/PluginImpact.tsx、apps/desktop/src-tauri/src/extensions.rs、apps/desktop/src-tauri/src/extension_host.rs

步骤：Native local ZIP permission dialog starts unchecked; install leaves package disabled → Explicit enable/activate displays real A/B Git changes; pause A retains B → Authorize added project.read during 0.1.1 update; rollback 0.1.0 and reactivate → Developer 0.1.2 reload preserves A includeUntracked=false while B inherits true → A exception removes its contributions while B remains usable; global disable lists A/B and owned PID81045; uninstall preserves private settings

25 original 1280×800 PNGs verified; operator 26 actions. Actual sample view matches independent fixture Git status; A/B settings differ as selected. Impact dialog identifies project/root/resource PID/ownership. Eight QuickJS process identities observed over real activation/update/reload; all absent after global stop/uninstall. Final registry marks sample uninstalled and retains A private config.

证据：docs/verification/PLUGINS_GUI.md、docs/verification/results/plugins-candidate4b/actions.json、docs/verification/results/plugins-candidate4b/summary.json、docs/verification/results/plugins-candidate4b/audit.json、docs/verification/results/plugins-candidate4b/registry-before.json、docs/verification/results/plugins-candidate4b/registry-after.json、docs/verification/screenshots/plugins-candidate4b/002-permissions-unchecked.png、docs/verification/screenshots/plugins-candidate4b/006-pause-impact-a.png、docs/verification/screenshots/plugins-candidate4b/008-update-added-permission.png、docs/verification/screenshots/plugins-candidate4b/016-global-disable-impact.png

限制：Native action sequence supplied by operator; verifier independently reviewed retained screenshots and actual bytes/process samples；One accidental old debug launch is explicitly logged and excluded; captured evidence binds release PID68112；Known editor blank-view lifecycle issue remains separately failed; no claim that this sequence closes editor recovery；Restart/persisted pause, invalid packages and transport denial are separate existing native evidence, not new GUI observations

### MAC-HOST-RECOVERY-PRESET-GUI-4B-001

macOS26.3.1 arm64;1280×800 native window / candidate4b; main SHA256 3889afae5e71e6f14a4a57297b30b6c0a65d07f0e426bddcdbadf1a261cd3d13 / Actual native GUI by plugin operator; independent original PNG/registry/source/recovery-byte audit and passive process correlation / pass / partial

实现：apps/desktop/src/features/plugins/PluginCenter.tsx、apps/desktop/src/features/plugins/PluginImpact.tsx、apps/desktop/src-tauri/src/extensions.rs、apps/desktop/src-tauri/src/extension_host.rs、apps/desktop/src/components/RecoveryPanel.tsx、apps/desktop/src-tauri/src/extensions/presets.rs、apps/desktop/src-tauri/src/files.rs

步骤：Apply minimal/development/review/custom capability presets through native impact dialog → Apply custom with all features disabled; navigate host settings/project controls → Open host Recovery while editor disabled; preview and export selected four-line draft → Uninstall builtin Git, prepare review and observe missing-package Apply disabled → Explicitly restore Git from Discover and apply review; verify 24 builtins and pending draft retained

All-off host navigation/settings/plugin/recovery controls remain available; editor/files show disabled states. Recovery export is 73 UTF-8 bytes with four lines, no BOM and LF; original remains 51 bytes, BOM/3CRLF and prior SHA77fbe3... without draft fourth line. Missing Git blocks Apply without automatic installation; explicit restore then review leaves editor/files/Git/search enabled and Agent/terminal/launcher/Markdown disabled.

证据：docs/verification/PLUGINS_GUI.md、docs/verification/results/plugins-candidate4b/actions.json、docs/verification/results/plugins-candidate4b/summary.json、docs/verification/results/plugins-candidate4b/audit.json、docs/verification/results/plugins-candidate4b/registry-before.json、docs/verification/results/plugins-candidate4b/registry-after.json、docs/verification/results/plugins-candidate4b/recovery-export.json、docs/verification/results/plugins-candidate4b/exported-recovery.txt、docs/verification/results/plugins-candidate4b/source-after-export.txt、docs/verification/screenshots/plugins-candidate4b/021-all-off-host.png、docs/verification/screenshots/plugins-candidate4b/022-host-recovery-preview.png、docs/verification/screenshots/plugins-candidate4b/024-preset-missing-default.png、docs/verification/screenshots/plugins-candidate4b/025-defaults-restored-editor.png

限制：Native action sequence supplied by operator; verifier independently reviewed retained screenshots and actual bytes/process samples；One accidental old debug launch is explicitly logged and excluded; captured evidence binds release PID68112；Known editor blank-view lifecycle issue remains separately failed; no claim that this sequence closes editor recovery；Restart/persisted pause, invalid packages and transport denial are separate existing native evidence, not new GUI observations

### MAC-EDITOR-VIEW-RESTORE-002

macOS26.3.1 arm64 / candidate5; main SHA256 8265d62143a81c380acd350dc8c261685f241a2bc3fd0cfbece65c81073b00b2 / Independent original native PNG, source bytes, native diagnostic export and browser-regression assertion review / pass / partial

实现：apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src/features/editor/store.ts、packages/editor/tests/view-lifecycle.mjs

步骤：Root native plugin editor sleep then wake without forcing full application remount → Return to editor: three Chinese lines and line numbers visible → Switch Aurora→UI Kit: distinct619byteTS/51byteBOMCRLF documents readable → Project sleep returns welcome; export actual anonymous diagnostics → Verifier inspects nativePNG and original fileSHA; reviews6phase browser regression and failure-before record

Retained React shell now recreates released CodeMirror view on restored buffer. Native sleep/wake returns visible three-line body and line numbers; A/B retain distinct source content. Original UI Kit disk remains51bytes with priorSHA77fbe3... . After project sleep diagnostics showcreated3/destroyed3/live0views, one inactive native document andonewatcher; subscriptions0. The exact4bblank-body failure is superseded.

证据：docs/verification/screenshots/root-candidate5/03-editor-sleep-wake-readable.png、docs/verification/results/root-candidate5/native-actions.json、docs/verification/results/root-candidate5/diagnostics-initial.json、docs/verification/results/root-candidate5/audit.json、docs/verification/results/root-candidate5/browser-view-before.json、docs/verification/results/root-candidate5/browser-view-after.json

限制：Native action timestamps were recorded after the sequence, not exact per-action clocks.；Candidate5 cold sample11461ms spans hidden editor after plugin wake until explicit return; retained raw, not a normal hot-file benchmark.；Three timing samples do not satisfy20 warm opens or150ms budget.；This replaces the specific blank-body failure; three-project session/IME/dirty-close acceptance remains separate.；Resource counts are one actual export at19:41:30Z; later sampler rows retain this timestamp and do not imply newly queried counts.

### MAC-EDITOR-SLEEP-STALE-SCOPE-001

macOS26.3.1 arm64 / candidate5; main SHA2568265d62143a81c380acd350dc8c261685f241a2bc3fd0cfbece65c81073b00b2 / Original native PNG inspection plus actual root/processes action reports and owner source diagnosis / fail / partial

实现：apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/features/editor/store.ts、apps/desktop/src/App.tsx

步骤：Root previously manually slept UI Kit and returned to Welcome → Processes operator opened /tmp/horizon-processes-gui.XifnCp via native project picker → Before opening any file, new project empty-editor view shows red 项目上下文已过期 banner → Plugin center roundtrip did not clear banner → Opening package.json succeeded, readable body appeared and banner cleared

After manual UI Kit sleep, a late automatic reopen using its old epoch leaves a global error shown in next project before any file is opened. Actual package.json opens successfully and clears error. This is stale asynchronous state crossing lifecycle boundaries, not new-project disk-read failure.

证据：docs/verification/screenshots/processes/001-project-context-expired.png、docs/verification/results/editor-sleep-stale-candidate5/observation.json

限制：Screenshot proves stale banner at new project empty state, not failure to read that project file；Verifier inspected originalPNG and operator/owner reports; no GUI mutation issued；Do not supersede until new packaged build repeats sleep→Welcome→newproject without stale error

### MAC-DIAGNOSTIC-EXPORT-001

macOS26.3.1 arm64 / candidate5; main SHA2568265d62143a81c380acd350dc8c261685f241a2bc3fd0cfbece65c81073b00b2; native test executable separately identified in raw log / Independent production data_export validation and three complete native test assertion review, combined with actual candidate5 native exported file / pass / partial

实现：apps/desktop/src-tauri/src/settings.rs、apps/desktop/src-tauri/tests/files_workflow.rs、apps/desktop/src/features/settings/diagnostics.ts、apps/desktop/src/features/settings/SettingsPanel.tsx

步骤：Root native Settings→Data→ExportDiagnostics→systemSaveDialog produces actual file → Verifier reads actual payload: three anonymous numeric editor timing samples, resource/cache counts, no path/project/content/secret fields → Review complete native positive/negative export assertions and exact retained3test output

Actual GUI exported an anonymous diagnostics payload; host preserves raw timings but injects canonical measurement description. Native negative cases reject private identifiers/content andunbounded/nonfinitevalues before writing; only counts of resource/cache/task entries are exported.

证据：docs/verification/results/diagnostic-export-audit/audit.json、docs/verification/results/diagnostic-export-audit/native-tests.log、docs/verification/results/root-candidate5/diagnostics-initial.json、docs/verification/results/root-candidate5/native-actions.json

限制：This closes only the diagnostic anonymization subcase; secrets in other logs, system credential storage, output preview and selective cleanup remain separate；Actual native export has3timing samples; no performance percentile claim；Tests call production dispatch directly; actual GUI export separately proves native picker→frontend→dispatch path

### MAC-CAPABILITY-PRESET-CONSOLIDATED-001

macOS 26.3.1 arm64 / Native GUI candidate4b SHA3889afae5e71e6f14a4a57297b30b6c0a65d07f0e426bddcdbadf1a261cd3d13; supporting native production/registry tests separately bound in linked evidence / Independent clause-level consolidation of already reviewed native GUI, native production integration and fresh-registry tests; no new execution / pass / full

实现：apps/desktop/src-tauri/src/extensions/presets.rs、apps/desktop/src/features/plugins/PluginCenter.tsx

步骤：Four selectable presets: minimal/review/development/custom → Default code-review does not start Agent or terminal → Before apply lists stopped/added capabilities → Missing package does not automatically install from network

All four requirement clauses have complementary native GUI and production integration evidence, listed separately in audit.json. No remaining REQ-EXT-010 condition is inferred from source alone.

证据：docs/verification/results/capability-preset-consolidated/audit.json、docs/verification/results/capability-preset-consolidated/presets-tests.log、docs/verification/PLUGINS_GUI.md、docs/verification/results/plugins-candidate4b/actions.json、docs/verification/results/plugins-candidate4b/registry-after.json、docs/verification/results/extension-native-presets/native-smoke.json

限制：This consolidates separate kinds of evidence, not one continuous GUI sequence.；Native integration has no window; actual UI proof comes from candidate4b original screenshots.；Only REQ-EXT-010 is fully closed. Other plugin/host requirements retain their individual missing conditions.

### MAC-LIFECYCLE-CANDIDATE5-001

macOS26.3.1 arm64 AppleM2Pro32GiB / candidate5 release; SHA2568265d62143a81c380acd350dc8c261685f241a2bc3fd0cfbece65c81073b00b2 / Independent passive all-associated process physical footprint/CPU/RSS collection during actual native workflows, sparse genuine GUI diagnostic exports, native CmdQ and exact PID+start postquit audit / pass / partial

实现：scripts/desktop/sample_macos.py、scripts/desktop/mac_metrics.py、apps/desktop/src-tauri/src/settings.rs

步骤：保持同一原生进程采样1800秒，操作编辑器/项目与真实终端/启动方案生命周期 → 保留两份实际GUI诊断及原capturedAt时间 → 原生Cmd+Q确认退出后，按全部69个PID和启动时间核验残留

完整采样1800.0044秒、871样本，主进程全程存在。865个完整footprint样本中位349.46MB、P95 394.24MB、峰450.15MB；正常退出后69个采样身份全消失。两份诊断来自不同项目/面板状态，不能据此证明计数稳定。

证据：docs/verification/results/candidate5-lifecycle-30m/audit.json、docs/verification/results/candidate5-lifecycle-30m/metadata.json、docs/verification/results/candidate5-lifecycle-30m/samples.jsonl、docs/verification/results/candidate5-lifecycle-30m/summary.json、docs/verification/results/candidate5-lifecycle-30m/post-quit.json、docs/verification/results/candidate5-lifecycle-30m/operator-actions.jsonl、docs/verification/results/processes-gui/candidate5-exit.json、docs/verification/results/processes-gui/candidate5-after-processes.json

限制：Active changing workload is not a fixed idle/reading budget; resource trends do not establish leak/no-leak.；Native URL helperPID6508 remainsdefunct untilquit; this cleanup condition remains unresolved.；Two diagnostic exports cannot demonstrate bounded subscription/listener/cache counts under repeated identical cycles.；Known candidate5 project-sleep old-epoch failure remains separate; no retroactive attribution ofcandidate6 fixes.；Sampling can miss short-lived processes; six incompletefootprint sums are null and excluded explicitly.

### MAC-URL-CHILD-REAP-FAIL-001

macOS26.3.1 arm64 / candidate5 releaseSHA8265d62143a81c380acd350dc8c261685f241a2bc3fd0cfbece65c81073b00b2 / Native manual Open URL followed by independently sampled OS process identity/state and source-owner root-cause audit / fail / partial

实现：apps/desktop/src-tauri/src/processes.rs

步骤：原生点击已保存的本地URL并成功打开页面 → 独立采样root直系子PID6508及启动时间，观察至30分钟采样结束 → 原生正常退出后检查全部69身份

点击打开URL后，03:50:54启动的子PID6508在495条样本中持续为defunct，覆盖elapsed 778.2325–1800.0044秒，footprint为0。实现者确认spawn后丢弃Child而未wait；应用最终退出后该身份消失。

证据：docs/verification/PROCESSES_GUI.md、docs/verification/screenshots/processes/010-manual-open-url.png、docs/verification/results/candidate5-lifecycle-30m/audit.json、docs/verification/results/candidate5-lifecycle-30m/samples.jsonl、docs/verification/results/candidate5-lifecycle-30m/post-quit.json

限制：只观察一次URL辅助进程生命周期；零footprint僵尸不等于已经证明内存持续增长。；候选6源码已改为等待status，但须新包实际回收复测后才能撤销该失败。

### MAC-TERMINAL-GUI-CANDIDATE5-001

macOS26.3.1 arm64; nativewindow1280x800→1101x714→1280x800 / candidate5 releaseSHA8265d62143a81c380acd350dc8c261685f241a2bc3fd0cfbece65c81073b00b2 / Independent original PNG review, all retained OS/fixture JSON and native action review, plus own passive process identity samples / pass / partial

实现：apps/desktop/src-tauri/src/processes.rs、apps/desktop/src/features/processes/index.tsx、apps/desktop/src/features/processes/processes.css

步骤：空面板无shell；原生新建启动PTY98648，父进程91978 → 中文粘贴/系统拼音、真实窗口resize由9×126变9×101 → 隐藏/专注/A-B切换后PID与terminal-cwd不变，输出序号继续 → 启动方案就绪自动选中PTY20065；插件暂停确认列98648/20065并回收，保留另一项目12301 → 全部服务结束后原生退出；独立69身份核验无残留

真实PTY98648完成中文输入、resize、Ctrl+C、焦点、隐藏与原cwd返回；系统拼音在PTY20065提交“你好”。当前项目暂停回收两个PTY，另一项目继续。直接结束会话按钮、带活动资源退出尚未在本轮测试。

证据：docs/verification/PROCESSES_GUI.md、docs/verification/results/processes-candidate5-audit/audit.json、docs/verification/results/processes-gui/candidate5-actions.jsonl、docs/verification/results/candidate5-lifecycle-30m/post-quit.json

限制：候选5没有点击“结束会话”；插件暂停不能替代该按钮链路。；退出前活动服务已清理，不证明带活动服务退出。；无受控OS停止失败夹具；成功SIGKILL不证明TIMEOUT残留处理。；URL子PID6508至退出仍为defunct，单独记录MAC-URL-CHILD-REAP-FAIL-001。；候选6的七项源码修复不回算到候选5；多数图为1101×714，与1280×800设计条件不同。；真实拼音逐键过程来自操作记录；保留PNG显示提交后结果，无完整组合态录像。

### MAC-LAUNCH-GUI-CANDIDATE5-001

macOS26.3.1 arm64; nativewindow1280x800→1101x714→1280x800 / candidate5 releaseSHA8265d62143a81c380acd350dc8c261685f241a2bc3fd0cfbece65c81073b00b2 / Independent original PNG review, all retained OS/fixture JSON and native action review, plus own passive process identity samples / pass / partial

实现：apps/desktop/src-tauri/src/processes.rs、apps/desktop/src/features/processes/index.tsx、apps/desktop/src/features/processes/processes.css

步骤：发现六个脚本不执行；once保存后首次授权，再执行复用授权 → 原生导入/保存/导出；API通过HTTP就绪后启动Web，通过TCP和PID/进程组核验 → 重启替换旧组三PID；两次web→api逆序停止，直接PTY仍存活 → 默认失败回收新API/子进程，保留排错策略则保持该组；另一项目继续 → 500ms就绪超时与原生取消均回收自有组；外部59130监听器保留 → 实际脚本追加注释改变SHA后重审，取消不执行 → PTY启动自动定位；暂停依赖终端只回收当前项目PTY；最终正常退出

原生发现、授权、导入/导出、双服务依赖就绪、重启、失败/保留排错、超时、取消、外部端口、来源变化、PTY定位与项目隔离均有界面和OS证据。剩余子项在CONDITION_GAPS列明；URL辅助进程回收另记失败。

证据：docs/verification/PROCESSES_GUI.md、docs/verification/results/processes-candidate5-audit/audit.json、docs/verification/results/processes-gui/candidate5-actions.jsonl、docs/verification/results/candidate5-lifecycle-30m/post-quit.json

限制：候选5没有点击“结束会话”；插件暂停不能替代该按钮链路。；退出前活动服务已清理，不证明带活动服务退出。；无受控OS停止失败夹具；成功SIGKILL不证明TIMEOUT残留处理。；URL子PID6508至退出仍为defunct，单独记录MAC-URL-CHILD-REAP-FAIL-001。；候选6的七项源码修复不回算到候选5；多数图为1101×714，与1280×800设计条件不同。；真实拼音逐键过程来自操作记录；保留PNG显示提交后结果，无完整组合态录像。

### MAC-RELEASE-BUNDLE-PERSISTENCE-001

macOS 26.3.1 arm64, Apple M2 Pro; no Windows or macOS x64 execution / Release candidates 4a, 4b, 5 and 6 with separate exact bundle audits; same product version 0.1.0 / 原生精确 .app 路径启动与正常退出；替换候选二进制后保留同一 QA 数据；独立审核包身份、资源字节、注册表与恢复稿 / pass / partial

实现：apps/desktop/src-tauri/tauri.conf.json、scripts/desktop-run.mjs

步骤：无需开发服务器即可启动发布版原生窗口并操作 → 退出后替换新候选 .app，保留 QA 数据并重开项目/恢复稿/设置 → 核验平台和最低系统元数据、全部许可证资源字节 → 通过宿主发现页卸载并恢复默认 Git，保留项目与配置

macOS arm64 发布版可独立运行。候选4a在代码修复后重新读取旧候选留下的检查点；后续候选保留工作区、项目和扩展策略。候选6包含2115文件、35,483,318字节，2109项许可证资源与源码逐字节一致。默认Git可单独恢复。

证据：docs/verification/results/bundle-candidate4a/audit.json、docs/verification/results/bundle-candidate4b/audit.json、docs/verification/results/bundle-candidate5/audit.json、docs/verification/results/bundle-candidate6/summary.json、docs/verification/results/native-recovery-candidate4a/observation.json、docs/verification/results/plugins-candidate4b/registry-after.json、docs/verification/results/candidate5-lifecycle-30m/post-quit.json、docs/verification/NATIVE_RUNS.md

限制：这里只证明同0.1.0版本的候选二进制替换与既有状态读取，不代替版本迁移/安装器升级验收。；尚无干净机器DMG安装、应用卸载、最低macOS12实机、macOS x64或Windows安装证据。；断网下文件/本地Git与远程能力单独失败仍待原生验证。；仅adhoc签名；未证明Developer ID、公证或公开分发资格。；最终DMG/ZIP仍需由最终候选重新生成；旧发行文件不属于本次包审核。

### MAC-TERMINAL-CONSOLIDATED-001

macOS26.3.1 arm64 / candidate5 native terminal workflows; candidate6 mainSHA25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5 EndProcess retest; separate native service test report / 逐条件组合候选5/6真实GUI和生产原生服务测试；不混成同一次执行 / pass / full

实现：apps/desktop/src-tauri/src/processes.rs、apps/desktop/src/features/processes/index.tsx

步骤：首次新建才启动shell，显示项目/目录 → 中文输入输出和resize可用 → 切项目不改旧cwd；隐藏继续 → 结束会话结束受管进程 → 日志有界

五项验收条件各有明确证据：空面板不启动、新建显示项目目录；真实中文/系统拼音/resize；隐藏和切项目保持PID/cwd；候选6直接结束按钮使PTY41752退出；生产有界reader消费8MiB仅保留2MiB。

证据：docs/verification/results/terminal-consolidated/audit.json、docs/verification/PROCESSES_GUI.md、docs/verification/results/processes-candidate5-audit/audit.json、docs/verification/results/processes-gui/candidate6-pty-stop.json、docs/verification/screenshots/processes/023-candidate6-single-header-live.png、docs/verification/results/processes-gui/candidate6-service-tests.log、apps/desktop/src-tauri/src/processes.rs

限制：仅macOS arm64；不证明Windows行为或其他平台声明。；隐藏大吞吐压力来自生产pipe reader测试，未声称候选5GUI实际输入8MiB。；完整需求闭合限定按需终端；其他RUN/LAUNCH需求仍按各自子项处理。

### MAC-PROCESSES-CANDIDATE6-REGRESSION-001

macOS26.3.1 arm64 nativewindow1280×800 / candidate6 SHA25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5 / 独立审核原生操作记录、原始PNG、OS父子进程结果与本方持续被动采样 / pass / partial

实现：apps/desktop/src-tauri/src/processes.rs、apps/desktop/src/features/processes/index.tsx、apps/desktop/src/App.tsx

步骤：原生保存新PTY方案，关闭设置后底栏立即选择；从底栏启动并定位本次终端 → 检查单层标题/无null退出码；点击结束进程并核PID41752退出 → 已保存URL连续实际打开3次；每次核root直系子进程仅API/Web，无open或僵尸 → 停止API/child/Web，核4个已知自有PID全退出；前后实际GUI导出diagnostics

URL三次分别创建真实本地页，原始OS快照及持续被动采样均无defunct，旧candidate5未wait缺陷已通过对应复测。PTY结束按钮和保存后底栏同步等UI修复通过。watchers1/subscriptions2前后相同；全部4个测试PID退出。

证据：docs/verification/results/processes-candidate6-audit/audit.json、docs/verification/PROCESSES_GUI.md、docs/verification/screenshots/processes/023-candidate6-single-header-live.png、docs/verification/results/processes-gui/candidate6-open-url.jsonl、docs/verification/results/processes-gui/candidate6-pty-stop.json、docs/verification/results/processes-gui/candidate6-all-stopped.json、docs/verification/results/processes-gui/candidate6-before-processes.json、docs/verification/results/processes-gui/candidate6-after-processes.json、docs/verification/results/processes-gui/candidate6-dualservice.json

限制：独立采样仍在继续，此文件只绑定已完成的processes阶段；不是最终30分钟结论。；3次点击后的OS快照和持续采样证明旧僵尸问题未复现，不将未采到的短命进程解释为从未存在。；watchers1/subscriptions2在两份实际快照相同；不能外推所有插件/项目资源长期不增长。；失败/超时提前PID与历史排序未在本次GUI重复，仍按源码/服务覆盖记录。；023原PNG包含系统窗口阴影；功能证据有效，视觉同尺寸比较需另取原生无阴影截图。

### MAC-LIFECYCLE-CANDIDATE6-001

macOS26.3.1 arm64, Apple M2 Pro; native window1280×800 / candidate6 release SHA25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5 / 独立全关联PID/启动身份/责任进程采样；原生操作者保持场景，核对原始动作与真实诊断 / pass / partial

实现：scripts/desktop/mac_metrics.py、scripts/desktop/sample_macos.py、apps/desktop/src-tauri/src/agent.rs

步骤：原生终端/启动器/Pi操作期间连续采样1800秒 → 保留实际动作与稀疏GUI诊断时间，核对所有归属身份及缺测项

1800.005秒871样本；root始终存在，26身份，无defunct。footprint中位300.05/P95442.90/峰460.60MB，含测试provider；2个退出竞态样本总量null。采样结束时应用仍运行；后续02:44:30UTC正常原生退出后，独立核20个Horizon身份全部消失、退出前11个全消失，无responsibility33304残留；外部provider60170/60171保留单列。

证据：docs/verification/results/candidate6-lifecycle-30m/audit.json、docs/verification/results/candidate6-lifecycle-30m/summary.json、docs/verification/results/candidate6-lifecycle-30m/samples.jsonl、docs/verification/results/candidate6-lifecycle-30m/operator-actions.jsonl、docs/verification/results/candidate6-lifecycle-30m/post-quit.json、docs/verification/screenshots/root-candidate6-final/02-exit-plan.png

限制：不同阶段项目/面板/进程改变，不以斜率证明泄漏或无增长。；当前仅实际快照计数，候选7frontend runtime计数尚未运行。；场景名称含Git/editor，但本轮时间窗只有processes/Pi动作，不冒充覆盖。；正常退出归属进程回收已补证；frontend runtime计数循环稳定和静置CPU13.858%失败仍未闭合。

### MAC-PI-FIXED-STREAM-CANDIDATE6-001

macOS26.3.1 arm64, Apple M2 Pro; native window1280×800 / candidate6 release SHA25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5 / 独立全关联PID/启动身份/责任进程采样；原生操作者保持场景，核对原始动作与真实诊断 / pass / partial

实现：scripts/desktop/mac_metrics.py、scripts/desktop/sample_macos.py、apps/desktop/src-tauri/src/agent.rs

步骤：真实Pi1.4.0受管实例连续流，UI保持125秒 → 原生停止后核Pi退出，再保持静置125秒；测试provider持续运行

有效连续流125.005秒，后60秒64.1764秒；Pi119/119样本存在。Horizon+Pi平均413.27/P95419.18/峰420.32MB，Pi本身86.62MB；provider另24.38MB。停止后整段Pi为零，静置CPU另记失败。

证据：docs/verification/results/candidate6-pi-one-stream-retest-125s/audit.json、docs/verification/results/candidate6-pi-one-stream-retest-125s/samples.jsonl、docs/verification/results/candidate6-pi-dormant-125s/audit.json、docs/verification/results/candidate6-pi-one-stream-125s/audit.json

限制：真实Pi+受控HTTP协议fixture，不声称真实远程provider或本地模型推理。；一小TS标签和持续流不是标准50轮长会话/十文件2000行diff或第二Pi实例。；86.62MB是活跃Pi进程成本；没有空闲Pi实例，不当作空闲增量。；第一次流测后60秒纯流不足60秒，原始记录保留并排除固定流判定。

### MAC-IDLE-CPU-PANEL-CANDIDATE6-FAIL-001

macOS26.3.1 arm64, Apple M2 Pro; native window1280×800 / candidate6 release SHA25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5 / 独立全关联PID/启动身份/责任进程采样；原生操作者保持场景，核对原始动作与真实诊断 / fail / partial

实现：scripts/desktop/mac_metrics.py、scripts/desktop/sample_macos.py、apps/desktop/src-tauri/src/agent.rs

步骤：原生停止Pi后保留窗口/面板不变125秒，无流式响应或显式Horizon任务 → 排除前60秒，对余64.1062秒61样本统计并逐身份归因 → 核系统责任进程与后续只读sample目录同步栈

Pi始终0；Horizon全关联静置CPU均值13.858%，超过单核1%建议。自有openAndSavePanelService35619贡献13.676%，约每5秒脉冲；其余Horizon约0.181%。helper完整计入，失败未撤销。

证据：docs/verification/results/candidate6-pi-dormant-125s/audit.json、docs/verification/results/candidate6-pi-dormant-125s/samples.jsonl、docs/verification/results/candidate6-pi-dormant-125s/panel-helper-attribution.json、docs/verification/results/candidate6-pi-dormant-125s/panel-helper-investigation.json、docs/verification/results/candidate6-pi-dormant-125s/panel-helper-sample.txt

限制：只读栈支持文件面板目录同步成本；未确定具体目录、调用源或Horizon源码缺陷。；候选7将先测未用选择器基线，再测空目录关闭后；若与大目录关联保留该成本。；本记录只判这一实际静置场景未达建议值，不外推所有机器/场景。

### MAC-PLUGIN-PROJECT-ENABLE-SCOPE-C6-FAIL-001

macOS26.3.1 arm64 native GUI / candidate6 release SHA25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5 / 原生操作者报告/AX与真实动作记录；独立核对较早before注册表和稍后after注册表，root源码定位 / fail / partial

实现：apps/desktop/src/features/plugins/PluginCenter.tsx

步骤：当前项目插件范围下点击Pi启用，没有先切换所有项目 → 核对全局原enabledGlobal=false，之后enabledGlobal=true、projects仍空

当前项目启用错误扩大到全局，越过既有全局停用；candidate7已修源码，尚未原生复测。

证据：docs/verification/results/plugin-scope-candidate6-audit/audit.json、docs/verification/results/plugin-scope-candidate6-audit/operator-after.json、docs/verification/results/candidate6-lifecycle-30m/operator-extensions-initial.json、docs/verification/results/candidate6-lifecycle-30m/operator-actions.jsonl、docs/verification/results/plugins-scope-candidate7/source-review.json

限制：没有点击瞬间PNG；before20:16/after20:57不是即时原子前后对照。；失败由操作者实际点击与源码路径共同确认；不声称额外恢复按钮路径也已原生触发。

### MAC-PI-NATIVE-GUI-CANDIDATE6-001

macOS26.3.1 arm64 native1280×800 / candidate6 release25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5; separate native32assertions/realPi1.4.0 protocol evidence / 独立审核16张原始JPEG、操作者快照、HTTP原始请求、当前磁盘/index/外部binary与会话状态；组合已审核原生测试 / pass / partial

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src/features/agent/AgentPanel.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/agent/ContextPicker.tsx、apps/desktop/src/features/agent/AgentReview.tsx

步骤：外部Pi检测→官方受管安装→保存/测试模型连接→全局默认/项目继承 → 真实聊天与未保存缓冲区快照；持续流与实际停止；长Unicode消息分页 → 任务write先拒绝再允许；只改副本，应用进入打开编辑器未保存状态，撤销/重做后显式保存 → 待授权停止、受管运行时活动移除阻止、受控exec环境；恢复历史不新增provider请求 → 项目往返保留提示草稿/附件；401后保留输入并重新验证；项目覆盖/连接移除影响 → 受管卸载/重装保留9会话与外部Pi原hash；最终真实诊断

原始19请求中3–19属于GUI：聊天工具0、任务4；连接测试只固定文本。独立核context原50B不变，example显式保存42B、index空/main不变；完整长消息327680B/hash精确匹配。9会话最终dormant且OS无Pi。外部binary SHA不变；provider继续运行。 界面明确首版Pi，Codex/Claude尚未接入，无假可用连接入口。

证据：docs/verification/results/pi-native-gui-audit/audit.json、docs/verification/results/pi-native-gui-audit/provider-requests.jsonl、docs/verification/results/pi-native-gui-audit/agent-state-after.json、docs/verification/results/pi-native-gui-audit/long-unicode-message.txt、docs/verification/results/pi-native-gui/applied-editor-before-save.json、docs/verification/results/pi-native-gui/review-undo-redo-save.json、docs/verification/results/pi-native-gui/pending-cancel.json、docs/verification/results/pi-native-gui/history-before.json、docs/verification/results/pi-native-gui/history-after.json、docs/verification/results/pi-native-gui/diagnostics-after-pi.json、docs/verification/results/pi-native-gui/qa-owned-resources.json

限制：所有provider响应是受控本地协议fixture；不声称真实厂商推理、OAuth登录或GUI系统密钥流已测。；16份.png实际JPEG/JFIF；保留原字节作功能证据，不入正式PNG视觉索引。；历史恢复无请求由原生操作者前后计数16→16和独立最终状态支持，不等同OS重启历史。；D01/D03/D05/F06主按钮、D02间距、D06审查结构、D07错误表现以及活动卸载失败空壳待7视觉复测。；当前项目启用越全局另有真实失败记录，不能从此正向记录推导scope通过。；3秒停止超时/断桥、无HEAD任务降级、失败运行时校验/升级保护等剩余条件在CONDITION_GAPS保留。；Pi资源/双端完整门槛仍未通过，不将候选功能展示当作发布默认已验收。

### MAC-PI-CONTEXT-BUDGET-CONSOLIDATED-001

macOS26.3.1 arm64 native1280×800 / candidate6 release25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5; separate native32assertions/realPi1.4.0 protocol evidence / 独立审核16张原始JPEG、操作者快照、HTTP原始请求、当前磁盘/index/外部binary与会话状态；组合已审核原生测试 / pass / full

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src/features/agent/AgentPanel.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/agent/ContextPicker.tsx、apps/desktop/src/features/agent/AgentReview.tsx

步骤：20 files /256KiB initial budget → Oversize requires reduction or split, no silent clipping → Host does not rewrite Agent memory → No false precise token count

实际原生21项/>256KiB拒绝、精确256KiB通过；GUI显示数量/字节预算和来源，源码超限禁用附加并明确删减、不截断；宿主仅冻结附件，不改写Pi记忆，不伪造token精度。

证据：docs/verification/results/pi-consolidated/audit.json、docs/verification/results/pi-native-final/pi-native.json、docs/verification/results/pi-stream-audit/pi-rpc.json、docs/verification/results/pi-native-gui-audit/audit.json、apps/desktop/src/features/agent/ContextPicker.tsx、apps/desktop/src-tauri/src/agent.rs

限制：Native budget guards have actual boundary tests; oversize error visual layout not separately captured. JPEG functional screenshot not counted as formal PNG visual pass.；完整闭合仅此需求的功能/协议条件，不计正式PNG视觉通过，也不关闭Pi发布默认门槛。

### MAC-PI-MESSAGE-MODE-CONSOLIDATED-001

macOS26.3.1 arm64 native1280×800 / candidate6 release25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5; separate native32assertions/realPi1.4.0 protocol evidence / 独立审核16张原始JPEG、操作者快照、HTTP原始请求、当前磁盘/index/外部binary与会话状态；组合已审核原生测试 / pass / full

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src/features/agent/AgentPanel.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/agent/ContextPicker.tsx、apps/desktop/src/features/agent/AgentReview.tsx

步骤：One in-flight turn, no queue → Chat has no project tools or automatic discovery → Accepted input is not completed run; retry/compaction must settle → Ordinary stdout not fabricated as structured events

真实Pi/Rust验证单项目单run；GUI聊天HTTP无工具，任务精确4工具；原生只在agent_settled后终态，长消息经历实际compaction后完成；stdout严格JSONL/显式类型映射。

证据：docs/verification/results/pi-consolidated/audit.json、docs/verification/results/pi-native-final/pi-native.json、docs/verification/results/pi-stream-audit/pi-rpc.json、docs/verification/results/pi-native-gui-audit/audit.json、apps/desktop/src/features/agent/ContextPicker.tsx、apps/desktop/src-tauri/src/agent.rs

限制：Provider is controlled local service. This closes message/mode semantics, not real-provider authentication, all transport failures or full Pi release gate.；Retry phase guard is source-reviewed; actual automatic-compaction ordering is observed. No claim a vendor auto-retry was triggered.；完整闭合仅此需求的功能/协议条件，不计正式PNG视觉通过，也不关闭Pi发布默认门槛。

### MAC-KEYRING-EXPORT-NATIVE-CANDIDATE7-001

macOS26.3.1 arm64 actual OS Keychain plus native integration test process / candidate7 source tests; not yet packaged native GUI / Independent raw test-output and complete credential/preview assertions review; no rerun, no GUI or keychain access by verifier / pass / partial

实现：apps/desktop/src-tauri/tests/credentials_workflow.rs、apps/desktop/src-tauri/tests/files_workflow.rs、apps/desktop/src-tauri/src/settings.rs、apps/desktop/src-tauri/src/state.rs

步骤：专用假system A读写/重建HostState→session B→重建后不可用，旧残留A不回退 → 不可用钥匙串与只读app-data路径失败保持原配置/内存，删除只作用专用引用 → 设置导出投影/冻结/量限/取消/过期/失败重试；匿名runtime计数白名单

真实macOS keyring1/1、失败backend1/1、files_workflow28/28、最终preview3/3通过。专用假key全部清理，无明文fallback；候选6旧session回退缺陷在生产原生API复测关闭。F09界面仍待候选7。 另有独立9网络入口源码复核，默认无上传/遥测路径闭合；不声称抓包。

证据：docs/verification/results/settings-privacy-candidate7-audit/audit.json、docs/verification/results/settings-privacy-candidate7-audit/keyring-real.log、docs/verification/results/settings-privacy-candidate7-audit/keyring-failures.log、docs/verification/results/settings-privacy-candidate7-audit/files-workflow.log、docs/verification/results/settings-privacy-candidate7-audit/export-preview-final.log、docs/verification/results/privacy-network-source-audit/audit.json、docs/verification/results/privacy-network-source-audit/candidate7-review.json

限制：Native integration is debug test executable against real macOS Keychain; candidate7 packaged GUI is not yet exercised.；No real provider secret used; all fake keychain entries are owned by test and cleanup is asserted.；APFS non-Unicode path test reports EILSEQ and checks lossless codec only;28test count is not proof of an on-disk invalid-name file.；F09 visible preview/save/cancel, selective cache/history/draft/credential cleanup and QuickJS visible error logging still require targeted native evidence.；Existing source-network audit closes no-default-upload/telemetry at source level; no packet capture is claimed.

### MAC-PI-AUTHORIZATION-CONSOLIDATED-001

macOS26.3.1 arm64 / candidate6 nativeGUI; candidate7 realPi1.4.0 Rust broker regression; separately source-reviewed policy guards / 逐条件组合实际GUI/HTTP/任务副本、真实Rust broker断言和明确的超时/断桥拒绝代码路径 / pass / full

实现：apps/desktop/src-tauri/src/agent.rs、packages/pi-policy/horizon-policy.ts、apps/desktop/src/features/agent/AgentPanel.tsx

步骤：Write/exec asks before effect and shows action/path/cwd/source → Deny causes no write; accepted operation runs only in copy → Expired or broken bridge refuses; no fail-open execution → Unknown tool cannot bypass → No OS sandbox claim

真实拒绝无写入，允许后只写任务副本；exec前显示精确命令/目录/来源，待授权取消无副作用；未知工具实测拒绝。过期与断桥默认拒绝且不存在本地执行fallback的路径经源码逐支核对。

证据：docs/verification/results/pi-consolidated/audit.json、docs/verification/results/pi-native-candidate7/audit.json、docs/verification/results/pi-native-candidate7/pi-native.json、docs/verification/results/pi-native-gui-audit/audit.json、docs/verification/screenshots/pi-native-gui/11-D05-exec-permission.png、packages/pi-policy/horizon-policy.ts

限制：120s expiry and broken socket responses are verified by source guard behavior combined with real denial/cancel paths; no separate deliberate120s GUI wait is claimed.；This closes authorization forwarding semantics, not OS sandboxing, credential system storage, all native process-stop failures or visual fidelity.；截图为原JPEG，仅作功能文字证据；candidate7正式PNG视觉复测仍待。

### MAC-PROCESSES-NATIVE-CANDIDATE7-001

macOS26.3.1 arm64 native service tests / candidate7 source; not yet packagedGUI / Independently read new production-service test assertions and raw24pass log; no rerun or GUI / pass / partial

实现：apps/desktop/src-tauri/src/processes.rs

步骤：Real shell run retains revision1/scriptold after savingrevision2; next run writesnew marker. Native active delete returnsRESOURCE_BUSY and leaves profile; confirmed stop then delete removes only profile and retains projectmarker. → Ready::ProcessStarted production run explicitly verifiesfalse (running unverified). UI wording remains candidate7 GUI task. → Real preceding exit7 stops new run; dependent that would write marker never starts and marker absent. → Real production launch/readiness; injected final URL opener only called once after ready-marker. Later savedURLchange and3repeatautomaticcalls do not replace/rerun; logURL neveropens; before-ready timeoutcalls0. → Missing executable identifiesprogram withDEPENDENCY_UNAVAILABLE; WindowsdrivepathonmacOS returnsUNSUPPORTED_PLATFORM.

24服务测试通过；新增运行快照/删除守卫、真实依赖失败不执行后继、自动URL就绪后一次与旧快照语义、缺程序和Windows路径错误均有生产路径断言。

证据：docs/verification/results/processes-candidate7-audit/audit.json、docs/verification/results/processes-candidate7-audit/native-tests.log

限制：URL final opener is a counter substitution, not browser evidence. Actual automatic browser navigation needs7GUI.；No OS signal failure/stop timeout residual fixture; successful stop is not failure preservation evidence.；Active-delete Cancel/Confirm UI, revision display and missing-program recovery controls await7GUI.；Explicitexternalattach is unsupported in launcher/PiMVP; do not demand arbitraryTUIattach contraryAI006. Existing external-port refusal/provider survival remain actual boundary evidence.

### MAC-GIT-NATIVE-GUI-CANDIDATE6-INITIAL-001

macOS26.3.1 arm64, native1280×800 / candidate6 release25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5 / Independent originalPNG review and exact Git/file snapshot comparison; native operator actions, no verifier GUI or fixture mutations / pass / partial

实现：apps/git-service/src/lib.rs、apps/desktop/src-tauri/src/git.rs、apps/desktop/src/features/git/GitPanel.tsx

步骤：实际A→B已暂存/B→C未暂存及脏缓冲区来源选择弹窗；仅暂存提交后index归零 → 真实fetch/仅快进pull/显式push到自有bare远端；非快进拒绝；脏工作区切分支拒绝 → 故意hook失败保留说明/暂存，再显式重试成功 → 中央冲突显示两来源与结果；采用传入仅改worktree；手动编辑保存/暂存/merge提交 → 放弃取消无变化；确认仅恢复index版本并保留原暂存

16项独立快照对照均满足对应子条件：提交HEAD精确为先前index B，磁盘C与未跟踪notes不变；fetch不改本地，push远端hash等于本地；hook失败HEAD不动且暂存保留；冲突选择仍保留3个index stage，显式完成后清空；tracked discard恢复B-index。

证据：docs/verification/results/git-gui-candidate6-audit/initial-audit.json、docs/verification/screenshots/git-candidate6/01-staged-A-to-B.png、docs/verification/screenshots/git-candidate6/02-unstaged-B-to-C-split.png、docs/verification/screenshots/git-candidate6/03-dirty-buffer-stage-choice.png、docs/verification/screenshots/git-candidate6/09-hook-failure-draft-retained.png、docs/verification/screenshots/git-candidate6/10-C05-conflict-sources-result.png、docs/verification/screenshots/git-candidate6/11-conflict-chosen-still-unmerged.png、docs/verification/screenshots/git-candidate6/12-C06-discard-plan.png

限制：Initial portion only; operator still validating history/clone/large diff. No full Git requirement closure here.；Local synthetic bare remote only; no real remote authentication claimed.；Untracked trash failed and is recorded separately; snapshot15 filename does not establish success.；Operator confirms dirtybuffer dialogCancel retainedD duringBcommit; diskC independently unchanged. Cross-project D restoration pending.

### MAC-GIT-STALE-DIFF-CANDIDATE6-002

macOS26.3.1 arm64, native1280×800 / candidate6 release25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5 / Independent originalPNG review and exact Git/file snapshot comparison; native operator actions, no verifier GUI or fixture mutations / pass / partial

实现：apps/git-service/src/lib.rs、apps/desktop/src-tauri/src/git.rs、apps/desktop/src/features/git/GitPanel.tsx

步骤：选中已暂存A→B差异后仅提交暂存内容 → 继续观察同一HEAD-to-index视图并独立核index

原生截图显示+0/-0与“此基线没有差异”，暂存列表归零；独立磁盘Git快照index实际为空，工作区仍C，旧已暂存差异不再残留。

证据：docs/verification/results/git-gui-candidate6-audit/initial-audit.json、docs/verification/screenshots/git-candidate6/04-C02-staged-before-commit.png、docs/verification/screenshots/git-candidate6/05-staged-diff-cleared-after-commit.png、docs/verification/results/git-gui-candidate6-audit/02-after-staged-only-commit.json

限制：Only closes prior specific stale selected-staged-diff reproduction. Other async staleness/progress/cancellation conditions remain separate.

### MAC-GIT-TRASH-CANDIDATE6-FAIL-001

macOS26.3.1 arm64, native1280×800 / candidate6 release25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5 / Independent originalPNG review and exact Git/file snapshot comparison; native operator actions, no verifier GUI or fixture mutations / fail / partial

实现：apps/git-service/src/lib.rs、apps/desktop/src-tauri/src/git.rs、apps/desktop/src/features/git/GitPanel.tsx

步骤：原生选择自有未跟踪temporary-note.txt，确认移废纸篓 → 等待中核取消/X/停止入口；随后核AppleEvent超时与原文件

等待Git期间取消与关闭均禁用、无停止；随后Finder AppleEvent -1712超时。原文件hash/内容仍在，没有降级永久删除。此操作未成功移废纸篓。

证据：docs/verification/results/git-gui-candidate6-audit/initial-audit.json、docs/verification/screenshots/git-candidate6/13-trash-finder-hang-no-stop.png、docs/verification/screenshots/git-candidate6/14-trash-appleevent-timeout.png、docs/verification/results/git-gui-candidate6-audit/16-trash-timeout-original-retained.json、docs/verification/results/git-gui-candidate6/trash-hang-recovery.json

限制：No forced cleanup was sent: operator recovery record sent=false. Exact wait duration/final fix belongs to owner followup.；Failure is this actual native environment; no claim all macOS Trash operations fail.；Original preservation is positive safety behavior but does not make required Trash action pass.

### MAC-GIT-NATIVE-GUI-CANDIDATE6-FINAL-001

macOS26.3.1 arm64 native1280×800 / candidate6 release25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5; separate retainednative18test evidence / Independent26originalPNG review,22Git/file snapshots and current read-only OS/Git checks; explicitper-clause sourcecombination where stated / pass / partial

实现：apps/git-service/src/lib.rs、apps/desktop/src-tauri/src/git.rs、apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx

步骤：37历史分页30+7、已删除目录内文件/根提交8文件切换/任意refs比较 → 二进制/中文/删除/120k字符长行/18MiB差异明确有界并翻页；rename与unborn取消暂存保留磁盘 → 非仓库不初始化、detached状态明确；已存在clone目标拒绝，新目标clone成功注册 → 项目往返保留dirtyD与提交草稿；DiskOnly→indexC，SaveThenStage→index/diskD → 真实hook处理中点击Stop，OS前后核ownhook/sleep消失且HEAD/index保留

追加14项独立比对通过。clone8文件clean、HEAD等于bare remote且已注册，现有keep.txt43B原文未变，非Git目录无.git；history37条且历史读取不改HEAD/branch/index/磁盘。取消进程证据前后间隔10.30秒，非停止延迟。

证据：docs/verification/results/git-gui-candidate6-audit/final-audit.json、docs/verification/results/git-gui-candidate6-audit/current-readonly.json、docs/verification/screenshots/git-candidate6/15-C03-deleted-history-file.png、docs/verification/screenshots/git-candidate6/19-large-diff-second-page.png、docs/verification/screenshots/git-candidate6/20-unborn-unstaged.png、docs/verification/screenshots/git-candidate6/21-detached-head.png、docs/verification/screenshots/git-candidate6/22-non-repository.png、docs/verification/screenshots/git-candidate6/24-clone-success-registered.png、docs/verification/screenshots/git-candidate6/25-draft-buffer-retained-across-projects.png、docs/verification/screenshots/git-candidate6/26-save-and-stage-D.png

限制：Localfile remote only; no realvendorGit auth/cancelledcloneGUI claim.；18MiBinteractivepaging is not whole-app fixedscene resource or20samplelatency benchmark.；NestedrefsmodalAX,Trashfailure,clonefalse-residueUIandvisualissuesremainseparate.；Screenshot26oldrecoverybannerpersistswhileDclean; cause/expectedcleanupnotyetverified.

### MAC-GIT-STAGING-CONSOLIDATED-001

macOS26.3.1 arm64 native1280×800 / candidate6 release25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5; separate retainednative18test evidence / Independent26originalPNG review,22Git/file snapshots and current read-only OS/Git checks; explicitper-clause sourcecombination where stated / pass / full

实现：apps/git-service/src/lib.rs、apps/desktop/src-tauri/src/git.rs、apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx

步骤：逐条组合磁盘暂存、脏文件三个选择、不改磁盘取消暂存、unborn首次取消、部分暂存准确保留

实际Cancel保D/旧indexB；DiskOnly精确取磁盘C；SaveThenStage才写D并暂存D。rename与unborn取消暂存前后全部文件hash不变；原A/B/C/D分离与index-onlycommit保持部分暂存内容。

证据：docs/verification/results/git-consolidated/audit.json、docs/verification/results/git-gui-candidate6-audit/final-audit.json、docs/verification/results/git-integration-final/test-report.json、docs/verification/screenshots/git-candidate6/03-dirty-buffer-stage-choice.png、docs/verification/screenshots/git-candidate6/20-unborn-unstaged.png、docs/verification/screenshots/git-candidate6/25-draft-buffer-retained-across-projects.png、docs/verification/screenshots/git-candidate6/26-save-and-stage-D.png

限制：Closesfile-levelstagingsemantics, not v0.2line/hunkstagingorotherGitrequirements.；Visualfidelityandoldrecoverybannerremainseparate; doesnotclaimcandidate7GUI.

### MAC-GIT-HISTORY-CONSOLIDATED-001

macOS26.3.1 arm64 native1280×800 / candidate6 release25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5; separate retainednative18test evidence / Independent26originalPNG review,22Git/file snapshots and current read-only OS/Git checks; explicitper-clause sourcecombination where stated / pass / full

实现：apps/git-service/src/lib.rs、apps/desktop/src-tauri/src/git.rs、apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx

步骤：实际37条分页、元数据/删文件/多文件父差异；原生first-parent与旧cursor → 源码逐支核shallowboolean从系统Git→historypayload→可见本地范围说明 → 历史读取前后HEAD/branch/index/文件不变，其他项目dirtyD仍在

分页/详情/父差异有实际GUI和原生断言；读取不改变分支/缓冲区/暂存。浅历史说明由简单生产数据流与条件渲染源码闭合，明确未造shallow GUI场景。

证据：docs/verification/results/git-consolidated/audit.json、docs/verification/results/git-gui-candidate6-audit/final-audit.json、docs/verification/results/git-integration-final/test-report.json、docs/verification/screenshots/git-candidate6/15-C03-deleted-history-file.png、docs/verification/screenshots/git-candidate6/16-history-second-page-root-commit.png、docs/verification/screenshots/git-candidate6/25-draft-buffer-retained-across-projects.png

限制：Shallowlabelis sourceinvariantcombinedwithactualnormalhistory, not actualshallowcloneGUItest.；Longtitleoverflowandnestedarbitrary-refmodalAXissuesareseparatevisual/UIconditions.；Nativefirst-parent/stale-cursorassertionsfromretained18tests; no repeatedtestrun.

### MAC-GIT-CLONE-RESIDUE-CANDIDATE6-FAIL-001

macOS26.3.1 arm64 native1280×800 / candidate6 release25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5; separate retainednative18test evidence / Independent26originalPNG review,22Git/file snapshots and current read-only OS/Git checks; explicitper-clause sourcecombination where stated / fail / partial

实现：apps/git-service/src/lib.rs、apps/desktop/src-tauri/src/git.rs、apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx

步骤：选择existing-nonempty克隆，原生拒绝已存在目录 → 观察失败后的残留说明/清理入口，独立核existing keep.txt

目录被正确拒绝且43B keep.txt保持原文，但UI仍把这个既有目录列作本次可清理残留并提供清理按钮。源码marker守卫拒绝无本次标记目录；不代表误导界面通过。

证据：docs/verification/results/git-gui-candidate6-audit/final-audit.json、docs/verification/screenshots/git-candidate6/23-clone-existing-target-refused.png、docs/verification/results/git-gui-candidate6-audit/current-readonly.json

限制：No actual deletion or cleanup-button success claimed. Backendguardis source-reviewed; existingtargetpreservationisactualdiskproof.；Newnameclone succeeded separately; actualcancelledpartialclonecleanupstillunproven.

### MAC-GIT-NESTED-MODAL-CANDIDATE6-FAIL-001

macOS26.3.1 arm64 native1280×800 / candidate6 release25e407375f1f112e4d111d5b088065af3034cefb9ce9b4e087c805e6e0b288b5; separate retainednative18test evidence / Independent26originalPNG review,22Git/file snapshots and current read-only OS/Git checks; explicitper-clause sourcecombination where stated / fail / partial

实现：apps/git-service/src/lib.rs、apps/desktop/src-tauri/src/git.rs、apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx

步骤：原生分支同步中提交任意refs比较 → 第二比较dialog覆盖第一dialog；操作者读取AX为空，坐标选择后仍可查看差异

截图17显示两层模态；实际操作者报告AX树为空，不能算键盘/辅助功能可达。候选7改为单层待实机。

证据：docs/verification/results/git-gui-candidate6-audit/final-audit.json、docs/verification/screenshots/git-candidate6/17-ref-compare-nested-dialog.png、docs/verification/results/git-gui-candidate6-audit/checks-in-progress.json

限制：AXemptyisoperatorreportednativeobservation; verifierindependentlyviews2-overlayPNGbutdidnotoperateAXduringexclusivelease.；Directhistoryselectionworks; thisfailureisspecificbranch→refcomparepath.

### MAC-GIT-NATIVE-CANDIDATE7-001

macOS26.3.1 arm64 native service tests / candidate7 source; notyetpackagedGUI / Independent4rawtestlogs/affectedassertionreview,finalsourcehashmatch; no rerun / pass / partial

实现：apps/git-service/src/lib.rs、apps/git-service/tests/workflow.rs、apps/desktop/src/features/git/CloneForm.tsx、apps/desktop/src/features/git/Modal.tsx

步骤：ProductionnativeNSFileManagerTrash path removesownuntrackedfileandretainstracked → Untrackedhunkstartsline1andnextpagecontinuous; binaryexplicit → Remote symbolicHEADnotlistedasbranch → Cloneexistingtargetcleanupwithoutownedmarkerdenied; originalpreserved → Cloneconfirmationusessameparentdialoginlinecontent; nosecondshowModal

4项定向原生回归与最后TypeScript通过，源码hash匹配。Trash测试全程0.56秒（含夹具，不是单操作延迟）；目标回收站内容未在测试内恢复。3条实际candidate6GUI失败继续保留，待新包复测。

证据：docs/verification/results/git-candidate7-audit/audit.json、docs/verification/results/git-candidate7-audit/native-trash.log、docs/verification/results/git-candidate7-audit/diff-pages.log、docs/verification/results/git-candidate7-audit/remote-branches.log、docs/verification/results/git-candidate7-audit/clone-ownership.log、docs/verification/results/git-candidate7-audit/typecheck-clone-confirmation.log

限制：Only4targetedtests; notclaimedfull19testsrerun.；No candidate7GUI/bundle proof;doesnotsupersedeTrash/clone-residue/nestedmodal failures.；OSnativeTrashcallsucceedssourceitemgone, buttestdoesnotinspectrecoverabilityatactualTrashdestination.

### MAC-HOST-TRASH-NATIVE-CANDIDATE7-001

macOS26.3.1 arm64 actualNSFileManagernativeAPI / candidate7source; nativeintegrationbinary / Independentrawlog/complete2assertions/productionfile_trash review; no rerun orGUI / pass / partial

实现：apps/desktop/src-tauri/src/files.rs、apps/desktop/src-tauri/tests/files_workflow.rs

步骤：Ownrandomfile viafile_stat→file_trash moveswithNSFileManager; unrelatedretained → Wrongdigest/diskrevision/dirtybuffer eachreject beforeTrash

2tests pass，sourcefile消失且unrelated字节保持；STALE_VERSION/FILE_CHANGED/RESOURCE_BUSY各保原件。0.28s为两测试总时长，不是删除延迟。

证据：docs/verification/results/native-trash-candidate7-audit/audit.json、docs/verification/results/native-trash-candidate7-audit/native-trash.log

限制：Notcandidate7GUIorrecoveryfromTrashdestinationproof.；GitFinderGUIfailurestillactive; nativepositivehasnosupersedes.

### MAC-PACKAGE-CANDIDATE7-001

macOS26.3.1 arm64 / candidate7 release main SHA84c6cf3bfadaa7a481648f051e34ed07e0f08ed0875d771720916ede2409ab38 / Independent hdiutil verify, readonly/nobrowse/noautoopen mount, unzip integrity, temporary ditto extraction and SHA256 comparison of every bundle file / pass / partial

实现：scripts/package-macos.mjs

步骤：Verify DMG checksums and ZIP compressed-data integrity → Read-only mount DMG and unpack ZIP into task-owned temporary directory without launching either application copy → Compare all 2115 regular files, all executable modes, sidecars and 2109 mapped resource files to the independently audited candidate7 bundle → Detach the task-owned disk image and remove task-owned temporary directories

DMG与ZIP完整性均通过；各2115文件/35,616,966字节与候选7逐文件SHA完全一致，四个可执行文件均0755。DMG含Applications→/Applications链接。归档SHA和卸载记录已保存，未启动第二应用。

证据：docs/verification/results/package-candidate7/audit.json、docs/verification/results/package-candidate7/dmg-verify.json、docs/verification/results/package-candidate7/zip-test.json、docs/verification/results/package-candidate7/dmg-detach.json、docs/verification/results/bundle-candidate7/audit.json、docs/verification/results/bundle-candidate7/source-drift-audit.json

限制：Only candidate artifact integrity and bundle identity; overall product acceptance remains incomplete.；No clean installation, upgrade/migration, launch-from-installed-location, Gatekeeper trust, Developer ID or notarization claim.；Candidate7 GUI and performance tests remain separate.

### MAC-IDLE-CPU-CANDIDATE7-A-001

macOS26.3.1 arm64 AppleM2Pro; actual native window2560x1337 / candidate7 release84c6cf3bfadaa7a481648f051e34ed07e0f08ed0875d771720916ede2409ab38 / 125s all-attributed-process collector; first60s excluded; actual native operator scene held, original before/after PNG independently reviewed / pass / partial

实现：scripts/desktop/sample_macos.py、scripts/desktop/mac_metrics.py

步骤：Parent explicitly selects01Git project and Git tab before A; no picker invoked by parent in current process → Observe125.005s/118samples including all8 persistent responsibility-owned processes and2 short-lived Git processes → Confirm same project/editor/Git draft and actual2560x1337 before/after; retain original incorrect1280x800 metadata with explicit correction

后预热60个有效CPU样本覆盖63.2881秒，单核CPU平均0.43918%；有效footprint均值203.513MB。root全程存在，SavePanel为0。末样2个Git进程退出竞态使CPU/footprint为null，未补零。

证据：docs/verification/results/candidate7-panel-cpu-a-125s/audit.json、docs/verification/results/candidate7-panel-cpu-a-125s/samples.jsonl、docs/verification/results/candidate7-panel-cpu-a-125s/metadata.json、docs/verification/screenshots/root-candidate7/02-cpu-a-fixed-scene.png、docs/verification/screenshots/root-candidate7/03-cpu-a-after.png

限制：Only one small-file/Git baseline; not empty-host or10000-path standard reading budget.；Candidate6 SavePanel high-CPU failure remains active; B picker comparison still pending.；Earlier unexplained navigation/window changes preceded fixed scene and are not attributed by this measurement.；No resource counter export before A because export opens picker.

### MAC-IDLE-CPU-PANEL-CANDIDATE7-B-FAIL-001

macOS26.3.1 arm64 AppleM2Pro; native2560x1337 / candidate7 release84c6cf3bfadaa7a481648f051e34ed07e0f08ed0875d771720916ede2409ab38 / Same-bundle A/B all-attributed-process125s sampling, independent before/after nativePNG and PID/start/responsibility audit / fail / partial

实现：scripts/desktop/sample_macos.py、scripts/desktop/mac_metrics.py、apps/desktop/src-tauri/src/appearance.rs

步骤：A fixedsmall-file/Git scene CPUmean0.43918%, noSavePanel → Parent opensF09 preview, actual nativeSavePanel, navigatespreparedemptydirectory thenSave; expired5minute plan rejectswrite, panel closes; Cancelpreview/DoneSettingsrestore exactscene → B holds125.005s/118samples, all11persistenthelperidentitiesincluded; samebefore/after2560x1337PNG → Compare60fully-accountedpostwarmupsamples, keeponeGitexit-race sampletotalnull

B后预热CPU平均13.14150%，高于1%建议；同60样本SavePanel55971贡献12.77183%、其他0.36967%，约5秒出现65%脉冲。footprint均值312.243MB，比A增108.730MB。前后项目/文件/草稿一致，root全程存在；未终止或排除helper。

证据：docs/verification/results/candidate7-panel-cpu-a-125s/audit.json、docs/verification/results/candidate7-panel-cpu-b-125s/audit.json、docs/verification/results/candidate7-panel-cpu-b-125s/samples.jsonl、docs/verification/results/candidate7-panel-cpu-b-125s/scene-confirmed.json、docs/verification/screenshots/root-candidate7/06-cpu-b-before.png、docs/verification/screenshots/root-candidate7/07-cpu-b-after.png

限制：Reproduces highCPU after picker; actual repeatedly enumerated directory and source-level cause remain unproven.；Preparedemptytarget was navigated, but no exportfilewritten because previewexpired; no successfulexport or runtime-count evidence.；SavePanel own61sampleCPUmean13.05874 differs from60matchedtotal-sample contribution12.77183; both recorded with explicit bases.；No additional C scene, helperkill, applicationrestart or stack sample performed by verification.

### MAC-EDITOR-CLOSE-FOCUS-CANDIDATE7-002

macOS26.3.1 arm64 native1280x800 / candidate7 release84c6cf3bfadaa7a481648f051e34ed07e0f08ed0875d771720916ede2409ab38 / Exclusive native operator CmdW/Cancel/immediatephysicalkey; independent twooriginalPNG and rawreport review / pass / partial

实现：apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/features/editor/CodeSurface.tsx

步骤：Dirtyfocus.ts→CmdW→Cancel → Without clickingeditor sendphysicalq; observeCodeMirrorfocus/Ln2Col19 and // cancel-focus-7q → OperatorrecordsunchangeddiskSHA baseline

取消关闭保留文本并立即返回编辑焦点；无需重新点击即可输入q。仅撤销原取消焦点缺陷。

证据：docs/verification/results/editor-candidate7-incremental-audit/audit.json、docs/verification/results/editor-candidate7-incremental-audit/close-cancel-focus.json、docs/verification/screenshots/editor-candidate7/05-B08-dirty-close-dialog.png、docs/verification/screenshots/editor-candidate7/06-close-cancel-immediate-key-q.png

限制：Not fullFILE009 savefailure/discard/batchclose coverage.；DiskSHA and immediatekey sequence are originaloperatorrecords; verifierdidnotissueGUIinput.

### MAC-DIAGNOSTICS-GUI-CANDIDATE7-002

macOS26.3.1 arm64 native1280x800 / candidate7 release84c6cf3bfadaa7a481648f051e34ed07e0f08ed0875d771720916ede2409ab38 / Actual nativeF09 preview/confirmation/SavePanel successfulexport; independent exactbytes/schema/hashreview / pass / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src-tauri/src/settings.rs

步骤：NativeF09 diagnostics preview/confirm andSavewithinplanTTL toownedemptydirectory → Read4600B horizon-diagnostics.json exported03:08:46.551980Z → Check15frontendruntimecountersseparatefromnativewatchers/subscriptions

真实导出成功且匿名字段完整：runtime eventListeners14/pluginInstances4/pluginStoreObservers12/Cordisroot3，native watchers1/subscriptions2/openDocuments1。计数仅该导出时点，不声称持续回收或循环稳定。

证据：docs/verification/results/editor-candidate7-incremental-audit/audit.json、docs/verification/results/editor-candidate7-incremental-audit/diagnostics-before.json

限制：WrongappearanceSavePanelUI remains in thispackage; sourcefixlater, successfulbytes not proofpickerwordingfixed.；Selectivecache/chat/draft/credentialcleanup stillpending.；Rawopening8samplesareincidental; no20warm/P95budgetclaim.

### MAC-GIT-COMMIT-CONSOLIDATED-001

macOS26.3.1 arm64; nativeGUI plusproductionnative/source invariants / NativeGUI candidates3/4b/6/7 asreferenced; sources independently matchcandidate7 snapshot84c6cf3b…ab38 / Clause-level independent consolidation of existing nativeGUI, production nativeintegration and narrowly verified source invariants; no new execution / pass / full

实现：apps/git-service/src/lib.rs、apps/desktop/src/features/git/GitPanel.tsx

步骤：空说明/无暂存/冲突禁用 → 提交前范围变化须再次核对 → 提交只含已暂存 → hooks/签名失败保留说明与真实状态 → 成功显示提交标识，不自动推送

五条子条件组合闭合。实际hook失败保留说明/index，签名失败按同一非零退出与只成功清稿路径证明，不冒充已触发签名失败；范围重验和index-only提交已有真实服务/GUI证据。

证据：docs/verification/results/condition-consolidation-candidate7/audit.json、docs/verification/results/git-gui-candidate6-audit/initial-audit.json、docs/verification/screenshots/git-candidate6/04-C02-staged-before-commit.png、docs/verification/screenshots/git-candidate6/05-staged-diff-cleared-after-commit.png、docs/verification/screenshots/git-candidate6/09-hook-failure-draft-retained.png、docs/verification/results/git-integration-final/test-report.json

限制：No real signingfailure executed; explicitlyclosed by same productionnonzeroexit/draft-retention invariant validated throughactualhook failure.；Doesnotclose otherGit visual/cancel/Trash/clone conditions.

### MAC-PI-CAPABILITIES-RESUME-CONSOLIDATED-001

macOS26.3.1 arm64; nativeGUI plusproductionnative/source invariants / NativeGUI candidates3/4b/6/7 asreferenced; sources independently matchcandidate7 snapshot84c6cf3b…ab38 / Clause-level independent consolidation of existing nativeGUI, production nativeintegration and narrowly verified source invariants; no new execution / pass / full

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/agent/AgentPanel.tsx

步骤：固定Pi版本RPC消息/授权/取消/恢复逐项验证 → 首版附着任意TUI不支持；能力表 → 运行时与实例归属可见 → 空闲退出可恢复会话但不重发任务

固定Pi1.4.0协议/权限/取消及能力声明、运行时归属、空闲恢复完整组合闭合。实际历史恢复请求16→16、零Pi。原需求未要求另做OS/app重启；此条件不人为扩展。

证据：docs/verification/results/condition-consolidation-candidate7/audit.json、docs/verification/results/pi-native-candidate7/audit.json、docs/verification/results/pi-native-candidate7/pi-native.json、docs/verification/results/pi-native-gui-audit/audit.json、docs/verification/results/pi-native-gui/history-before.json、docs/verification/results/pi-native-gui/history-after.json、docs/verification/results/pi-native-gui/stream-stop.json、docs/architecture/PI_AGENT_RESEARCH.md

限制：ThisrequirementasksidlePi exit/resume; itdoesnotadd wholeOS/apprestart. Apprestartretention remainsseparatewhereexplicitlyrequired.；ControlledHTTPmodelprovider, realPi runtime; no livevendorcredentialclaim.；Original6GUIimagesJPEGmisnamedPNG, functionalonly; visualPNGfidelity remainsopen.

### MAC-DEFAULT-WORKBENCH-CONSOLIDATED-001

macOS26.3.1 arm64; nativeGUI plusproductionnative/source invariants / NativeGUI candidates3/4b/6/7 asreferenced; sources independently matchcandidate7 snapshot84c6cf3b…ab38 / Clause-level independent consolidation of existing nativeGUI, production nativeintegration and narrowly verified source invariants; no new execution / pass / full

实现：apps/desktop/src/App.tsx、apps/desktop/src/features/processes/index.tsx

步骤：默认扩展主界面项目/文件/代码 → AI/终端默认收起 → 配置集中设置，启动只留紧凑入口 → 无需登录阅读

默认项目/文件/代码、AI/终端收起、集中设置/紧凑启动入口及无需登录阅读已有真实GUI与默认状态/渲染路由不变量组合。只闭合默认功能布局，不表示八套视觉通过。

证据：docs/verification/results/condition-consolidation-candidate7/audit.json、docs/verification/results/capability-preset-consolidated/audit.json、docs/verification/screenshots/appearance-candidate3/01-mist.png、docs/verification/screenshots/editor-candidate7/06-close-cancel-immediate-key-q.png、docs/verification/results/processes-candidate6-audit/audit.json、docs/verification/screenshots/processes/023-candidate6-single-header-live.png

限制：Functionaldefaultinformationhierarchy only; no eight-layoutvisualfidelityclaim.；Lateruserchosenrestoredpanelsmayopen; defaultfalse clause appliesnewsession/noexplicitpreference.

### MAC-EDITOR-IME-CANDIDATE7-001

macOS 26.3.1 arm64, native 1280×800, SCIM Pinyin / candidate7 release 84c6cf3bfadaa7a481648f051e34ed07e0f08ed0875d771720916ede2409ab38 / Independent original PNG visual inspection plus exact disk UTF8/hash audit; exclusive operator performed physical keys and native Save/Undo/Redo / pass / partial

实现：apps/desktop/src/features/editor/CodeSurface.tsx、packages/editor/src/store.ts

步骤：Physical z h o n g w e n → marked zhong wen → Space 中文 → Physical s h u r u → marked shu ru → Space 输入; no paste/typeText/AX text injection → Native Save dirty→clean; independently read exact 34 UTF8 bytes → Cmd+Z removes entire 输入 composition, retains 中文 and dirty state

真实拼音组合、选中中文、保存与整次组合撤销通过。磁盘精确34B“真实拼音输入：\n中文输入”，SHA256与操作员记录一致。3张原始PNG均1280×800；未捕获候选浮窗，不作该画面证据。

证据：docs/verification/results/editor-candidate7-ime-audit/audit.json、docs/verification/results/editor-candidate7-ime-audit/operator-ime.json、docs/verification/results/editor-candidate7-ime-audit/saved-ime.txt、docs/verification/screenshots/editor-candidate7/08-ime-marked-zhong-wen.png、docs/verification/screenshots/editor-candidate7/09-ime-chinese-saved.png、docs/verification/screenshots/editor-candidate7/10-ime-undo-whole-composition.png

限制：Floating candidate list was not captured; only marked composition and chosen Chinese result are claimed.；Earlier shortcut/composition anomaly on focus.ts is a separate unresolved observation; this successful ime.txt case does not attribute or erase it.；Only FILE006 IME/undo/save subconditions, not full find/replace/unknown language or all editor acceptance.

### MAC-EXTENSION-STOP-FAILURE-NATIVE-001

macOS 26.3.1 arm64; native test + real QuickJS child + Tauri MockRuntime event transport / Post-candidate7 source snapshot; cfg(test) fault seam, no production fault switch / Read actual test source and production stop helpers; validate source/log hashes and raw phase invariants; did not rerun test or operate GUI / pass / partial

实现：apps/desktop/src-tauri/src/extensions.rs、apps/desktop/src-tauri/src/extension_host.rs

步骤：Launch actual extension-host worker; real hello/activate; deactivate intentionally never resolves → Inject one terminate failure after try_wait confirms live child before kill → Run production stop path and inspect pausing/cleanupFailed state, same activation/PID, resource ownership and unchanged policy → Retry same production cleanup; actual kill/wait, zero resources and ESRCH

实际QuickJS PID77809在注入清理失败后仍存活，资源数1、原activation/PID与策略保留，资源state=stopping。再次清理真实结束并wait，资源0/OS ESRCH。停止失败资源保留子条件已证；UI停止中/错误显示仍待原生操作。

证据：docs/verification/results/plugins-stop-failure-native/evidence.json、docs/verification/results/plugins-stop-failure-native-audit/audit.json、docs/verification/raw/plugins-candidate7/ext-009-cleanup-failure.log

限制：This is an injected native cleanup failure with a real live child, not an observed operating-system refusal to kill.；The test covers production state transitions and retry resource cleanup, not final extension_stop_apply policy commit.；No native GUI operation or stop-timeout screenshot was performed. Requirement-wide status remains partial.；This is post-candidate7 native test evidence; no new release GUI behavior claimed.

### MAC-EDITOR-QUICKOPEN-CANDIDATE7-001

macOS26.3.1 arm64 native1280×800 / candidate7 84c6cf3bfadaa7a481648f051e34ed07e0f08ed0875d771720916ede2409ab38 / Independent original native capture11–20 visual inspection, disk hashes against pre-GUI baseline, operator action records, narrow preview source invariants / pass / partial

实现：apps/desktop/src/features/editor/SearchPanel.tsx

步骤：Native ModShiftP >保存; Escape → Native ModP ime; reopen each mode retains its query → Bare > restores commandquery; Escape returns editor

正常组合结束后，文件/命令独立记忆、>模式与取消焦点路径通过；早先未完组合异常单列，不归因工具或产品。

证据：docs/verification/results/editor-candidate7-final-audit/audit.json、docs/verification/results/editor-candidate7-final-audit/actions.jsonl、docs/verification/screenshots/editor-candidate7/11-B03-command-query-remembered.png

限制：Current-project-only results and disabled-command guard remain separate; no fullFILE004 claim.

### MAC-EDITOR-SLEEP-RETURN-CANDIDATE7-001

macOS26.3.1 arm64 native1280×800 / candidate7 84c6cf3bfadaa7a481648f051e34ed07e0f08ed0875d771720916ede2409ab38 / Independent original native capture11–20 visual inspection, disk hashes against pre-GUI baseline, operator action records, narrow preview source invariants / pass / partial

实现：apps/desktop/src/features/editor/EditorWorkbench.tsx、packages/editor/src/store.ts

步骤：After operator sleep→Welcome→newproject inspect no staleerror → ReturnEditorQA restores focusdraft → Save yields clean tab and65Bdisk

新阅读项目未见stale scope错误，返回旧项目保稿且保存成功；起始sleep点击未保留日志，不撤销旧竞态失败。

证据：docs/verification/results/editor-candidate7-final-audit/audit.json、docs/verification/results/editor-candidate7-final-audit/actions.jsonl、docs/verification/screenshots/editor-candidate7/12-sleep-to-new-project-no-banner.png、docs/verification/screenshots/editor-candidate7/13-wake-retained-focus-draft.png

限制：Partial observation only; no auto5min/activeblocker/raceclosure claim.；Native captures are JPEG bytes named.png; functional evidence only, not formal PNG visual.

### MAC-EDITOR-RECOVERY-STALE-CANDIDATE7-FAIL-001

macOS26.3.1 arm64 native1280×800 / candidate7 84c6cf3bfadaa7a481648f051e34ed07e0f08ed0875d771720916ede2409ab38 / Independent original native capture11–20 visual inspection, disk hashes against pre-GUI baseline, operator action records, narrow preview source invariants / fail / partial

实现：apps/desktop/src/features/editor/EditorWorkbench.tsx

步骤：Save focus.ts and verifyclean → Old recovery banner still lists1draft → Compare returns No such file or directory (os error 2); reread clears

保存成功后恢复提示仍列已不存在草稿，比较报ENOENT。候选7真实失败；源码修复须新包对应复测。

证据：docs/verification/results/editor-candidate7-final-audit/audit.json、docs/verification/results/editor-candidate7-final-audit/actions.jsonl、docs/verification/screenshots/editor-candidate7/13-wake-retained-focus-draft.png、docs/verification/screenshots/editor-candidate7/14-stale-recovery-banner-after-save.png

限制：Disk save succeeded; stale recovery UI, not textloss.；Native captures are JPEG bytes named.png; functional evidence only, not formal PNG visual.

### MAC-MARKDOWN-PREVIEW-CONSOLIDATED-CANDIDATE7-001

macOS26.3.1 arm64 native1280×800 / candidate7 84c6cf3bfadaa7a481648f051e34ed07e0f08ed0875d771720916ede2409ab38 / Independent original native capture11–20 visual inspection, disk hashes against pre-GUI baseline, operator action records, narrow preview source invariants / pass / full

实现：apps/desktop/src/features/editor/Preview.tsx、apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/App.tsx、packages/plugins/src/runtime.ts

步骤：启用预览后Markdown分栏/标题定位可用，源码始终可读 → 脚本及默认远程资源禁用 → 暂停扩展释放预览，不启动语义服务

Markdown分栏、标题定位和源码可读已实机通过。脚本/远程默认禁用与暂停释放由明确渲染/清理不变量组合；实际全局停用经过相同卸载路径。

证据：docs/verification/results/editor-candidate7-final-audit/audit.json、docs/verification/results/editor-candidate7-final-audit/actions.jsonl、docs/verification/screenshots/editor-candidate7/15-B10-markdown-outline-jump.png、docs/verification/screenshots/editor-candidate7/16-B07-markdown-preview.png

限制：Pause release inferred from same gate/cleanup as actualdisable; no actualpaused-preview capture claimed.；Narrow layout/project images remain separate followups.；Native captures are JPEG bytes named.png; functional evidence only, not formal PNG visual.

### MAC-EDITOR-LARGEFILES-CANDIDATE7-001

macOS26.3.1 arm64 native1280×800 / candidate7 84c6cf3bfadaa7a481648f051e34ed07e0f08ed0875d771720916ede2409ab38 / Independent original native capture11–20 visual inspection, disk hashes against pre-GUI baseline, operator action records, narrow preview source invariants / pass / partial

实现：apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src-tauri/src/files.rs

步骤：10MiB simplifiedreadonly; physicalx/CmdS no write → 50MiB readonly0–262144→262144–524288; CmdS no overwrite → 120kline simplifiedreadonly; CmdS no write → Independent hash matches baseline3files+README

10MiB/50MiB/120k单行降级与部分加载保护通过；磁盘hash完全等于初始夹具。只读原因文案缺陷另记。

证据：docs/verification/results/editor-candidate7-final-audit/audit.json、docs/verification/results/editor-candidate7-final-audit/actions.jsonl、docs/verification/screenshots/editor-candidate7/17-read-10MiB-readonly.png、docs/verification/screenshots/editor-candidate7/18-B09-read-50MiB-first-chunk.png、docs/verification/screenshots/editor-candidate7/19-B09-read-50MiB-next-chunk.png、docs/verification/screenshots/editor-candidate7/20-long-line-120k-readonly.png

限制：Exact100k,binaryexternalopen,100MiBrefusal/timing remain untested.；Native captures are JPEG bytes named.png; functional evidence only, not formal PNG visual.

### MAC-EDITOR-READONLY-REASON-CANDIDATE7-FAIL-001

macOS26.3.1 arm64 native1280×800 / candidate7 84c6cf3bfadaa7a481648f051e34ed07e0f08ed0875d771720916ede2409ab38 / Independent original native capture11–20 visual inspection, disk hashes against pre-GUI baseline, operator action records, narrow preview source invariants / fail / partial

实现：apps/desktop/src/features/editor/EditorWorkbench.tsx

步骤：Open10MiB/120kline readonly → Read generic and simplifiedreason banners

同页误称“当前编码或文件权限不支持写入”，实际来自大小/超长行降级，与下方正确原因矛盾。只读原因显示失败；磁盘保护仍通过。

证据：docs/verification/results/editor-candidate7-final-audit/audit.json、docs/verification/results/editor-candidate7-final-audit/actions.jsonl、docs/verification/screenshots/editor-candidate7/17-read-10MiB-readonly.png、docs/verification/screenshots/editor-candidate7/20-long-line-120k-readonly.png

限制：No corruption or unauthorizedwrite.；Native captures are JPEG bytes named.png; functional evidence only, not formal PNG visual.

### MAC-MARKDOWN-TASK-GUI-CANDIDATE7-001

macOS26.3.1 arm64 native1280×800 / candidate7 84c6cf3bfadaa7a481648f051e34ed07e0f08ed0875d771720916ede2409ab38 / Independent original native capture11–20 visual inspection, disk hashes against pre-GUI baseline, operator action records, narrow preview source invariants / pass / partial

实现：apps/desktop/src/features/editor/Preview.tsx、apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/App.tsx、packages/plugins/src/runtime.ts

步骤：启用预览后Markdown分栏/标题定位可用，源码始终可读 → 脚本及默认远程资源禁用 → 暂停扩展释放预览，不启动语义服务

TASK031中普通Markdown分栏/标题定位/关闭与全局停用已有真实动作；任务另要求编辑预览更新、窄窗选区与具体释放计数，尚未全部验证。

证据：docs/verification/results/editor-candidate7-final-audit/audit.json、docs/verification/results/editor-candidate7-final-audit/actions.jsonl、docs/verification/screenshots/editor-candidate7/15-B10-markdown-outline-jump.png、docs/verification/screenshots/editor-candidate7/16-B07-markdown-preview.png

限制：Pause release inferred from same gate/cleanup as actualdisable; no actualpaused-preview capture claimed.；Narrow layout/project images remain separate followups.；Native captures are JPEG bytes named.png; functional evidence only, not formal PNG visual.；TASK031 has additional acceptance steps beyond FILE010, so task remains partial.

### MAC-NORMAL-QUIT-CANDIDATE7-001

macOS26.3.1 arm64 native1280×800 / candidate7 release84c6cf3bfadaa7a481648f051e34ed07e0f08ed0875d771720916ede2409ab38 / Actual native CmdQ confirmation; independent all-attributed PID+lstart/libproc identity and responsibility SPI audit / pass / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src-tauri/src/projects.rs、scripts/desktop/mac_metrics.py

步骤：Before normalexit union allA/B sample identities with current responsibility37993 children/helpers → Root nativeCmdQ, inspect no dirty documents/resources, click处理并退出 → Check all15PID+start identities and rescan responsibility37993 afterexit

退出前当前11个责任进程；合并A/B短命Git共15个身份。正常退出后全15均消失，责任37993复扫零残留，SavePanel/QuickLook/WebKit全部纳入。

证据：docs/verification/results/root-candidate7/normal-exit.json、docs/verification/screenshots/root-candidate7/08-normal-quit-plan.png、docs/verification/results/candidate7-exit-audit/before-exit.json、docs/verification/results/candidate7-exit-audit/after-exit.json

限制：No activeTTY/launcher/Pi or dirtydocument atquit; full active-resource/cancel/savefailure/reopen path remains separate.；Snapshot+earlier125s sample union is not an uninterrupted lifecycle census between sampling intervals.

### MAC-PROCESS-CONTROLLED-STOP-FAILURE-001

macOS26.3.1 arm64; production native supervisor + actual owned shell/child/process group / Candidate8 frozen source; cfg(test) run-scoped failure only; sourceSHA pinned in audit / Independent source, raw three-phase log, report and hashes audit; no rerun/GUI by verifier / pass / partial

实现：apps/desktop/src-tauri/src/processes.rs、apps/desktop/src/features/processes/index.tsx

步骤：Actual two services; second exits23 triggering production background cleanup → One run-scoped cfg(test) pre-signal error retains root97048/child97049/PGID97048 and lease → Observepartial/stopping/stopError, duplicateStart/delete RESOURCE_BUSY with onegroup → Retry production stop with real TERM/KILL; root/child/group absent, resources empty/lease released

停止失败保留真实PID/进程组、资源和租约，run为partial、step为stopping且stopError；重复启动/删除拒绝。重试真实回收全部后才终态，错误清除。源码UI直显状态/PID/停止未确认原因；不声称实际OS拒杀或故障GUI。

证据：docs/verification/results/processes-gui/candidate8-controlled-stop-failure.json、docs/verification/results/processes-gui/candidate8-controlled-stop-failure.log、docs/verification/results/processes-stop-failure-candidate8-audit/audit.json

限制：Not a real OS permission-denied or unkillable-process reproduction.；Not a GUI test; stopping/error rendering requires existing GUI evidence plus source invariant or candidate8 check.；Failure seam is cfg(test) only, keyed to this runId and consumed once; no release switch.

### MAC-LAUNCH-FAILURE-POLICY-CONSOLIDATED-001

macOS26.3.1 arm64; production native supervisor + actual owned shell/child/process group / Candidate8 frozen source; cfg(test) run-scoped failure only; sourceSHA pinned in audit / Clause-level combination of existing nativeGUI, real production native dependency/failure tests, controlled live-process cleanup-failure and narrow UI render invariants / pass / full

实现：apps/desktop/src-tauri/src/processes.rs、apps/desktop/src/features/processes/index.tsx

步骤：Required processfailure prevents dependents; actual native marker remains absent → Default stops newlystartedownedgroup; realGUI externalport process persists → Cleanupfailure retains partialrun+livePID+stopError; productionretry reclaims → ExplicitkeepRunning shown and actualremainingprocess preserved

LAUNCH006五子条件组合闭合：依赖失败不执行后继、默认清本组不误杀外部、停止失败保部分运行并直显错误、显式保留排错。UI故障显示采用实际服务状态+同组件渲染不变量，不冒充实际OS拒杀画面。

证据：docs/verification/results/processes-gui/candidate8-controlled-stop-failure.json、docs/verification/results/processes-gui/candidate8-controlled-stop-failure.log、docs/verification/results/processes-stop-failure-candidate8-audit/audit.json、docs/verification/results/processes-candidate5-audit/audit.json、docs/verification/results/processes-candidate7-audit/audit.json

限制：Not a real OS permission-denied or unkillable-process reproduction.；Not a GUI test; stopping/error rendering requires existing GUI evidence plus source invariant or candidate8 check.；Failure seam is cfg(test) only, keyed to this runId and consumed once; no release switch.；Full onlyLAUNCH006; runrestartversionprompt,autoURL,activequit andformalvisual stillseparate.

### MAC-PANEL-SETTINGS-PROJECT-A-125S-001

macOS26.3.1 arm64; actual native1280×800 / settings-project release SHA25695deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6; root34128 / Actual nativeGUI scene plus125s responsibility-attributed physical footprint/CPU collector; first60s warmup / pass / partial

实现：scripts/desktop/sample_macos.py、scripts/desktop/mac_metrics.py、apps/desktop/src-tauri/src/lib.rs、apps/desktop/src-tauri/src/appearance.rs

步骤：Freshreleasewelcome; no nativepicker yet → HoldGUI unchanged125seconds; countroot+descendants+responsibilityhelpers → Independentbefore/afteroriginalcapture andidentityaudit

同包同PID34128与1280×800欢迎页；117原始样本，后60秒61样本覆盖64.7139秒；全责任进程CPU均值0.221823%，physical footprint均值98.414739MB。 未用选择器基线低于1%建议；插件策略仍启用，不是全功能停用预算场景。

证据：docs/verification/results/settings-project-panel-a-125s/audit.json、docs/verification/results/settings-project-panel-a-125s/summary.json、docs/verification/results/settings-project-panel-a-125s/metadata.json、docs/verification/results/settings-project-panel-a-125s/samples.jsonl、docs/verification/results/settings-project-panel-a-125s/native-before.jpg、docs/verification/results/settings-project-panel-a-125s/native-after.jpg、docs/verification/results/settings-project-panel-source-audit/README.md

限制：Sequential stages retain process and picker history; not an isolated mode/sourcefix comparison.；Different welcome scene from candidate6/7 prior ~13% failures; those failures remain.；Point-time diagnostics are not live per-sample runtime counts.；Original native JPEG retained; scene inspected only, no design-reference visual pass inferred.；Source rfd rollback occurred afterthese samples; runningbinary stillcontains experiment, rollbacknotCPUfix.

### MAC-PANEL-SETTINGS-PROJECT-B-125S-001

macOS26.3.1 arm64; actual native1280×800 / settings-project release SHA25695deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6; root34128 / Actual nativeGUI scene plus125s responsibility-attributed physical footprint/CPU collector; first60s warmup / fail / partial

实现：scripts/desktop/sample_macos.py、scripts/desktop/mac_metrics.py、apps/desktop/src-tauri/src/lib.rs、apps/desktop/src-tauri/src/appearance.rs

步骤：F09 actual NSOpenPanel directory selection;1876B diagnostic export succeeds; return samewelcome → HoldGUI unchanged125seconds; countroot+descendants+responsibilityhelpers → Independentbefore/afteroriginalcapture andidentityaudit

同包同PID34128与1280×800欢迎页；117原始样本，后60秒61样本覆盖64.5515秒；全责任进程CPU均值3.424934%，physical footprint均值168.645883MB。 panel40868贡献3.190867%，关闭选择器后仍超过1%建议；全部9个责任身份计入，未杀helper。

证据：docs/verification/results/settings-project-panel-b-125s/audit.json、docs/verification/results/settings-project-panel-b-125s/summary.json、docs/verification/results/settings-project-panel-b-125s/metadata.json、docs/verification/results/settings-project-panel-b-125s/samples.jsonl、docs/verification/results/settings-project-panel-b-125s/native-before.jpg、docs/verification/results/settings-project-panel-b-125s/native-after.jpg、docs/verification/results/settings-project-panel-source-audit/README.md

限制：Sequential stages retain process and picker history; not an isolated mode/sourcefix comparison.；Different welcome scene from candidate6/7 prior ~13% failures; those failures remain.；Point-time diagnostics are not live per-sample runtime counts.；Original native JPEG retained; scene inspected only, no design-reference visual pass inferred.；Source rfd rollback occurred afterthese samples; runningbinary stillcontains experiment, rollbacknotCPUfix.

### MAC-PANEL-SETTINGS-PROJECT-C-125S-001

macOS26.3.1 arm64; actual native1280×800 / settings-project release SHA25695deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6; root34128 / Actual nativeGUI scene plus125s responsibility-attributed physical footprint/CPU collector; first60s warmup / fail / partial

实现：scripts/desktop/sample_macos.py、scripts/desktop/mac_metrics.py、apps/desktop/src-tauri/src/lib.rs、apps/desktop/src-tauri/src/appearance.rs

步骤：Actual appearancepreset NSSavePanel columnview;946B export succeeds; return samewelcome → HoldGUI unchanged125seconds; countroot+descendants+responsibilityhelpers → Independentbefore/afteroriginalcapture andidentityaudit

同包同PID34128与1280×800欢迎页；118原始样本，后60秒62样本覆盖64.9372秒；全责任进程CPU均值6.430524%，physical footprint均值173.898545MB。 panel40868贡献6.249457%，关闭选择器后仍超过1%建议；全部9个责任身份计入，未杀helper。

证据：docs/verification/results/settings-project-panel-c-125s/audit.json、docs/verification/results/settings-project-panel-c-125s/summary.json、docs/verification/results/settings-project-panel-c-125s/metadata.json、docs/verification/results/settings-project-panel-c-125s/samples.jsonl、docs/verification/results/settings-project-panel-c-125s/native-before.jpg、docs/verification/results/settings-project-panel-c-125s/native-after.jpg、docs/verification/results/settings-project-panel-source-audit/README.md

限制：Sequential stages retain process and picker history; not an isolated mode/sourcefix comparison.；Different welcome scene from candidate6/7 prior ~13% failures; those failures remain.；Point-time diagnostics are not live per-sample runtime counts.；Original native JPEG retained; scene inspected only, no design-reference visual pass inferred.；Source rfd rollback occurred afterthese samples; runningbinary stillcontains experiment, rollbacknotCPUfix.

### MAC-PANEL-SETTINGS-PROJECT-D-125S-001

macOS26.3.1 arm64; actual native1280×800 / settings-project release SHA25695deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6; root34128 / Actual nativeGUI scene plus125s responsibility-attributed physical footprint/CPU collector; first60s warmup / fail / partial

实现：scripts/desktop/sample_macos.py、scripts/desktop/mac_metrics.py、apps/desktop/src-tauri/src/lib.rs、apps/desktop/src-tauri/src/appearance.rs

步骤：Same SavePaneldirectory switchListView; alternatefilename export succeeds; return samewelcome → HoldGUI unchanged125seconds; countroot+descendants+responsibilityhelpers → Independentbefore/afteroriginalcapture andidentityaudit

同包同PID34128与1280×800欢迎页；117原始样本，后60秒61样本覆盖64.6008秒；全责任进程CPU均值4.215005%，physical footprint均值172.465260MB。 panel40868贡献3.998779%，关闭选择器后仍超过1%建议；全部9个责任身份计入，未杀helper。

证据：docs/verification/results/settings-project-panel-d-125s/audit.json、docs/verification/results/settings-project-panel-d-125s/summary.json、docs/verification/results/settings-project-panel-d-125s/metadata.json、docs/verification/results/settings-project-panel-d-125s/samples.jsonl、docs/verification/results/settings-project-panel-d-125s/native-before.jpg、docs/verification/results/settings-project-panel-d-125s/native-after.jpg、docs/verification/results/settings-project-panel-source-audit/README.md

限制：Sequential stages retain process and picker history; not an isolated mode/sourcefix comparison.；Different welcome scene from candidate6/7 prior ~13% failures; those failures remain.；Point-time diagnostics are not live per-sample runtime counts.；Original native JPEG retained; scene inspected only, no design-reference visual pass inferred.；Source rfd rollback occurred afterthese samples; runningbinary stillcontains experiment, rollbacknotCPUfix.；ListView didnoteliminatecost; prior column panels and ancestor enumeration not isolated.

### MAC-SETTINGS-GLOBAL-SCOPE-AND-PROJECT-SELECTOR-001

macOSnative1280×800 plus separately labeled controlledReactcomponent/bridge / settings-global bdd8843ebb227c0abee450211f55849c078816d3fe2920c4a1f6c963a548f2d1; settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 / Independent existing originalnativeimage/AX andcontrolledReactresult review; no newGUI in this audit / pass / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/appearance.rs、apps/desktop/src-tauri/src/settings.rs

步骤：ReadOct31actualmigration/nativecrossprojectlayoutandselectorrecords → InspectoriginalnativeimageandAX02→03 project/settingssection → InspectactualcontrolledReactscopewritepayloads; distinguishfromnativeGUI → Nov1 actual946Bappearancepreset export atC/D; identicalSHA

新全局外观规则下：实际跨项目仍为卡片分区，单外观入口四页签；设置下拉实际切工作台项目，窗口/分类保留且启动方案跟随。实际组件写入证明字体写global、缩进写project，加载期间旧值隐藏。Nov1命名外观方案导出成功；设置行为完整子条件仍待对应GUI。

证据：docs/verification/results/settings-scope-resume-audit/audit.json、docs/verification/SETTINGS_SCOPE_AUDIT.md、docs/verification/results/settings-global/summary.json、docs/verification/results/settings-global/result.json、docs/verification/results/settings-global/migration.json、docs/verification/results/settings-global/native-layout.jpg、docs/verification/results/settings-global/project-b-layout.txt、docs/verification/results/settings-project/summary.json、docs/verification/results/settings-project/result.json、docs/verification/results/settings-project/native-project-b.txt、docs/verification/results/settings-project/native-project-restored.txt、docs/verification/results/settings-project-panel-c-125s/audit.json、docs/verification/results/settings-project-panel-d-125s/audit.json

限制：ControlledReactbridgechecks are not nativeGUI checks.；No fullfont14→15allprojects/tab2→4+A8reset chain claimed; currentGUI remainsqueued.；No implicitpromotionof oldprojectappearance inheritance to validnewglobalrequirements.；No full8layoutdesignreviewor finalreleasepackageclaim.

### MAC-EDITOR-SLEEP-RECOVERY-SETTINGS-PROJECT-001

macOS26.3.1 arm64 native1280×800; separately labeled source/domain/native-test combination / settings-project SHA95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 root34128 / Independent originalnativeJPEG review + direct fixturebytes + previouslyexecuted productionStore/nativefile tests withmatchedsource; noGUI/test rerun byverifier / pass / partial

实现：packages/editor/src/store.ts、apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/features/editor/RecoveryNotice.tsx

步骤：Dirty41Bdraft→actualsleep retaincheckpoint→welcome → OpennewProjectB beforefileopen; nooldscopeerror → Wakeoldproject; dirtydraft intact; Saveclean/noRecoveryNotice; disk41Bexact

明确起始休眠动作与完整前后原图现已保留。新项目不再收到旧epoch错误；唤醒保稿，保存后恢复提示不残留，磁盘41B与文本一致。仅撤销这两项旧失败，自动5分钟/活跃阻止/异常退出等继续独立验收。

证据：docs/verification/results/editor-resume-incremental-audit/audit.json、docs/verification/results/editor-resume-incremental-audit/actions-at-audit.jsonl、docs/verification/results/editor-resume-20261101/003-checkpoint-before-sleep.jpg、docs/verification/results/editor-resume-20261101/004-sleep-retain-checkpoint.jpg、docs/verification/results/editor-resume-20261101/005-sleep-to-new-project-isolated.jpg、docs/verification/results/editor-resume-20261101/006-wake-retained-draft-before-save.jpg、docs/verification/results/editor-resume-20261101/007-wake-save-no-stale-recovery.jpg、docs/verification/results/editor-resume-incremental-audit/recovery.txt

限制：No actual native save/input overlap claimed; 024–026 invalidated observations retained in actions.；Storeasync test uses controlledtransport/faketimers; Rusttests use realtempfileproductionservice; neither is GUI.；Fullsavebehavior closure onlyFILE007, not allclose/recovery/threeproject/lifecycleconditions.；Recovery retest supersedes only oldsleepstalescope andsavedstaleRecoveryNotice failures.；NativeJPEG functional scene observations; no newvisualreferencepass.

### MAC-EDITOR-SAVE-VERSION-CONSOLIDATED-001

macOS26.3.1 arm64 native1280×800; separately labeled source/domain/native-test combination / settings-project SHA95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 root34128 / Independent originalnativeJPEG review + direct fixturebytes + previouslyexecuted productionStore/nativefile tests withmatchedsource; noGUI/test rerun byverifier / pass / full

实现：packages/editor/src/store.ts、apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/features/editor/RecoveryNotice.tsx、packages/editor/src/store.test.ts、apps/desktop/src-tauri/tests/files_workflow.rs

步骤：Only save matchingdiskbaseline → Failure retainsfulltext/dirtydot → New input during save remainsdirty → Duplicate samefile saves do notinterleave

保存版本校验四子句组合闭合：实际磁盘外变拒绝、全文和脏圆点保留；生产EditorStore同源码异步测试证明保存期间新版本仍脏与重复保存共用一次请求，真实native文件测试证明旧快照不清新checkpoint。GUI仅记录保存后继续编辑与再次保存，不声称捕获保存重叠。

证据：docs/verification/results/editor-resume-incremental-audit/audit.json、docs/verification/results/editor-resume-incremental-audit/actions-at-audit.jsonl、docs/verification/results/editor-resume-20261101/018-dirty-conflict-save-refused.jpg、docs/verification/results/editor-resume-20261101/021-failed-save-keeps-close-dialog-and-draft.jpg、docs/verification/results/editor-resume-20261101/027-native-save-immediate-paste-retained.jpg、docs/verification/results/editor-resume-20261101/028-repeat-save-final-bytes.jpg、docs/verification/results/editor-async-candidate8/evidence.json、docs/verification/results/editor-async-candidate8/store-tests-final.log、docs/verification/results/native-integration-final/native-close-cache-tests.log

限制：No actual native save/input overlap claimed; 024–026 invalidated observations retained in actions.；Storeasync test uses controlledtransport/faketimers; Rusttests use realtempfileproductionservice; neither is GUI.；Fullsavebehavior closure onlyFILE007, not allclose/recovery/threeproject/lifecycleconditions.；Recovery retest supersedes only oldsleepstalescope andsavedstaleRecoveryNotice failures.；NativeJPEG functional scene observations; no newvisualreferencepass.

### MAC-EDITOR-LARGEFILES-CONSOLIDATED-20261101-001

macOS26.3.1 arm64 actualnative; separatelylabeledproductiondomain/source evidence / settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6; earliercandidate7 referencedexplicitly / IndependentoriginalnativeJPEG/actualfixturebyteaudit, prior10/50MiBactualGUI evidence, samepreviouslytestedproductionstore/source invariants; noGUI/test rerun / pass / full

实现：packages/editor/src/store.ts、apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src-tauri/src/files.rs

步骤：10MiB/50MiB/100kline independentlydegrade → Size,range,readonlyreason → Partialloadcannotoverwritefullfile → Binaryopensviasystem

旧10/50MiB真实降级/分页/保存保护与当前99999/100000/100001字符边界、正确只读原因、101MiB实际分段和二进制系统委托共同闭合FILE011。当前5份文件hash均与原生成内容一致；仅撤销旧通用只读原因错误。

证据：docs/verification/results/editor-resume-large-and-close-audit/audit.json、docs/verification/results/editor-resume-large-and-close-audit/actions-at-audit.jsonl、docs/verification/results/editor-resume-20261101/039-limit-single-line-99999-txt.jpg、docs/verification/results/editor-resume-20261101/040-limit-single-line-100000-txt.jpg、docs/verification/results/editor-resume-20261101/041-limit-single-line-100001-txt.jpg、docs/verification/results/editor-resume-20261101/043-limit-binary-bin.jpg、docs/verification/results/editor-resume-20261101/044-101MiB-chunked-final-and-background-sleep.jpg、docs/verification/results/editor-resume-20261101/045-101MiB-next-chunk-save-disabled.jpg、docs/verification/results/editor-resume-20261101/046-binary-system-archive-result.jpg、docs/verification/results/editor-candidate7-final-audit/audit.json

限制：042isloadingtransientandnotlargefileendpoint; use044/045.；101MiBrefusal is notREQ-FILE011/PRDcondition; chunkedreadonlyisvalidlargerfilecase.；Native100000lineboundaryisrecordedexactly; nooffbyoneclaimderivedfrominitialsuggestedPRDwording.；ArchiveUtilitycannotdecodefakebinary; Horizonactualsystemdelegation iswhatpassed.；Closebatchmicrosequence verifiedviaactualproductionStore withcontrolledtransport, notnewnativeGUIbatch.；No8layoutvisualpassfromfunctionalimages.

### MAC-EDITOR-CLOSE-CONSOLIDATED-20261101-001

macOS26.3.1 arm64 actualnative; separatelylabeledproductiondomain/source evidence / settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6; earliercandidate7 referencedexplicitly / IndependentoriginalnativeJPEG/actualfixturebyteaudit, prior10/50MiBactualGUI evidence, samepreviouslytestedproductionstore/source invariants; noGUI/test rerun / pass / full

实现：packages/editor/src/store.ts、packages/editor/src/store.test.ts、apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src-tauri/src/files.rs

步骤：Save/discard/cancelindependent → Savefailuredoesnotclose → Cancelrestoresoriginalcontext → DiscardbufferdoesnotGitrestore → Batchcloseindividualhandling

保存/放弃/取消独立；真实失败保存仍留对话框与全文，候选7原生取消立即回编辑焦点。逐文件批量处理由同SHA生产Store已通过测试和同一对话框渲染证明；放弃只移除缓冲与checkpoint，不调用Git。没有声称新做原生批量关闭。

证据：docs/verification/results/editor-resume-large-and-close-audit/audit.json、docs/verification/results/editor-resume-large-and-close-audit/actions-at-audit.jsonl、docs/verification/results/editor-resume-20261101/021-failed-save-keeps-close-dialog-and-draft.jpg、docs/verification/results/editor-candidate7-incremental-audit/audit.json、docs/verification/results/editor-gui-candidate7/close-cancel-focus.json、docs/verification/results/editor-async-candidate8/evidence.json、docs/verification/results/editor-async-candidate8/store-tests-final.log

限制：042isloadingtransientandnotlargefileendpoint; use044/045.；101MiBrefusal is notREQ-FILE011/PRDcondition; chunkedreadonlyisvalidlargerfilecase.；Native100000lineboundaryisrecordedexactly; nooffbyoneclaimderivedfrominitialsuggestedPRDwording.；ArchiveUtilitycannotdecodefakebinary; Horizonactualsystemdelegation iswhatpassed.；Closebatchmicrosequence verifiedviaactualproductionStore withcontrolledtransport, notnewnativeGUIbatch.；No8layoutvisualpassfromfunctionalimages.

### MAC-EDITOR-EXTERNAL-CHANGE-CONSOLIDATED-20261101-001

macOS26.3.1 arm64 actual native; retained native/domain tests separately labeled / settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 root34128 / Independent original native GUI/disk/F09 review plus production cache source and retained prior native bounded-buffer results / pass / full

实现：packages/editor/src/store.ts、apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src-tauri/src/files.rs

步骤：Clean external changes refresh → Dirty conflict retains both; comparison, reload and copy → Autosave pauses on conflict → Deletion retains open content without overwrite

实际干净外变刷新、脏冲突保双方/比较/重载/另存、冲突暂停自动保存、外部移除仍保打开文本均已观察。磁盘原件/副本分别42B/62B，删除原文30B保留，不采用已撤回的026观察。

证据：docs/verification/results/editor-resume-external-and-cache-audit/audit.json、docs/verification/results/editor-resume-external-and-cache-audit/actions-at-audit.jsonl、docs/verification/results/editor-resume-20261101/017-clean-external-refresh.jpg、docs/verification/results/editor-resume-20261101/018-dirty-conflict-save-refused.jpg、docs/verification/results/editor-resume-20261101/019-conflict-comparison-both-sides.jpg、docs/verification/results/editor-resume-20261101/020-conflict-pauses-focus-autosave.jpg、docs/verification/results/editor-resume-20261101/021-failed-save-keeps-close-dialog-and-draft.jpg、docs/verification/results/editor-resume-20261101/022-conflict-copy-preserves-original.jpg、docs/verification/results/editor-resume-20261101/023-explicit-reload-restores-disk.jpg、docs/verification/results/editor-resume-20261101/029-opened-file-external-delete-retains-text.jpg、docs/verification/results/editor-resume-incremental-audit/audit.json

限制：F09 is a point-time snapshot; cache cold/warm means Horizon document state, not OS cache.；Native Document metadata count is distinct from retained text/EditorState capacity.；026 invalid external-delete observation excluded; use029 and actual missing path.；Shared production PIPE reader stress proves log bound, not actual GUI8MiB PTY stress.；RUN006 bound behavior does not close NFR001 budgets or NFR004 CPU/lifecycle.；Functional captures do not automatically pass visual-reference review.

### MAC-RESOURCE-BOUNDS-CONSOLIDATED-20261101-001

macOS26.3.1 arm64 actual native; retained native/domain tests separately labeled / settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 root34128 / Independent original native GUI/disk/F09 review plus production cache source and retained prior native bounded-buffer results / pass / full

实现：packages/editor/src/store.ts、apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src-tauri/src/state.rs、apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/processes.rs

步骤：Default10000 search cap is visible → 20 clean/64MiB initial limits are verifiable → Unsaved content is not evicted → Chat, terminal and logs are bounded → No fabricated memory gauge

真实10000搜索截断、>20clean后早期文件cold重读、8×9MiB后首文件cold重读及dirty持续warm/文本保留，与已验聊天分页/终端日志限额组合闭合。37个nativeDocument是元数据；不是37份正文。关闭其他标签后实际9个Document。缓存验证后显式保存保稿文件不改变此前淘汰证据。

证据：docs/verification/results/editor-resume-external-and-cache-audit/audit.json、docs/verification/results/editor-resume-external-and-cache-audit/actions-at-audit.jsonl、docs/verification/results/editor-resume-20261101/034-search-10000-cap.jpg、docs/verification/results/editor-resume-20261101/047-cache-over20-clean-with-dirty-retained.jpg、docs/verification/results/editor-resume-20261101/048-dirty-buffer-survives-clean-eviction.jpg、docs/verification/results/editor-resume-20261101/049-reopen-early-clean-after20.jpg、docs/verification/results/editor-resume-20261101/051-reopen-first-after72MiB.jpg、docs/verification/results/editor-resume-20261101/052-dirty-survives-byte-limit.jpg、docs/verification/results/editor-resume-20261101/export-byte-cache/horizon-diagnostics.json、docs/verification/results/editor-resume-20261101/export-cache/horizon-diagnostics.json、docs/verification/results/pi-native-final/pi-cache-tests.json、docs/verification/results/pi-native-final/audit.json、docs/verification/results/pi-native-gui-audit/audit.json、docs/verification/results/processes-service-audit/audit.json、docs/verification/results/processes-service-audit/service-tests.log

限制：F09 is a point-time snapshot; cache cold/warm means Horizon document state, not OS cache.；Native Document metadata count is distinct from retained text/EditorState capacity.；026 invalid external-delete observation excluded; use029 and actual missing path.；Shared production PIPE reader stress proves log bound, not actual GUI8MiB PTY stress.；RUN006 bound behavior does not close NFR001 budgets or NFR004 CPU/lifecycle.；Functional captures do not automatically pass visual-reference review.

### MAC-SEARCH-PENDING-STOP-SETTINGS-PROJECT-OBSERVATION-001

macOS26.3.1 arm64 native1280×800 / settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 root34128 / Actual native long-search screenshot/AX action; independent unchanged image inspection / not_run / partial

实现：apps/desktop/src/features/editor/SearchPanel.tsx

步骤：Long no-match search reports 正在搜索… → Operator filtered AX omitted Stop → Independent original057 screenshot shows Stop; record inconsistency pending chronology review

早期AX未列停止，较晚057原图实际可见停止；两次观察不足以证明持续缺失。原生缺陷结论撤回，原始记录和纠正保留。组件延迟句柄/零match复现另列；当前运行包未改。

证据：docs/verification/results/editor-search-cancel-resume-audit/audit.json、docs/verification/results/editor-resume-20261101/057-search-loading-stop-missing.jpg、docs/verification/results/editor-resume-20261101/actions.jsonl

限制：Native persistent missing-Stop was not established.；Component before/after evidence does not replace unified-build native cancellation.

### MAC-EDITOR-HOT24-SETTINGS-PROJECT-001

macOS26.3.1 arm64 native1280×800 / settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 root34128 / 24 actual native tab clicks; frozen otherwork; independent F09 rawtiming/timewindow/fixturehash audit usingexisting summarizer / pass / partial

实现：packages/editor/src/metrics.ts、apps/desktop/src/features/editor/CodeSurface.tsx、scripts/desktop/summarize_editor_metrics.py

步骤：Prewarm five184320B TS files in actual10000tracked cleanreading fixture → 03:10:50.148Z–03:11:04.598Z24native tabclicks → ExportrealF09; independentlyfilterbyactualinterval; match all24IDs78–101 andactionbounds → Compute existingstats fromvisible/highlight-ready proxy; keepCUAobservationboundseparate

24条均为warm/TS/184320B、clean revision0、同view5；应用打开handler→布局及高亮rAF代理中位23ms、P95 26ms、峰27ms，在150ms建议内。全部指标时点落在对应原生动作发出至观察之间；CUA调用观察上界P95另为552ms。1万tracked/五文件SHA/clean Git均核对。

证据：docs/verification/results/editor-hot24-settings-project-audit/audit.json、docs/verification/results/editor-hot24-settings-project-audit/filtered-editor-diagnostics.json、docs/verification/results/editor-hot24-settings-project-audit/summary.json、docs/verification/results/editor-resume-20261101/hot24-actions.json、docs/verification/results/editor-resume-20261101/hot24-raw.json、docs/verification/results/editor-resume-20261101/export-hot24/horizon-diagnostics.json

限制：Not exact pixel paint; handler timing excludes automation delivery before app handler.；Warm application cache; OS cache retained, not process coldstart.；Existing approximately2s ACTIVE collector continued; otherGUI/build/tests/fixtures frozen for24actions.；Current settings-project build, not upcoming finalcombined build.；No fullNFR002:20independentstarts andremainingplatform/finalscene checks separate.

### MAC-SEARCH-STOP-COMPONENT-RESUME-001

Actual React SearchPanel in Chromium with controlled transport, not macOS native acceptance / Current source SearchPanel one-line update; running settings-project binary unchanged / Independent source/harness inspection and original before/after component outputs / pass / partial

实现：apps/desktop/src/features/editor/SearchPanel.tsx、packages/editor/tests/quick-open.mjs

步骤：Virtual before-source reproduces no Stop after delayed task handle and zero match events; five prior phases pass → Current source schedules existing update() after task handle assignment → Same component harness passes six phases: Stop visible/clickable, one cancel invocation, terminal cancelled, query retained

生产React组件受控时序下，修复前等待停止控件1500ms超时；修复后6阶段通过，取消一次并保留查询。057原生图像仍不作为缺少按钮的失败证据。

证据：docs/verification/results/editor-search-cancel-resume-audit/audit.json、docs/verification/results/editor-resume-20261101/search-stop-before.json、docs/verification/results/editor-resume-20261101/search-stop-after.json

限制：Next unified release still needs one native pending no-match search Stop/cancel verification.；Controlled transport emits no matches; no native performance claim.

### MAC-ACTIVE-WORKFLOW-SETTINGS-PROJECT-30M-001

macOS26.3.1 arm64,Apple M2 Pro32GB / settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 root34128 / Actual1800.0051s passive process sampler during native editor/appearance workflows, followed by independent complete JSONL audit / pass / partial

实现：scripts/desktop/sample_macos.py、scripts/desktop/mac_metrics.py

步骤：Start after fixed A/B/C/D experiments, retain all existing helper processes → Collect867 samples at median2.08185s while actual editor,search,cache,reading andeightlayout workflows run → Preserve4 actual diagnostic snapshots and initiallynull resources; bind source hashes and snapshot timestamps → Observe real collector exit0 after30minutes; verify executable hash,all16 process identities,no rootmissing and foreignWebKit responsibility

当前包连续1800.0051秒、867样本，根进程全程在场；11个持续/后续helper身份和5个短暂horizon-rg均计量，未终止helper。physical footprint均值389.320MB/P95695.115MB/峰781.394MB；活跃工作流CPU均值11.685%。资源快照4份按真实导出时间保留。

证据：docs/verification/results/settings-project-active-workflow-30m/audit.json、docs/verification/results/settings-project-active-workflow-30m/metadata.json、docs/verification/results/settings-project-active-workflow-30m/samples.jsonl、docs/verification/results/settings-project-active-workflow-30m/summary.json、docs/verification/results/settings-project-active-workflow-30m/controls/actions.jsonl、docs/verification/results/settings-project-active-workflow-30m/foreign-responsible-processes.txt、docs/verification/results/editor-resume-20261101/actions.jsonl

限制：Current settings-project build only; final release still needs its own controlled30minute loop and post-quit resource audit.；Changing scenes/data mean descriptive9.878MB/min regression slope is neither a leak finding nor same-state no-growth acceptance.；AllCPU is active-workflow measurement, not fixed idleCPU<=1% proof; earlier panelCPU failures retained.；Nine samples have incompleteCPU orfootprint totals when first-seen/short-lived processes lack deltas; invalid values are null,notzero.；2s sampling can miss shorter processes;4 point-time diagnostic snapshots are not live per-row listener counts.；No Pi/provider workload and no final fixedscene resource budgets in this run.

### MAC-APPEARANCE-B01-SETTINGS-PROJECT-REVIEW-001

macOS 26.3.1 arm64, native 1280×800 / settings-project 95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6, PID 34128 / Independent manual comparison of eight original native JPEG captures against eight unchanged B01 references, plus semantic palette source check / pass / partial

实现：apps/desktop/src/styles.css、packages/plugins/builtins

步骤：Appearance owner used actual settings controls for eight layout/theme pairs with two clean tabs → Verifier independently viewed every original image and its matching reference → Verify image hashes, dimensions, themes, density and current geometry conditions → Resolve only repeated status row, paper/graphite edges, celadon drawer and previous named-palette mismatch; retain remaining differences

八套真实B01复图完成；八套重复状态行已消除，paper/graphite直角贴边和celadon抽屉成立。128项核心浅深色token与参考源码一致，原生图整体色偏消失。具体结构差异及数据/密度条件继续保留，未新增整体视觉通过。

证据：docs/verification/results/appearance-settings-project-b01-review/audit.json、docs/verification/results/appearance-settings-project-b01-review/captures.json、docs/verification/visual-records.json、docs/verification/screenshots/appearance-settings-project-b01/01-mist.jpg、docs/verification/screenshots/appearance-settings-project-b01/02-paper.jpg、docs/verification/screenshots/appearance-settings-project-b01/03-orbit.jpg、docs/verification/screenshots/appearance-settings-project-b01/04-graphite.jpg、docs/verification/screenshots/appearance-settings-project-b01/05-celadon.jpg、docs/verification/screenshots/appearance-settings-project-b01/06-iris.jpg、docs/verification/screenshots/appearance-settings-project-b01/07-sand.jpg、docs/verification/screenshots/appearance-settings-project-b01/08-aurora.jpg

限制：Source CSS fixes after capture are not included in this running binary; new bundle needs related native review.；Six own projects versus three reference projects, no Git M markers and density differences remain explicit.；JPEG supports manual structural review; exact per-pixel color or antialiasing equality is not claimed.；Only B01 and listed resolved subdifferences; other528 macOS product states retain their existing independent statuses.

### MAC-PICKER-LIFETIME-ISOLATED-PROBE-001

macOS26.3.1 arm64, isolated AppKit probe / Probe v2 SHA5c2a6ff23ec5c9f503ddcda4cea4247f4cb328b9ce6fbf05d9d0672678322add,112624B; Horizon unchanged / Four actual native GUI picker results and independent process-identity observation while parent remains alive / pass / partial

实现：scripts/desktop/mac_metrics.py

步骤：Record all pre-existing target service identities and old Horizon group → Native folder selected/cancelled and save selected/cancelled through distinct child bundle; child normally exit0 → Retain every new child/helper identity despite responsibility grouping; observe16 identities absent while parent+ThemeWidget live → Continue more than60s after last child exit; then native-close parent and verify cleanup separately

隔离探针四例正常返回exit0；父仍活跃时，四子及12个新面板服务全部自然消失，末例后至少107.5秒保有该状态。旧Horizon完整11身份保留，首例作废清理另列。

证据：docs/verification/results/picker-lifetime-probe-20261101/README.md、docs/verification/results/picker-lifetime-probe-20261101/source/PanelLifetimeProbe.swift、docs/verification/results/picker-lifetime-probe-20261101/source/compile-receipt-v2.json、docs/verification/results/picker-lifetime-probe-20261101/native-actions.jsonl、docs/verification/results/picker-lifetime-probe-20261101/evidence/v2/lifecycle-audit-parent-alive.json、docs/verification/results/picker-lifetime-probe-20261101/evidence/v2/parent-alive-after-four.json、docs/verification/results/picker-lifetime-probe-20261101/evidence/v2/post-parent-native-close.json

限制：Feasibility experiment only; no Horizon product integration or final idleCPU budget pass.；CPU benefit is inferred from terminated identities, not a measured whole-application budget.；Separate child bundle ID is part of the successful condition; same-bundle normal completion not measured.；Parent focus does not return automatically; cross-process host sheet semantics cannot be preserved by this probe.；5.413s recorder handoff gap falls between cases3 and4; no interpolated evidence.；Known candidate6/7/settings-project panelCPU failures remain active until actual product retest.

### MAC-EDITOR-FILEOPS-PREVIEW-PATHS-RESUME-001

macOS26.3.1 arm64 native1280×800; retained production service/source evidence separately labeled / settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 root34128 / Independent24original nativeJPEG, actual existing file/Trash bytes,100000-path count and narrow source/retained-test audit; no GUI/test rerun / pass / partial

实现：apps/desktop/src-tauri/src/files.rs、packages/editor/src/store.ts、apps/desktop/src/features/editor/SearchPanel.tsx

步骤：Create/save and two non-overwrite collision branches; rename updates tab; actual Trash preserves bytes → Singleclick clean preview reused; edit pins before next preview → Actual100k fixture layered navigation and last path; QuickOpen100-item limit → Independent existing100000-file count and last-file exacttext

新建/改名冲突保双方，成功改名更新标签，实际废纸篓仍为原24B中文文件。预览计数20→20→21与dirty固定图吻合。现存100000文件、末文件精确文本与GUI一致，快速打开明确仅前100项。

证据：docs/verification/results/editor-resume-e1-e2-audit/audit.json、docs/verification/results/editor-resume-e1-e2-audit/actions.jsonl、docs/verification/results/editor-resume-e1-e2-audit/fixture.json、docs/verification/results/editor-resume-20261101/009-file-create-save.jpg、docs/verification/results/editor-resume-20261101/010-file-create-collision.jpg、docs/verification/results/editor-resume-20261101/011-rename-collision-preserves-both.jpg、docs/verification/results/editor-resume-20261101/012-rename-success-updates-tab.jpg、docs/verification/results/editor-resume-20261101/013-native-trash-result.jpg、docs/verification/results/editor-resume-20261101/046-preview-reuse-edit-pins-tab.jpg、docs/verification/results/editor-resume-20261101/053-100k-project-root-lazy-tree.jpg、docs/verification/results/editor-resume-20261101/054-100k-lazy-two-directory-levels.jpg、docs/verification/results/editor-resume-20261101/055-100k-last-file-opened.jpg、docs/verification/results/editor-resume-20261101/056-100k-quickopen-100-results-cap.jpg

限制：System Reveal and dirty-file delete end-to-end remain; no permanent-delete fallback exists in reviewed native branch.；Layered screenshot does not measure backend I/O call counts.；Other-project state after clean close and complete QuickOpen disabled/current-project paths remain.；Not final-package performance or8layout visual pass.

### MAC-EDITOR-BASIC-EDIT-RESUME-001

macOS26.3.1 arm64 native1280×800; retained production service/source evidence separately labeled / settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 root34128 / Independent24original nativeJPEG, actual existing file/Trash bytes,100000-path count and narrow source/retained-test audit; no GUI/test rerun / pass / partial

实现：apps/desktop/src/features/editor/CodeSurface.tsx、packages/editor/src/store.ts

步骤：Native case/wholeword find-replace → Save exact38B retaining Alpha/alphabet → Open unknown.custom as readable plain text

实际alpha→omega只替换全词且区分大小写；磁盘38B“omega Alpha alphabet
omega beta omega
”。未知扩展显示原28B纯文本。旧真实拼音/撤销重做/保存与粘贴证据继续保留。

证据：docs/verification/results/editor-resume-e1-e2-audit/audit.json、docs/verification/results/editor-resume-20261101/032-find-replace-case-wholeword.jpg、docs/verification/results/editor-resume-20261101/033-unknown-extension-plain-text.jpg、docs/verification/results/editor-candidate7-ime-audit/audit.json

限制：Explicit native editor select→Copy→Paste still lacks retained evidence.；Earlier focus.ts shortcut/composition anomaly remains unattributed; current024–026 invalidated claims stay invalid.；No fullFILE006 orvisual acceptance.

### MAC-EDITOR-AUTOSAVE-AUTOSLEEP-RESUME-001

macOS26.3.1 arm64 native1280×800; retained production service/source evidence separately labeled / settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 root34128 / Independent24original nativeJPEG, actual existing file/Trash bytes,100000-path count and narrow source/retained-test audit; no GUI/test rerun / pass / partial

实现：apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src-tauri/src/settings.rs、apps/desktop/src-tauri/src/lib.rs

步骤：Enable afterDelay with existing dirty buffer; original disk remains → Next edit saves; focuschange saves; externalconflict separately pauses → Observe B/C automatic sleeping icons after background5min with default policy

开启延迟保存不立即写已有dirty；下一编辑及离焦分别实际写入，最终63B与记录吻合。B/C无手动sleep、继承5分钟/keepRunningfalse；044确有睡眠图标。B在自动sleep前已显式保存，不把其当成未落盘阻止条件。

证据：docs/verification/results/editor-resume-e1-e2-audit/audit.json、docs/verification/results/editor-resume-e1-e2-audit/owner-evidence-map.md、docs/verification/results/editor-resume-e1-e2-audit/root-resource-policy.json、docs/verification/results/editor-resume-20261101/014-autosave-enable-keeps-existing-dirty.jpg、docs/verification/results/editor-resume-20261101/015-autosave-after-delay.jpg、docs/verification/results/editor-resume-20261101/016-autosave-on-focus-change.jpg、docs/verification/results/editor-resume-20261101/020-conflict-pauses-focus-autosave.jpg、docs/verification/results/editor-resume-20261101/044-101MiB-chunked-final-and-background-sleep.jpg

限制：Native IME-autosave composition pause remains.；Sleep icons do not prove listener/scan/process cleanup.；B/C wake after automatic sleep, active-resource/undurable-draft blockers and manual-pause preservation remain.

### MAC-EDITOR-SEARCH-CONSOLIDATED-20261101-001

macOS26.3.1 arm64 native1280×800; retained production service/source evidence separately labeled / settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 root34128 / Independent24original nativeJPEG, actual existing file/Trash bytes,100000-path count and narrow source/retained-test audit; no GUI/test rerun / pass / full

实现：apps/desktop/src/features/editor/SearchPanel.tsx、apps/desktop/src-tauri/src/search.rs、apps/desktop/src-tauri/tests/search_workflow.rs

步骤：Grouped results/line2 navigation → Case,wholeword,regex,path range and no-result input retention → New query1031expected results; existing generation/cancel guards → Actual invalidregex UI plus same-SHA native no-spawn assertion → Visible disk-content label

FILE005原句逐项闭合：分组/定位、大小写/全词/regex/范围、换query隔离、错误regex不启动、空结果保输入、磁盘内容标记。当前100k中needle-89恰1031，与生成式一致；后端取消/无spawn源码及测试SHA与原通过记录完全相同。

证据：docs/verification/results/editor-resume-e1-e2-audit/audit.json、docs/verification/results/editor-resume-e1-e2-audit/actions.jsonl、docs/verification/results/editor-resume-20261101/035-search-case-insensitive-wholeword-path.jpg、docs/verification/results/editor-resume-20261101/036-search-case-sensitive-no-results-keeps-query.jpg、docs/verification/results/editor-resume-20261101/037-search-regex-path-two-lines.jpg、docs/verification/results/editor-resume-20261101/038-search-result-line-two-navigation.jpg、docs/verification/results/editor-resume-20261101/058-100k-new-query-stays-current.jpg、docs/verification/results/editor-resume-20261101/059-search-invalid-regex-keeps-input.jpg、docs/verification/results/native-integration-final/audit.json、docs/verification/results/native-integration-final/native-close-cache-tests.log

限制：Next combined package still requires actual pending search Stop/cancel under STATE003/component regression; this exact FILE005 closure does not remove that action.；Manual Stop persistent absence was never established by057; original correction retained.；Native service tests and source generation guards are labeled separately from GUI observations.；No search timing or fullNFR budget inferred.

### MAC-EDITOR-ENCODING-CONSOLIDATED-20261101-001

macOS26.3.1 arm64 native1280×800; retained production service/source evidence separately labeled / settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 root34128 / Independent24original nativeJPEG, actual existing file/Trash bytes,100000-path count and narrow source/retained-test audit; no GUI/test rerun / pass / full

实现：apps/desktop/src-tauri/src/files.rs、apps/desktop/src-tauri/src/settings.rs、apps/desktop/src/features/editor/CodeSurface.tsx、packages/editor/src/store.ts

步骤：Reuse actual BOM/CRLF/finalCRLF save → Newfile exactUTF8/LF24B; no-final-newline edit stays17B without trailingLF → UnsupportedLatin1 explicit readonly/no-save and originalfive bytes unchanged → Preference patch/reconfiguration writes onlysettings/effects; saves preserve document encoding/eol

旧51B BOM/3CRLF/末CRLF与当前新建24B UTF8/LF、无末换行17B、unsupported5B未动组合闭合。配置不批量改写由settings_patch仅写设置、CodeSurface仅重配及save保meta编码/换行的生产不变量证明，未声称新增配置遍历测试。

证据：docs/verification/results/editor-resume-e1-e2-audit/audit.json、docs/verification/results/editor-resume-20261101/009-file-create-save.jpg、docs/verification/results/editor-resume-20261101/013-native-trash-result.jpg、docs/verification/results/editor-resume-20261101/030-no-final-newline-preserved.jpg、docs/verification/results/editor-resume-20261101/031-unsupported-encoding-readonly.jpg、docs/verification/results/native-file-release-candidate/disk-observation.json、docs/verification/results/native-file-release-candidate/saved-file.txt、docs/verification/results/native-integration-final/native-close-cache-tests.log

限制：No dedicated new native preference-change/all-file-hash experiment; the no-bulk-rewrite clause is a source invariant combined with actual setting transition evidence.；Older native BOM and UTF16/mixed evidence provenance retained; not represented as rerun on current bundle.；No final package/platform or8layout visual pass implied.

### MAC-WORKSPACE-ADD-ALIAS-READONLY-RESUME-001

macOS26.3.1 arm64 native1280×800 / settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 root34128 / Independent original nativeJPEG/fullAX, task-owned disk bytes/modes and registry identity review; root performed GUI / pass / partial

实现：apps/desktop/src-tauri/src/projects.rs、apps/desktop/src-tauri/src/files.rs、apps/desktop/src/App.tsx

步骤：NativeAdd scriptedproject and readonlyproject → NativeAdd symlinkalias selects samecanonicalproject → Actualreadonly text/Saveblocked/SaveCopyentry → Independentlyverify marker/node_modulesabsent,Gitclean,sameHEAD,onecanonicalID,555/444mode

实际添加含dev/postinstall标记脚本的项目后无标记、无node_modules且Gitclean；alias解析同根，registry只有原ec6de2de项目。只读非Git文件真实可读、Save禁用、另存入口可见，原28B及555/444权限保持。

证据：docs/verification/results/workspace-resume-w1-audit/audit.json、docs/verification/results/workspace-resume-20261101/01-add-scripted.jpg、docs/verification/results/workspace-resume-20261101/01-add-disk-process.json、docs/verification/results/workspace-resume-20261101/02-alias-result.jpg、docs/verification/results/workspace-resume-20261101/03-readonly.jpg、docs/verification/results/workspace-resume-20261101/04-registry.json

限制：No exhaustive process trace; point-time process receipt and deterministic marker are combined.；SaveCopy entry visible but no copy action inthiscase.；Permission/path recovery remain observedfailure/pending; nofullWS002.；Not8layoutvisual acceptance.

### MAC-WORKSPACE-PERMISSION-RECOVERY-SETTINGS-PROJECT-FAIL-001

macOS26.3.1 arm64 native1280×800 / settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 root34128 / Independent original nativeJPEG/fullAX, task-owned disk bytes/modes and registry identity review; root performed GUI / fail / partial

实现：apps/desktop/src-tauri/src/projects.rs、apps/desktop/src/App.tsx

步骤：Addown000permissionfolder → Observeactivationfailurewithoriginalreadonlycontextpreserved → InspectfullAXandregistry → Restoreownedpermission000→700thenreopenexistingproject

权限拒绝只显示Permission denied(oserror13)toast和关闭，未给对应恢复入口；项目已registered但原readonly项目仍active。外部恢复权限后同ID可开，只证明恢复原目录，不撤销缺入口失败。

证据：docs/verification/results/workspace-resume-w1-audit/audit.json、docs/verification/results/workspace-resume-20261101/04-denied.jpg、docs/verification/results/workspace-resume-20261101/04-denied.txt、docs/verification/results/workspace-resume-20261101/04-registry.json、docs/verification/results/workspace-resume-20261101/05-permission-restored.json、docs/verification/results/workspace-resume-20261101/05-permission-reopened.jpg

限制：NewsourceRetry/Relocate and reportednative tests pendingcombined-packageGUI.；FailurelimitedtoWS002explicitrecoveryentry; no broaderSTATE001distinction failure inferredwithoutmatchingmissing-pathendpoint.

### MAC-WORKSPACE-MISSING-ROOT-EXIT-SETTINGS-PROJECT-FAIL-001

macOS26.3.1 arm64 native1280×800 / settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 root34128 / Independent original nativeJPEG/fullAX, task-owned disk bytes/modes and registry identity review; root performed GUI / fail / partial

实现：apps/desktop/src-tauri/src/projects.rs、packages/editor/src/store.ts、apps/desktop/src/App.tsx

步骤：Openrelocatablekeep.txt → Inactiveownrootcontrolledmove withsamebytes → NativeCmdQfailsbeforecloseplan → Restoreoriginalrootthenordinarycloseplanappears

后台已打开项目根搬迁后，CmdQ未出现退出计划，仅错误“符号链接指向项目外部”。将专用目录恢复原位置且32Bhash不变后，正常退出计划出现。source已改session元数据owner校验，但实际旧包失败仍保留。

证据：docs/verification/results/workspace-resume-w1-audit/audit.json、docs/verification/results/workspace-resume-20261101/06-relocate-before.jpg、docs/verification/results/workspace-resume-20261101/07-controlled-relocation.json、docs/verification/results/workspace-resume-20261101/08-missing-root-blocked-exit.jpg、docs/verification/results/workspace-resume-20261101/08-missing-root-blocked-exit.txt、docs/verification/results/workspace-resume-20261101/09-restore-for-old-exit.json、docs/verification/results/workspace-resume-20261101/10-old-exit-plan.txt、docs/verification/results/workspace-resume-20261101/root-fix-validation.json

限制：Sourcefix/reportednative test is not actualnewbundlequitpass.；No data lost or maliciouspath escape established; failureiscloseplanblockedonmissingregisteredroot.；Restoringtestrootiscleanup,notproductfix.

### MAC-NORMAL-QUIT-SETTINGS-PROJECT-IDENTITIES-001

macOS26.3.1 arm64 native1280×800 / settings-project95deaa5bb3d6d04bb7f7471d35bb6d07d313b12601df3534cac2080eb4423be6 root34128 / Independent original nativeJPEG/fullAX, task-owned disk bytes/modes and registry identity review; root performed GUI / pass / partial

实现：scripts/desktop/mac_metrics.py

步骤：Afterrestoringfixture,nativeCmdQshowsno-unsaveddocumentsplan → Rootclicks处理并退出;CUAreportsAppquit → Independent03:47:16.405Zcomparesall11retainedPID/startidentities → CheckremainingApplepanelcandidatesarepreexistingforeignowners

当前包正常退出后，34128及10个关联helper共11身份全消失，包含旧40868面板。仅余此前其他应用的服务，责任归742/732/676/621；未杀任何Applehelper。

证据：docs/verification/results/settings-project-normal-quit-20261101/post-quit-initial.json、docs/verification/results/settings-project-active-workflow-30m/audit.json、docs/verification/results/workspace-resume-20261101/10-old-exit-plan.txt

限制：NoactivePi/PTY/launchresourcesatquit; active-resourceQ1remains.；Noexactquitlatencyclaimed; thisispost-nativequitsnapshot.；DoesnotresolvepriorpanelidleCPUor08missing-rootclosefailure.；Notfinalcombinedbundle.

### MAC-NATIVE-PICKER-READING-A-125S-001

macOS 26.3.1 arm64 Apple M2 Pro; actual native 1280x800 / native-picker release d77ced715ee3c3b78d87e552138fc37d33ad9f70027423c0368bdff1c6a53d20; helper1fcf424a; root88219 / Independent original native JPEG/full AX, raw process identity/responsibility and numerical audit; root performed GUI / pass / partial

实现：scripts/desktop/sample_macos.py、scripts/desktop/mac_metrics.py、apps/desktop/src-tauri/src/picker.rs

步骤：Hold same release root, clean10000 tracked-file reading project, five184320B TypeScript tabs and hot4, Git ready, card/iris Mistlight1280x800 → Freeze GUI/build/tests for125seconds; attribute root, descendants, responsibility and retained start identities → Discard first60seconds for reported window; independently recompute means from117 raw samples and61 postwarmup rows → A before any picker; B after seven actual picker selection/cancel lifetimes with all28 new identities naturally gone

A: 125.0053s /117原始样本；后60s的61样本覆盖64.5849s。全6个关联身份每行均计入，root未缺失。physical footprint均值144.290889MB、P95144.592784MB（十进制）；CPU均值0.360263%、P950.685174%。阅读≤350MB及空闲CPU均值≤1%条件通过。

证据：docs/verification/results/native-picker-product-ab-audit/audit.json、docs/verification/results/native-picker-reading-A-125s/audit.json、docs/verification/results/native-picker-reading-A-125s/metadata.json、docs/verification/results/native-picker-reading-A-125s/samples.jsonl、docs/verification/results/native-picker-reading-A-125s/summary.json、docs/verification/results/native-picker-reading-A-125s/native-scene/reading-a-before.jpg、docs/verification/results/native-picker-reading-A-125s/controls/reading-fixture-audit.json

限制：MB=bytes/1000000; raw byte values preserved. CPU means, P95 and maxima are separate.；Reading condition only; empty-host/diff/one-and-second-Pi budgets and final same-state30minute/resource cleanup remain.；Root reports GUI freeze; original endpoint captures are independently inspected but do not independently prove every instant.；Eight unassigned WebKit candidates independently attributed to existing CC Switch645/Safari732, not omitted Horizon helpers.；After B and actual root exit, helper menu changed and outer bundle re-signed; measured original hashes retained, no claim these samples used later menu helper.；Original metadata used obsolete display name 圆角表达; exact iris ID and actual 卡片分区 scene never changed. Original raw metadata preserved with separate audit correction.

### MAC-NATIVE-PICKER-READING-B-125S-001

macOS 26.3.1 arm64 Apple M2 Pro; actual native 1280x800 / native-picker release d77ced715ee3c3b78d87e552138fc37d33ad9f70027423c0368bdff1c6a53d20; helper1fcf424a; root88219 / Independent original native JPEG/full AX, raw process identity/responsibility and numerical audit; root performed GUI / pass / partial

实现：scripts/desktop/sample_macos.py、scripts/desktop/mac_metrics.py、apps/desktop/src-tauri/src/picker.rs

步骤：Hold same release root, clean10000 tracked-file reading project, five184320B TypeScript tabs and hot4, Git ready, card/iris Mistlight1280x800 → Freeze GUI/build/tests for125seconds; attribute root, descendants, responsibility and retained start identities → Discard first60seconds for reported window; independently recompute means from117 raw samples and61 postwarmup rows → A before any picker; B after seven actual picker selection/cancel lifetimes with all28 new identities naturally gone

B: 125.0051s /117原始样本；后60s的61样本覆盖64.5644s。全6个关联身份每行均计入，root未缺失。physical footprint均值151.626964MB、P95151.654360MB（十进制）；CPU均值0.218225%、P950.588820%。阅读≤350MB及空闲CPU均值≤1%条件通过。 新产品选择器真实选取/取消后未留下旧高CPU面板身份；同root B相对A增加7.336075MB，无持续热helper。仅据本机真实产品复测替代五条旧选择器CPU失败，旧原始失败保留。

证据：docs/verification/results/native-picker-product-ab-audit/audit.json、docs/verification/results/native-picker-reading-B-125s/audit.json、docs/verification/results/native-picker-reading-B-125s/metadata.json、docs/verification/results/native-picker-reading-B-125s/samples.jsonl、docs/verification/results/native-picker-reading-B-125s/summary.json、docs/verification/results/native-picker-reading-B-125s/native-scene/reading-b-before.jpg、docs/verification/results/native-picker-reading-B-125s/controls/reading-fixture-audit.json

限制：MB=bytes/1000000; raw byte values preserved. CPU means, P95 and maxima are separate.；Reading condition only; empty-host/diff/one-and-second-Pi budgets and final same-state30minute/resource cleanup remain.；Root reports GUI freeze; original endpoint captures are independently inspected but do not independently prove every instant.；Eight unassigned WebKit candidates independently attributed to existing CC Switch645/Safari732, not omitted Horizon helpers.；After B and actual root exit, helper menu changed and outer bundle re-signed; measured original hashes retained, no claim these samples used later menu helper.；Between A/B one imported preset was added without applying; project/file/layout/theme/window scene is same, backend state is not claimed byte-identical. No B after screenshot claimed.

### MAC-NATIVE-PICKER-PRODUCT-LIFECYCLE-001

macOS 26.3.1 arm64 Apple M2 Pro; actual native 1280x800 / native-picker release d77ced715ee3c3b78d87e552138fc37d33ad9f70027423c0368bdff1c6a53d20; helper1fcf424a; root88219 / Independent original native JPEG/full AX, raw process identity/responsibility and numerical audit; root performed GUI / pass / partial

实现：apps/picker-service/Picker.swift、apps/desktop/src-tauri/src/picker.rs、apps/desktop/src-tauri/src/appearance.rs

步骤：Start uninterrupted passive identity observer after A and before first picker → Actual folder export selected/cancel; preset Save selected/cancel; validJSON import selected/cancel; seventh Save CmdQ ineffective then Cancel → Independently inspect original native images/AX and exact2244B diagnostic/946B preset export bytes → Observe all28 new identities disappear while same6 baseline Horizon identities remain, then complete fixedB sampling

423.8151s/393连续样本；7次独立HorizonPicker和21个Apple面板服务共28新身份，首次责任均属88219，末行全部自然消失且root全程存活。三类选择与取消均返回设置焦点；默认导出JSON名正确、TXT不可选，JSON导入新增第三预设并明确须点应用才生效。folder诊断2244B与preset946B独立hash匹配。

证据：docs/verification/results/native-picker-product-ab-audit/audit.json、docs/verification/results/native-picker-product-ab-audit/picker-lifecycle/identity-observation.jsonl、docs/verification/results/native-picker-product-ab-audit/picker-lifecycle/summary.json、docs/verification/results/native-picker-product-ab-audit/exports/horizon-diagnostics.json、docs/verification/results/native-picker-product-ab-audit/exports/horizon-appearance.json、docs/verification/results/native-picker-release-20261101/gui-summary.json、docs/verification/results/native-picker-release-20261101/save-ready.jpg、docs/verification/results/native-picker-release-20261101/file-ready.jpg、docs/verification/results/native-picker-release-20261101/file-import-settled.txt

限制：One-second observations can miss shorter-lived identities; sampled first/last bounds are not exact click or exit latency.；No Apple helper killed and no root restart between A/lifecycle/B. CmdQ failed separately; normal Cancel recovery does not erase it.；Host blank sheet blocks parent while child foreground; AX restores Settings container, no full keyboard/focus requirement pass inferred.；Old probe feasibility evidence retained; this is actual Horizon integration. It does not replace active-resource exit/30minute same-state work.；file-import-completed capture is transient; settled original JPEG/AX proves completed import.

### MAC-NATIVE-PICKER-CMDQ-FAIL-001

macOS 26.3.1 arm64 Apple M2 Pro; actual native 1280x800 / native-picker release d77ced715ee3c3b78d87e552138fc37d33ad9f70027423c0368bdff1c6a53d20; helper1fcf424a; root88219 / Independent original native JPEG/full AX, raw process identity/responsibility and numerical audit; root performed GUI / fail / partial

实现：apps/picker-service/Picker.swift、apps/desktop/src-tauri/src/picker.rs

步骤：Open seventh actual Save picker → Issue normal CmdQ then100ms CmdQ through native operator → Inspect host blank sheet and actual Save window still present → Use ordinary Cancel to recover and continue B

Save选择器活动时两次CmdQ均未进入宿主退出计划，选择器仍打开。之后普通Cancel正常返回设置。记录核心键盘退出路径失败，不将面板自然回收当作CmdQ成功。

证据：docs/verification/results/native-picker-product-ab-audit/audit.json、docs/verification/results/native-picker-release-20261101/gui-summary.json、docs/verification/results/native-picker-release-20261101/picker-cmdq.txt、docs/verification/results/native-picker-release-20261101/picker-cmdq-settled.jpg、docs/verification/results/native-picker-release-20261101/picker-cmdq-still-open.txt、docs/verification/results/native-picker-release-20261101/picker-after-cmdq-cancel.txt

限制：Failure specific to active native child picker; not normal host CmdQ behavior after picker closes.；Later menu helper source/build is not yet native retest evidence in this record; original failing bundle identity retained.

### MAC-WORKSPACE-NORMALIZATION-RECOVERY-FULL-001

macOS26.3.1 arm64 actual native1280x800 / native-picker d77ced715ee3c3b78d87e552138fc37d33ad9f70027423c0368bdff1c6a53d20 root88219; after menuhelper/outer-signature update main abc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917, identical executable payload12bafafe / Independent original nativeJPEG/fullAX, owned bytes/recovery/registry, actual PID-start liveness and narrow source invariant review; root performed GUI / pass / full

实现：apps/desktop/src-tauri/src/projects.rs、apps/desktop/src/App.tsx

步骤：Combine previous actualsame-canonical-path alias singleID and readonly/nonGit open evidence → New release denied directory shows permission-specific Retry/Relocate; restore owned0700 and click Retry, actual keep body opens → Move inactive root keeping32Bhash; after normal exit/reopen, unavailable-path dialog differs from permission case → Actual Relocate chooses moved directory; same projectID/session keep.txt body restored

原有alias规范同根仅ec6de2de项目、只读非Git原28B可读/保存禁用与本次实际权限Retry、缺目录Relocate组合闭合WS002。两类恢复文案与入口明确；Relocate保持6c0d32d8项目身份与keep会话，原32Bhash未变。权限入口旧失败由当前真实新包路径替代。

证据：docs/verification/results/workspace-native-picker-audit/audit.json、docs/verification/results/workspace-resume-w1-audit/audit.json、docs/verification/results/workspace-resume-20261101/02-alias-result.jpg、docs/verification/results/workspace-resume-20261101/03-readonly.jpg、docs/verification/results/workspace-native-picker-20261101/01-permission-recovery-dialog.jpg、docs/verification/results/workspace-native-picker-20261101/03-permission-open-owned-file.txt、docs/verification/results/workspace-native-picker-20261101/08-missing-root-recovery-dialog.jpg、docs/verification/results/workspace-native-picker-20261101/09-relocate-restored-session.txt

限制：Old alias/readonly native observations reused with current independentcanonical-path andfilehash confirmation; no redundantGUI rerun.；Single restored file is not fullWS005 multi-project editor/Git/chat session coverage.；Only permission/missing-root failure superseded; no visual fidelity or active-resource exit claim.

### MAC-WORKSPACE-PERMISSION-MISSING-STATES-001

macOS26.3.1 arm64 actual native1280x800 / native-picker d77ced715ee3c3b78d87e552138fc37d33ad9f70027423c0368bdff1c6a53d20 root88219; after menuhelper/outer-signature update main abc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917, identical executable payload12bafafe / Independent original nativeJPEG/fullAX, owned bytes/recovery/registry, actual PID-start liveness and narrow source invariant review; root performed GUI / pass / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src-tauri/src/projects.rs

步骤：Compare native permission and absent-directory dialogs → Recover through actual Retry and Relocate while original reading context remains

权限显示“项目目录需要访问权限”，路径失效显示“项目目录不可用”；均保留原项目显示路径和原reading上下文，提供重试/重新定位；真实各走一条恢复成功。

证据：docs/verification/results/workspace-native-picker-audit/audit.json、docs/verification/results/workspace-native-picker-20261101/01-permission-recovery-dialog.txt、docs/verification/results/workspace-native-picker-20261101/08-missing-root-recovery-dialog.txt、docs/verification/results/workspace-native-picker-20261101/06-missing-root-exit-cancel-preserved.jpg

限制：Covers permission versus missing-path states only; other requirement empty/error-state/input conditions retain their own evidence.

### MAC-WORKSPACE-MISSING-ROOT-NORMAL-QUIT-001

macOS26.3.1 arm64 actual native1280x800 / native-picker d77ced715ee3c3b78d87e552138fc37d33ad9f70027423c0368bdff1c6a53d20 root88219; after menuhelper/outer-signature update main abc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917, identical executable payload12bafafe / Independent original nativeJPEG/fullAX, owned bytes/recovery/registry, actual PID-start liveness and narrow source invariant review; root performed GUI / pass / partial

实现：apps/desktop/src-tauri/src/projects.rs、packages/editor/src/store.ts、apps/desktop/src/App.tsx

步骤：Keep registered inactive project root moved and unavailable → Native main-windowCmdQ opens actual close plan → Cancel returns five unchanged reading tabs → CmdQ and Process-and-Quit normally exits app; independent check all6original PID/start identities absent

源根确实保持不存在时，本次主窗CmdQ已出现退出计划；取消保留5标签，再确认正常退出。04:08:17独立查88219及5个基础helper全部消失，未恢复旧路径来绕过退出。替代旧包缺根会话刷盘阻塞退出失败。

证据：docs/verification/results/workspace-native-picker-audit/audit.json、docs/verification/results/workspace-native-picker-20261101/04-move-receipt.json、docs/verification/results/workspace-native-picker-20261101/05-missing-inactive-root-close-plan.jpg、docs/verification/results/workspace-native-picker-20261101/06-missing-root-exit-cancel-preserved.jpg、docs/verification/results/workspace-native-picker-20261101/actions.jsonl、docs/verification/results/native-picker-product-ab-audit/post-native-quit.json

限制：NoactivePi/PTY/launcher or dirtydocument during this normalquit; fullQ1 activity/resource/cancel/savefailure/reopen remains.；Post-native-quit identity snapshot does not assert exact quit latency.；Same-root picker28identity cleanup and fixedreadingA/B are separately recorded.

### MAC-WORKSPACE-REMOVE-RETAIN-DRAFT-001

macOS26.3.1 arm64 actual native1280x800 / native-picker d77ced715ee3c3b78d87e552138fc37d33ad9f70027423c0368bdff1c6a53d20 root88219; after menuhelper/outer-signature update main abc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917, identical executable payload12bafafe / Independent original nativeJPEG/fullAX, owned bytes/recovery/registry, actual PID-start liveness and narrow source invariant review; root performed GUI / pass / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src-tauri/src/projects.rs、apps/desktop/src-tauri/src/settings.rs

步骤：Rename display name and pin same project/root → Make ownW2_UNSAVED_RETAIN_1101 dirty edit → Open remove plan and Cancel; dirty text remains → Choose Retain Recovery and remove association → Read originalsource32B andretainedrecovery56B independently → F09 select only ownrecovery and preview1-item cleanup, thenCancel

改名/固定保留原目录和正文；Remove明确1份未保存文档，Cancel留脏稿；选择保留恢复稿后仅6c0d32d8项目关联消失。原磁盘32B/SHA9bb1c335未改且无新marker；恢复JSON有同projectId/baseDiskHash及完整56B未保存正文。F09标“已移除项目”，单选只列1项待清，Cancel后该稿仍存在。

证据：docs/verification/results/workspace-native-picker-audit/audit.json、docs/verification/results/workspace-native-picker-20261101/10-renamed-pinned-same-root.jpg、docs/verification/results/workspace-native-picker-20261101/12-remove-dirty-plan.txt、docs/verification/results/workspace-native-picker-20261101/13-remove-cancel-preserved-dirty.jpg、docs/verification/results/workspace-native-picker-20261101/14-remove-retain-selected.txt、docs/verification/results/workspace-native-picker-20261101/17-removed-project-draft-preview.jpg、docs/verification/results/workspace-native-picker-20261101/18-post-remove-disk-receipt.json、docs/verification/results/workspace-native-picker-20261101/19-single-draft-clean-preview.txt、docs/verification/results/workspace-native-picker-audit/retained-source-keep.txt、docs/verification/results/workspace-native-picker-audit/removed-project-own-recovery.json

限制：Noactive managedservice in removal; active-service removal remains forQ1/P1.；Cleanup preview was cancelled; permanent selectedhistory cleanup not measured.；Doesnot prove independentcache/chat/credential cleanup or no-deletion of externalAgentdata; those remainD1.

### MAC-WORKSPACE-ROOT-SCOPE-WORKTREE-FULL-001

macOS26.3.1 arm64 actual native1280x800 / native-picker d77ced715ee3c3b78d87e552138fc37d33ad9f70027423c0368bdff1c6a53d20 root88219; after menuhelper/outer-signature update main abc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917, identical executable payload12bafafe / Independent original nativeJPEG/fullAX, owned bytes/recovery/registry, actual PID-start liveness and narrow source invariant review; root performed GUI / pass / full

实现：apps/git-service/src/lib.rs、apps/git-service/tests/workflow.rs、apps/desktop/src-tauri/src/projects.rs

步骤：Add nested directory as its own project and inspect explicit parentrepository guard → Add parent root and linkedworktree independently; nativeGit showsmain andqa-worktree → Independently verify3distinct registryIDs/roots, originalHEADs andcleantrees → Review mutate→expected→status→canonical rootcheck and existing18-test non-root integration evidence

nested-directory明确提示单独添加父仓库根并避免无提示提交父目录，无提交入口；parent与linked-worktree已独立注册，分别显示main/qa-worktree，原HEAD及clean状态独立核对不变。每个项目仅持一个root，写命令先经canonical rev-parse根一致性检查，不能绕过界面向父目录提交。

证据：docs/verification/results/workspace-native-picker-audit/audit.json、docs/verification/results/workspace-native-picker-20261101/20-nested-parent-repository-guard.jpg、docs/verification/results/workspace-native-picker-20261101/20-nested-parent-repository-guard.txt、docs/verification/results/workspace-native-picker-20261101/21-parent-root-git-usable.jpg、docs/verification/results/workspace-native-picker-20261101/22-worktree-independent-branch.jpg、docs/verification/results/workspace-native-picker-20261101/23-post-workspace-receipt.json、docs/verification/results/git-integration-final/audit.json

限制：Native nested case is a project directory inside parentrepository. PRD54/interaction53 exclude scanning or aggregating nestedrepositories; no such capability claimed.；No actual commit performed in this guard case; prevention combines visible blockedUI and production writepath invariant with existing realrepo tests.；No newGit test rerun; no source/root/branch mutations by verifier.

### MAC-NATIVE-PICKER-CMDQ-SCOPE-OBSERVATION-001

macOS26.3.1 arm64 actual native1280x800 / native-picker d77ced715ee3c3b78d87e552138fc37d33ad9f70027423c0368bdff1c6a53d20 root88219; after menuhelper/outer-signature update main abc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917, identical executable payload12bafafe / Independent original nativeJPEG/fullAX, owned bytes/recovery/registry, actual PID-start liveness and narrow source invariant review; root performed GUI / not_run / partial

实现：apps/picker-service/Picker.swift、apps/desktop/src-tauri/src/picker.rs

步骤：Retain original two unsuccessful native child-picker CmdQ observations and current menu-helper repeat → Review diagnosticcopy local/menu trace: ready and later menu requestQuit only → Compare exact canonicalRUN004/UI004 and interactionclose/quit requirements; remove extra unrequested picker-open shortcut obligation

原CmdQ输入后Save仍开的事实保留；仪器副本未记录local/menu键事件，不能归因为业务退出判断。规范要求关闭/退出保护与核心键盘可达，未另要求文件选择器保持打开时直接CmdQ。将原记录从104硬失败门槛撤回为组合未证实/自动化观察边界；未称CmdQ成功，也未删旧fail原始证据。

证据：docs/verification/results/picker-cmdq-menu-20261101/native-observation.json、docs/verification/results/picker-cmdq-menu-20261101/isolated-input-probe/audit.json、docs/verification/results/picker-cmdq-menu-20261101/isolated-input-probe/key-events.jsonl、docs/verification/results/picker-cmdq-menu-20261101/isolated-input-probe/native-after-key.txt、docs/product/REQUIREMENTS.md、docs/ux/INTERACTION_SPEC.md、docs/verification/results/native-picker-release-20261101/picker-cmdq-still-open.txt

限制：Native picker-open directCmdQ remains unproven; no OS/automation rootcause asserted.；Normalmain-windowCmdQ, Cancel/retry protection and active-resource exit remain required; scope correction cannot stand in forQ1.；Instrumented copy is diagnostic only, not production GUI success.

### MAC-NATIVE-PICKER-MENU-QUIT-CHAIN-001

macOS26.3.1 arm64 actual native1280x800 / native-picker d77ced715ee3c3b78d87e552138fc37d33ad9f70027423c0368bdff1c6a53d20 root88219; after menuhelper/outer-signature update main abc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917, identical executable payload12bafafe / Independent original nativeJPEG/fullAX, owned bytes/recovery/registry, actual PID-start liveness and narrow source invariant review; root performed GUI / pass / partial

实现：apps/picker-service/Picker.swift、apps/desktop/src-tauri/src/picker.rs

步骤：Open production Save picker on targetedmenu-helper bundle → Choose actual Horizon→退出Horizon menu → Observe helper closes and hostprotectedexitplan appears, thenCancel → ContinueactualRelocate andobserve bothpicker groups naturallydisappear

实际菜单Quit走完child回复与宿主closeplan链，主窗未绕过保护。217.0227s/202行中Save+Relocate两组2child/6系统服务共8身份全部gone，21917父进程全程存在。之后W2新出现SafariHelper29435仍被保留归属，不声称全部新增身份消失。

证据：docs/verification/results/picker-cmdq-menu-20261101/native-observation.json、docs/verification/results/picker-cmdq-menu-20261101/native-menu-quit-plan.jpg、docs/verification/results/picker-cmdq-menu-20261101/native-menu-quit-plan.txt、docs/verification/results/picker-cmdq-menu-20261101/lifecycle-audit.json、docs/verification/results/picker-cmdq-menu-20261101/lifecycle/identity-observation.jsonl、docs/verification/results/picker-cmdq-menu-20261101/independent-binary-audit.json、docs/verification/results/picker-cmdq-menu-20261101/bundle-integration.json

限制：DirectpickerCmdQ didnot hit observed event path and is not counted aspass.；Late SafariPlatformSupport.Helper29435 remainsattributedto21917; finalresource/lifecyclechecks mustinclude it.；No newCPUbudgetclaim; A/B measured originalhelper and sameRustpayload, currenttargetedmenu change separatelyhashed.；NoactiveTTY/launcher/Pi closed in this menu case; fullQ1 remains.

### MAC-SEARCH-STOP-NATIVE-PICKER-001

macOS26.3.1 arm64 native1280x800 / native-picker-menu mainabc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917 / Independent original nativeJPEG/fullAX/action audit; editor owner performed actualGUI / pass / partial

实现：apps/desktop/src/features/editor/SearchPanel.tsx、packages/editor/src/store.ts、apps/desktop/src-tauri/src/search.rs

步骤：Run actualnative no-match query across100000paths and observe pendingStop → Discard firststaleAX click as noncancellation → Restart samequery and click actualcurrentStop once → Observecancelledterminal and unchangedquery

新包原生001零match搜索pending确有停止；首轮staleAX点击未成立且自然完成已排除。重启同query后的实际Stop点击一次，002终态“已取消，保留已有结果”，完整query未变。补齐此前组件update修复的真实新包路径。

证据：docs/verification/results/editor-native-stop-scroll-audit/audit.json、docs/verification/results/editor-native-picker-20261101/001-no-match-stop-visible.jpg、docs/verification/results/editor-native-picker-20261101/001-no-match-stop-visible.txt、docs/verification/results/editor-native-picker-20261101/002-no-match-cancelled-query-retained.jpg、docs/verification/results/editor-native-picker-20261101/002-no-match-cancelled-query-retained.txt、docs/verification/results/editor-search-cancel-resume-audit/audit.json

限制：Doesnot close allSTATE003 Pi/process/clone stopping/latecompletion conditions.；No duplicateFILE005 broadsearch run or newfullFILE005 claim.

### MAC-THREE-PROJECT-SCROLL-NATIVE-PICKER-FAIL-001

macOS26.3.1 arm64 native1280x800 / native-picker-menu mainabc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917 / Independent original nativeJPEG/fullAX/action audit; editor owner performed actualGUI / fail / partial

实现：apps/desktop/src/features/editor/CodeSurface.tsx、packages/editor/src/store.ts

步骤：Prepare C/B/A differenttabs/caret/scroll andexpandedtree; A hasdirtybuffer → Return among threeprojects viaactualnativeUI → Independently compare6originalimages andmatchingcaretAX

C可视首行58→78，B28→1，A8→14；同一原生三项目往返滚动未恢复。caret仍分别70:31、40:31、20:25，标签/正文/树展开仍在，A仍dirty。operator expected字段仅期望，未误作通过。

证据：docs/verification/results/editor-native-stop-scroll-audit/audit.json、docs/verification/results/editor-native-picker-20261101/009-C-session-tree-selection-before.jpg、docs/verification/results/editor-native-picker-20261101/018-C-session-tree-return.jpg、docs/verification/results/editor-native-picker-20261101/011-B-session-tree-selection-before.jpg、docs/verification/results/editor-native-picker-20261101/016-B-session-tree-return.jpg、docs/verification/results/editor-native-picker-20261101/013-A-session-tree-selection-before.jpg、docs/verification/results/editor-native-picker-20261101/020-A-session-tree-return.jpg、docs/verification/results/editor-native-picker-20261101/actions.jsonl

限制：Failure limited to actualWS005 scroll subcondition; no clean-closeotherproject FILE003failure inferred.；No lateprovider context or Gitbranch failure inferred.；Sourcefix alone willnot supersede nativefailure; targetednative retest required.

### MAC-FILE-TREE-NATIVE-REMAINDER-001

macOS26.3.1 arm64 native1280x800 / native-picker-menu mainabc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917; priorretainedGUI/service evidence labeledseparately / Independent24 original nativeJPEG/fullAX, actualownedfile bytes, historicalreceipt hash and narrowproductionsource audit; no newGUI/test execution / pass / full

实现：apps/desktop/src/features/editor/FileExplorer.tsx、apps/desktop/src-tauri/src/files.rs

步骤：Combinepreviousreal100k layerednavigation withrequested-directory sourceinvariant → Showhidden andrefreshvalidselectedentry → Openownroot-loop link withoutrecursiveexpansion → Denyonesubdirectory;observeerrorwithsiblingsretained;restoreoriginal0755

按层读取由现有100k原生导航+FileExplorer仅root/expanded加载+native单目录read_dir组合证明。隐藏项可显式显示，刷新保有效选中，实际自指loop不递归。子目录000权限失败保兄弟节点/编辑器且AX有Permission denied和重试；恢复0755后自动展示keep.txt。

证据：docs/verification/results/editor-native-remainder-audit/audit.json、docs/verification/results/editor-resume-e1-e2-audit/audit.json、docs/verification/results/editor-native-picker-20261101/024-tree-show-hidden.jpg、docs/verification/results/editor-native-picker-20261101/025-tree-refresh-selected-retained.jpg、docs/verification/results/editor-native-picker-20261101/026-loop-link-does-not-recurse.jpg、docs/verification/results/editor-native-picker-20261101/027-one-directory-denied-keeps-siblings.txt、docs/verification/results/editor-native-picker-20261101/028-directory-permission-auto-recovers.jpg

限制：No backend syscallcount measurement claimed.；027 childpermissionerror is in fullAX belowviewport; unrelatedordinary-file banner remains fromloopattempt.；028 recoverywasautomatic, not anactualRetryclick.

### MAC-FILE-OPERATIONS-NATIVE-REMAINDER-001

macOS26.3.1 arm64 native1280x800 / native-picker-menu mainabc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917; priorretainedGUI/service evidence labeledseparately / Independent24 original nativeJPEG/fullAX, actualownedfile bytes, historicalreceipt hash and narrowproductionsource audit; no newGUI/test execution / pass / full

实现：apps/desktop/src/features/editor/FileExplorer.tsx、apps/desktop/src-tauri/src/files.rs

步骤：Reuseactualcreate/renamecollision,tabrename,pathcopy,nativeTrashreadback → InvokeproductFinderReveal andinspectselectedownedfile → AttemptnativeTrashondirtyfile,Cancel,retainoriginaldiskandbuffer → ReviewnativeTrasherrorreturnwithoutpermanentdeletefallback

旧证据已覆盖不覆盖冲突路径、改名更新标签、复制相对路径与真实废纸篓24B回读。本轮Finder确选中visual.ts；脏文件Trash被拒绝，Cancel保完整未保存正文，操作时磁盘仍原22B/hash。native trash.delete失败只返回IO_ERROR，无永久删除回退。

证据：docs/verification/results/editor-native-remainder-audit/audit.json、docs/verification/results/editor-resume-e1-e2-audit/audit.json、docs/verification/results/native-trash-candidate7-audit/audit.json、docs/verification/results/editor-native-picker-20261101/029-finder-reveals-visual-ts.jpg、docs/verification/results/editor-native-picker-20261101/030-dirty-trash-refused-dialog-retained.jpg、docs/verification/results/editor-native-picker-20261101/031-dirty-trash-cancel-retains-text.jpg、docs/verification/results/editor-native-picker-20261101/dirty-trash-refusal-disk.json

限制：Dirtyfilewaslatersaved explicitly; latercurrentbytesare not representedas originalrefusalbytes.；Thisfile-treeReveal doesnot supersede unrelatedGitFinderfailure.

### MAC-FILE-TABS-CLEAN-CLOSE-NATIVE-REMAINDER-001

macOS26.3.1 arm64 native1280x800 / native-picker-menu mainabc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917; priorretainedGUI/service evidence labeledseparately / Independent24 original nativeJPEG/fullAX, actualownedfile bytes, historicalreceipt hash and narrowproductionsource audit; no newGUI/test execution / pass / full

实现：packages/editor/src/store.ts

步骤：Reusepreview20to20to21/editpin andexistingtabopenproof → CloseonlyAclean-01,retainAstate.txtdirty → CompareB/Cimmediatelyprecedingreturnedstatewithpostcloseoriginals → Reviewclosemutatesexplicitprojecttabsandbufferonly

干净预览复用、编辑固定与已有标签定位复用原证据。A关闭clean-01后dirty state仍在。B/C相对紧邻前态分别同首行1/78、caret40:31/70:31、同标签顺序/活动state与树展开；close源码只操作所属project。

证据：docs/verification/results/editor-native-remainder-audit/audit.json、docs/verification/results/editor-resume-e1-e2-audit/audit.json、docs/verification/results/editor-native-picker-20261101/016-B-session-tree-return.jpg、docs/verification/results/editor-native-picker-20261101/018-C-session-tree-return.jpg、docs/verification/results/editor-native-picker-20261101/021-A-close-clean-keeps-dirty-session.jpg、docs/verification/results/editor-native-picker-20261101/022-B-after-A-clean-close.jpg、docs/verification/results/editor-native-picker-20261101/023-C-after-A-clean-close.jpg

限制：Earlierfirst-roundscroll displacement28to1/58to78 remainsactiveWS005failure; thisrecorddoesnotclaimthatrestoredoriginalviewport.；Fullthree-projectselection/search/Git/chatacceptanceremainsWS005.

### MAC-QUICKOPEN-NATIVE-REMAINDER-001

macOS26.3.1 arm64 native1280x800 / native-picker-menu mainabc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917; priorretainedGUI/service evidence labeledseparately / Independent24 original nativeJPEG/fullAX, actualownedfile bytes, historicalreceipt hash and narrowproductionsource audit; no newGUI/test execution / pass / full

实现：apps/desktop/src/features/editor/SearchPanel.tsx

步骤：Reusecandidate7 >mode/querymemory/Escape-focus → Querysame-nameinBandC,currentprojectsinglematch → PhysicalDown/Up/Down andEnter withvisiblekeyboardhint → Disableeditorprojectextension;physicalEnterdisabledSavecommandretainsdialog;restoreeditor

B/C各自same-name查询仅当前项目一条；原生Up/Down+Enter选中state，Enter/Esc提示可见。编辑扩展禁用后Save命令显示不可用，实际Enter未执行且弹层未关；源码path_query传projectId，execute在disabled前置返回。与旧>模式和Escape焦点组合闭合。

证据：docs/verification/results/editor-native-remainder-audit/audit.json、docs/verification/results/editor-candidate7-final-audit/audit.json、docs/verification/results/editor-native-picker-20261101/005-quickopen-B-only-one-same-name.jpg、docs/verification/results/editor-native-picker-20261101/006-quickopen-C-only-one-same-name.jpg、docs/verification/results/editor-native-picker-20261101/007-quickopen-keyboard-next-previous.jpg、docs/verification/results/editor-native-picker-20261101/039-disabled-editor-save-command-no-run.jpg、docs/verification/results/editor-native-picker-20261101/040-editor-restored-after-disabled-command.jpg

限制：No allkeyboardaccessibilityUI004pass inferred.；Extensionwasrestoredbyoperator; thisdoesnotprove allpluginlifecyclecleanup.

### MAC-BASIC-EDIT-COPY-IME-NATIVE-REMAINDER-001

macOS26.3.1 arm64 native1280x800 / native-picker-menu mainabc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917; priorretainedGUI/service evidence labeledseparately / Independent24 original nativeJPEG/fullAX, actualownedfile bytes, historicalreceipt hash and narrowproductionsource audit; no newGUI/test execution / pass / full

实现：apps/desktop/src/features/editor/CodeSurface.tsx、packages/editor/src/store.ts

步骤：ReuseUTF8input/findreplace/unknownplaintextandsavedwholeChinesecompositionundo → PhysicalselectCopyPaste exactliteral;Undo/Redo/nativeSave → PhysicalPinyinmarkedcompositionwithafterDelay1000ms → Verifydisk34Bunchangedbeyonddelay;Spacecommit中文thenactual40Bautosave

原生Copy结果为精确第二个COPY_NATIVE_1101；Undo移除、Redo+Save恢复。真实Pinyin下划线zhong wen保持期间至少4.553237s，afterDelay1s仍保磁盘34B/hash/mtime；Space提交中文后自动保存精确40B并clean。结合旧UTF8/查找替换/未知语言/整次中文撤销证据满足正文。

证据：docs/verification/results/editor-native-remainder-audit/audit.json、docs/verification/results/editor-candidate7-ime-audit/audit.json、docs/verification/results/editor-resume-e1-e2-audit/audit.json、docs/verification/results/editor-native-picker-20261101/032-native-text-copy-paste.jpg、docs/verification/results/editor-native-picker-20261101/033-native-copy-undo.jpg、docs/verification/results/editor-native-picker-20261101/034-native-copy-redo-save.jpg、docs/verification/results/editor-native-picker-20261101/036-ime-marked-with-afterdelay.jpg、docs/verification/results/editor-native-picker-20261101/038-ime-auto-saved-clean.jpg、docs/verification/results/editor-native-picker-20261101/ime-before-composition.json、docs/verification/results/editor-native-picker-20261101/ime-during-composition.json、docs/verification/results/editor-native-picker-20261101/ime-after-commit.json

限制：Candidate7focus.ts input/composition observation remainsunattributedandpreserved; itwasnotaconfirmedproductfailure, andthiscurrentpassdoesnotclaimitscause.；No candidatefloatingwindowcapture orLSPdependency claimed.；Fullsave-race/recoveryworkflow remains separately evidenced underFILE007/008/009.

### MAC-AUTOSLEEP-WAKE-NATIVE-REMAINDER-001

macOS26.3.1 arm64 native1280x800 / native-picker-menu mainabc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917; priorretainedGUI/service evidence labeledseparately / Independent24 original nativeJPEG/fullAX, actualownedfile bytes, historicalreceipt hash and narrowproductionsource audit; no newGUI/test execution / pass / partial

实现：packages/editor/src/store.ts、apps/desktop/src/App.tsx

步骤：ReusepreviousnativeB/Cautomaticfive-minutesleep andinheritedresourcepolicyaudit → WakeProjectB throughactualnativeprojectswitch → Verifycleanexact24Bsavedbeforeautosleep

已证自动休眠的B通过原生切换唤醒后显示精确24B“Project B\nB-unsaved-1101”、clean、Ln2Col15；该文件早于自动休眠显式保存。

证据：docs/verification/results/editor-native-remainder-audit/audit.json、docs/verification/results/editor-native-picker-20261101/004-B-wake-saved-text.jpg、docs/verification/results/editor-native-picker-20261101/004-B-wake-saved-text.txt、docs/verification/results/editor-resume-e1-e2-audit/audit.json

限制：Doesnotclose listener/scanrelease,activeprocess/unpersisteddraftblockers ormanualdisablepreservation.；No newfive-minutesleepwait orsyntheticstate manipulation byverifier.

### MAC-EDITOR-SCROLL-COMPONENT-NATIVE-REMAINDER-001

macOSarm64 host; headlessChromium React/CodeMirror componentregression / CodeSurface finalSHA256 e889979ec35877fc22bf631890d17835fc0c1e5fc541c9aa2416257f2e1c460e / Independent retainedrawresults/receipts/logs/sourcehash and finalReact/CodeMirrorharness review; no rerun / pass / partial

实现：apps/desktop/src/features/editor/CodeSurface.tsx、packages/editor/tests/view-lifecycle.mjs

步骤：Retainedwarmbeforefailure700/1450/2300→0/0/4146 andafterexactrestoration → Retainedfreshsessionbefore1800→3243 andafterexact1800 withselection200..205 → Independentlymatchfourreceiptsourcehashesandfinal15phaseharness

四次实际headless运行before/after均留存；warm偏移700/1450/2300最终精确恢复，fresh session1800及selection200..205最终精确恢复，最终15阶段通过。源码修复在浏览器组件层成立。

证据：docs/verification/results/editor-scroll-restoration-20261101/independent-audit.json、docs/verification/results/editor-scroll-restoration-20261101/report.json、docs/verification/results/editor-scroll-restoration-20261101/before.json、docs/verification/results/editor-scroll-restoration-20261101/after.json、docs/verification/results/editor-scroll-restoration-20261101/cold-before.json、docs/verification/results/editor-scroll-restoration-20261101/cold-after.json、docs/verification/results/editor-scroll-restoration-20261101/view-lifecycle.mjs、docs/verification/results/editor-scroll-restoration-20261101/CodeSurface.final.tsx

限制：Currentnativebundle21917/abc31e remainsunchanged andpriorWS005scrollfailure remainsactive.；Nextnativepackage musttargetthreeprojectscroll/fullselection, realrestartrestoration andone relatedhot24 timing; no readingA/B rerunimplied.；Fourexternalheadlesstestruns are not Horizonprocess samples orfixedidlebudgetwindows.

### MAC-IME-AUTOSAVE-PAUSE-NATIVE-REMAINDER-001

macOS26.3.1 arm64 native1280x800 / native-picker-menu mainabc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917; priorretainedGUI/service evidence labeledseparately / Independent24 original nativeJPEG/fullAX, actualownedfile bytes, historicalreceipt hash and narrowproductionsource audit; no newGUI/test execution / pass / partial

实现：apps/desktop/src/features/editor/CodeSurface.tsx、packages/editor/src/store.ts

步骤：ProjectafterDelay1000ms → PhysicalPinyinmarkedcompositionwaitbeyonddelay → Verifyunchanged34B/hash/mtime → Commit中文andobserveautomatic40Bclean → Removeprojectoverridestorestoreinheritedoff

真实marked Pinyin至少4.553237s期间自动保存暂停，原34B/hash/mtime均不变；Space提交后实际40B自动保存且clean。功能汇总确认项目override移除、输入源原SCIMPinyin未改。

证据：docs/verification/results/editor-native-remainder-audit/audit.json、docs/verification/results/editor-candidate7-ime-audit/audit.json、docs/verification/results/editor-resume-e1-e2-audit/audit.json、docs/verification/results/editor-native-picker-20261101/032-native-text-copy-paste.jpg、docs/verification/results/editor-native-picker-20261101/033-native-copy-undo.jpg、docs/verification/results/editor-native-picker-20261101/034-native-copy-redo-save.jpg、docs/verification/results/editor-native-picker-20261101/036-ime-marked-with-afterdelay.jpg、docs/verification/results/editor-native-picker-20261101/038-ime-auto-saved-clean.jpg、docs/verification/results/editor-native-picker-20261101/ime-before-composition.json、docs/verification/results/editor-native-picker-20261101/ime-during-composition.json、docs/verification/results/editor-native-picker-20261101/ime-after-commit.json

限制：OnlyIME/automatic-savepause clause;globalfontandprojectindent/wrapremainappearanceGUIwork.；Earlierfocus.tsobservationpreserved;noattributionclaim.

### MAC-EDITOR-CLEAN-UNDO-RECOVERY-NATIVE-PICKER-FAIL-001

macOS26.3.1 arm64native / native-picker-menuabc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917 / IndependentfouroriginalnativeJPEG/fullAX reviewandactualfixturehashreadback; no extraGUI orrerun / fail / partial

实现：apps/desktop/src/features/editor/EditorWorkbench.tsx、packages/editor/src/store.ts

步骤：Undoonlyownvisual.tsmarkerbacktobaseline → ObservecleanfileanddisabledSave → ObserveRecoveryNoticeerrorENOENTwithReread;noCompareclick

044清理自有视觉标记Undo至clean后出现“恢复草稿暂时无法读取 No such file or directory (os error 2)”与重新读取；原正文仍在、Save禁用、当前304B与初始hash一致。只登记此原生错误观察，不推断旧Compare案例同根因。

证据：docs/verification/results/editor-native-tail-observations-audit/audit.json、docs/verification/results/editor-native-picker-20261101/044-recovery-error-after-visual-undo.jpg、docs/verification/results/editor-native-picker-20261101/044-recovery-error-after-visual-undo.txt

限制：NoCompareclickwasperformedinthiscase.；No persistence duration or rootcause inferred fromsinglecapture.；No textloss or failedsave claim.；Operatorfoundduringcleanup;no extra test sequence.

### MAC-MARKDOWN-NARROW-NATIVE-PICKER-001

macOS26.3.1 arm64native / native-picker-menuabc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b root21917 / IndependentfouroriginalnativeJPEG/fullAX reviewandactualfixturehashreadback; no extraGUI orrerun / pass / partial

实现：apps/desktop/src/features/editor/EditorWorkbench.tsx、packages/editor/src/store.ts

步骤：Actual823x800nativewindow andcollapsedsidebar → SwitchMarkdownsource/preview → Showunsavedmarkerpreview;switchbackUndo restorescleanoriginal

真实823×800窄窗已切为源码/预览页签；预览可见未保存状态，完整AX有NARROW_UNDO_1101；回源码Undo后原图clean、AX无标记、磁盘原377B/hash。

证据：docs/verification/results/editor-native-tail-observations-audit/audit.json、docs/verification/results/editor-native-picker-20261101/041-narrow-markdown-preview.jpg、docs/verification/results/editor-native-picker-20261101/042-narrow-preview-after-source-edit.jpg、docs/verification/results/editor-native-picker-20261101/043-narrow-source-undo-preserved.jpg

限制：043AXtabselectedlabel is not aligned with screenshotactiveMarkdown; useoriginalimage forvisibleactivetab andonlyAXcontent for markerabsence. No inferredlossfrommixedmomentAX.；OnlyMarkdownnarrowbehavior;AIoverlay/diff/longnames/200percentfontandplatformscalesremainseparate.

### MAC-NATIVE-PICKER-EDITOR-LIFECYCLE-30M-001

macOS26.3.1arm64native;wholeprocessgroupphysicalfootprintdecimalMB / native-picker-menuabc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3broot21917 / Singlecontinuous2secondlibproc/ps sampler withmacOSresponsibility+retainedidentity; independentrawphase/process/actualF09/originalscene/fixtureaudit;naturalstopfileexit0 / pass / partial

实现：scripts/desktop/sample_macos.py、scripts/desktop/mac_metrics.py

步骤：Continuouslyobserveeditor/project/eightlayoutworkflowthroughfinalsameactive-readingreturn → CaptureactualF09beforeworkflowandattail → FreezeallGUI/build/testsforfinal85.36sphase → Naturalstoponlyafterover30minfromconfirmedbaseline;verifyexit0andallnewpickeridentitiesgone

928样本1929.1371s，root从不缺失。7基线进程+末尾picker4临时身份全计入且4全自然消失。末尾42样本85.3636s：CPU均0.321819%、footprint均214.490541MB；实际F09监听13→13、workers0→0、实例19→8、watchers5→2、订阅2→2、live view1→1。

证据：docs/verification/results/native-picker-editor-lifecycle-30m/audit.json、docs/verification/results/native-picker-editor-lifecycle-30m/metadata.json、docs/verification/results/native-picker-editor-lifecycle-30m/samples.jsonl、docs/verification/results/native-picker-editor-lifecycle-30m/summary.json、docs/verification/results/native-picker-editor-lifecycle-30m/completion-receipt.json

限制：Overallpositivefootprinttrend and35.63MB endpointgrowth includeobservednewcache/documentstate; neitherisalonealeakfinding. Initial7samples12.48s are endpointbaseline, notstable125sbudget.；Final42samples85.36s show0.3218percentCPUmean and214.49MBfootprintmean afterreturn. Thisisstabilizationevidence;separateA/B125sreadingbudgetremainsretained.；Actualpoint-timeF09: eventListeners13to13,workers0to0,pluginInstances19to8,watchers5to2,subscriptions2to2,liveEditorView1to1;created/destroyed4/3to8/7. openDocuments2to6/pathcache0to10056explicitlyretained.；F09end timestampis04:51:09 snapshotpreparation, not04:51:39filewrite orper-rowlivecounts.；Finalpickerchild7820andthreeApplehelpersnaturallydisappeared;allsevenpre-existingresponsibleidentitiesremainwithhost. No hostquitorallownedresource-releasepassfromthisrun.；FourrootheadlesscomponentrunswereseparatelytimedandnotHorizonattribution orfixedidlephase.；Sampler2s cadencecanmissshortlivedprocesses;no syntheticPIDcounts.；CurrentnativebuildpredateslaterG02/scroll/RecoveryNotice/visualsourcechanges;relevantnewpackagechecksremainseparate.

### MAC-RECOVERY-NOTICE-UNDO-COMPONENT-001

macOShostheadlessChromiumproductionReact/EditorStorecomponent / RecoveryNotice b48f02fc3911550f7767d0bf4b69550b831cde80ec2f916643751b81abfdc39a;store snapshot38af736d / Independentretainedbefore/afterJSON,receipt/sourcehash and completeproductionReact+EditorStoreharnessread;no rerun / pass / partial

实现：apps/desktop/src/features/editor/RecoveryNotice.tsx、packages/editor/src/store.ts、packages/editor/tests/recovery-notice.mjs

步骤：Beforevirtualdirtydependency removal timesoutwaitingnewUndo-list → Currentfivephases:continuousdirtydoesnotrefetch,Undo invalidatesoldererror,cleanupreceiptrefresh,realcurrenterrorandmissingdraftremainactionable

保留before仅首阶段通过，Undo新list等待1500ms超时；after五阶段通过，真实当前列表NOT_FOUND与选中稿缺失仍显示，不以吞错掩盖044。来源hash逐项一致。

证据：docs/verification/results/editor-recovery-notice-component-20261101/independent-audit.json、docs/verification/results/editor-recovery-notice-component-20261101/receipt.json、docs/verification/results/editor-recovery-notice-component-20261101/before.json、docs/verification/results/editor-recovery-notice-component-20261101/after.json、docs/verification/results/editor-recovery-notice-component-20261101/RecoveryNotice.tsx、docs/verification/results/editor-recovery-notice-component-20261101/store.ts、docs/verification/results/editor-recovery-notice-component-20261101/recovery-notice.mjs

限制：ControlledRPCcomponenttest,notactualnativecleanuporfile-raceproof.；Virtualbefore removesonlynotice dirtydependency whileusingcurrentfixedstore,peroperatorreceipt; itisnotfulloldbundle reconstruction.；No independentnewexecution;retainedresultsandfinalharness/source audited.；Native044FILE013/STATE002failure remainsactiveuntilpackagedtargetedretest.

### MAC-FILE-RECOVERY-COMPONENT-20261101-001

macOS arm64 host; headless Chromium React/CodeMirror component regression / Source snapshots and SHA256 in editor-file-recovery-component-20261101/independent-audit.json / Independent production source, retained source SHA256 and raw React/CodeMirror result review; no tests rerun / pass / partial

实现：packages/editor/src/types.ts、packages/editor/src/store.ts、packages/editor/src/store.test.ts、packages/editor/tests/view-lifecycle.mjs、apps/desktop/src/features/editor/CodeSurface.tsx、apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/features/editor/FileRecovery.tsx、apps/desktop/src/features/editor/file-recovery.css

步骤：Review all eight current/source snapshot SHA256 pairs → Audit retained 17-phase real CodeMirror run and relocation/Undo/current-target baseline assertions → Review placeholder/retry/close/clean-ack state tests; retain owner-reported command outcomes

真实React/CodeMirror 17阶段结果保留：重定位保同buffer/正文/Undo，Undo后仍脏且不增View；warm 700/1450/2300与fresh-session 1800/selection200..205保持。store44与desktop:check原输出未归档，按操作者报告记录。

证据：docs/verification/results/editor-file-recovery-component-20261101/independent-audit.json、docs/verification/results/editor-file-recovery-component-20261101/report.json、docs/verification/results/editor-file-recovery-component-20261101/view-lifecycle.json

限制：store44 and desktop:check exit/counts are operator-reported from original tool output; raw command logs were not saved and unavailable history was not reconstructed.；Headless 17-phase JSON is retained and independently audited. Its CLI exitCode is operator-reported; transport responses are controlled fixtures.；Harness renders production CodeSurface with real React/CodeMirror but does not render FileRecovery/EditorWorkbench or invoke the native picker.；The initial broad vitest substring run selected archived source test copies and failed module resolution; corrected --dir run is reported separately.；Native G02, three-project/cold-restart scroll and 044 Undo acceptance remain pending the central new package.

### MAC-FILE-RECOVERY-NATIVE-DISPATCH-20261101-001

macOS arm64 host; native Rust dispatch/filesystem tests, not application GUI / files.rs SHA256 ea837628d3ed8bba316d80d3d895846b66285111bc1e099a45731ce7405eac97 / Independent native source/test assertions, current SHA256 and retained exact RTK stdout/completion receipt review; no test rerun / pass / partial

实现：apps/desktop/src-tauri/src/files.rs、apps/desktop/src-tauri/src/state.rs、apps/desktop/src-tauri/src/watch.rs、apps/desktop/src-tauri/src/lib.rs、apps/desktop/src-tauri/tests/file_recovery.rs

步骤：Independently review production relocation/error ownership paths and eleven current test functions → Match five final source hashes and archive source snapshots → Match retained RTK stdout to completed exit0 receipts for earlier10+33 and final7 subset checks; preserve exact source/version and timing limits

原生源码/用例确认缺路径与权限分开、删除保稿、真实watch事件、选择文件确认后单文件关联、完整恢复稿与只读候选处理；三份原样RTK输出与exit0完成回执已独立匹配：前版10+33，最终7 relocation通过/4过滤。此项不替代真实G02 UI。

证据：docs/verification/results/file-recovery-native-20261101/independent-audit.json、docs/verification/results/file-recovery-native-20261101/report.json、docs/verification/results/file-recovery-native-20261101/execution-receipts.json、docs/verification/results/file-recovery-native-20261101/file-recovery-10.rtk.stdout.txt、docs/verification/results/file-recovery-native-20261101/file-recovery-10.completion.json、docs/verification/results/file-recovery-native-20261101/files-workflow-33.rtk.stdout.txt、docs/verification/results/file-recovery-native-20261101/files-workflow-33.completion.json、docs/verification/results/file-recovery-native-20261101/relocation-7.rtk.stdout.txt、docs/verification/results/file-recovery-native-20261101/relocation-7.completion.json

限制：10 file_recovery and 33 files_workflow passes refer to earlier source hashes in report.previousSourceHashes; final correction has seven relocation passes and four filtered tests, not eleven newly executed passes.；Exact RTK stdout and completed tool results are retained and independently matched. Unfiltered Cargo logs and absolute start/completion timestamps were not retained; no timings are inferred from poll wall_time_seconds.；No native application build/restart/picker/UI acceptance is claimed by these dispatch/filesystem tests.

### MAC-NATIVE-PICKER-EDITOR-LIFECYCLE-NORMAL-QUIT-001

macOS arm64 native release / Previous release abc31e6b2d2ac4e1b28a9fd229070b84d091014ead51bfb9f083cdb7a24fbb3b, root PID21917 / Independent full ps PID/start identity check after root reported actual CmdQ, close plan, and native App quit; no kill or sampler / pass / partial

实现：apps/desktop/src-tauri/src/lib.rs

步骤：View original no-unsaved-document Quit plan image and AX → After operator-reported normal Process and Quit, inspect full process table using all seven known PID/start identities

05:04:48Z完整ps核验：21917/21919/21920/21921/21922/21923/29435七个原基线身份全部消失，无PID复用。与此前4个新增picker身份消失一起闭合本轮已知进程退出。

证据：docs/verification/results/native-picker-editor-lifecycle-30m/post-normal-quit.json、docs/verification/results/native-picker-editor-lifecycle-30m/post-normal-quit-processes.txt、docs/verification/results/editor-recovery-release-20261101/old-quit-plan.txt、docs/verification/results/editor-recovery-release-20261101/old-quit-plan.jpg

限制：This checks the seven known baseline identities from the completed 30-minute run, not later active Pi/terminal/launch shutdown conditions.；Prior four new picker identities had already disappeared during the retained sampler run.

### MAC-EDITOR-THREE-PROJECT-SCROLL-SELECTION-RETEST-001

macOS arm64 native release / df1e122d9d242dc364f5b36253879285a885d4f128ed95b54e19aad88b6b1733; original PID40972 and fresh PID52226 / Independent original native JPEG/AX, exact session-range/viewport snapshots, fixture/disk hashes, process identity and actual F09/action timing audit; no GUI or test rerun / pass / partial

实现：apps/desktop/src/features/editor/CodeSurface.tsx、packages/editor/src/store.ts

步骤：Review three original before/warm-return/fresh-process images plus visible selection captures and complete directional session snapshots → Independently match exact source-file range text, tab IDs/order, search drafts and expanded-entry IDs → Verify prior seven native process identities gone before same-bundle CUA relaunch at PID52226

原生QA/B/C暖往返与真实新进程恢复均保持scroll991/1491/641及可视首行40/60/26；完整选区475→499、1239→1209、2139→2179保持，包含B反向与C跨行。标签、树展开和三个不同搜索draft保持。旧七身份全退出后同包新PID52226恢复；原滚动失败被本次定向复验替代。

证据：docs/verification/results/editor-targeted-retest-audit/audit.json、docs/verification/results/editor-targeted-retest-20261101/summary.json、docs/verification/results/editor-recovery-release-20261101/independent-bundle-audit.json

限制：Warm/cold means current process versus a real fresh application process; OS caches were retained.；After project clicks the AX dump does not expose Selected text because focus is outside the editor. Native before selected text, full directional session ranges, rendered selection images and source/real-CodeMirror regression are combined; caret alone is not used as full-selection proof.；WS005的Git提交草稿、聊天和旧Agent上下文仍由对应owner补齐；本项不宣称整条需求完整。；正常退出本轮全部buffer clean，无活动Pi/TTY/启动方案；Q1/Q2另有明确余项。；001–004 were initially written by the old capture helper into the prior result directory using unique new names, then moved unchanged into this directory; both action logs retain the correction and original timestamps. These belong to df1e release, not the prior native-picker build.

### MAC-EDITOR-CLEAN-UNDO-RECOVERY-RETEST-001

macOS arm64 native release / df1e122d9d242dc364f5b36253879285a885d4f128ed95b54e19aad88b6b1733; original PID40972 and fresh PID52226 / Independent original native JPEG/AX, exact session-range/viewport snapshots, fixture/disk hashes, process identity and actual F09/action timing audit; no GUI or test rerun / pass / partial

实现：apps/desktop/src/features/editor/RecoveryNotice.tsx、packages/editor/src/store.ts、apps/desktop/src-tauri/src/files.rs

步骤：Review two native temporary-marker/checkpoint/Undo cycles and leave/return original JPEG/AX → Audit historical 1280B native checkpoint receipt, post-Undo deletion receipt and current missing checkpoint path → Independently hash current visual.ts against original 304B baseline

两轮原生checkpoint后Undo均回到clean、Save禁用且无旧ENOENT恢复条；离开再返回仍无错误。第二轮恢复稿1280B/revision3有原始读取回执，Undo后实际删除且当前再次独立确认不存在；原文件仍304B/同SHA。本次替代044特定原生失败，旧图保留。

证据：docs/verification/results/editor-targeted-retest-audit/audit.json、docs/verification/results/editor-targeted-retest-20261101/summary.json、docs/verification/results/editor-recovery-release-20261101/independent-bundle-audit.json

限制：恢复稿存在时的全文未额外复制，before元数据/hash/marker回执由操作者当时读取；独审原始回执、原生图/AX、当前删除状态及原盘SHA。；本次不包含Compare点击，不推断旧Compare案例根因。；受控异常退出恢复、2s/10s节奏、清缓存保未决稿和checkpoint失败处理仍按原验收余项。

### MAC-EDITOR-HOT24-RECOVERY-RELEASE-001

macOS arm64 native release / df1e122d9d242dc364f5b36253879285a885d4f128ed95b54e19aad88b6b1733; original PID40972 and fresh PID52226 / Independent original native JPEG/AX, exact session-range/viewport snapshots, fixture/disk hashes, process identity and actual F09/action timing audit; no GUI or test rerun / pass / partial

实现：apps/desktop/src/features/editor/CodeSurface.tsx、packages/editor/src/metrics.ts

步骤：Native Git main/0changes and five prewarmed clean184320B TypeScript files; other GUI/build/tests/sampler frozen → Match F09 IDs10–33 to all24 corresponding actual CUA issued/observed intervals → Verify10000 tracked clean files/five original SHA, native F09 export and same view4

真实窗口05:14:40.395Z–05:14:55.099Z内24次热标签操作逐项匹配F09 IDs10–33；duration/highlight median17ms、P95 26ms、max27ms，均在对应CUA动作界内。CUA上界median538ms/P95 552ms/max553ms单列；五文件均184320B/clean/rev0，单view4，仓库10000tracked且clean。

证据：docs/verification/results/editor-targeted-retest-audit/audit.json、docs/verification/results/editor-targeted-retest-20261101/summary.json、docs/verification/results/editor-recovery-release-20261101/independent-bundle-audit.json

限制：Hot24 reports handler-to-layout/next-visible-frame and highlight proxies, not pixel paint. CUA issued-to-observed upper bounds include input/automation overhead.；Exactly 24 warm clean TS samples are selected from the actual click window; prior restoration and five prewarm samples are excluded.；No sampler, build, test or unrelated GUI work ran during the hot24 freeze. No new 125-second or 30-minute measurement was performed.；20次独立进程可交互启动仍未完成；本项不声称完整NFR002或额外内存/CPU预算通过。

### MAC-FILE-RECOVERY-NATIVE-GUI-20261101-001

macOS arm64 native release / df1e122d9d242dc364f5b36253879285a885d4f128ed95b54e19aad88b6b1733; PID52226 / Independent 29 original native JPEG/AX review, exact seven-file final bytes, retained historical filesystem/action receipts and seven process identity shutdown audit; no GUI or test rerun / pass / partial

实现：apps/desktop/src/features/editor/FileRecovery.tsx、apps/desktop/src/features/editor/EditorWorkbench.tsx、packages/editor/src/store.ts、apps/desktop/src-tauri/src/files.rs

步骤：Review original001–023 native images/AX and retained timestamped setup/actions → Verify seven current files against initial/restored/saved receipts, including readonly mode0444 and exact64B full-copy bytes → Compare keep-buffer/Undo/Save and candidate-version-rejection transitions without replaying UI

8条真实原生流程通过：首次缺失独立tab、缺失/权限分别Retry、native与比较Cancel、仅关错误tab、完整50B只读候选载入、缺盘dirty64B另存副本保原34B、keep后目标45B不写且Undo仍dirty/显式Save才34B、候选后改83B拒绝应用且取消保原38B。最终七文件SHA/字节独核一致。

证据：docs/verification/results/file-recovery-native-gui-audit/audit.json、docs/verification/results/file-recovery-native-gui-20261101/functional-summary-before-fix.json、docs/verification/results/file-recovery-native-gui-20261101/metadata-corrections.json

限制：Intermediate no-write and moved-file states are operator-retained timestamped filesystem receipts. Verifier independently reads final seven files and original native images/AX; it did not continuously sample disk during each UI step.；Some AX captures label every tab selected; active tab conclusions combine rendered underline, editor container/path/content and specific stable AX states, not that label alone.；Native picker Cancel has retained selected AX excerpt plus post-cancel native image; no extra complete picker screenshot is fabricated.；Dirty discard choice is visible but not executed in this batch. Complete readonly useSelected and keepBuffer/Undo were executed.；This batch does not by itself complete crash recovery, every state requirement, or eight-layout visual acceptance.

### MAC-CHUNKED-SLEEP-WAKE-RECOVERY-NATIVE-FAIL-001

macOS arm64 native release / df1e122d9d242dc364f5b36253879285a885d4f128ed95b54e19aad88b6b1733; PID52226 / Independent 29 original native JPEG/AX review, exact seven-file final bytes, retained historical filesystem/action receipts and seven process identity shutdown audit; no GUI or test rerun / fail / partial

实现：packages/editor/src/store.ts、apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/App.tsx

步骤：Open owned101MiB file and confirm initial0..262144 visible chunk → Manually sleep project; reversibly rename owned file; wake same project → Observe blank stale chunk frame, then Next failure without Retry/Locate/Close; retain unsuccessful later tab/Quick Open navigation → Restore owned105906176B fixture at exact originalSHA before normal application quit

024–030原图/AX确认：休眠后路径缺失，唤醒仍旧分块范围/空正文；Next出现两处“读取位置已失效”和禁用“重试保存”，没有文件Retry/Locate/Close。之后tab/Quick Open尝试也未离开旧页。原101MiB夹具已原SHA复原；新包定向复验前保留失败。

证据：docs/verification/results/file-recovery-native-gui-audit/audit.json、docs/verification/results/file-recovery-native-gui-20261101/functional-summary-before-fix.json、docs/verification/results/file-recovery-native-gui-20261101/metadata-corrections.json

限制：失败归属唤醒重验磁盘与错误可恢复，不撤销FILE011正常大小边界/只读/防部分覆盖证据。；030原成功描述已纠正为未成功导航，原文/修正/原时间/原图均保留。；生命周期根因由后续源码和回归结果补证，本记录只认实际原生结果。

### MAC-FILE-RECOVERY-NORMAL-QUIT-20261101-001

macOS arm64 native release / df1e122d9d242dc364f5b36253879285a885d4f128ed95b54e19aad88b6b1733; PID52226 / Independent 29 original native JPEG/AX review, exact seven-file final bytes, retained historical filesystem/action receipts and seven process identity shutdown audit; no GUI or test rerun / pass / partial

实现：apps/desktop/src-tauri/src/lib.rs

步骤：Independently snapshot root52226 and six responsible helpers before quit → Review031normal CmdQ no-unsaved plan image/AX; after operator Process and Quit inspect fullprocess table → Match every recordedPID/start identity and rule out PID reuse

05:30:50Z七身份52226/52227/52228/52229/52230/52297/67138有完整归属；原生无dirty退出计划后，05:32:10Z独立ps七身份全消失，无PID复用。

证据：docs/verification/results/file-recovery-native-gui-audit/audit.json、docs/verification/results/file-recovery-native-gui-20261101/functional-summary-before-fix.json、docs/verification/results/file-recovery-native-gui-20261101/metadata-corrections.json

限制：未启动连续collector，不补造G02期间已退出短暂picker身份。；本轮没有活动Pi/TTY/启动方案，Q1仍保留。

### MAC-CHUNKED-WAKE-LIFECYCLE-COMPONENT-20261101-001

macOS arm64 host; controlled production service/runtime/store and headless React component regressions / Store075bc050fcd5d4875f8d3ea337f7a10210db0638bbfba37f7b8e854bacfceaa1; pluginservice4a79ff7a81e070441798ffa5192ecb905d1391724df5ebd14f05ea2586d93612; Workbench695ac932d3706f1e4cbab35db065e8f29e39aa08e51cd84bfa60b2e87aa51e1c / Independent production source/archived SHA, exact retained command/time/output, raw deterministic probe and component before/after result audit; no tests rerun / pass / partial

实现：packages/editor/src/store.ts、packages/editor/src/store.test.ts、apps/desktop/src/features/plugins/service.ts、apps/desktop/src/features/plugins/service.test.ts、apps/desktop/src/features/editor/EditorWorkbench.tsx、packages/editor/tests/chunked-wake.mjs

步骤：Audit store3actualfailing assertions then corrected scoped48/48 with retained intermediate archive-runner errors → Audit exact original late-dispose probe and production service3fail→3pass, current/snapshot source and final build tsc → Audit real Workbench/LargeFile virtual-before guard removal failure and current automatic first-chunk success without Next click

三层定向源码回归已独审：sleep清cursor/range/loading、晚chunk响应丢弃/错误可Retry；fresh插件快照等待旧dispose，保stale-ticket拒绝且新activation仅一次、暂停不复活；evicted时卸载LargeFile，fresh同fileId自动首块reader2/0–262144，无Next点击。Store48pass、service3pass、真实Workbench2phasepass。

证据：docs/verification/results/editor-chunked-lifecycle-component-20261101/independent-audit.json、docs/verification/results/plugins-wake-order-20261101/independent-audit.json、docs/verification/results/plugins-wake-order-20261101/probe-before-receipt.json、docs/verification/results/editor-chunked-mount-component-20261101/independent-audit.json、docs/verification/results/file-recovery-wake-release-20261101/independent-bundle-audit.json

限制：本项不替代df1e sleep/wake恢复或d709正常路径首块0–0的原生失败；是否由后续新包替代以单独原生记录为准。；BridgeRPC和部分外层provider为受控夹具；没有原生GUI/CPU/内存预算声明。；Store早期命令误扫4份归档源码导致额外模块错误，最终限定--dir为单实际文件48/48。；原probe绝对执行时间null，原始stdout/exit0从操作者当前工具结果恢复；归档时间不冒充执行时间。；Workbench before只在内存去掉evicted guard，未声称复现完整d709历史包；最终源当前SHA与快照匹配。

### MAC-CHUNKED-WAKE-MISSING-AND-QUIT-RETEST-001

macOS arm64native release / d70952fe156c6f2027ab0eb184846db3ced7ef634548a83d3ad19155f9464645;PID8305 / Independent13originalfunctionalnativeJPEG/AX, two unchanged ownedfilebytes, retainedmetadata corrections and complete sevenknownidentity normalquit audit; noGUI/test/sampler rerun / pass / partial

实现：packages/editor/src/store.ts、apps/desktop/src/features/plugins/service.ts、apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/components/SleepingProjectPage.tsx

步骤：Review native001–009newprocesschunkready→manualG03sleep→ownedmissingpath→ResumeFileRecovery → Verify exact38BQuickOpen and existingtab navigation then pathrestore Retryfirst0..262144 andNext262144..524288 → Independentlyhash restored105906176Bfixture and compare original015normalquit/no-dirty plan to sevenPID/start snapshots

d709新包实际补齐旧失败范围：缺失101MiB唤醒显示独立Retry/Locate/Close页，无旧chunkframe；QuickOpen读原38B，tab往返恢复；原盘同SHA恢复后Retry首块0–262144、Next至262144–524288均有真实正文。G03保11标签元数据；无dirty正常退出后7已知身份全消失。仅替代df1e缺路径/late-dispose/导航原失败，保留新normalpath自动首块失败。

证据：docs/verification/results/file-recovery-wake-native-audit/audit.json、docs/verification/results/file-recovery-wake-native-audit/incremental-001-013.json、docs/verification/results/file-recovery-wake-native-audit/incremental-014-015.json、docs/verification/results/file-recovery-wake-release-20261101/independent-bundle-audit.json

限制：正常存在路径首块未自动读取另列active失败，不能据此称整条RUN003通过。；G03偏好误跳Appearance仍待新包；页面资源释放声明尚需真实运行资源计数证明。；7身份清退是两次完整ps快照；没有连续collector，本轮无活动Pi/TTY/launch。；ChunkAX正文是可见片段，不是完整256KiB转储；完整磁盘105906176B另有独立SHA。

### MAC-CHUNKED-VALID-WAKE-FIRST-READ-FAIL-001

macOS arm64native release / d70952fe156c6f2027ab0eb184846db3ced7ef634548a83d3ad19155f9464645;PID8305 / Independent13originalfunctionalnativeJPEG/AX, two unchanged ownedfilebytes, retainedmetadata corrections and complete sevenknownidentity normalquit audit; noGUI/test/sampler rerun / fail / partial

实现：apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/App.tsx

步骤：After actualreaderat262144..524288, manuallysleepandResume with unchangedvaliddiskpath → Inspect011and012originals57.375sapart:range0..0/blank; explicitlyclickNext at013andgetfirst0..262144 → Retain010SleepPreferencesactualAppearance and originalcorrectedoperatorwording

正常存在路径Resume后011/012均0–0空正文，两次观察相隔57.375秒；013显式Next才出现首块。010休眠偏好实际打开Appearance，原预期成功描述已保原纠正。组件mountguard与route源码修复已准备，真实下一包前保持失败。

证据：docs/verification/results/file-recovery-wake-native-audit/audit.json、docs/verification/results/file-recovery-wake-native-audit/incremental-001-013.json、docs/verification/results/file-recovery-wake-native-audit/incremental-014-015.json、docs/verification/results/file-recovery-wake-release-20261101/independent-bundle-audit.json

限制：观察间隔不等于连续采样；未声称57.375秒每一帧均观察。；缺路径错误恢复与tab/QuickOpen在同包已经实际通过，范围分开记录。；14dialog高度和3布局整tab可见性属另行视觉目标，不扩充本需求failuremapping。

### MAC-CHUNKED-VALID-WAKE-AND-QUIT-RETEST-001

macOS arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87; retest PID30261; samebundle Welcome PID40426 / Independent viewing of all11 original native JPEGs across two verification windows, complete AX/assertion review, original capture/action/hash correction audit, unchanged owned-file bytes and retained six-identity quit/relaunch snapshots; no GUI/test/sampler replay / pass / partial

实现：apps/desktop/src/features/editor/EditorWorkbench.tsx、apps/desktop/src/App.tsx、apps/desktop/src/components/SleepingProjectPage.tsx、apps/desktop/src-tauri/src/lib.rs

步骤：Review coldfirstchunk, actualSleepPreferences ProjectandResources and Resume-only firstchunk original001–003 with exact actiontimes → Confirm explicitNext004 advances262144..524288 with fixturetext; hash unchanged105906176Bdiskfile → Review006asleep12tabs→007no-dirty Quit→independent sixidentity shutdown→008samebundle freshprocess Welcome → Independentlycheck all14 movedfile hashes/originaltimes and31 prior d709 artifacts, preserving disclosure of lost intermediatevisuals

342256真实新包：正常存在路径Resume自动首块0–262144有正文，无需Next；再Next到262144–524288。休眠偏好实际到项目与资源且5分钟/已休眠可见。清稿正常退出后6已知PID/start全消失，同包40426重开Welcome。仅替代d709正常唤醒首块/路由失败，整条RUN003仍有资源阻止/释放/暂停组合待验。

证据：docs/verification/results/file-recovery-final-target-native-audit/audit.json、docs/verification/results/file-recovery-final-target-native-20261101/actions.jsonl、docs/verification/results/file-recovery-final-target-native-20261101/capture-location-correction.json、docs/verification/results/file-recovery-final-target-release-20261101/independent-bundle-audit.json、docs/verification/results/editor-chunked-mount-component-20261101/independent-audit.json

限制：No whole RUN003 pass: active-resource/draft blockers, resource release and paused/disabled-policy combinations remain separately tracked.；NoNext-before003 is operator action chronology corroborated by original003 content and the prior production component regression; there is no continuousvideo or per-click eventstream.；AX chunk text is a visible excerpt, not a full256KiB content dump. Entire105906176Bdiskfixture was independentlyhashed.；Current three owned-file reads confirm unchanged finaldiskstate; no continuousdisk monitoring was performed.；Six prequit identities and six relaunched identities are fullps snapshots, not a collector covering all transientpicker helpers.；008Welcome is functionalhandoff evidence; formal eight-layout A01visual review belongs to appearanceowner.；The three overwritten intermediate d709 visualimages have no retained original/hash and remain observation-only. Earlierdf1e originals and all13d709 functional originals remain intact.

### MAC-CLONE-PARENT-PICKER-DISABLED-NATIVE-FAIL-001

macOS26.3.1arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87;PID40426 / Independentview of three original880x448 nativepicker JPEGs plus postcancel1280x800 form JPEG; complete AXselected/OpenDisabled assertions, exact retained capturehash bindings and currentreadonly directorypermission/absence checks. No GUI/test/source edit. / fail / partial

实现：apps/desktop/src/features/git/CloneForm.tsx、apps/desktop/src-tauri/src/picker.rs、apps/picker-service/Picker.swift

步骤：Inspect actualMist cloneparentpicker with appearanceparent selected butOpen disabled → Inspect secondMist attempt selecting ownedGit clone-targets andPaper empty-form attempt selecting appearanceparent, bothOpen disabled → Confirm cancelpreservesURL/newname buttargetunselected; compareA04samepathsuccessfulreturn and currentdirectorypermissions without replaying GUI

342256原生A05三次不能完成父目录选择：Mist两次分别选appearance父目录与Git clone-targets，Paper空表单一次选appearance父目录；均蓝选中/AXselected且folderURL尾/，Open仍disabled。取消保URL与appearance-clone-form-only，父目录仍尚未选择，未执行clone。两目录现时R/W/X正常、拟建目标不存在；A04两次同路径成功返回表单。

证据：docs/verification/results/clone-parent-picker-native-failure-audit-20261101/audit.json、docs/verification/results/clone-parent-picker-native-failure-audit-20261101/capture-metadata.json、docs/verification/results/appearance-full-native-20261101/A05-mist-picker-disabled.jpg、docs/verification/results/appearance-full-native-20261101/A05-mist-picker-disabled.ax.txt、docs/verification/results/appearance-full-native-20261101/A05-mist-picker-retry-disabled.jpg、docs/verification/results/appearance-full-native-20261101/A05-mist-picker-retry-disabled.ax.txt、docs/verification/results/appearance-full-native-20261101/A05-paper-picker-empty-form-disabled.jpg、docs/verification/results/appearance-full-native-20261101/A05-paper-picker-empty-form-disabled.ax.txt

限制：Per-root and operatorreports identify cloneentry and thirdattempt emptyform; threepickerimages alone do not show the underlyingappform.；No continuousvideo, exact disabled duration or low-level nativepicker configuration trace is retained; rootcause is not assigned.；DirectoryR/W/X and proposedtargetabsence are currentindependentreads, not continuoussampling during thefailed clicks.；Originalpickerimages are880x448 nativepanel captures, not resized1280x800 appvisualcases; no A05formalvisual acceptance follows.；A04success only proves its nativepicker returned thispath into the form. AddAndOpen was not committed by this appearancebatch.；No new test of everypicker mode, theme or CPUbudget is requested.

### MAC-EDITOR-CHECKPOINT-CADENCE-AND-RELEASE-COMPONENT-001

macOS host; controlled productionEditorStore component test / packages/editor/src/store.ts SHA256 075bc050fcd5d4875f8d3ea337f7a10210db0638bbfba37f7b8e854bacfceaa1; packages/editor/src/store.test.ts SHA256 62c3b2015af91d3632dedcd9d8df922b25947215352bf1af79b2b74dfac07df9 / Narrow remapping of the existing final48/48 retained productionEditorStore Vitest result. Independently read both assertions, production timer/checkpoint/flush/dispose paths, and matched current/archived source and raw execution receipt hashes. No test rerun. / pass / partial

实现：packages/editor/src/store.ts、packages/editor/src/store.test.ts

步骤：Read exact retained two passed assertions within existing48/48 result → Match current source with archived tested source SHA and finalrun exit0/raw JSON/stdout/stderr → Read 2000ms idle/10000ms max scheduler and checkpoint failure rejection/retained-buffer assertions

既有48/48中两条精确断言均passed：1999ms未checkpoint、再1ms完成首稿；连续11次950ms编辑后已至少第二次checkpoint，生产源码max timer为10000ms且不随编辑重置；checkpoint报磁盘已满时dispose拒绝，only copy正文和错误保留。补足FILE013节奏/失败不放行的组件组合证据。

证据：docs/verification/results/editor-checkpoint-cadence-audit-20261101/audit.json、docs/verification/results/editor-chunked-lifecycle-component-20261101/after-run.json、docs/verification/results/editor-chunked-lifecycle-component-20261101/after.json、docs/verification/results/editor-chunked-lifecycle-component-20261101/independent-audit.json

限制：Timers and transport are controlled component fixtures, not a new wall-clock native measurement.；The continuous-edit test checks accumulated calls after10450ms; exact10000ms scheduling is established by production source, not a claimed separate deadline-bound assertion.；Does not prove actual abnormal-process exit/restart recovery or cache cleaning preserves unresolved drafts. Those native Q2/D1 actions remain pending.；This is an additional requirement mapping of the same48-test run, not48 newly executed tests.

### MAC-APPEARANCE-LAYOUT-50-NATIVE-001

macOS26.3.1arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87;PID40426 / Independently viewed14 original nativeJPEGs, matched28 image/AX hashes and14 capturebindings; independently checked exact50 sequence, actualdiagnostic JSON, selected AX/action chain and archived production cache/recovery source. No GUI/test/build rerun. / pass / partial

实现：apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src-tauri/src/settings.rs

步骤：Match50 successful layoutapplications against exact6x8+2 sequence → Compare retained originalselection,dirty marker,singleUndo,Gitdraft andsamePTY51343 → Compare actualbefore/after exportedfrontend editor/runtimecounters

恰好50次布局切换后同一EditorView1/openSamples1/created1/destroyed0；原选区精确相同，17次Tab仅取回焦点，随后一次Undo移除原marker；PTY51343保留，后态Git草稿匹配操作者预置条件文本。runtime监听/observer计数相同，pluginInstances5→6为初次搜索功能加入，明确保留差异。

证据：docs/verification/results/appearance-functional-native-audit-20261101/core-audit.json、docs/verification/results/appearance-full-native-20261101/functional-summary.json

限制：Before/after diagnostics are point snapshots; no memory/30minute/no-growth claim.；Search was first enabled during initial layout cycle;pluginInstances5to6 is explicitly not equal.；Baseline/after selection and oneUndo prove original state/history retention, not IME deferred apply or all scroll positions.；Git draft after50 is directly visible; initial value is retained operator capturecondition, not a separate before Gitimage/action in this archive.

### MAC-CACHE-CLEAR-PRESERVES-UNRESOLVED-DRAFT-NATIVE-001

macOS26.3.1arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87;PID40426 / Independently viewed14 original nativeJPEGs, matched28 image/AX hashes and14 capturebindings; independently checked exact50 sequence, actualdiagnostic JSON, selected AX/action chain and archived production cache/recovery source. No GUI/test/build rerun. / pass / partial

实现：apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src-tauri/src/settings.rs

步骤：Create actual1project/5path QuickOpencache andprepare1itemclear → Confirmclear1 and comparecounters to0 → Compare same refreshedrecoveryid/time/size and dirtybuffer; verify productioncache scope and recoverylist refresh

真实路径缓存1项目/5路径→0，预览1项且实际清理1项；恢复稿49796e2f-8639-446a-a5b6-2b4573c0a5e4及14:36:31/0.6KiB前后保留，编辑器仍有未保存marker。生产缓存清理仅path_search_cache和data_dir/cache，恢复稿单列显式选择；成功后recovery_list刷新，非旧UI残影。

证据：docs/verification/results/appearance-functional-native-audit-20261101/core-audit.json、docs/verification/results/appearance-full-native-20261101/functional-summary.json

限制：Closes only FILE013 cache-preserves-unresolved-draft clause; actual abnormalexit/restart and diskcomparison remain Q2.；Initial emptycache and fulltextsearch4items/2tasks are not counted as the nonempty pathcache test.；Beforeclear1itemplan is below initial image viewport and verified by AX/action; actualafterclear1 result is visible.；No direct checkpointbody/mtime read; later re-marked checkpoint is not asserted to be originalbaseline timestamp.

### MAC-TERMINAL-EXPLICIT-STOP-AFTER-LAYOUT-50-NATIVE-001

macOS26.3.1arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87;PID40426 / Independently viewed14 original nativeJPEGs, matched28 image/AX hashes and14 capturebindings; independently checked exact50 sequence, actualdiagnostic JSON, selected AX/action chain and archived production cache/recovery source. No GUI/test/build rerun. / pass / partial

实现：apps/desktop/src/features/processes/index.tsx、apps/desktop/src-tauri/src/processes.rs

步骤：InspectsamePTYbefore/after50 → Read actualexplicitstop action andps-p51343exit1 → Inspectclosednativehistory

原PTY51343显式结束后ps查询exit1且stdout空；原生显示已退出(1)，历史仍在。自有声明式QA布局卸载25→24；runtime插件计数仍6。

证据：docs/verification/results/appearance-functional-native-audit-20261101/core-audit.json、docs/verification/results/appearance-full-native-20261101/functional-summary.json

限制：No allownedprocess cleanup or final30minute memoryclaim.；Native reopeningclosedterminal still raisesNoPTY; separatefailure remains.

### MAC-TERMINAL-CLOSED-REOPEN-NOPTY-NATIVE-FAIL-001

macOS26.3.1arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87;PID40426 / Independently viewed14 original nativeJPEGs, matched28 image/AX hashes and14 capturebindings; independently checked exact50 sequence, actualdiagnostic JSON, selected AX/action chain and archived production cache/recovery source. No GUI/test/build rerun. / fail / partial

实现：apps/desktop/src/features/processes/index.tsx、apps/desktop/src-tauri/src/processes.rs

步骤：ExplicitlyendPTY51343 → Hidepanel thenreopenexistingclosedhistory → ObserveinlineandtoastNoPTYwhileheaderalreadyclosed

342256原生终端已退出且OS无51343；隐藏后重开历史同时出现行内及toast“此进程没有 PTY”。重开只读历史仍触发无效PTY调用。

证据：docs/verification/results/appearance-functional-native-audit-20261101/core-audit.json、docs/verification/results/appearance-full-native-20261101/functional-summary.json

限制：Actualcallorigin not proven solelybyimage; sourcepreparedfix and controlledcomponent5pass do not supersede nativefailure.；Originalterminal-stopped-confirmedimage/AXandaction retained; latercentralbuild requiresoneclosedhistoryreopen retest.

### MAC-APPEARANCE-COLOR-MODES-NATIVE-001

macOS26.3.1arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87;PID40426 / Independent original nativeJPEG/AX/action/source/byte audit;53 original images viewed once,106 hashes and53 capturebindings checked. Existing named evidence reused explicitly; no GUI or product test rerun. / pass / full

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/appearance.rs

步骤：Reviewmixedlayout/theme50sequence → Inspect5nativecolor originals andall11AXfields → Check archivedinvalidinput/modekey/reset/contrast production source

真实布局/主题混搭应用；11语义令牌可编辑，非法#GGGGGG保留旧有效色；浅#445566、深#bbccdd分开，改深色不改变当前浅色模式，返回浅色仍原值。单项恢复#b2cdf8；对比提示13.8/11.5与正文/表面计算路径一致。

证据：docs/verification/results/appearance-functional-native-audit-20261101/additional-audit.json、docs/verification/results/appearance-functional-native-audit-20261101/owner-summary-final.json

限制：Native macOS behavior only; no claim that JPEG can provide exact pixelcolor deltas.；Does not close wholeUI002 semantics acrossGit/Agent or visualfidelity.

### MAC-APPEARANCE-GLOBAL-FONTS-PROJECT-BEHAVIOR-NATIVE-001

macOS26.3.1arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87;PID40426 / Independent original nativeJPEG/AX/action/source/byte audit;53 original images viewed once,106 hashes and53 capturebindings checked. Existing named evidence reused explicitly; no GUI or product test rerun. / pass / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/appearance.rs

步骤：InspectactualAuroraoverride4 → InspectProjectBglobalfonts16/UI15/compact/260andindent2 → ReturnAuroraandUseGlobalto2

Aurora项目缩进覆盖4、ProjectB继承2同时存在，来源及使用全局设置可见，Aurora重置回2。UI15/紧凑、系统等宽16、Mist260在两项目共用。

证据：docs/verification/results/appearance-functional-native-audit-20261101/additional-audit.json、docs/verification/results/appearance-functional-native-audit-20261101/owner-summary-final.json

限制：Exactrequirement globalindent2to4 whileAoverride8 thenresetA4 remains untested; this4vs2sequence doesnot substitute.；Projectwrap override and everyautosave/IMEcondition are not claimed here.

### MAC-APPEARANCE-PRESET-GLOBAL-COMPOSITE-NATIVE-001

macOS26.3.1arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87;PID40426 / Independent original nativeJPEG/AX/action/source/byte audit;53 original images viewed once,106 hashes and53 capturebindings checked. Existing named evidence reused explicitly; no GUI or product test rerun. / pass / full

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/appearance.rs

步骤：Inspect7preset originals andownedmissingJSON → CombinecurrentA/Bglobalappearanceandkeyedgeometry/color nativechanges → Reusepreviousindependentlyauditedactualpresetexport/import andcurrent6244Bglobalexport → Readglobal/keyedproductionstorageandapplydependencies

本轮真实方案保存/应用把Paper恢复Mist，UI17/代码18仍保留；删除方案不改变当前效果。缺qa.layout.missing.20261101的真实JSON可导入并显示缺包提示，应用拒绝且当前Mist保留。配合本轮两项目全局共用、Mist271→Paper→Mist271、浅深色独立及此前独立核验946B真实导出/导入，按layoutId/themeId保存与全局范围各子句闭合。

证据：docs/verification/results/appearance-functional-native-audit-20261101/additional-audit.json、docs/verification/results/appearance-functional-native-audit-20261101/owner-summary-final.json

限制：Compositebasis includes prior native export/import MAC-NATIVE-PICKER-PRODUCT-LIFECYCLE-001 and MAC-SETTINGS-GLOBAL-SCOPE-AND-PROJECT-SELECTOR-001, not a fresh duplicate export run.；Noapprestart or backgrounddecodedmemory claim; those belongUI007/UI008.；Currentnative source snapshot is corroboration, not claimedbyte-for-byte oldbuildsource manifest.

### MAC-APPEARANCE-BACKGROUND-REGIONS-NATIVE-20261101-001

macOS26.3.1arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87;PID40426 / Independent original nativeJPEG/AX/action/source/byte audit;53 original images viewed once,106 hashes and53 capturebindings checked. Existing named evidence reused explicitly; no GUI or product test rerun. / pass / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/appearance.rs

步骤：Inspect5originalregion/settingsframes → Checkretainedassetid matchesprevious320x180asset → Observeclosedbackground andretainedpresetassetmetadata

已复制背景资产在编辑区contain40/40、侧栏cover30/65/x25/y75、整个工作台均可见，设置关闭重开保留；最终关闭背景。既有源移动与资产字节一致已在早期原生记录验证。

证据：docs/verification/results/appearance-functional-native-audit-20261101/additional-audit.json、docs/verification/results/appearance-functional-native-audit-20261101/owner-summary-final.json

限制：This batch reuses existing asset; no fresh imageimport claimed.；Decoded image memory release remains unverified; visualhide orBlobURLdereference alone does not establish it.

### MAC-SETTINGS-SHORTCUTS-NATIVE-MACOS-001

macOS26.3.1arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87;PID40426 / Independent original nativeJPEG/AX/action/source/byte audit;53 original images viewed once,106 hashes and53 capturebindings checked. Existing named evidence reused explicitly; no GUI or product test rerun. / pass / full

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/appearance.rs

步骤：Inspect6originalshortcut/focusframes → Matchretainedrecord/cancel/replaceactions andnativeoperatorreport forunwrappedkeypresses → Verifyfinalexportshortcuts{} andsharedmouse/keyboardsource

真实按操作搜索快速打开、录CmdS显示保存冲突，取消/替换均执行；替换后CmdS打开QuickOpen。分别单项恢复后CmdP生效，最终导出shortcuts={}。macOS显示⌘；鼠标快速打开与keyboard configured dispatch同到openQuickFiles。

证据：docs/verification/results/appearance-functional-native-audit-20261101/additional-audit.json、docs/verification/results/appearance-functional-native-audit-20261101/owner-summary-final.json

限制：Full coverage is scoped to requested macOS acceptance; native WindowsCtrl behavior remains separate untestedplatform item.；Actions.jsonl omits someunwrappedkeypresses; do not label it acompleteinputstream.；NativeQuickOpenEsc focus returns originaleditor, but this doesnot closeallkeyboard/modalUI004 cases.

### MAC-APPEARANCE-REAL-IME-BASIC-NATIVE-001

macOS26.3.1arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87;PID40426 / Independent original nativeJPEG/AX/action/source/byte audit;53 original images viewed once,106 hashes and53 capturebindings checked. Existing named evidence reused explicitly; no GUI or product test rerun. / pass / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/appearance.rs

步骤：Inspectnativecomposingandcommittedoriginals → Readoperatorinputsource andactualkeypressreport

真实简体拼音逐键n/i/h/a/o显示下划线ni hao，Space提交你好；原始两图保留。并非粘贴中文或注入composition。

证据：docs/verification/results/appearance-functional-native-audit-20261101/additional-audit.json、docs/verification/results/appearance-functional-native-audit-20261101/owner-summary-final.json

限制：No layoutrequest during composition: deferredapplyuntilcompositionend remains open.；Originalinputsource not separatelyrecorded; finalABC is confirmed, restorationoforiginal not claimed.；No IMEautosavecondition inferred from QuickOpeninput.

### MAC-APPEARANCE-GEOMETRY-INPUT-PERSIST-NATIVE-001

macOS26.3.1arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87;PID40426 / Independent original nativeJPEG/AX/action/source/byte audit;53 original images viewed once,106 hashes and53 capturebindings checked. Existing named evidence reused explicitly; no GUI or product test rerun. / pass / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/appearance.rs

步骤：Inspect7nativegeometryframes andcorrectedAXvalues → Checklayoutswitchandwindowreturngeometry → Matchkeyrightmetadata correction261

可见divider拖到260，键盘Right260→261、ShiftRight261→271。Mist首选271经Paper→Mist仍271；随后显式240，窄窗760→1280回240。

证据：docs/verification/results/appearance-functional-native-audit-20261101/additional-audit.json、docs/verification/results/appearance-functional-native-audit-20261101/owner-summary-final.json

限制：Restartpersistence,alllayoutfields/rangeboundaries and pointercancel are separate remainingconditions.；Escanddoubleclickfailures remain separatelyregistered; initialAXclick160 not independentlyattributed.

### MAC-APPEARANCE-GEOMETRY-ESC-AX-NATIVE-FAIL-001

macOS26.3.1arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87;PID40426 / Independent original nativeJPEG/AX/action/source/byte audit;53 original images viewed once,106 hashes and53 capturebindings checked. Existing named evidence reused explicitly; no GUI or product test rerun. / fail / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/appearance.rs

步骤：ReadpriornativeRight/ShiftRight271 → InspectEscoriginalvisible160 andsamecaptureAX271

原生Esc后可见侧栏回160，AX splitter仍271；同一次状态的视觉与可访问值分离。

证据：docs/verification/results/appearance-functional-native-audit-20261101/additional-audit.json、docs/verification/results/appearance-functional-native-audit-20261101/owner-summary-final.json

限制：Old342256nativefailure; repairedsource/controlledcomponent evidence doesnot supersede withoutnewnativecheck.；Initial160 setup mayincludeAXclickpositionbehavior; no separate initialclickdefect claimed.

### MAC-APPEARANCE-GEOMETRY-DOUBLECLICK-NATIVE-FAIL-001

macOS26.3.1arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87;PID40426 / Independent original nativeJPEG/AX/action/source/byte audit;53 original images viewed once,106 hashes and53 capturebindings checked. Existing named evidence reused explicitly; no GUI or product test rerun. / fail / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/appearance.rs

步骤：InspectnativeDoubleClickdefaultframe andexactSTALE_VERSIONtext → CompareAX240 againstvisible160 andownerfollowingSettingsvalue

原生双击恢复默认出现“外观已更新，请刷新后重试”；图中侧栏仍160，AX240，随后设置实值仍160。显式240并重排后才一致。

证据：docs/verification/results/appearance-functional-native-audit-20261101/additional-audit.json、docs/verification/results/appearance-functional-native-audit-20261101/owner-summary-final.json

限制：Duplicatewrites/stalerevisioncause requires source/component evidence; originalframe alone establishesvisiblefailure.；Old342256retained untilnativeclosedloopretarget onnewbuild.

### MAC-SETTINGS-EXPORT-FROZEN-PREVIEW-NATIVE-001

macOS26.3.1arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87;PID40426 / Independent original nativeJPEG/AX/action/source/byte audit;53 original images viewed once,106 hashes and53 capturebindings checked. Existing named evidence reused explicitly; no GUI or product test rerun. / pass / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/appearance.rs

步骤：ParseJSONdirectlyfromoriginalAXafterpreviewreopen → Compareactualfilebytes/SHA/JSON/exportedAt → InspectCancel/Confirmactions and3originalframes

实际配置预览→取消→新预览→目录选择→horizon-settings.json。6244字节、SHA7c91ae41…；从原AX直接解析JSON与保存文件逐字段相同，exportedAt均06:53:54.739126。导出仅设置/外观元数据，未含已知绝对路径、编辑正文或脏稿标记。

证据：docs/verification/results/appearance-functional-native-audit-20261101/additional-audit.json、docs/verification/results/appearance-functional-native-audit-20261101/owner-summary-final.json

限制：Data smaller thanpaginationthreshold; largeJSONpagination remainsuntested.；Selectivechat/draft/credentials cleanup remains separate.；Actualownedexportscan plus priorprivacytests, not proofthat allpossibleprivateinputs wereexhausted.

### MAC-APPEARANCE-NARROW-SETTINGS-NATIVE-001

macOS26.3.1arm64 native release / 342256d59cf7b67cd73c3d9bc48ac1adac1b558932396836557e61fdee2edd87;PID40426 / Independent original nativeJPEG/AX/action/source/byte audit;53 original images viewed once,106 hashes and53 capturebindings checked. Existing named evidence reused explicitly; no GUI or product test rerun. / pass / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/appearance.rs

步骤：Independentlyview13original760x800frames → Check13hash/dimensions/capturebindings and11append-onlywindowcorrections → InspectF08/F09lower andfixedclose/Done controls

760×800真实侧栏覆盖层可见；四外观页签及编辑/资源/AI/Git/快捷键/隐私上段均显示，关闭与完成始终可见。F08/F09实际滚到下段仍能到达操作。11份旧1280元数据已逐图纠正，原图不改。

证据：docs/verification/results/appearance-functional-native-audit-20261101/additional-audit.json、docs/verification/results/appearance-functional-native-audit-20261101/owner-summary-final.json

限制：AIframe onlydetecting; not loadedAIpagecoverage.；Otherpage lowersections, G06AIoverlay/inlineDiff andlongChinesenames remain separate.；Allthese captures100%; newTerra200% nativepagezoom audit isseparate. No extra puretext-only200% gate imposed.

### MAC-RESIZE-GEOMETRY-PRODUCTION-COMPONENT-001

HeadlessChromium controlledReactcomponent onmacOS; no nativeGUI / ResizeHandle e4cf4e79;AppearanceProvider1443e94e; owner6phase run2026-11-01T07:08:07Z / Independent fullharness/results/receipts/sourcehash audit; actualproductionReact components withcontrolledRPC; no verifier rerun. / pass / partial

实现：apps/desktop/src/components/ResizeHandle.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src/App.tsx

步骤：Check6realproductioncomponentphases andcontrolleddeferredhostfixture → VerifyCSS/renderedwidth/ARIA/authoritativevalues → Verifyserializedfreshrevisions andsingleoriginalerroridentity → Archiveallrawinputs/resultsincludingloaderfirstattemptbyteidentically

6阶段exit0/2.122s：drag Esc回260且后续pointerup零提交；普通Esc保持已提交271；真实headless双击仅提交默认一次；多move单提交；快速键盘276/277/287串行revision44/45/46；失败回权威283并保原Error，无自动重试，下一次写284成功。

证据：docs/verification/results/resize-geometry-component-20261101/independent-audit.json、docs/verification/results/resize-geometry-component-20261101/receipt.json、docs/verification/results/resize-geometry-component-20261101/result.json、docs/verification/results/resize-geometry-component-20261101/run.mjs

限制：Controlled RPC/events in headlessChromium; not macOS GUI, native disk persistence or OSprocess test.；App.tsx snapshotted but not rendered in harness: GeometryFixture mirrors saveGeometry callback; real ResizeHandle/AppearanceProvider/applyAppearance are rendered.；Original harness path relies on .work relative location; archive is byteidentical historical input and not represented as relocated runnablecommand.；NativeEsc/doubleclick failure records remain active until actualnewbuild retest.

### MAC-TERMINAL-EXIT-THEME-PRODUCTION-COMPONENT-001

HeadlessChromium controlledReactcomponent onmacOS; no nativeGUI / TerminalPanel0967e421;owner5phase run2026-11-01T07:06Z / Independent fullharness/results/receipts/sourcehash audit; actualproductionReact components withcontrolledRPC; no verifier rerun. / pass / partial

实现：apps/desktop/src/features/processes/index.tsx、apps/desktop/src/features/processes/processes.css

步骤：ReadactualReact/xterm+controlledbridgeharness → Verify5phases andrawinput/resizecallcounts → Checkretainedsamexterm/history andhidden3palettes → Checkexitedfreshmount thennewinteractive session

5阶段exit0：同一xterm在隐藏dark/light/dark后更新h-low/text且保留中文历史；running→exited不重建、只读、待发送输入不再下发；退出历史隐藏重开/重新挂载不触发旧PTY resize/input；新终端仍可输入并resize。

证据：docs/verification/results/terminal-exit-theme-component-20261101/independent-audit.json、docs/verification/results/terminal-exit-theme-component-20261101/receipt.json、docs/verification/results/terminal-exit-theme-component-20261101/after-result.json、docs/verification/results/terminal-exit-theme-component-20261101/check-terminal-closed.mjs

限制：Realxterm is subclassed only to collect instances; IPC/OSsession iscontrolled, no actualPTYpid51343 spawnedbytest.；No automatic beforecomponent run: originalnative failure/source isbeforeevidence.；Nativeclosedhistoryreopen andstylejoining geometry still need actualnewbundle; no superseding nativefailure here.

### MAC-TERMINAL-CLOSED-HISTORY-REOPEN-NATIVE-RETEST-001

macOS26.3.1arm64 native1280x800/100% / aa010d289eadc486167225d2eae8c9fb65bc9abdab7d19848cf88fc3fbbd2101;PID92803/start15:13:42 / Independent native originals/AX/actions/hash audit, combinedwith separatelyaudited realTerminalPanel/xterm5phase regression; no verifier GUI/test rerun. / pass / partial

实现：apps/desktop/src/features/processes/index.tsx、apps/desktop/src/components/ResizeHandle.tsx

步骤：Printownedterminalecho marker → Explicitlystop12504 andobserveexitedreadonly → Hideandreopenhistory → Inneredgedrag220to260,doubleclick220 andhide

新aa010原生退出终端12504隐藏后重开保留marker历史，AX只读且结束按钮禁用；无旧“此进程没有PTY”。同一退出历史实际拖高220→260与双击220均无错误。对应旧NoPTY反例已由新原生与真实组件回归闭合。

证据：docs/verification/results/terra-terminal-closed-native-audit-20261101/audit.json、docs/verification/results/terra-terminal-closed-native-20261101/gui-terminal-1793517787433-captures.jsonl、docs/verification/results/terra-terminal-closed-native-20261101/gui-terminal-1793517787433-actions.jsonl、docs/verification/results/terminal-exit-theme-component-20261101/independent-audit.json

限制：Firstouter-edge drag554to514 leaves220; correctedinsideedge556to516 actuallyproduces260. Firstmiss is retained, notclassifiedproductfailure.；typeText dropped specialcharacters; ctrlU thenverifiedpaste simpleecho used. Initialrawattempt isretained and notcountedasintendedprintfsuccess.；Poststop12504absence isparentpsobservation with noexplicitUTC andnobeforeOSstarttime; no fullPID/start or allownedprocess cleanupclaim.；Noactualnativehidden-theme roundtrip inthisbatch; controlled5phase coverssourcebehavior butvisualstylesremainseparate.；Bottomheightdoubleclick passes; earlier sidebarEsc/doubleclickfailure records notsuperseded bythisnarrowterminalregression.

### MAC-NATIVE-PAGE-ZOOM-200-REACHABILITY-PARTIAL-001

macOS26.3.1arm64 native1280x800 physicalwindow;100/125/150/175/200%pagezoom / aa010d289eadc486167225d2eae8c9fb65bc9abdab7d19848cf88fc3fbbd2101;PID92803/start15:13:42 / Independent9originalnativeJPEGviews,menuAX/actions/format/hash/sourceaudit; no verifierGUI/test rerun. / pass / partial

实现：apps/desktop/src-tauri/src/lib.rs、apps/desktop/src/styles.css

步骤：ActualViewmenuZoomIn100to200 in25pointsteps → At200openSettingsandclickDone → OpenAddProjectandscrolltoCancel,clickCancel → Reset100viaViewmenu andverifyAX

菜单缩放真实100→125→150→175→200，上限放大禁用；设置完成及添加表单滚动后取消可用；已恢复100。亲见原图保持真实重排。响应式标题38→32等使部分文字未相对基准完整2x，因此仅机制与指定动作部分通过。

证据：docs/verification/results/terra-zoom-native-audit-20261101/audit.json、docs/verification/results/terra-zoom-native-audit-20261101/styles-aa010d.css、docs/verification/results/terra-zoom-native-20261101/format-corrections.json

限制：Ordinarypagezoom200 isacceptedmechanism; no extra text-onlyzoom gate.；OnlyWelcome/Settingsvisibleupper/Addscroll interactions checked; not allworkbench/editor/AI/Git controls orlongChinesenames.；Alloriginalpngsuffix files areJPEGbytes, retainedunmodified; not calledPNG.；Settings13initial capture isnot usedasloadedcoverage; use14.；NoWindows125/150% claim.；Native快捷键super+equal/plus未使菜单百分比改变；现无根因归属，仅观察未验，不加猜测性frontendfallback。

### MAC-SETTINGS-EXACT-INDENT-AND-WRAP-INHERITANCE-NATIVE-001

macOS26.3.1arm64 native1280x800/100% / aa010d289eadc486167225d2eae8c9fb65bc9abdab7d19848cf88fc3fbbd2101;PID92803/startlocal15:13:42 / Independent 14 new original native JPEG/full AX/actions/28 hashes/source audit; prior independently audited evidence reused explicitly, without repeating old images, GUI, tests, builds or sampling. / pass / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/settings.rs、apps/desktop/src/features/editor/CodeSurface.tsx

步骤：Read global default2/off → Set Aurora indent8, global4, confirm Aurora8 → UseGlobal gives Aurora4 → Set Aurora wrapon, switch B off/indent4, return Aurora on → Reset wrapoff; restore global indent2 then remove its override; verify Aurora2/off

明确原生链闭合：全局缩进2→4时Aurora项目覆盖8保持；使用全局设置后Aurora4。折行项目覆盖on不串到ProjectB，往返仍on，使用全局设置回off。来源分别为应用默认/全局默认/项目覆盖，最终恢复Aurora2/off、无这两项项目覆盖。既有全局字体/外观共用证据保留。

证据：docs/verification/results/terra-settings-inheritance-native-audit-20261101/audit.json、docs/verification/results/terra-settings-inheritance-native-20261101/gui-settings-1793518086358-captures.jsonl、docs/verification/results/terra-settings-inheritance-native-20261101/gui-settings-1793518086358-actions.jsonl

限制：SET001 remains partial: aa010d SettingsPanel save-delay Row has source but no onReset; autoSave reset removes only editor.autoSave, so editor.autoSaveDelay has no independent UseGlobal control. This is a source-confirmed missing control, not a newly exercised native failure.；Frame03 image shows4 but its sequential AX still has the earlier2/menu; stable frame04 image and AX establish global4. No atomic-capture or product-failure inference.；No app-restart persistence claim in this batch; final settings restoration is observed before closing the dialog.

### MAC-EDITOR-PREFERENCES-COMPOSITE-NATIVE-CLOSED-001

macOS26.3.1arm64 native1280x800/100% / aa010d289eadc486167225d2eae8c9fb65bc9abdab7d19848cf88fc3fbbd2101;PID92803/startlocal15:13:42 / Independent 14 new original native JPEG/full AX/actions/28 hashes/source audit; prior independently audited evidence reused explicitly, without repeating old images, GUI, tests, builds or sampling. / pass / full

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src-tauri/src/settings.rs、apps/desktop/src/features/editor/CodeSurface.tsx

步骤：Reuse audited global-font A/B evidence → Audit new indent and wrap project isolation/reset → Reuse audited default-off/enable-keeps-dirty/delay/focus/conflict pause → Reuse marked IME disk-hash/mtime pause and exact postcommit save → Bind unchanged source preference compartments and newline-preserving save invariant

macOS SET003各子句组合闭合：字体全局共用；本轮项目缩进与折行覆盖、隔离和恢复；应用默认自动保存关闭。此前实际开启延迟保存不写既有dirty，后续编辑/离焦才写；外部冲突暂停；真实marked Pinyin超过延迟期间34B/hash/mtime不变，提交后40B自动保存且clean。既有原生LF/CRLF/末行字节与设置仅重配编辑器的源码不暗改换行证据复用。

证据：docs/verification/results/terra-settings-inheritance-native-audit-20261101/audit.json、docs/verification/results/terra-settings-inheritance-native-20261101/gui-settings-1793518086358-captures.jsonl、docs/verification/results/terra-settings-inheritance-native-20261101/gui-settings-1793518086358-actions.jsonl

限制：Full status is a composite macOS requirement conclusion; prior independently audited native evidence is reused, not represented as a fresh rerun on aa010d.；The SET001 independent save-delay reset control remains a separate explicit gap; SET003 does not require every override control to have its own reset button.；No new visual-fidelity, Windows, whole-package or app-restart conclusion.

### MAC-SIDEBAR-ORDINARY-ESC-SYNCHRONIZED-NATIVE-RETEST-001

macOS26.3.1arm64 native1280x800/100%, classic sidebar/Mist light / aa010d289eadc486167225d2eae8c9fb65bc9abdab7d19848cf88fc3fbbd2101;PID92803/startlocal15:13:42 / Independent14 original JPEG files/16 AX hashes/actions and exact frozen production-source audit, combined with existing separately audited six-phase component evidence; no GUI/test/build/sampling by verifier. / pass / partial

实现：apps/desktop/src/components/ResizeHandle.tsx、apps/desktop/src/App.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx

步骤：Set classic sidebar260 → Tab to actual focused splitter → Right261 then ShiftRight271 → Press ordinaryEscape with no active drag → Check same visual and AX271

新aa010实际侧栏260→Right261→ShiftRight271。普通Esc后图07/08 JPEG和AX各自字节完全相同，侧栏仍271且焦点仍splitter，没有旧可见160/AX271分离。只撤旧普通Esc状态失同步反例。

证据：docs/verification/results/terra-sidebar-geometry-native-audit-20261101/audit.json、docs/verification/results/terra-sidebar-geometry-native-20261101/gui-sidebar-1793518481460-captures.jsonl、docs/verification/results/terra-sidebar-geometry-native-20261101/gui-sidebar-1793518481460-actions.jsonl、docs/verification/results/resize-geometry-component-20261101/independent-audit.json

限制：Active held-pointer drag plus Escape was explicitly skipped: documented CUA drag is atomic. Existing component phase is supplemental and not represented as native execution.；Coordinate doubleClick [333,350] produced width480 and opened clean README. Raw09 observation remains, with no product-cause or successful-reset attribution. Fresh AX-targeted doubleClick is a separate actual action.；All supported layout regions/ranges, restart persistence and actual narrow clamp without rewriting preferred geometry remain separate; this is not full UI007.；Quit tail has clean document/previous exited-terminal UI and explicit ProcessAndQuit followed by Appquit tool error. No independent owned-PID/start absence or full Q1 shutdown-resource conclusion is inferred.

### MAC-SIDEBAR-DOUBLECLICK-DEFAULT-NATIVE-RETEST-001

macOS26.3.1arm64 native1280x800/100%, classic sidebar/Mist light / aa010d289eadc486167225d2eae8c9fb65bc9abdab7d19848cf88fc3fbbd2101;PID92803/startlocal15:13:42 / Independent14 original JPEG files/16 AX hashes/actions and exact frozen production-source audit, combined with existing separately audited six-phase component evidence; no GUI/test/build/sampling by verifier. / pass / partial

实现：apps/desktop/src/components/ResizeHandle.tsx、apps/desktop/src/App.tsx、apps/desktop/src/features/settings/AppearanceProvider.tsx

步骤：Retain failed coordinate observation09 without attribution → Restore clean workspace and explicitly set271 → Fresh AX splitter index71 doubleClick once → Check original11→12 visual/AX271→240 and no stale-version error

新aa010 fresh AX splitter双击一次从侧栏271回默认240；原图11/12与AX一致，workspace.ts仍clean，无旧“外观已更新，请刷新后重试”。真实原生结果结合冻结Resize/App/provider与已独审组件回归，闭合旧双击STALE_VERSION/视觉AX失同步反例；09坐标事件仍单列。

证据：docs/verification/results/terra-sidebar-geometry-native-audit-20261101/audit.json、docs/verification/results/terra-sidebar-geometry-native-20261101/gui-sidebar-1793518481460-captures.jsonl、docs/verification/results/terra-sidebar-geometry-native-20261101/gui-sidebar-1793518481460-actions.jsonl、docs/verification/results/resize-geometry-component-20261101/independent-audit.json

限制：Active held-pointer drag plus Escape was explicitly skipped: documented CUA drag is atomic. Existing component phase is supplemental and not represented as native execution.；Coordinate doubleClick [333,350] produced width480 and opened clean README. Raw09 observation remains, with no product-cause or successful-reset attribution. Fresh AX-targeted doubleClick is a separate actual action.；All supported layout regions/ranges, restart persistence and actual narrow clamp without rewriting preferred geometry remain separate; this is not full UI007.；Quit tail has clean document/previous exited-terminal UI and explicit ProcessAndQuit followed by Appquit tool error. No independent owned-PID/start absence or full Q1 shutdown-resource conclusion is inferred.

### MAC-SAVE-DELAY-RESET-AND-INHERITANCE-COMPOSITE-NATIVE-001

macOS26.3.1arm64 native1280x800 / b077f8307c0b208bb1d0c514934be09365c915c5f9602deaead7b87c036cc3a8;delay/Overview PID54593/start15:43:40;Welcome PID68973/start15:50:43 / Independent15 new original JPEG files plus8 reference PNG views, manifest/AX/hash/identity/dimension and frozen-source audit. Previously independently audited scopes reused explicitly; no GUI/test/build/sampling by verifier. / pass / full

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/styles.css

步骤：Reuse exact global2to4/A8retained/UseGlobalA4 and projectwrap isolation audit → Reuse global font/appearance and default-global-project source invariants → Actual project delay1000→500 with source and UseGlobal→1000/default → Reset autosaveoff; inspect retained final disk projection and exact one-line reset source

SET001最后保存延迟入口闭合：真实Aurora延迟保存下1秒应用默认→0.5秒项目覆盖且有“使用全局设置”→点击后1秒应用默认，再清自动保存覆盖回关闭。留存磁盘投影revision42的global/project两字段均无覆盖。结合已独审global2→4/A8保持→UseGlobalA4、折行A/B隔离与全局字体/外观共用及来源/作用域源码，macOS该条完整。

证据：docs/verification/results/appearance-terra-retest-audit-20261101/audit.json、docs/verification/results/appearance-terra-retest-audit-20261101/manifest-snapshot.jsonl、docs/verification/results/appearance-terra-retest-audit-20261101/actions-snapshot.jsonl

限制：Full conclusion combines named prior independently audited native/source evidence; only missing delay control is newly exercised onb077.；Disk-after artifact is a parent read-only persisted projection with full-file SHA recorded; verifier hashes the retained projection, not an independently retained full settings.json snapshot.；Navigation toast08/localLauncher16 is a separately owned activation observation, not attributed to editor settings and not closed by this record.

### MAC-PAGE-ZOOM-200-HEADING-NATIVE-RETEST-001

macOS26.3.1arm64 native1280x800 / b077f8307c0b208bb1d0c514934be09365c915c5f9602deaead7b87c036cc3a8;delay/Overview PID54593/start15:43:40;Welcome PID68973/start15:50:43 / Independent15 new original JPEG files plus8 reference PNG views, manifest/AX/hash/identity/dimension and frozen-source audit. Previously independently audited scopes reused explicitly; no GUI/test/build/sampling by verifier. / pass / partial

实现：apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/styles.css

步骤：Read actual menu100/125/150/175/200 AX and restore100 → Inspect new Overview200 and Welcome100/200 originals → Scroll Welcome200 until both opening actions are fully visible → Bind frozen CSS removing narrow heading font reductions; reuse prior SettingsDone/AddCancel200 acceptance

新b077原生菜单200%与Welcome/项目总览标题重排相符；冻结CSS保留Welcome38px与Overview26px，不再因窄布局降到32/23，pagezoom对应76/52逻辑到屏幕缩放。Welcome打开/克隆动作滚动后完整可达，已恢复100%。此前同控制路径的Settings完成/Add滚动取消200%真实证据复用。关闭旧响应式标题未完整2x缺口，UI003其余窄窗组合仍部分。

证据：docs/verification/results/appearance-terra-retest-audit-20261101/audit.json、docs/verification/results/appearance-terra-retest-audit-20261101/manifest-snapshot.jsonl、docs/verification/results/appearance-terra-retest-audit-20261101/actions-snapshot.jsonl

限制：Page zoom200 is the accepted resize mechanism; no separate text-only zoom gate.；Heading2x is supported by actual native menu/images plus exact CSS; no claim of pixel-perfect glyph-height measurement or every workbench control being retested.；Native shortcut delivery/root cause remains unverified; this uses the actual menu.；Some looped menu input steps are not individually wrapped in actions; retained menu AX percentages are the direct observations, not a claimed complete event stream.；Narrow AI overlay/inline diff/long Chinese names and remaining lower settings controls, optional Windows125/150 remain separate.

### MAC-OVERVIEW-CURRENT-PROJECT-STALE-LAUNCHER-NATIVE-FAIL-001

macOS26.3.1arm64 native1280x800/100%, separately labeled actual React component under controlled IPC / b077f8307c0b208bb1d0c514934be09365c915c5f9602deaead7b87c036cc3a8;PID54593/startlocal15:43:40 / Independent6 original nativeJPEG/12 image-AX hashes, operator manifests/actions, full real-component harness/result/receipt/12-file archive hash and exact applied-source audit. No GUI/test/build/sampling by verifier. / fail / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/bridge.ts、apps/desktop/src/features/processes/index.tsx

步骤：Retain overview→currentAurora→Settings chronology without assuming first error step → Inspect original08 global toast and16 local launcher error → Read real launcher report/scope chain and controlled before reproduction

旧b077总览返回当前Aurora后，08设置上方全局toast“项目上下文已过期”，关闭全局提示后16启动栏仍同文局部错误。源码将两者归useLauncher；before真实组件扣留激活回包时host epoch2、两条list仍epoch1且各STALE_SCOPE，回包后旧局部错误保留。此before检查passed表示复现缺陷，不表示旧产品通过。

证据：docs/verification/results/navigation-activation-native-audit-20261101/audit.json、docs/verification/results/navigation-activation-component-20261101/result.json、docs/verification/results/navigation-activation-component-20261101/execution-receipt.json、docs/verification/results/navigation-activation-repair-release-20261101/build-receipt.json

限制：Historical native first error-occurrence step is unknown: pre08 outputs were filtered.08 is first retained full error AX; do not assign it to SettingsPanel or Viewzoom.；Local LauncherToolbar source attributes old error to useLauncher; historical native trace cannot identify which parallel list failed first. Controlled component reproduces both methods, not a fabricated native request trace.；New native captures use no actual saved profile; empty dropdown/startdisabled is normal and supports absence of old stale error only. New-epoch nonempty-profile load is separately controlled component evidence.；Activation-failure retention is component evidence, not a newly executed native failure. No whole three-project session/Agent-context, launcher lifecycle, or whole STATE004 pass.

### MAC-OVERVIEW-ACTIVATION-ORDER-NATIVE-RETEST-001

macOS26.3.1arm64 native1280x800/100%, separately labeled actual React component under controlled IPC / 7ba8676ec5884232dd7170e1ed252fdc5fccc7ba9cca37e72c2f42d4ddae0885;PID89459/startlocal16:00:58 / Independent6 original nativeJPEG/12 image-AX hashes, operator manifests/actions, full real-component harness/result/receipt/12-file archive hash and exact applied-source audit. No GUI/test/build/sampling by verifier. / pass / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/bridge.ts、apps/desktop/src/features/processes/index.tsx

步骤：Check applied one-line App ordering exactly matches tested after hash → Read real component pending/success/failure traces and loaded profile assertion → Inspect new native02 baseline→03overview/currentAurora→04readonlyAuroraSettings→05main → Confirm no old global/local stale error in settled captures, clean file and expected empty-launcher disabled state

新7ba原生总览→当前Aurora→只读编辑设置→主界面四图均无旧全局/启动栏过期错误；workspace.ts仍clean，空启动方案下disabled正常。实际应用App先等activateProject成功才关闭总览；after真实组件pending不挂launcher/不发list，完成后两条list使用epoch2并加载方案，激活失败保留总览和原错误。新原生+精确源码/组件组合只闭合该旧竞态反例。

证据：docs/verification/results/navigation-activation-native-audit-20261101/audit.json、docs/verification/results/navigation-activation-component-20261101/result.json、docs/verification/results/navigation-activation-component-20261101/execution-receipt.json、docs/verification/results/navigation-activation-repair-release-20261101/build-receipt.json

限制：Historical native first error-occurrence step is unknown: pre08 outputs were filtered.08 is first retained full error AX; do not assign it to SettingsPanel or Viewzoom.；Local LauncherToolbar source attributes old error to useLauncher; historical native trace cannot identify which parallel list failed first. Controlled component reproduces both methods, not a fabricated native request trace.；New native captures use no actual saved profile; empty dropdown/startdisabled is normal and supports absence of old stale error only. New-epoch nonempty-profile load is separately controlled component evidence.；Activation-failure retention is component evidence, not a newly executed native failure. No whole three-project session/Agent-context, launcher lifecycle, or whole STATE004 pass.

### MAC-APPEARANCE-MAIN-MIST-PAPER-VISUAL-RETEST-001

macOS26.3.1arm64 native1280x800/100% / 7ba8676ec5884232dd7170e1ed252fdc5fccc7ba9cca37e72c2f42d4ddae0885;PID89459/startlocal16:00:58 / Independent44 selected original JPEG/34 reference PNG manual comparison;141 frozen capture/reference hash checks, completeAX semantic reuse/diff and114 frozen source-file checks. No verifier GUI/build/test. / pass / partial

实现：apps/desktop/src/styles.css、apps/desktop/src/features/settings/settings.css、apps/desktop/src/features/settings/SettingsPanel.tsx、packages/plugins/builtins

步骤：Check exact two layout/theme/density conditions and source7ba binding. → Review selected originals/ref pairs and related fullAX; combine scroll supplements into single logicalcases. → Reassess each old finding against new rendering and truthful real controls; preserve explicit untested states.

Mist/Paper34主界面case：24视觉通过、6留A02按钮及A04/A05输入几何、4条件不符。旧Paper专注空白/多余footer、settings toggle/search/action/range/card/toast/overlay等按新原图具体闭合；有用真实数据/编辑控件结构逐项接受。F13仍3真实预设，PaperB01仍终端展开、B05无scope筛选，不冒充对应空态/隐藏终端/清除scope视图。

证据：docs/verification/results/appearance-main-mist-paper-audit-20261101/audit.json、docs/verification/results/appearance-main-mist-paper-audit-20261101/frozen-batch.json、docs/verification/results/appearance-main-source-7ba-20261101/manifest.json、docs/verification/visual-records.json

限制：Partial UI002 support only; no full536-state or eight-layout functional pass.；Pure visual review does not prove unseen lower pixels, persistence, clone submission or postcommit failure behavior.；Build/source changes alone never remove historical native failure; later four-source release requires related evidence only.

### MAC-APPEARANCE-MAIN-ORBIT-GRAPHITE-VISUAL-RETEST-001

macOS26.3.1arm64 native1280x800/100% / 7ba8676ec5884232dd7170e1ed252fdc5fccc7ba9cca37e72c2f42d4ddae0885;PID89459/startlocal16:00:58 / Independent44 selected original JPEG/34 reference PNG manual comparison;132 frozen capture/reference hash checks, completeAX semantic reuse/diff and114 frozen source-file checks. No verifier GUI/build/test. / pass / partial

实现：apps/desktop/src/styles.css、apps/desktop/src/features/settings/settings.css、apps/desktop/src/features/settings/SettingsPanel.tsx、packages/plugins/builtins

步骤：Check exact two layout/theme/density conditions and source7ba binding. → Review selected originals/ref pairs and related fullAX; combine scroll supplements into single logicalcases. → Reassess each old finding against new rendering and truthful real controls; preserve explicit untested states.

Orbit/Graphite34主case：22视觉pass、8差异（各A02/A04/A05及OrbitB03/B08独立editoroverlay）、4条件不符（各F13/B01）。Orbit31px主题密度条件与可见代码、终端主题surface、Graphite边线/形状等已据新图核实；其余设置修复及真实可编辑控件有明确理由。旧Orbit独立editoroverlay未修，冻结editor.css31仍25%/blur4，保留open。

证据：docs/verification/results/appearance-main-orbit-graphite-audit-20261101/audit.json、docs/verification/results/appearance-main-orbit-graphite-audit-20261101/frozen-batch.json、docs/verification/results/appearance-main-source-7ba-20261101/manifest.json、docs/verification/visual-records.json

限制：Partial UI002 support only; no full536-state or eight-layout functional pass.；Pure visual review does not prove unseen lower pixels, persistence, clone submission or postcommit failure behavior.；Build/source changes alone never remove historical native failure; later four-source release requires related evidence only.

### MAC-APPEARANCE-MAIN-CELADON-IRIS-VISUAL-RETEST-001

macOS26.3.1arm64 native1280x800/100% / 7ba8676ec5884232dd7170e1ed252fdc5fccc7ba9cca37e72c2f42d4ddae0885;PID89459/startlocal16:00:58 / Independent42 original JPEG/32 reference PNG manual comparison;126 frozen capture/reference hash checks, completeAX semantic reuse/diff and114 frozen source-file checks. No verifier GUI/build/test. / pass / partial

实现：apps/desktop/src/styles.css、apps/desktop/src/features/settings/settings.css、apps/desktop/src/features/settings/SettingsPanel.tsx、packages/plugins/builtins

步骤：Check exact two layout/theme/density conditions and source7ba binding. → Review selected originals/ref pairs and related fullAX; combine scroll supplements into single logicalcases. → Reassess each old finding against new rendering and truthful real controls; preserve explicit untested states.

Celadon/Iris32主case：23视觉pass、7差异（各A02/A04/A05，另IrisA03外角；IrisA04/A05亦保留同外角子项）、2F13真实预设条件不符。终端主题与containment、Celadonfocus可见代码及settings控件/背景输入首屏/inline恢复均据原图闭合。Iris外角仍28vsref38，具体source优先级已交root，不以新build改写旧图。

证据：docs/verification/results/appearance-main-celadon-iris-audit-20261101/audit.json、docs/verification/results/appearance-main-celadon-iris-audit-20261101/frozen-batch.json、docs/verification/results/appearance-main-source-7ba-20261101/manifest.json、docs/verification/visual-records.json

限制：Partial UI002 support only; no full536-state or eight-layout functional pass.；Pure visual review does not prove unseen lower pixels, persistence, clone submission or postcommit failure behavior.；Build/source changes alone never remove historical native failure; later four-source release requires related evidence only.

### MAC-APPEARANCE-MAIN-SAND-AURORA-VISUAL-RETEST-001

macOS26.3.1arm64 native1280x800/100% / 7ba8676ec5884232dd7170e1ed252fdc5fccc7ba9cca37e72c2f42d4ddae0885;PID89459/startlocal16:00:58 / Independent43 selected original JPEG/33 reference PNG manual comparison;143 frozen capture/reference hash checks, completeAX semantic reuse/diff and114 frozen source-file checks. No verifier GUI/build/test. / pass / partial

实现：apps/desktop/src/styles.css、apps/desktop/src/features/settings/settings.css、apps/desktop/src/features/settings/SettingsPanel.tsx、packages/plugins/builtins

步骤：Check exact two layout/theme/density conditions and source7ba binding. → Review selected originals/ref pairs and related fullAX; combine scroll supplements into single logicalcases. → Reassess each old finding against new rendering and truthful real controls; preserve explicit untested states.

Sand/Aurora33主case：22视觉pass、8差异（各A02/A04/A05及AuroraB03/B08独立editoroverlay）、3条件不符（各F13及SandB01）。Sand33px主题密度条件与可见代码、终端主题surface及Aurora主题层次已据新图核实；其余设置修复及真实可编辑控件有明确理由。旧Aurora独立editoroverlay未修，冻结editor.css31仍25%/blur4，保留open。

证据：docs/verification/results/appearance-main-sand-aurora-audit-20261101/audit.json、docs/verification/results/appearance-main-sand-aurora-audit-20261101/frozen-batch.json、docs/verification/results/appearance-main-source-7ba-20261101/manifest.json、docs/verification/visual-records.json

限制：Partial UI002 support only; no full536-state or eight-layout functional pass.；Pure visual review does not prove unseen lower pixels, persistence, clone submission or postcommit failure behavior.；Build/source changes alone never remove historical native failure; later four-source release requires related evidence only.

### MAC-APPEARANCE-EIGHT-LAYOUT-WORK-STATE-COMPOSITE-NATIVE-001

macOS26.3.1arm64 native1280×800/100% / 7ba8676ec5884232dd7170e1ed252fdc5fccc7ba9cca37e72c2f42d4ddae0885;PID89459/startlocal16:00:58 / Independent retained-original/fullAX/receipt/source audit; no verifier GUI, build, sampling or product test. / pass / partial

实现：apps/desktop/src/components/SleepingProjectPage.tsx、apps/desktop/src/styles.css、apps/desktop/src/features/settings/AppearanceProvider.tsx

步骤：Verify frozen7ba source/capture binding and native conditions. → Read exact same-tour before/after and independently compare original images/AX/OS receipts.

本轮八布局前/后Git完整AX同值“外观切换50次 · 草稿保持 · 20261101”，均0staged；文本虽含50次，证据仅本轮八布局，不倒填旧50before。追加非零Aurora→Mist→Aurora原图前后同首4/完整末17/18半行，Mist4–19随面板高度变化。文档511字符、两个标签与同16574保持；诊断前后EditorView1/created1/destroyed0/openSamples3及全部runtime计数精确相等，缓存69→76差异保留。

证据：docs/verification/results/appearance-main-native-tail-audit-20261101/audit.json、docs/verification/results/appearance-main-native-tail-audit-20261101/frozen-batch.json、docs/verification/results/appearance-main-source-7ba-20261101/manifest.json

限制：PartialUI011 until IME/failure and color/size request boundary existing component evidence separately audited.；Screenshots establish visible reading range, not numeric scrollTop or pixel-paint timing.；No new50-switch, native selection, or post-sleep-resume claim.

### MAC-APPEARANCE-MAIN-SLEEP-G03-EIGHT-LAYOUT-RETEST-001

macOS26.3.1arm64 native1280×800/100% / 7ba8676ec5884232dd7170e1ed252fdc5fccc7ba9cca37e72c2f42d4ddae0885;PID89459/startlocal16:00:58 / Independent retained-original/fullAX/receipt/source audit; no verifier GUI, build, sampling or product test. / pass / partial

实现：apps/desktop/src/components/SleepingProjectPage.tsx、apps/desktop/src/styles.css、apps/desktop/src/features/settings/AppearanceProvider.tsx

步骤：Verify frozen7ba source/capture binding and native conditions. → Read exact same-tour before/after and independently compare original images/AX/OS receipts.

自有PTY显式停止后真实干净项目休眠，八布局G03新图/AX均保留两个标签并显示休眠/恢复/偏好。64图标、24/500标题、13/1.9正文和50/48min动作修复可见；8视觉pass。Celadon首可见半行重分类为已滚动边界观察，旧判断收窄，无源码修好声明。

证据：docs/verification/results/appearance-main-native-tail-audit-20261101/audit.json、docs/verification/results/appearance-main-native-tail-audit-20261101/frozen-batch.json、docs/verification/results/appearance-main-source-7ba-20261101/manifest.json

限制：Sleeping presentation and clean Sleep only; no resume action or full resource-release proof from these stills.；Small native action footprints and real sleeping-resource sidebar explicitly accepted; exact prototype pixel identity not asserted.

### MAC-OWNED-PTY-STOP-AND-NORMAL-QUIT-AFTER-MAIN-TOUR-001

macOS26.3.1arm64 native1280×800/100% / 7ba8676ec5884232dd7170e1ed252fdc5fccc7ba9cca37e72c2f42d4ddae0885;PID89459/startlocal16:00:58 / Independent retained-original/fullAX/receipt/source audit; no verifier GUI, build, sampling or product test. / pass / partial

实现：apps/desktop/src/components/SleepingProjectPage.tsx、apps/desktop/src/styles.css、apps/desktop/src/features/settings/AppearanceProvider.tsx

步骤：Verify frozen7ba source/capture binding and native conditions. → Read exact same-tour before/after and independently compare original images/AX/OS receipts.

同一自有zsh16574（父89459/start16:14:04/cwd已归档）显式Stop后原生停止中→已退出(1)，历史只读，08:37:47Z同PIDabsent；此状态不诊断崩溃。最终Iris+Mist浅色/UI13/Menlo14/背景off/睡眠clean，CmdQ→无未保存→处理并退出；Appquit工具结果与08:41:19Z89459/16574均absent互证。

证据：docs/verification/results/appearance-main-native-tail-audit-20261101/audit.json、docs/verification/results/appearance-main-native-tail-audit-20261101/frozen-batch.json、docs/verification/results/appearance-main-source-7ba-20261101/manifest.json

限制：Only these two exact OS identities audited; this is not a fresh all-helper inventory or full Q1 active-resource exit scenario.；No restart/no-auto-run claim from this tail alone.

### MAC-BACKGROUND-OWNED-RESOURCE-CLEANUP-COMPOSITE-001

macOS native evidence + real React components in controlled Chromium/Tauri boundary / Frozen7ba source SHA binding; prior native captures retain their individual original build identities. / Independent existing4-condition harness/raw-result/source/16-file-hash audit combined with accepted native evidence. No verifier test execution or new GUI. / pass / full

实现：apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/background.ts、packages/appearance/src/index.ts

步骤：Verify complete actual harness, controlledTauri boundary and source hashes. → Inspect each raw state/URL/call/commit phase and exact first-attempt correction. → Combine only relevant previously accepted native behaviors and explicit source paths.

组合闭合当前macOS背景原句：既有真实导入/源移动/资产字节、三显示区域/适配/位置/可见度/遮罩/重开保值及关闭已审；新两真实effect在assetId null时两asset state与CSS均清空，2个实际BlobURL各revoke1次，迟到2read均不创建新URL。只关应用持有资源，不称WebKit物理缓存立即归零。

证据：docs/verification/results/appearance-boundary-ui008-ui011-audit-20261101/audit.json、docs/verification/results/appearance-boundary-ui008-ui011-audit-20261101/component/run.mjs、docs/verification/results/appearance-boundary-ui008-ui011-audit-20261101/component/result.json、docs/verification/results/appearance-boundary-ui008-ui011-audit-20261101/component/execution-receipt.json、docs/verification/results/appearance-boundary-ui008-ui011-audit-20261101/component/manifest.json

限制：Component CompositionEvents are synthetic; the separate physical native nihao→你好 observation is not relabeled as a native composition-held layout click.；UI008 proves application-owned resource release, not instant WebKit decoded-cache/texture physical memory zero.；Failure check rejects before successful apply; no postcommit partially-running rollback is invented. Static CSS-only/stable dependency source reasoning is labeled source review, not native request tracing.

### MAC-APPEARANCE-WORK-STATE-IME-FAILURE-COMPOSITE-001

macOS native evidence + real React components in controlled Chromium/Tauri boundary / Frozen7ba source SHA binding; prior native captures retain their individual original build identities. / Independent existing4-condition harness/raw-result/source/16-file-hash audit combined with accepted native evidence. No verifier test execution or new GUI. / pass / full

实现：apps/desktop/src/features/settings/AppearanceProvider.tsx、apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/settings/background.ts、packages/appearance/src/index.ts

步骤：Verify complete actual harness, controlledTauri boundary and source hashes. → Inspect each raw state/URL/call/commit phase and exact first-attempt correction. → Combine only relevant previously accepted native behaviors and explicit source paths.

组合闭合当前应用切换保留工作：已审50次保留原EditorState/选区/撤销/PTY，新增同八布局Git前后全文与非零scroll往返已登记。真实Provider composition监听+真实selectLayout在持有时prepare/apply0，end后各1且不重复；提交前失败保持Provider/Panel完整snapshot、rootstyle及commit原态。冻结source颜色/尺寸仅CSS/appearance持久化，稳定Editor/Agent生命周期不以外观为重开/发送触发。组件边界与真实中文原生证据分别标明。

证据：docs/verification/results/appearance-boundary-ui008-ui011-audit-20261101/audit.json、docs/verification/results/appearance-boundary-ui008-ui011-audit-20261101/component/run.mjs、docs/verification/results/appearance-boundary-ui008-ui011-audit-20261101/component/result.json、docs/verification/results/appearance-boundary-ui008-ui011-audit-20261101/component/execution-receipt.json、docs/verification/results/appearance-boundary-ui008-ui011-audit-20261101/component/manifest.json

限制：Component CompositionEvents are synthetic; the separate physical native nihao→你好 observation is not relabeled as a native composition-held layout click.；UI008 proves application-owned resource release, not instant WebKit decoded-cache/texture physical memory zero.；Failure check rejects before successful apply; no postcommit partially-running rollback is invented. Static CSS-only/stable dependency source reasoning is labeled source review, not native request tracing.

### MAC-SHARED-PROJECT-FORM-AND-EDITOR-OVERLAY-REPAIR-COMPOSITE-001

macOS26.3.1arm64 native1280×800/100% / Legacy7ba retained; e597PID95581;8124PID25623/8124d09f55051290d86609dd4762af18e363a0e4ee6ab55e8b1644baec4b863b / Independent15 new native originals,18 relevant completeAX,8 unchanged previously viewed references; source before/after/release receipts; explicit sharedCSS cross-case disposition. / pass / partial

实现：apps/desktop/src/styles.css、apps/desktop/src/features/editor/editor.css

步骤：Verify per-phase source/release/PID/capture identities. → Compare e597mixedIris/Mist dimensions and true8124Iris forms/four dark/light editor snapshots. → Close only shared sizing findings across old eight-layout cases using explicitly labeled composite; preserve all historical capture identities.

A02button38→40及A04/A05input36/8→40/12以无layout分支共享CSS+已审旧八套全图+e597混搭/8124真Iris定点组合闭合。IrisA03/A04外角38独立新图闭合；Orbit/Aurora四darkeditoroverlay50%/blur3独立新图闭合，Mistlight回归可读。30新复核条目29pass/1IrisA05外角尚待自然clone图；22条明确保旧7ba主图，8条用新8124实际主图。两个Cancel/Undo511字符/Save disabled，磁盘566B/SHAafda…前后同。

证据：docs/verification/results/shared-form-overlay-repair-audit-20261101/audit.json、docs/verification/results/shared-form-overlay-repair-audit-20261101/8124-frozen-batch.json、docs/verification/results/shared-form-overlay-repair-audit-20261101/e597-frozen-batch.json

限制：Cross-case source/native composite is explicit, not a new capture in every layout.；e597mixedtheme checks dimensions only; IrisA05radius not closed by source alone.；No Add/Clone submission or extra full tour; afterUndoAX tab-selection ambiguity preserved without diagnosing cause.

### MAC-UNINSTALLED-EXTENSION-PERMISSION-PREVIEW-RETEST-001

macOS26.3.1arm64 native / e597a6ad6adafc56f953e5df45ee0abb2dc624567459b055907d5373f38c40b8;PID95581/startlocal16:53:56 / Actual owned uninstalled QA permission preview original/fullAX plus exact before/after registry and frozen source review. / pass / partial

实现：apps/desktop/src-tauri/src/extensions.rs、apps/desktop/src/features/plugins/PluginInstallDialog.tsx

步骤：Open owned uninstalled guard package preview. → Read singleversion0.1.0/unpacked4159/source/compatibility/no-extra-permission/Install action; Cancel. → Compare actual registry with original false equality flag and isolate startup stopping reset.

卸载但有历史记录的自有guard显示确认扩展权限、单v0.1.0、解包后4159B、授权并安装，未误显示旧→新版/更新。Cancel后installedfalse/rev8/全部安装策略与logs不变。matchesBeforePreview=false原值保留，唯一stopping{@app:false}→{}由启动initialize229重置，基线在启动前；不声称全JSON字节同。

证据：docs/verification/results/shared-form-overlay-repair-audit-20261101/audit.json、docs/verification/results/final-boundary-repair-release-20261101/guard-record-before-native-preview.json、docs/verification/results/final-boundary-repair-release-20261101/guard-record-after-native-preview.json、docs/verification/results/boundary-repair-native-20261101/boundary-1793523282022-guard-permission-preview.jpg、docs/verification/results/boundary-repair-native-20261101/boundary-1793523282022-guard-permission-preview.ax.txt

限制：Preview cancellation only, not a reinstall/upgrade execution or all permission-denial behaviors.；Before baseline predates new host launch; ephemeral stopping change is preserved and not attributed to preview mutation.

### MAC-MAIN-SETTINGS-CONNECTION-DELETE-STALE-PANEL-NATIVE-FAIL-001

macOS26.3.1arm64 native + explicitly controlled actual React component boundary / 8124d09f55051290d86609dd4762af18e363a0e4ee6ab55e8b1644baec4b863b;PID25623/startlocal17:08:44 / Independent existing native originals/fullAX/data projection/source/controlled component audit; no verifier GUI/build/test. / fail / partial

实现：apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/agent/AgentPanel.tsx、apps/desktop/src/features/agent/store.ts、apps/desktop/src/App.tsx

步骤：Verify exact source/build/PID and capture hashes. → Compare same-project main Settings mutation/close path and actual cache state. → Inspect controlled actual-component before/after scenarios and source body equality.

旧8124主设置删除唯一自有协议验证服务后，backend连接0、项目defaults0、旧9会话全保留；同A不切换/刷新/发送，AI仍旧provider与“从一个问题开始”。前后完整AX同b2631…，首次明确原生cache失败保留。

证据：docs/verification/results/agent-connections-cache-native-audit-20261101/audit.json、docs/verification/results/agent-connections-cache-native-audit-20261101/frozen-native-batches.json、docs/verification/results/agent-connections-refresh-release-20261101/component-evidence/result.json、docs/verification/results/agent-connections-refresh-release-20261101/component-evidence/run.mjs

限制：Failure is stale same-project UI cache after successful selective deletion, not backend loss or model execution.；Old0/9 deletion preview differs from new temp0/0 by actual fixture references.

### MAC-MAIN-SETTINGS-CONNECTION-CACHE-COMPONENT-RETEST-001

macOS26.3.1arm64 native + explicitly controlled actual React component boundary / Controlled actual components:8124source before vs exact AgentSettings e475a8… after later built495ab6… / Independent existing native originals/fullAX/data projection/source/controlled component audit; no verifier GUI/build/test. / pass / partial

实现：apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/agent/AgentPanel.tsx、apps/desktop/src/features/agent/store.ts、apps/desktop/src/App.tsx

步骤：Verify exact source/build/PID and capture hashes. → Compare same-project main Settings mutation/close path and actual cache state. → Inspect controlled actual-component before/after scenarios and source body equality.

既有6场景实际组件报告12349ms：before新增/验证/删除均精确复现host/view不同，after均同步；三个before pass仅指成功复现预期缺陷。每场保草稿/上下文/messages/session/运行task同一对象/tools/选中连接；无submit/contextPrepare/sessionCreate/cancel调用。Detect-only不刷新Agent cache。测试为受控Tauri，主SettingsPanel外壳替换、真实App路由/AgentSettings/Panel/store/bridge执行。

证据：docs/verification/results/agent-connections-cache-native-audit-20261101/audit.json、docs/verification/results/agent-connections-cache-native-audit-20261101/frozen-native-batches.json、docs/verification/results/agent-connections-refresh-release-20261101/component-evidence/result.json、docs/verification/results/agent-connections-refresh-release-20261101/component-evidence/run.mjs

限制：Synthetic task identity and verification event, not a new native running-Pi test or model-connection network verification.；12349ms is harness self-report; no separate raw exec completion receipt archived. Two earlier label-locator fixture timeouts are not product failures.

### MAC-MAIN-SETTINGS-CONNECTION-CACHE-NATIVE-RETEST-001

macOS26.3.1arm64 native + explicitly controlled actual React component boundary / 495ab6bae4ebb33678afcd7c9fc3327c24d0af179b20f5061d70efca133ad2d1;PID75147/startlocal17:34:01 / Independent existing native originals/fullAX/data projection/source/controlled component audit; no verifier GUI/build/test. / pass / partial

实现：apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/agent/AgentPanel.tsx、apps/desktop/src/features/agent/store.ts、apps/desktop/src/App.tsx

步骤：Verify exact source/build/PID and capture hashes. → Compare same-project main Settings mutation/close path and actual cache state. → Inspect controlled actual-component before/after scenarios and source body equality.

495ab6仅AgentSettings改动且after源与受测体SHA完全同。真实同A主设置保存PiQA刷新验收1101（本地loopback/外部认证/no-key），明确已配置未验证；关闭立即同A显示真新名。再0defaults/0history预览删同一自有temp，关闭立即同A真未连接引导；不切项目/重开AI/刷新/发送。旧QA仍absent、旧9会话集合不变、A/B无新session、Pi0/provideroff。startupD01仅基线，不当作此delete修复证据。

证据：docs/verification/results/agent-connections-cache-native-audit-20261101/audit.json、docs/verification/results/agent-connections-cache-native-audit-20261101/frozen-native-batches.json、docs/verification/results/agent-connections-refresh-release-20261101/component-evidence/result.json、docs/verification/results/agent-connections-refresh-release-20261101/component-evidence/run.mjs

限制：Exact same-project cache save/delete retest only; full Pi runtime/model/session requirements remain independently tracked.；No D01 visual pass or auxiliary geometry claim; visual review deferred.

### MAC-PI-RUNTIME-DETECTION-AND-CONNECTION-STATE-COMPOSITE-001

Current macOSarm64; other architectures/platforms retain existing untested plan / 495ab6bae4ebb33678afcd7c9fc3327c24d0af179b20f5061d70efca133ad2d1 / Native/source/existing-production-test evidence composite independently audited; verifier did not rerun product build/test/sampling. / pass / full

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src/features/agent/AgentSettings.tsx

步骤：Verify frozen native identities/fullAX/data periods. → Read existing exact production-helper test source, receipt/log and actual installer guards. → Combine only relevant already accepted native behaviors; preserve fixed-version and cancel scope.

组合闭合当前macOS检测/连接状态：既有受管与外部1.4/未安装未配置/真实验证401等复用；495同A保存明确已配置未验证/cache即同步已审。02实际managed1.4可用→移除预览Cancel→自有9.9.9显示“版本未验证”且明确仅1.4→清空路径恢复managed1.4。检测期Pi0/provideroff/日志无新增、连接0与旧9会话不变。

证据：docs/verification/results/pi-runtime02-installer-audit-20261101/audit.json、docs/verification/results/pi-runtime02-installer-audit-20261101/frozen-native-batch.json、docs/verification/results/pi-terra-20261101/02-runtime.json

限制：Literal UI is版本未验证, not a fabricated不兼容 string.；Only this02 interval; no claim about later03 requests or current global provider state.

### MAC-PI-RUNTIME-CORRUPT-ARCHIVE-PRODUCTION-TRANSACTION-001

Current macOSarm64; other architectures/platforms retain existing untested plan / 495ab6bae4ebb33678afcd7c9fc3327c24d0af179b20f5061d70efca133ad2d1 / Native/source/existing-production-test evidence composite independently audited; verifier did not rerun product build/test/sampling. / pass / partial

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src/features/agent/AgentSettings.tsx

步骤：Verify frozen native identities/fullAX/data periods. → Read existing exact production-helper test source, receipt/log and actual installer guards. → Combine only relevant already accepted native behaviors; preserve fixed-version and cancel scope.

既有精确Rust生产共享install_from坏包事务：1pass/133filtered/0.04s，receipt exit0。localhost返回损坏archive，INTEGRITY_ERROR在写archive/解压/探测执行前返回；无managed可执行文件，staging清空。after源SHA与当前495bundle map相同，公共入口固定官方1.4url/digest。未重跑。

证据：docs/verification/results/pi-runtime02-installer-audit-20261101/audit.json、docs/verification/results/pi-runtime02-installer-audit-20261101/frozen-native-batch.json、docs/verification/results/final-boundary-repair-release-20261101/pi-checksum-transaction-test-receipt.json、docs/verification/results/final-boundary-repair-release-20261101/pi-checksum-transaction-test.log、docs/verification/results/final-boundary-repair-release-20261101/after/apps/desktop/src-tauri/src/agent.rs

限制：Owned localhost corrupt bytes in temp HostState; not an additional native download-error screenshot or live public-network corruption.

### MAC-PI-FIXED-RUNTIME-INSTALL-OWNERSHIP-COMPOSITE-001

Current macOSarm64; other architectures/platforms retain existing untested plan / 495ab6bae4ebb33678afcd7c9fc3327c24d0af179b20f5061d70efca133ad2d1 / Native/source/existing-production-test evidence composite independently audited; verifier did not rerun product build/test/sampling. / pass / full

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src/features/agent/AgentSettings.tsx

步骤：Verify frozen native identities/fullAX/data periods. → Read existing exact production-helper test source, receipt/log and actual installer guards. → Combine only relevant already accepted native behaviors; preserve fixed-version and cancel scope.

组合闭合当前固定Pi1.4运行时应用职责：既有真实安装/外部路径ownership/活动卸载拒绝/idle0复用；02显示受管来源路径1.4，移除仅Cancel且77,151,074B/SHA前后一致；坏包生产事务拒绝激活/清staging通过。生产install已有managed路径直接detect，不写/不替换活动运行文件；固定1.4无动态跨版本升级入口，不虚称执行了该不存在功能。05a人为缺失路径UI已取消未执行。

证据：docs/verification/results/pi-runtime02-installer-audit-20261101/audit.json、docs/verification/results/pi-runtime02-installer-audit-20261101/frozen-native-batch.json、docs/verification/results/final-boundary-repair-release-20261101/after/apps/desktop/src-tauri/src/agent.rs、docs/verification/results/pi-terra-20261101/02-runtime.json

限制：Existing-install no-replacement is exact production source reasoning, paired with prior actual active-uninstall/ownership evidence; no invented upgrade GUI test.；Information/failure-frame pure visual coverage deferred by latest user, no visual pass added.

### MAC-USABLE-CANDIDATE-MACOS-ARM64-PACKAGE-001

Current macOSarm64; other architectures/platforms retain existing untested plan / 495ab6bae4ebb33678afcd7c9fc3327c24d0af179b20f5061d70efca133ad2d1 / Native/source/existing-production-test evidence composite independently audited; verifier did not rerun product build/test/sampling. / pass / partial

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src/features/agent/AgentSettings.tsx

步骤：Verify frozen native identities/fullAX/data periods. → Read existing exact production-helper test source, receipt/log and actual installer guards. → Combine only relevant already accepted native behaviors; preserve fixed-version and cancel scope.

当前495可安装候选DMG/ZIP打包exit0、源main未变；verifier只读核2archive hash及ZIP内main/plist/picker3项与原bundle一致。Root已有hdiutilverify/ditto解包/deepstrict codesign全0，解包mainSHA同495；复用receipt未重跑。功能验收继续，未宣称最终安装位置运行/升级/全部goal完成。

证据：docs/verification/results/pi-runtime02-installer-audit-20261101/audit.json、docs/verification/results/pi-runtime02-installer-audit-20261101/frozen-native-batch.json、docs/verification/results/usable-candidate-package-20261101/receipt.json、docs/verification/results/usable-candidate-package-20261101/verifier-artifact-audit.json、docs/verification/results/usable-candidate-package-20261101/archive-verification.json

限制：Candidate package only; extracted app not launched and installed-location/upgrade/offline remaining checks retain exact scope.

### MAC-PI-MAIN-CONNECTION-EXPLICIT-TEST-NATIVE-001

macOS arm64 native release; controlled loopback Pi protocol fixture / 495ab6bae4ebb33678afcd7c9fc3327c24d0af179b20f5061d70efca133ad2d1 / Independent retained native originals/fullAX/raw HTTP/source/owner-receipt audit; relevant earlier accepted evidence composed without rerunning tests. / pass / partial

实现：apps/desktop/src/features/agent/ContextPicker.tsx、apps/desktop/src/features/agent/AgentPanel.tsx、apps/desktop/src/features/agent/store.ts、apps/desktop/src-tauri/src/agent.rs

步骤：Verify exact frozen app identity and original image/fullAX byte hashes. → Personally inspect functional originals and complete AX or complete numeric-node-ID diffs. → Compare first three actual provider request bodies, exact session/process/copy identities and retained post-stop receipts. → Bind current source to495 release hashes and preserve reviewed source copies.

新主连接保存后显示已配置·未验证，health0/log0/Pi0；仅一次显式测试发送固定无项目文本，原始HTTP第1条tools空、请求1，UI已验证且测试Pi退出。同A自动显示新连接；模型调用由受管Pi而非verifier发起。

证据：docs/verification/results/pi0305-functional-audit-20261101/audit.json、docs/verification/results/pi0305-functional-audit-20261101/frozen-native-batch.json、docs/verification/results/pi0305-functional-audit-20261101/provider-first-three-request-bodies.json、docs/verification/results/pi0305-functional-audit-20261101/complete-ax-diffs.json、docs/verification/results/pi0305-functional-audit-20261101/03a-connection-saved.json、docs/verification/results/pi0305-functional-audit-20261101/03b-explicit-test.json、docs/verification/results/pi0305-functional-audit-20261101/04a-context.json、docs/verification/results/pi0305-functional-audit-20261101/04b-http-context.json、docs/verification/results/pi0305-functional-audit-20261101/05a-run-identity.json、docs/verification/results/pi0305-functional-audit-20261101/05b-forced-stop.json

限制：No real-provider/key/OAuth or later credential-scope closure inferred; external no-key loopback connection only.

### MAC-PI-CONTEXT-LINES-REMOVAL-HTTP-COMPOSITE-001

macOS arm64 native release; controlled loopback Pi protocol fixture / 495ab6bae4ebb33678afcd7c9fc3327c24d0af179b20f5061d70efca133ad2d1 / Independent retained native originals/fullAX/raw HTTP/source/owner-receipt audit; relevant earlier accepted evidence composed without rerunning tests. / pass / full

实现：apps/desktop/src/features/agent/ContextPicker.tsx、apps/desktop/src/features/agent/AgentPanel.tsx、apps/desktop/src/features/agent/store.ts、apps/desktop/src-tauri/src/agent.rs

步骤：Verify exact frozen app identity and original image/fullAX byte hashes. → Personally inspect functional originals and complete AX or complete numeric-node-ID diffs. → Compare first three actual provider request bodies, exact session/process/copy identities and retained post-stop receipts. → Bind current source to495 release hashes and preserve reviewed source copies.

D03原图/完整AX真实显示当前A、2项、context.ts编辑快照/附加时已保存/选区第2行、example.txt冻结暂存区→磁盘差异，并区分聊天附件与任务整个副本范围。移除项不在最终附件，实际第2条HTTP仅精确中文目标行+原冻结diff，SHA匹配、tools空，未附未选行/移除marker/B marker。结合当前495显式snapshot缓存/版本检查/UTF16切片/提交按快照组包源码及既有native/integration缓冲区证据闭合。

证据：docs/verification/results/pi0305-functional-audit-20261101/audit.json、docs/verification/results/pi0305-functional-audit-20261101/frozen-native-batch.json、docs/verification/results/pi0305-functional-audit-20261101/provider-first-three-request-bodies.json、docs/verification/results/pi0305-functional-audit-20261101/complete-ax-diffs.json、docs/verification/results/pi0305-functional-audit-20261101/03a-connection-saved.json、docs/verification/results/pi0305-functional-audit-20261101/03b-explicit-test.json、docs/verification/results/pi0305-functional-audit-20261101/04a-context.json、docs/verification/results/pi0305-functional-audit-20261101/04b-http-context.json、docs/verification/results/pi0305-functional-audit-20261101/05a-run-identity.json、docs/verification/results/pi0305-functional-audit-20261101/05b-forced-stop.json、docs/verification/results/pi-native-final/pi-native.json、docs/verification/results/pi-native-gui-audit/audit.json、docs/verification/results/agent-connections-refresh-release-20261101/bundle-identity.json

限制：This native selection is a saved buffer; no new dirty-buffer GUI run is claimed. Current source explicitly labels both saved/unsaved snapshot branches; prior accepted buffer/native and stale-version integration evidence is reused.；Controlled protocol fixture proves delivered content and displayed state, not model-answer quality.

### MAC-PI-TASK-HIDE-CROSSPROJECT-IDENTITY-NATIVE-001

macOS arm64 native release; controlled loopback Pi protocol fixture / 495ab6bae4ebb33678afcd7c9fc3327c24d0af179b20f5061d70efca133ad2d1 / Independent retained native originals/fullAX/raw HTTP/source/owner-receipt audit; relevant earlier accepted evidence composed without rerunning tests. / pass / partial

实现：apps/desktop/src/features/agent/ContextPicker.tsx、apps/desktop/src/features/agent/AgentPanel.tsx、apps/desktop/src/features/agent/store.ts、apps/desktop/src-tauri/src/agent.rs

步骤：Verify exact frozen app identity and original image/fullAX byte hashes. → Personally inspect functional originals and complete AX or complete numeric-node-ID diffs. → Compare first three actual provider request bodies, exact session/process/copy identities and retained post-stop receipts. → Bind current source to495 release hashes and preserve reviewed source copies.

A任务I1隐藏AI后返回完整AX字节相同；切B时A仍运行中，B无会话/新请求，返A仍正在回复与原2附件/审查入口。OS收据精确Pi36311/start18:04:45/parent75147/session9d735921与ownedA副本cwd匹配，第三请求SHA相同且无B marker；没有重复启动或更换旧任务上下文。

证据：docs/verification/results/pi0305-functional-audit-20261101/audit.json、docs/verification/results/pi0305-functional-audit-20261101/frozen-native-batch.json、docs/verification/results/pi0305-functional-audit-20261101/provider-first-three-request-bodies.json、docs/verification/results/pi0305-functional-audit-20261101/complete-ax-diffs.json、docs/verification/results/pi0305-functional-audit-20261101/03a-connection-saved.json、docs/verification/results/pi0305-functional-audit-20261101/03b-explicit-test.json、docs/verification/results/pi0305-functional-audit-20261101/04a-context.json、docs/verification/results/pi0305-functional-audit-20261101/04b-http-context.json、docs/verification/results/pi0305-functional-audit-20261101/05a-run-identity.json、docs/verification/results/pi0305-functional-audit-20261101/05b-forced-stop.json

限制：B AI was not expanded/sent in this chain; full three-project chat/commit-draft restoration and Git hidden-active branch remain their assigned workflows.；Persisted dormant/epoch0 is only disk metadata; actual live identity comes from native state plus exact retained OS/session argv/cwd.

### MAC-PI-UNACKNOWLEDGED-STOP-OWNED-REAP-NATIVE-001

macOS arm64 native release; controlled loopback Pi protocol fixture / 495ab6bae4ebb33678afcd7c9fc3327c24d0af179b20f5061d70efca133ad2d1 / Independent retained native originals/fullAX/raw HTTP/source/owner-receipt audit; relevant earlier accepted evidence composed without rerunning tests. / pass / partial

实现：apps/desktop/src/features/agent/ContextPicker.tsx、apps/desktop/src/features/agent/AgentPanel.tsx、apps/desktop/src/features/agent/store.ts、apps/desktop/src-tauri/src/agent.rs

步骤：Verify exact frozen app identity and original image/fullAX byte hashes. → Personally inspect functional originals and complete AX or complete numeric-node-ID diffs. → Compare first three actual provider request bodies, exact session/process/copy identities and retained post-stop receipts. → Bind current source to495 release hashes and preserve reviewed source copies.

精确授权SIGSTOP36311后只点一次Stop；新图/AX先正在停止…且Stop禁用，后已中断/原草稿与2附件可继续/审查入口保留。owner收据确认36311及所有Pi已无、外部provider2344仍在、请求3→3无重放、原盘/index/副本不变。两图观察间隔23.683s保留，未把sleep4.5s当真实结束耗时。

证据：docs/verification/results/pi0305-functional-audit-20261101/audit.json、docs/verification/results/pi0305-functional-audit-20261101/frozen-native-batch.json、docs/verification/results/pi0305-functional-audit-20261101/provider-first-three-request-bodies.json、docs/verification/results/pi0305-functional-audit-20261101/complete-ax-diffs.json、docs/verification/results/pi0305-functional-audit-20261101/03a-connection-saved.json、docs/verification/results/pi0305-functional-audit-20261101/03b-explicit-test.json、docs/verification/results/pi0305-functional-audit-20261101/04a-context.json、docs/verification/results/pi0305-functional-audit-20261101/04b-http-context.json、docs/verification/results/pi0305-functional-audit-20261101/05a-run-identity.json、docs/verification/results/pi0305-functional-audit-20261101/05b-forced-stop.json

限制：No observed3–6s bound, unobserved timeout/effects-unknown wording, arbitrary external-process termination, permission-disconnect or rollback claim.；AI005 remaining disconnect/pending-authorization/Q1 paths stay partial until their actual frozen evidence.

### MAC-PI-CONTEXT-PREPARE-ERROR-SWALLOWED-NATIVE-FAIL-001

macOS arm64 native release; controlled loopback Pi fixture / 495ab6bae4ebb33678afcd7c9fc3327c24d0af179b20f5061d70efca133ad2d1 / Independent native original/fullAX/click-owner receipt audit plus exact frozen cache/source inference; no new test execution. / fail / partial

实现：apps/desktop/src/features/agent/store.ts、apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/git.rs

步骤：View actual06 original and complete AX; review complete pre/post remembered AX difference and later byte identity. → Verify exact cache bytes/repo-root digest/patch SHA and identical earlier actual HTTP attachment. → Compute expiry lower bounds from retained originalmtime and recorded previous terminal/observation times. → Bind error-reset source chain to495 release hashes and preserve source copies.

新task sessiona95b创建但epoch0/reviewnull；fresh发送一次正常返回，原生只显示就绪、无error，draft+2附件保留，HTTP仍3/Pi0/无新review。精确冻结A差异patch与04b实际HTTP一致，原mtime计算最早可能06前已718.49s>600；495源码git503拒绝过期缓存、context_prepare先于Pi，sendAgent catch→loadAgent→selectSession会清error/idle，解释实际静默失败。

证据：docs/verification/results/pi-context-prepare-error-failure-audit-20261101/audit.json、docs/verification/results/pi-context-prepare-error-failure-audit-20261101/cache-proof.json、docs/verification/results/pi-context-prepare-error-failure-audit-20261101/expired-diff-cache.json、docs/verification/results/pi-context-prepare-error-failure-audit-20261101/06a-send-observation.json、docs/verification/results/pi-context-prepare-error-failure-audit-20261101/01c-1793525687778-06a-click-record.json、docs/verification/results/pi0305-functional-audit-20261101/provider-first-three-request-bodies.json、docs/verification/screenshots/pi-terra-20261101/01c-1793525687778-06a-send-observation.jpg、docs/verification/results/pi-terra-20261101/01c-1793525687778-06a-send-observation.ax.txt

限制：The swallowed native error reply itself was not logged. Cause is source/cache/actual-HTTP inference, explicitly distinguished from a captured internal reply.；No exact click time or10minute synthetic wait claimed; actual recorded previous terminal gives conservative expiry bound.；No120s permission window/newPi/newreview was reached; input and two attachments remained. This is error-recovery failure, not an unauthorized write/tool side effect.；Later repair must combine retained native expiredDiff failure +same-error actual-component before/after +new native stale-buffer refusal/recovery; do not claim it replayed the sameexpired cache.

### MAC-PI-PASSIVE-HYDRATION-ERROR-COMPONENT-RETEST-001

Actual headless components + retained source; current macOS release source binding only / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent read-only audit of existing actual-component harness/results and exact before/after source hashes; no rerun/native operation. / pass / partial

实现：apps/desktop/src/features/agent/store.ts、apps/desktop/src/features/agent/AgentPanel.tsx、apps/desktop/src/bridge.ts

步骤：Read retained complete harness and relevant production changes. → Audit every final scenario/phase result and controlled boundary. → Match before files to495, after files to applied eight-file12ed release map; retain raw artifact hashes. → Keep exact old native failure active pending native repair composite.

最终10类×before/after共20场景报告全pass/8028ms。旧fresh/existing错误先failed后被hydrate清idle复现；新269dd58/02823ff保failed/error/draft/附件，cancel保cancelled。迟到旧history不覆盖新running/messages，draft-only修改仍可正常落历史；正常发送/恢复/显式选择/auth原指引/普通无draft新文案均保。latest-read token与具体session/profile/connection/status/messages/task守卫已逐行核，未用全revision。

证据：docs/verification/results/context-error-functional-component-audit-20261101/audit.json、docs/verification/results/context-error-functional-component-audit-20261101/pi-twenty-scenario-projection.json、docs/verification/results/context-error-functional-component-audit-20261101/search-motion-eight-phase-projection.json、docs/verification/results/context-error-functional-release-20261101/source-change.json、docs/verification/results/context-error-functional-release-20261101/bundle-identity.json、docs/verification/results/context-error-functional-release-20261101/pi-component-evidence/result.json、docs/verification/results/context-error-functional-release-20261101/pi-component-evidence/run.mjs、docs/verification/results/context-error-functional-release-20261101/state-motion-component-evidence/result.json、docs/verification/results/context-error-functional-release-20261101/state-motion-component-evidence/run.mjs、docs/verification/results/context-error-functional-release-20261101/state-motion-component-evidence/execution-receipt.json

限制：Component scope only; old STATE004 native failure remains active until new installed-native stale-buffer error/recovery composite.；Final duration/pass are harness-reported; no separate Pi raw exec completion receipt in archive.

### MAC-SEARCH-SNAPSHOT-STALE-GENERATION-COMPONENT-001

Actual headless components + retained source; current macOS release source binding only / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent read-only audit of existing actual-component harness/results and exact before/after source hashes; no rerun/native operation. / pass / partial

实现：apps/desktop/src/features/editor/SearchPanel.tsx

步骤：Read retained complete harness and relevant production changes. → Audit every final scenario/phase result and controlled boundary. → Match before files to495, after files to applied eight-file12ed release map; retain raw artifact hashes. → Keep exact old native failure active pending native repair composite.

真实SearchPanel最终before/after各4组，2948ms/原receipt exit0。新结果保存请求起始时间/独立参数快照；选项变更保旧结果/输入/scroll并提示，旧generation事件隔离且ACK回来后cancel一次。改回旧参数仍标仅此前部分结果；新请求后迟到旧事件/终态不盖新结果。零匹配归旧请求、invalidregex无新task、清query清旧error/time。

证据：docs/verification/results/context-error-functional-component-audit-20261101/audit.json、docs/verification/results/context-error-functional-component-audit-20261101/pi-twenty-scenario-projection.json、docs/verification/results/context-error-functional-component-audit-20261101/search-motion-eight-phase-projection.json、docs/verification/results/context-error-functional-release-20261101/source-change.json、docs/verification/results/context-error-functional-release-20261101/bundle-identity.json、docs/verification/results/context-error-functional-release-20261101/pi-component-evidence/result.json、docs/verification/results/context-error-functional-release-20261101/pi-component-evidence/run.mjs、docs/verification/results/context-error-functional-release-20261101/state-motion-component-evidence/result.json、docs/verification/results/context-error-functional-release-20261101/state-motion-component-evidence/run.mjs、docs/verification/results/context-error-functional-release-20261101/state-motion-component-evidence/execution-receipt.json

限制：Controlled bridge/editor draft store and virtualized DOM; no new native filesystem search or OS cancellation timing claim.；Existing actual Trash failure remains separate/active; this record closes only Search component subconditions.

### MAC-REDUCED-MOTION-PAGER-NAMES-COMPONENT-SOURCE-001

Actual headless components + retained source; current macOS release source binding only / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent read-only audit of existing actual-component harness/results and exact before/after source hashes; no rerun/native operation. / pass / partial

实现：apps/desktop/src/styles.css、apps/desktop/src/features/agent/agent.css、apps/desktop/src/features/git/git.css、apps/desktop/src/features/editor/editor.css、apps/desktop/src/features/git/GitPanel.tsx

步骤：Read retained complete harness and relevant production changes. → Audit every final scenario/phase result and controlled boundary. → Match before files to495, after files to applied eight-file12ed release map; retain raw artifact hashes. → Keep exact old native failure active pending native repair composite.

真实AppearanceProvider与产品CSS的on/off/system×OS两态共6组合，before复现设置未覆盖全局及off被OS盖；after全局/Agent/Git动画、Settings/plugin伪元素/editor transition/scroll均按解析设置生效。Git分页恰仅新增含分组title的上一页/下一页两个aria-label，功能行为字节不变。结合此前键盘/命名/非纯色审查保留子项证据。

证据：docs/verification/results/context-error-functional-component-audit-20261101/audit.json、docs/verification/results/context-error-functional-component-audit-20261101/pi-twenty-scenario-projection.json、docs/verification/results/context-error-functional-component-audit-20261101/search-motion-eight-phase-projection.json、docs/verification/results/context-error-functional-release-20261101/source-change.json、docs/verification/results/context-error-functional-release-20261101/bundle-identity.json、docs/verification/results/context-error-functional-release-20261101/pi-component-evidence/result.json、docs/verification/results/context-error-functional-release-20261101/pi-component-evidence/run.mjs、docs/verification/results/context-error-functional-release-20261101/state-motion-component-evidence/result.json、docs/verification/results/context-error-functional-release-20261101/state-motion-component-evidence/run.mjs、docs/verification/results/context-error-functional-release-20261101/state-motion-component-evidence/execution-receipt.json

限制：Motion computed-style component check, not a new native fullK1 run; pager names are source-only.；Old exact Git nested-modal native failure still active; no UI004 full promotion from this record.

### MAC-INSTALLED-CANDIDATE-PERSISTED-STARTUP-NATIVE-001

macOS arm64 installed native release; controlled Pi fixture where applicable / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent native originals/fullAX or complete node-ID diffs/frozen owner receipts; relevant retained component/source evidence composed, no rerun. / pass / partial

实现：apps/desktop/src/features/agent/store.ts、apps/desktop/src/features/agent/AgentPanel.tsx、apps/desktop/src/features/editor/SearchPanel.tsx、apps/desktop/src/styles.css

步骤：Verify exact14original/fullAXhashpairs and installed native identity. → Personally view all14functional originals and read6fullAX+8complete diffs. → Compare ownerbaseline/error/recovery/permission/expiry and rawHTTP4/5. → Compose only relevant already-accepted source/component/error recovery clauses; preserve WRITE/expiry boundary.

新12ed由owned最终路径~/Applications/Horizon.app真实启动8737/start18:41:19，原图/AX恢复A项目、两编辑标签、Git1更改、旧聊天/工作区及极光偏好；health3/Pi0无自动模型重放。复用已存build0/codesign0/DMGverify/ZIP解包main一致和安装替换回执，未重复包检查。

证据：docs/verification/results/context-error-native-audit-20261101/audit.json、docs/verification/results/context-error-native-audit-20261101/frozen-native-batch.json、docs/verification/results/context-error-native-audit-20261101/complete-ax-diffs.json、docs/verification/results/context-error-native-audit-20261101/provider-request-four-five-bodies.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-before.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-stale-prepared.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-stale-error.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-ready.json、docs/verification/results/context-error-native-audit-20261101/06a-permission.json、docs/verification/results/context-error-native-audit-20261101/06-permission-expired.json、docs/verification/results/context-error-native-audit-20261101/installed-native-identity.json、docs/verification/results/context-error-native-audit-20261101/installation-copy.json、docs/verification/results/context-error-native-audit-20261101/archive-verification.json、docs/verification/results/context-error-native-audit-20261101/release-build-receipt.json

限制：Current installed-path startup/state persistence subcondition only; no20-start timing or complete offline/upgrade acceptance inferred.

### MAC-SEARCH-SNAPSHOT-PARAMETERS-NATIVE-RETEST-001

macOS arm64 installed native release; controlled Pi fixture where applicable / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent native originals/fullAX or complete node-ID diffs/frozen owner receipts; relevant retained component/source evidence composed, no rerun. / pass / partial

实现：apps/desktop/src/features/agent/store.ts、apps/desktop/src/features/agent/AgentPanel.tsx、apps/desktop/src/features/editor/SearchPanel.tsx、apps/desktop/src/styles.css

步骤：Verify exact14original/fullAXhashpairs and installed native identity. → Personally view all14functional originals and read6fullAX+8complete diffs. → Compare ownerbaseline/error/recovery/permission/expiry and rawHTTP4/5. → Compose only relevant already-accepted source/component/error recovery clauses; preserve WRITE/expiry boundary.

真实搜索selected初始2处/1文件与18:42:56时间；开case保留2处/原时间并明确条件已变。一次手动搜索变1处/1文件18:43:55且旧提示消失；操作者报告B观察后返A图/AX保持query/case/result/time。与既有ACK/generation/partial组件证据组合，原生Search旧快照子项闭合。

证据：docs/verification/results/context-error-native-audit-20261101/audit.json、docs/verification/results/context-error-native-audit-20261101/frozen-native-batch.json、docs/verification/results/context-error-native-audit-20261101/complete-ax-diffs.json、docs/verification/results/context-error-native-audit-20261101/provider-request-four-five-bodies.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-before.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-stale-prepared.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-stale-error.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-ready.json、docs/verification/results/context-error-native-audit-20261101/06a-permission.json、docs/verification/results/context-error-native-audit-20261101/06-permission-expired.json、docs/verification/results/context-error-native-audit-20261101/installed-native-identity.json、docs/verification/results/context-error-native-audit-20261101/installation-copy.json、docs/verification/results/context-error-native-audit-20261101/archive-verification.json、docs/verification/results/context-error-native-audit-20261101/release-build-receipt.json

限制：Exact old GitTrash/native busyStop failure remains separate and active; no fullSTATE002/WS005 promotion.

### MAC-REDUCED-MOTION-SETTING-NATIVE-COMPOSITE-001

macOS arm64 installed native release; controlled Pi fixture where applicable / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent native originals/fullAX or complete node-ID diffs/frozen owner receipts; relevant retained component/source evidence composed, no rerun. / pass / partial

实现：apps/desktop/src/features/agent/store.ts、apps/desktop/src/features/agent/AgentPanel.tsx、apps/desktop/src/features/editor/SearchPanel.tsx、apps/desktop/src/styles.css

步骤：Verify exact14original/fullAXhashpairs and installed native identity. → Personally view all14functional originals and read6fullAX+8complete diffs. → Compare ownerbaseline/error/recovery/permission/expiry and rawHTTP4/5. → Compose only relevant already-accepted source/component/error recovery clauses; preserve WRITE/expiry boundary.

新安装包全局减少动效实际system→开启→恢复system，UI/AX实值及已保存可见。结合先前真实Provider/CSS六组合计算样式与同12ed源码，on/off/system语义及两Git分页名称子项闭合；无需新整套K1。

证据：docs/verification/results/context-error-native-audit-20261101/audit.json、docs/verification/results/context-error-native-audit-20261101/frozen-native-batch.json、docs/verification/results/context-error-native-audit-20261101/complete-ax-diffs.json、docs/verification/results/context-error-native-audit-20261101/provider-request-four-five-bodies.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-before.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-stale-prepared.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-stale-error.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-ready.json、docs/verification/results/context-error-native-audit-20261101/06a-permission.json、docs/verification/results/context-error-native-audit-20261101/06-permission-expired.json、docs/verification/results/context-error-native-audit-20261101/installed-native-identity.json、docs/verification/results/context-error-native-audit-20261101/installation-copy.json、docs/verification/results/context-error-native-audit-20261101/archive-verification.json、docs/verification/results/context-error-native-audit-20261101/release-build-receipt.json

限制：Still images prove setting interaction/state, while motion effect comes from actual retained computed-style component evidence. Old Gitnested failure remains active.

### MAC-PI-CONTEXT-ERROR-RECOVERY-NATIVE-COMPOSITE-001

macOS arm64 installed native release; controlled Pi fixture where applicable / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent native originals/fullAX or complete node-ID diffs/frozen owner receipts; relevant retained component/source evidence composed, no rerun. / pass / full

实现：apps/desktop/src/features/agent/store.ts、apps/desktop/src/features/agent/AgentPanel.tsx、apps/desktop/src/features/editor/SearchPanel.tsx、apps/desktop/src/styles.css

步骤：Verify exact14original/fullAXhashpairs and installed native identity. → Personally view all14functional originals and read6fullAX+8complete diffs. → Compare ownerbaseline/error/recovery/permission/expiry and rawHTTP4/5. → Compose only relevant already-accepted source/component/error recovery clauses; preserve WRITE/expiry boundary.

新12ed真实buffer编辑版本拒绝显示“附件编辑版本或项目已变化”，draft/单附件/未保存X保持且HTTP3/Pi0/无新review；UndoX回原三行/Save disabled、移除旧附件后，同24c一次手动重发已到真正Pi任务副本example42B授权。结合旧expiredDiff实际失败、同错误20组件前后、当前源码及既有401重测/文件RetryLocateClose/危险写不盲重试和归属证据，精确修复吞错并闭合错误可恢复原句。

证据：docs/verification/results/context-error-native-audit-20261101/audit.json、docs/verification/results/context-error-native-audit-20261101/frozen-native-batch.json、docs/verification/results/context-error-native-audit-20261101/complete-ax-diffs.json、docs/verification/results/context-error-native-audit-20261101/provider-request-four-five-bodies.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-before.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-stale-prepared.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-stale-error.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-ready.json、docs/verification/results/context-error-native-audit-20261101/06a-permission.json、docs/verification/results/context-error-native-audit-20261101/06-permission-expired.json、docs/verification/results/context-error-native-audit-20261101/installed-native-identity.json、docs/verification/results/context-error-native-audit-20261101/installation-copy.json、docs/verification/results/context-error-native-audit-20261101/archive-verification.json、docs/verification/results/context-error-native-audit-20261101/release-build-receipt.json、docs/verification/PROCESSES_GUI.md、docs/verification/results/pi-native-gui-audit/audit.json、docs/verification/results/file-recovery-native-gui-audit/audit.json、docs/verification/results/file-recovery-wake-native-audit/audit.json、docs/verification/results/navigation-activation-native-audit-20261101/audit.json、docs/verification/results/context-error-functional-component-audit-20261101/audit.json

限制：This is same generic context_prepare/catch/hydration path with a realbufferSTALE_VERSION, not a second nativeexpiredDiff run or captured old reply.；Reaching authorization proves recovery; first permission later expired. No normalWRITE, apply/review or live-vendor inference.

### MAC-PI-PERMISSION-EXPIRED-WITHOUT-WRITE-NATIVE-001

macOS arm64 installed native release; controlled Pi fixture where applicable / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent native originals/fullAX or complete node-ID diffs/frozen owner receipts; relevant retained component/source evidence composed, no rerun. / pass / partial

实现：apps/desktop/src/features/agent/store.ts、apps/desktop/src/features/agent/AgentPanel.tsx、apps/desktop/src/features/editor/SearchPanel.tsx、apps/desktop/src/styles.css

步骤：Verify exact14original/fullAXhashpairs and installed native identity. → Personally view all14functional originals and read6fullAX+8complete diffs. → Compare ownerbaseline/error/recovery/permission/expiry and rawHTTP4/5. → Compose only relevant already-accepted source/component/error recovery clauses; preserve WRITE/expiry boundary.

首次真实任务副本写入权限显示来源Pi/example.txt42B；交接后原生按钮实际disabled/授权已过期，未点失效按钮。第5条真实HTTP含tool-4拒绝/取消/过期结果，Pi已退出，源盘/index/copySHA均未写。该边界为真实拒绝保护，不计正常WRITE成功。

证据：docs/verification/results/context-error-native-audit-20261101/audit.json、docs/verification/results/context-error-native-audit-20261101/frozen-native-batch.json、docs/verification/results/context-error-native-audit-20261101/complete-ax-diffs.json、docs/verification/results/context-error-native-audit-20261101/provider-request-four-five-bodies.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-before.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-stale-prepared.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-stale-error.json、docs/verification/results/context-error-native-audit-20261101/06-recovery-ready.json、docs/verification/results/context-error-native-audit-20261101/06a-permission.json、docs/verification/results/context-error-native-audit-20261101/06-permission-expired.json、docs/verification/results/context-error-native-audit-20261101/installed-native-identity.json、docs/verification/results/context-error-native-audit-20261101/installation-copy.json、docs/verification/results/context-error-native-audit-20261101/archive-verification.json、docs/verification/results/context-error-native-audit-20261101/release-build-receipt.json

限制：Owner prior deadline-readiness estimate is not actualexpiresAt/click guarantee; exact120s interaction timestamp was not exposed.；Later independent successfulWRITE belongs to the forthcoming frozen batch.

### MAC-PI-WRITE-REVIEW-STALE-UNBORN-COMPOSITE-001

macOS arm64 installed native release; real Pi controlled local protocol fixture / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent retained17original/fullAX/rawHTTP/owner identity-data review plus relevant earlier accepted native/source/integration composites; no rerun. / pass / full

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src/features/agent/store.ts、apps/desktop/src/features/agent/AgentPanel.tsx、packages/pi-policy/horizon-policy.ts

步骤：Verify formal frozen17capture+allow action+10JSON/SHA slice. → Personally inspect16functional originals andone existing matchingbeforeAllow supplement, read7fullAX+10completeIDdiffs. → Match rawrequests6–11 hashes/bodies, exactsession/PID/cwd/review/copy/stop/retry boundaries. → Compose only missing acceptance clauses with retained earlier exact native/integration/source evidence.

新独立da0f/c314任务经真实匹配权限允许后，Pi tool-6只写副本example42B/SHAf142，源盘/index不变；stream7自然结束后真审查显示原磁盘→副本差异，切B无A内容、回A同review。后追加单X使一次应用被明确拒绝/0项，X保留；Undo clean再仅显式放弃核定c314copy。B无HEAD拒任务且0会话/Pi/请求/copy，手动聊天可用。结合旧成功apply/UndoRedo/显式Save、完整dirtybuffer基线与原盘版本/branch/index集成保护，修改审查原句组合闭合。

证据：docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/audit.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/frozen-batch.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/frozen-manifest.jsonl、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/complete-ax-diffs.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/provider-requests-six-eleven-bodies.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/06b-write-retry-stream.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/06b-write-retry-http.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/06b-write-retry-finish.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/06c-review-isolation.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/07-stale-review.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/08-baseline.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/08a-unborn.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/08b-disconnect.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/09-baseline.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/09a-auth-retry.json、research/verification/pi-rpc.json、docs/verification/results/pi-native-final/pi-native.json、docs/verification/results/pi-native-gui-audit/audit.json、docs/verification/results/pi-native-gui/applied-editor-before-save.json、docs/verification/results/pi-native-gui/review-undo-redo-save.json

限制：Current batch does not claim a new successfulapply; successful undoablebuffer application uses prior accepted exact native evidence.；Review.completed=false before apply is expected, not unfinishedPi run; controlled model fixture only.

### MAC-PI-DISCONNECT-MANUAL-RESUME-COMPOSITE-001

macOS arm64 installed native release; real Pi controlled local protocol fixture / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent retained17original/fullAX/rawHTTP/owner identity-data review plus relevant earlier accepted native/source/integration composites; no rerun. / pass / full

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src/features/agent/store.ts、apps/desktop/src/features/agent/AgentPanel.tsx、packages/pi-policy/horizon-policy.ts

步骤：Verify formal frozen17capture+allow action+10JSON/SHA slice. → Personally inspect16functional originals andone existing matchingbeforeAllow supplement, read7fullAX+10completeIDdiffs. → Match rawrequests6–11 hashes/bodies, exactsession/PID/cwd/review/copy/stop/retry boundaries. → Compose only missing acceptance clauses with retained earlier exact native/integration/source evidence.

精确Bchat88987/PIDstart/parent/session/cwd核对后SIGKILL，原生保部分正文并显示终态前退出/效果未知；109.183693s后Pi0/HTTP仍8，无自动重启/重放。仅一次手动继续原Bsession→请求9完成/Pi0。结合已审I1未确认abort强回收真实stopping→已中断/OSgone、nativependingCancel撤权限保草稿和生产clear_queue/abort/权限清理与实际Pi取消集成，取消/断连/停止原句组合闭合。

证据：docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/audit.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/frozen-batch.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/frozen-manifest.jsonl、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/complete-ax-diffs.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/provider-requests-six-eleven-bodies.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/06b-write-retry-stream.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/06b-write-retry-http.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/06b-write-retry-finish.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/06c-review-isolation.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/07-stale-review.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/08-baseline.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/08a-unborn.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/08b-disconnect.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/09-baseline.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/09a-auth-retry.json、docs/verification/results/pi0305-functional-audit-20261101/audit.json、research/verification/pi-rpc.json、docs/verification/results/pi-native-final/pi-native.json、docs/verification/results/pi-native-gui-audit/audit.json、docs/verification/results/pi-native-gui/pending-cancel.json

限制：SIGKILL is disconnect injection, not protocolabort acknowledgment or provider-offline test; no exact stop-latency bound invented.；Controlled fixture/native owner receipts; no arbitrary externalprocess termination or rollback claim.

### MAC-PI-ALLOW-NATURAL-REVIEW-CROSSPROJECT-NATIVE-001

macOS arm64 installed native release; real Pi controlled local protocol fixture / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent retained17original/fullAX/rawHTTP/owner identity-data review plus relevant earlier accepted native/source/integration composites; no rerun. / pass / partial

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src/features/agent/store.ts、apps/desktop/src/features/agent/AgentPanel.tsx、packages/pi-policy/horizon-policy.ts

步骤：Verify formal frozen17capture+allow action+10JSON/SHA slice. → Personally inspect16functional originals andone existing matchingbeforeAllow supplement, read7fullAX+10completeIDdiffs. → Match rawrequests6–11 hashes/bodies, exactsession/PID/cwd/review/copy/stop/retry boundaries. → Compose only missing acceptance clauses with retained earlier exact native/integration/source evidence.

新beforeAllow原图/完整AX匹配Pi/任务副本/example42B，11:04:54.023实际允许一次；真实tool-6成功后仍streaming，随后自然终态/Pi0才已完成。A审查→B无A内容→返A同c314差异，旧source/index不变；仅核定copy显式放弃，其他历史不纳删除声明。

证据：docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/audit.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/frozen-batch.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/frozen-manifest.jsonl、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/complete-ax-diffs.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/provider-requests-six-eleven-bodies.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/06b-write-retry-stream.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/06b-write-retry-http.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/06b-write-retry-finish.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/06c-review-isolation.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/07-stale-review.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/08-baseline.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/08a-unborn.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/08b-disconnect.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/09-baseline.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/09a-auth-retry.json

限制：AI010外部认证/历史删除边界与WS005剩余Git草稿/聊天综合恢复沿后续既有工作流，未由本条推满。；Expired24c/de22 remains separate; this is newda0f/c314 successfulWRITE.

### MAC-PI-AUTH-FAILURE-EXPLICIT-RETRY-NATIVE-001

macOS arm64 installed native release; real Pi controlled local protocol fixture / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent retained17original/fullAX/rawHTTP/owner identity-data review plus relevant earlier accepted native/source/integration composites; no rerun. / pass / partial

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src/features/agent/store.ts、apps/desktop/src/features/agent/AgentPanel.tsx、packages/pi-policy/horizon-policy.ts

步骤：Verify formal frozen17capture+allow action+10JSON/SHA slice. → Personally inspect16functional originals andone existing matchingbeforeAllow supplement, read7fullAX+10completeIDdiffs. → Match rawrequests6–11 hashes/bodies, exactsession/PID/cwd/review/copy/stop/retry boundaries. → Compose only missing acceptance clauses with retained earlier exact native/integration/source evidence.

新Ac74chat仅fresh44Bexample快照，真实请求10由受控401触发认证失败，输入/唯一附件保持、Pi0；一次明确重试请求11仍401、同session/同上下文、authState仍needsAuthentication。两次都不是认证修复；详情默认折叠，用户可检查连接/重发。

证据：docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/audit.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/frozen-batch.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/frozen-manifest.jsonl、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/complete-ax-diffs.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/provider-requests-six-eleven-bodies.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/06b-write-retry-stream.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/06b-write-retry-http.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/06b-write-retry-finish.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/06c-review-isolation.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/07-stale-review.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/08-baseline.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/08a-unborn.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/08b-disconnect.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/09-baseline.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/09a-auth-retry.json

限制：Exact responsewirebody was not recorded; controlled401 basis is approvedfixture branch plus actualnativeerror/persistedauthstate.；09b later显式Test恢复不在本批；真实供应商/APIkey/OAuth与系统/会话凭据边界仍独立未验。

### MAC-PI-SYSTEM-SESSION-CREDENTIAL-OWNERSHIP-NATIVE-001

macOS arm64 installed native release; Pi1.4.0 controlled local protocol fixture / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent existing9original/11AX/frozenowner+rawHTTP review; reused completed351sample independent derivation. No rerun. / pass / partial

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/settings.rs、apps/desktop/src/features/agent/AgentSettings.tsx、scripts/desktop/mac_metrics.py

步骤：Verify frozen9capture+2AX-only and16data artifact hashes; reuse exactthree previouslyviewed performanceoriginals and351raw measurement derivation. → View remaining6functional originals, read5additionalfullAX and3completeIDdiffs; match actualcredential/test/Stop states. → Bind exactinstalled12ed/8737/PiPIDstart+session/cwd/source; compare boundedexistingHTTP12–16 andfrozenowntranscript. → Report eachfixedcondition separately; retain initialHTTP15false/HOLD plus resolvedcheckpointclassification.

旧两次401后主QA仅一次显式固定Test12恢复verified，固定probe与旧03b一致且无项目/工具。唯一自有假凭据3d3/f496保存系统钥匙串先configured且0请求/Pi，再唯一Test13为verified/Authorization仅present；预览Pi已有认证后Cancel，保存同ref为session/rev2，旧系统item精确metadata查询0→44/absent、其他item不变、明文不进state/index/models。随后实际Pi SDK14/15复用会话凭据且无额外Test。

证据：docs/verification/results/pi-credential-fixed-performance-audit-20261101/audit.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/frozen-batch.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/frozen-manifest.jsonl、docs/verification/results/pi-credential-fixed-performance-audit-20261101/complete-ax-diffs.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/measurement-preaudit.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/provider-requests-twelve-sixteen-bodies.json、docs/verification/results/pi-fixed-performance-20261101/product-accounting.json、docs/verification/results/pi-terra-20261101/09b-main-test-restored.json、docs/verification/results/pi-terra-20261101/10a-baseline.json、docs/verification/results/pi-terra-20261101/10a-credential-reference.json、docs/verification/results/pi-perf-owner-20261101/request16-investigation.json、docs/verification/results/pi-perf-owner-20261101/request16-a-transcript-proof.json、docs/verification/results/pi-perf-owner-20261101/request16-own-a-session.jsonl、docs/verification/results/pi-perf-owner-20261101/scene0/metadata.json、docs/verification/results/pi-perf-owner-20261101/scene0/members.json、docs/verification/results/pi-perf-owner-20261101/scene1/metadata.json、docs/verification/results/pi-perf-owner-20261101/scene1/members.json、docs/verification/results/pi-perf-owner-20261101/scene2/metadata.json、docs/verification/results/pi-perf-owner-20261101/scene2/members.json、docs/verification/results/pi-perf-owner-20261101/scene0/post.json、docs/verification/results/pi-perf-owner-20261101/scene1/post.json、docs/verification/results/pi-perf-owner-20261101/scene2/post-stopped.json、docs/verification/results/pi-perf-owner-20261101/scene2/post-stopped-initial-hold.json、docs/verification/results/pi-fixed-performance-20261101/scene0/samples.jsonl、docs/verification/results/pi-fixed-performance-20261101/scene0/metadata.json、docs/verification/results/pi-fixed-performance-20261101/scene0/summary.json、docs/verification/results/pi-fixed-performance-20261101/scene0-receipt.json、docs/verification/results/pi-fixed-performance-20261101/scene1/samples.jsonl、docs/verification/results/pi-fixed-performance-20261101/scene1/metadata.json、docs/verification/results/pi-fixed-performance-20261101/scene1/summary.json、docs/verification/results/pi-fixed-performance-20261101/scene1-receipt.json、docs/verification/results/pi-fixed-performance-20261101/scene2/samples.jsonl、docs/verification/results/pi-fixed-performance-20261101/scene2/metadata.json、docs/verification/results/pi-fixed-performance-20261101/scene2/summary.json、docs/verification/results/pi-fixed-performance-20261101/scene2-receipt.json、docs/verification/results/context-error-functional-release-20261101/source-change.json、docs/verification/results/pi-fixed-performance-20261101/README.md

限制：Knownfake only; metadata queries do not expose keyvalues. Native保存模式/credentialindex/owneditem absence与实际SDK组合；不将系统configured画面当作会话storage控件直接截图。；Pi-ownedauth仅预览后取消，未完成OAuth登录/读取全局auth。Q1重启session过期与10b选择性清理/历史删除未做；真实供应商未验。

### MAC-PI-ZERO-INSTANCE-FIXED-RESOURCE-12ED-001

macOS arm64 installed native release; Pi1.4.0 controlled local protocol fixture / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent existing9original/11AX/frozenowner+rawHTTP review; reused completed351sample independent derivation. No rerun. / pass / partial

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/settings.rs、apps/desktop/src/features/agent/AgentSettings.tsx、scripts/desktop/mac_metrics.py

步骤：Verify frozen9capture+2AX-only and16data artifact hashes; reuse exactthree previouslyviewed performanceoriginals and351raw measurement derivation. → View remaining6functional originals, read5additionalfullAX and3completeIDdiffs; match actualcredential/test/Stop states. → Bind exactinstalled12ed/8737/PiPIDstart+session/cwd/source; compare boundedexistingHTTP12–16 andfrozenowntranscript. → Report eachfixedcondition separately; retain initialHTTP15false/HOLD plus resolvedcheckpointclassification.

同installed12ed/8737，A/B空聊天/无附件、0Pi/0PTY/0launcher、Horizon7责任进程完整。125.0051s/117样本，排除首60s后61样本：产品footprint median189748312B/P95191878232B/稳态max191878232B、全窗peak205526104B；CPU mean0.2810297359%单核。外部provider单列median26544288B/CPUmean0.0003086921%。

证据：docs/verification/results/pi-credential-fixed-performance-audit-20261101/audit.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/frozen-batch.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/frozen-manifest.jsonl、docs/verification/results/pi-credential-fixed-performance-audit-20261101/complete-ax-diffs.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/measurement-preaudit.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/provider-requests-twelve-sixteen-bodies.json、docs/verification/results/pi-fixed-performance-20261101/product-accounting.json、docs/verification/results/pi-terra-20261101/09b-main-test-restored.json、docs/verification/results/pi-terra-20261101/10a-baseline.json、docs/verification/results/pi-terra-20261101/10a-credential-reference.json、docs/verification/results/pi-perf-owner-20261101/request16-investigation.json、docs/verification/results/pi-perf-owner-20261101/request16-a-transcript-proof.json、docs/verification/results/pi-perf-owner-20261101/request16-own-a-session.jsonl、docs/verification/results/pi-perf-owner-20261101/scene0/metadata.json、docs/verification/results/pi-perf-owner-20261101/scene0/members.json、docs/verification/results/pi-perf-owner-20261101/scene1/metadata.json、docs/verification/results/pi-perf-owner-20261101/scene1/members.json、docs/verification/results/pi-perf-owner-20261101/scene2/metadata.json、docs/verification/results/pi-perf-owner-20261101/scene2/members.json、docs/verification/results/pi-perf-owner-20261101/scene0/post.json、docs/verification/results/pi-perf-owner-20261101/scene1/post.json、docs/verification/results/pi-perf-owner-20261101/scene2/post-stopped.json、docs/verification/results/pi-perf-owner-20261101/scene2/post-stopped-initial-hold.json、docs/verification/results/pi-fixed-performance-20261101/scene0/samples.jsonl、docs/verification/results/pi-fixed-performance-20261101/scene0/metadata.json、docs/verification/results/pi-fixed-performance-20261101/scene0/summary.json、docs/verification/results/pi-fixed-performance-20261101/scene0-receipt.json、docs/verification/results/pi-fixed-performance-20261101/scene1/samples.jsonl、docs/verification/results/pi-fixed-performance-20261101/scene1/metadata.json、docs/verification/results/pi-fixed-performance-20261101/scene1/summary.json、docs/verification/results/pi-fixed-performance-20261101/scene1-receipt.json、docs/verification/results/pi-fixed-performance-20261101/scene2/samples.jsonl、docs/verification/results/pi-fixed-performance-20261101/scene2/metadata.json、docs/verification/results/pi-fixed-performance-20261101/scene2/summary.json、docs/verification/results/pi-fixed-performance-20261101/scene2-receipt.json、docs/verification/results/context-error-functional-release-20261101/source-change.json、docs/verification/results/pi-fixed-performance-20261101/README.md

限制：Existingprojects/enabledfeatures emptychat不是alloffhost≤200MB场景；全窗峰值也不冒充低于200MB。；No listener/subscription diagnostics; zeroPi quietCPU subcondition only, notnew30min orfullresource-release acceptance.

### MAC-PI-SINGLE-INSTANCE-FIXED-RESOURCE-12ED-001

macOS arm64 installed native release; Pi1.4.0 controlled local protocol fixture / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent existing9original/11AX/frozenowner+rawHTTP review; reused completed351sample independent derivation. No rerun. / pass / partial

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/settings.rs、apps/desktop/src/features/agent/AgentSettings.tsx、scripts/desktop/mac_metrics.py

步骤：Verify frozen9capture+2AX-only and16data artifact hashes; reuse exactthree previouslyviewed performanceoriginals and351raw measurement derivation. → View remaining6functional originals, read5additionalfullAX and3completeIDdiffs; match actualcredential/test/Stop states. → Bind exactinstalled12ed/8737/PiPIDstart+session/cwd/source; compare boundedexistingHTTP12–16 andfrozenowntranscript. → Report eachfixedcondition separately; retain initialHTTP15false/HOLD plus resolvedcheckpointclassification.

一次手动A发送14，唯一Pi68652/start20:05:04/session74a5/项目A实际cwd，managed1.4.0/chat/no-tools持续10Hz流。125.0031s/117样本、post60共61；每样本Horizon7+Pi1求和后median275584928B/P95284350368B/稳态max285431736B、全窗peak320952224B，实际受控单Pi工作流总量低于建议600MB。activeCPUmean17.9714977434%单核。外部provider另报median27199672B/CPUmean0.2816175724%。

证据：docs/verification/results/pi-credential-fixed-performance-audit-20261101/audit.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/frozen-batch.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/frozen-manifest.jsonl、docs/verification/results/pi-credential-fixed-performance-audit-20261101/complete-ax-diffs.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/measurement-preaudit.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/provider-requests-twelve-sixteen-bodies.json、docs/verification/results/pi-fixed-performance-20261101/product-accounting.json、docs/verification/results/pi-terra-20261101/09b-main-test-restored.json、docs/verification/results/pi-terra-20261101/10a-baseline.json、docs/verification/results/pi-terra-20261101/10a-credential-reference.json、docs/verification/results/pi-perf-owner-20261101/request16-investigation.json、docs/verification/results/pi-perf-owner-20261101/request16-a-transcript-proof.json、docs/verification/results/pi-perf-owner-20261101/request16-own-a-session.jsonl、docs/verification/results/pi-perf-owner-20261101/scene0/metadata.json、docs/verification/results/pi-perf-owner-20261101/scene0/members.json、docs/verification/results/pi-perf-owner-20261101/scene1/metadata.json、docs/verification/results/pi-perf-owner-20261101/scene1/members.json、docs/verification/results/pi-perf-owner-20261101/scene2/metadata.json、docs/verification/results/pi-perf-owner-20261101/scene2/members.json、docs/verification/results/pi-perf-owner-20261101/scene0/post.json、docs/verification/results/pi-perf-owner-20261101/scene1/post.json、docs/verification/results/pi-perf-owner-20261101/scene2/post-stopped.json、docs/verification/results/pi-perf-owner-20261101/scene2/post-stopped-initial-hold.json、docs/verification/results/pi-fixed-performance-20261101/scene0/samples.jsonl、docs/verification/results/pi-fixed-performance-20261101/scene0/metadata.json、docs/verification/results/pi-fixed-performance-20261101/scene0/summary.json、docs/verification/results/pi-fixed-performance-20261101/scene0-receipt.json、docs/verification/results/pi-fixed-performance-20261101/scene1/samples.jsonl、docs/verification/results/pi-fixed-performance-20261101/scene1/metadata.json、docs/verification/results/pi-fixed-performance-20261101/scene1/summary.json、docs/verification/results/pi-fixed-performance-20261101/scene1-receipt.json、docs/verification/results/pi-fixed-performance-20261101/scene2/samples.jsonl、docs/verification/results/pi-fixed-performance-20261101/scene2/metadata.json、docs/verification/results/pi-fixed-performance-20261101/scene2/summary.json、docs/verification/results/pi-fixed-performance-20261101/scene2-receipt.json、docs/verification/results/context-error-functional-release-20261101/source-change.json、docs/verification/results/pi-fixed-performance-20261101/README.md

限制：Active streamingCPU不是idle；相对zero的85836616B增量不证明idlePi≤120MB。；Localcontrolledprotocol only; thisresource subcondition不单独宣告Pi发布默认/完整资源或其他平台已验。

### MAC-PI-TWO-INSTANCE-FIXED-RESOURCE-12ED-001

macOS arm64 installed native release; Pi1.4.0 controlled local protocol fixture / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent existing9original/11AX/frozenowner+rawHTTP review; reused completed351sample independent derivation. No rerun. / pass / partial

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/settings.rs、apps/desktop/src/features/agent/AgentSettings.tsx、scripts/desktop/mac_metrics.py

步骤：Verify frozen9capture+2AX-only and16data artifact hashes; reuse exactthree previouslyviewed performanceoriginals and351raw measurement derivation. → View remaining6functional originals, read5additionalfullAX and3completeIDdiffs; match actualcredential/test/Stop states. → Bind exactinstalled12ed/8737/PiPIDstart+session/cwd/source; compare boundedexistingHTTP12–16 andfrozenowntranscript. → Report eachfixedcondition separately; retain initialHTTP15false/HOLD plus resolvedcheckpointclassification.

仅一次显式B发送15新增Pi81050/start20:11:32/sessiondc71/项目Bcwd，A68652/PIDstart/session保持；采样每帧恰2Pi+同Horizon7。125.0051s/117样本、post60共61：产品median380263168B/P95413227776B/稳态max415046400B、全窗peak424434432B，activeCPUmean31.7886767813%单核。外部provider另报median28559544B/CPUmean0.3176897928%。scene2结束在A保守600s截止前，未混入后续summary/Stop。

证据：docs/verification/results/pi-credential-fixed-performance-audit-20261101/audit.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/frozen-batch.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/frozen-manifest.jsonl、docs/verification/results/pi-credential-fixed-performance-audit-20261101/complete-ax-diffs.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/measurement-preaudit.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/provider-requests-twelve-sixteen-bodies.json、docs/verification/results/pi-fixed-performance-20261101/product-accounting.json、docs/verification/results/pi-terra-20261101/09b-main-test-restored.json、docs/verification/results/pi-terra-20261101/10a-baseline.json、docs/verification/results/pi-terra-20261101/10a-credential-reference.json、docs/verification/results/pi-perf-owner-20261101/request16-investigation.json、docs/verification/results/pi-perf-owner-20261101/request16-a-transcript-proof.json、docs/verification/results/pi-perf-owner-20261101/request16-own-a-session.jsonl、docs/verification/results/pi-perf-owner-20261101/scene0/metadata.json、docs/verification/results/pi-perf-owner-20261101/scene0/members.json、docs/verification/results/pi-perf-owner-20261101/scene1/metadata.json、docs/verification/results/pi-perf-owner-20261101/scene1/members.json、docs/verification/results/pi-perf-owner-20261101/scene2/metadata.json、docs/verification/results/pi-perf-owner-20261101/scene2/members.json、docs/verification/results/pi-perf-owner-20261101/scene0/post.json、docs/verification/results/pi-perf-owner-20261101/scene1/post.json、docs/verification/results/pi-perf-owner-20261101/scene2/post-stopped.json、docs/verification/results/pi-perf-owner-20261101/scene2/post-stopped-initial-hold.json、docs/verification/results/pi-fixed-performance-20261101/scene0/samples.jsonl、docs/verification/results/pi-fixed-performance-20261101/scene0/metadata.json、docs/verification/results/pi-fixed-performance-20261101/scene0/summary.json、docs/verification/results/pi-fixed-performance-20261101/scene0-receipt.json、docs/verification/results/pi-fixed-performance-20261101/scene1/samples.jsonl、docs/verification/results/pi-fixed-performance-20261101/scene1/metadata.json、docs/verification/results/pi-fixed-performance-20261101/scene1/summary.json、docs/verification/results/pi-fixed-performance-20261101/scene1-receipt.json、docs/verification/results/pi-fixed-performance-20261101/scene2/samples.jsonl、docs/verification/results/pi-fixed-performance-20261101/scene2/metadata.json、docs/verification/results/pi-fixed-performance-20261101/scene2/summary.json、docs/verification/results/pi-fixed-performance-20261101/scene2-receipt.json、docs/verification/results/context-error-functional-release-20261101/source-change.json、docs/verification/results/pi-fixed-performance-20261101/README.md

限制：Sequential scenes changeforeground/sessionage；zero差190514856B不是两个idlePi预算，双实例数据仅实际条件另报。；No automaticsecondinstance claim from count alone; explicittwoSends/native+owner proof establish thispath. Q1恢复不重放/后续记录清理仍独立未验。

### MAC-PI-TWO-INSTANCE-STOP-CHECKPOINT-CLASSIFICATION-NATIVE-001

macOS arm64 installed native release; Pi1.4.0 controlled local protocol fixture / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Independent existing9original/11AX/frozenowner+rawHTTP review; reused completed351sample independent derivation. No rerun. / pass / partial

实现：apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/settings.rs、apps/desktop/src/features/agent/AgentSettings.tsx、scripts/desktop/mac_metrics.py

步骤：Verify frozen9capture+2AX-only and16data artifact hashes; reuse exactthree previouslyviewed performanceoriginals and351raw measurement derivation. → View remaining6functional originals, read5additionalfullAX and3completeIDdiffs; match actualcredential/test/Stop states. → Bind exactinstalled12ed/8737/PiPIDstart+session/cwd/source; compare boundedexistingHTTP12–16 andfrozenowntranscript. → Report eachfixedcondition separately; retain initialHTTP15false/HOLD plus resolvedcheckpointclassification.

三场结束后B12:15:18.472/A12:15:48.887各真实GUI Stop一次，native均已中断，精确两Pi身份消失、App8737/provider2344原身份保活。HTTP实际16，原15不变check=false/HOLD完整保留；原A transcript12:15:10.540 stop/noerror/126021chars后不同body摘要请求16（summarysystem+checkpointuser），位于scene2exit之后/两Stop之前。fixture子串匹配引用的RESOURCE_STREAM使summary继续流；不是Horizon重发原prompt/HTTPtimeoutretry。

证据：docs/verification/results/pi-credential-fixed-performance-audit-20261101/audit.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/frozen-batch.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/frozen-manifest.jsonl、docs/verification/results/pi-credential-fixed-performance-audit-20261101/complete-ax-diffs.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/measurement-preaudit.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/provider-requests-twelve-sixteen-bodies.json、docs/verification/results/pi-fixed-performance-20261101/product-accounting.json、docs/verification/results/pi-terra-20261101/09b-main-test-restored.json、docs/verification/results/pi-terra-20261101/10a-baseline.json、docs/verification/results/pi-terra-20261101/10a-credential-reference.json、docs/verification/results/pi-perf-owner-20261101/request16-investigation.json、docs/verification/results/pi-perf-owner-20261101/request16-a-transcript-proof.json、docs/verification/results/pi-perf-owner-20261101/request16-own-a-session.jsonl、docs/verification/results/pi-perf-owner-20261101/scene0/metadata.json、docs/verification/results/pi-perf-owner-20261101/scene0/members.json、docs/verification/results/pi-perf-owner-20261101/scene1/metadata.json、docs/verification/results/pi-perf-owner-20261101/scene1/members.json、docs/verification/results/pi-perf-owner-20261101/scene2/metadata.json、docs/verification/results/pi-perf-owner-20261101/scene2/members.json、docs/verification/results/pi-perf-owner-20261101/scene0/post.json、docs/verification/results/pi-perf-owner-20261101/scene1/post.json、docs/verification/results/pi-perf-owner-20261101/scene2/post-stopped.json、docs/verification/results/pi-perf-owner-20261101/scene2/post-stopped-initial-hold.json、docs/verification/results/pi-fixed-performance-20261101/scene0/samples.jsonl、docs/verification/results/pi-fixed-performance-20261101/scene0/metadata.json、docs/verification/results/pi-fixed-performance-20261101/scene0/summary.json、docs/verification/results/pi-fixed-performance-20261101/scene0-receipt.json、docs/verification/results/pi-fixed-performance-20261101/scene1/samples.jsonl、docs/verification/results/pi-fixed-performance-20261101/scene1/metadata.json、docs/verification/results/pi-fixed-performance-20261101/scene1/summary.json、docs/verification/results/pi-fixed-performance-20261101/scene1-receipt.json、docs/verification/results/pi-fixed-performance-20261101/scene2/samples.jsonl、docs/verification/results/pi-fixed-performance-20261101/scene2/metadata.json、docs/verification/results/pi-fixed-performance-20261101/scene2/summary.json、docs/verification/results/pi-fixed-performance-20261101/scene2-receipt.json、docs/verification/results/context-error-functional-release-20261101/source-change.json、docs/verification/results/pi-fixed-performance-20261101/README.md

限制：Native终态/OSgone证明本次ownedreap；未捏造3–6s延迟、abortACK或新listenercounts。；No persistedcompletedcompaction entry/eventpair；仅原assistant自然stop+distinctsummary模型调用和时序已证。Q1重启noReplay仍待后续，当前baseline16。

### MAC-QUIT-SAVE-RECOVERY-STALE-GLOBAL-ERROR-NATIVE-FAIL-001

macOS arm64 installed native release / exact frozen production source; controlled Pi protocol fixture / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Retained independent Q1+targeted native+10b/source/component review with exact build bindings; no rerun. SET007 specifically source-only, native unexecuted. / fail / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/components/Modal.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/processes/index.tsx、apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/settings.rs

步骤：Reuse independentlyaudited19Q1 and9targeteddelta originals/AX,16componentfiles/140sourcemap; do not recapture/retest. → Personally inspect16new10boriginals;5fullAX+8completeIDdiffs+3exactSHAAXreuses; verify22frozenartifacts/sourceindex/final17rowlog. → Bind oldQ1to12ed/8737→42567 andtargetedfix/cleanup toa78c/91087; retain historicalfailures andexactreplacementlinks. → Compose originalclauses from acceptednative/sourceevidence; retain SET007sourcegap andassignedfunctionalmergepoints.

旧12ed Q1恢复权限后实际Save47B/marker1、文件clean/Save禁用，但05-save-recovered与06-final-quit-impact原图/AX仍有全局“仍有文档未保存成功”；后者同时显示没有未保存文档。错误提示跨操作残留，不能当作真实磁盘保存仍失败。

证据：docs/verification/results/q1-credential-cleanup-composite-audit-20261101/audit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-hash-review.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-request17-body.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-delta-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-credential-tail.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-native-records.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/pi-final-frozen-batch.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/functional-candidate-remaining.md、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/set007-source-manifest.json、docs/verification/results/pi-10b-owner-20261101/00-static-scope.json、docs/verification/results/pi-10b-owner-20261101/01-native-fixed-preflight.json、docs/verification/results/pi-10b-owner-20261101/02-ax-setvalue-attempt.json、docs/verification/results/pi-10b-owner-20261101/03-paste-corrected-valid.json、docs/verification/results/pi-10b-owner-20261101/04-credential-cleared.json、docs/verification/results/pi-10b-owner-20261101/05-discard-i1.json、docs/verification/results/pi-10b-owner-20261101/06-two-copies-discarded.json、docs/verification/results/pi-10b-owner-20261101/07-A-history-preview.json、docs/verification/results/pi-10b-owner-20261101/08-A-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/09-B-history-preview.json、docs/verification/results/pi-10b-owner-20261101/10-B-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/11-fake-connection-deleted.json、docs/verification/results/pi-10b-owner-20261101/12-final-before-provider-stop.json、docs/verification/results/pi-10b-owner-20261101/13-provider-stopped.json、docs/verification/results/pi-10b-owner-20261101/14-launcher-join.json、docs/verification/results/pi-10b-owner-20261101/final-provider-control.jsonl、docs/verification/results/pi-10b-owner-20261101/final-provider-requests.jsonl、docs/verification/results/pi-10b-owner-20261101/final-source/A-index.snapshot、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/context.ts、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/example.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/removed-context.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-B-unborn/context.ts、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.ax.txt、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.jpg、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-manifest.jsonl、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.ax.txt、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.ax.txt、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.jpg、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.jpg、docs/verification/results/quit-credential-functional-release-20261101/bundle-identity.json、docs/verification/results/quit-credential-functional-release-20261101/installed-native-identity.json、docs/verification/results/quit-credential-functional-release-20261101/source-change.json、docs/verification/results/quit-credential-functional-release-20261101/components/manifest.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/result.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/source-sha.json、docs/verification/results/processes-terra-20261101/q1-1793535544818-evidence-freeze.json、docs/verification/results/quit-recovery-q1-20261101/process-owner-frozen-manifest.json、docs/verification/results/quit-recovery-q1-20261101/root-prequit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-postquit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-reopen-identity.json、docs/verification/results/pi-q1-owner-20261101/q1-original-frozen-batch.json、docs/verification/results/quit-credential-functional-native-20261101/quit-hint-owner-frozen-manifest.json、docs/verification/results/quit-credential-functional-native-20261101/root-targeted-review-and-input-observation.json

限制：Historicalactualnative failure; latera78c exactlocal-error retest separatelysupersedes.

### MAC-PI-SESSION-CREDENTIAL-EDIT-METADATA-NATIVE-FAIL-001

macOS arm64 installed native release / exact frozen production source; controlled Pi protocol fixture / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Retained independent Q1+targeted native+10b/source/component review with exact build bindings; no rerun. SET007 specifically source-only, native unexecuted. / fail / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/components/Modal.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/processes/index.tsx、apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/settings.rs

步骤：Reuse independentlyaudited19Q1 and9targeteddelta originals/AX,16componentfiles/140sourcemap; do not recapture/retest. → Personally inspect16new10boriginals;5fullAX+8completeIDdiffs+3exactSHAAXreuses; verify22frozenartifacts/sourceindex/final17rowlog. → Bind oldQ1to12ed/8737→42567 andtargetedfix/cleanup toa78c/91087; retain historicalfailures andexactreplacementlinks. → Compose originalclauses from acceptednative/sourceevidence; retain SET007sourcegap andassignedfunctionalmergepoints.

旧12ed同包新42567重开后，Fake编辑框静态ref显示已保存、保存方式硬默认系统钥匙串；同ID privacy真实本次会话·未配置且owner同ref sessionindex/ownedkeychain absent，已证expiry。编辑提示错误，不是secret仍持久化。

证据：docs/verification/results/q1-credential-cleanup-composite-audit-20261101/audit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-hash-review.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-request17-body.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-delta-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-credential-tail.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-native-records.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/pi-final-frozen-batch.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/functional-candidate-remaining.md、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/set007-source-manifest.json、docs/verification/results/pi-10b-owner-20261101/00-static-scope.json、docs/verification/results/pi-10b-owner-20261101/01-native-fixed-preflight.json、docs/verification/results/pi-10b-owner-20261101/02-ax-setvalue-attempt.json、docs/verification/results/pi-10b-owner-20261101/03-paste-corrected-valid.json、docs/verification/results/pi-10b-owner-20261101/04-credential-cleared.json、docs/verification/results/pi-10b-owner-20261101/05-discard-i1.json、docs/verification/results/pi-10b-owner-20261101/06-two-copies-discarded.json、docs/verification/results/pi-10b-owner-20261101/07-A-history-preview.json、docs/verification/results/pi-10b-owner-20261101/08-A-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/09-B-history-preview.json、docs/verification/results/pi-10b-owner-20261101/10-B-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/11-fake-connection-deleted.json、docs/verification/results/pi-10b-owner-20261101/12-final-before-provider-stop.json、docs/verification/results/pi-10b-owner-20261101/13-provider-stopped.json、docs/verification/results/pi-10b-owner-20261101/14-launcher-join.json、docs/verification/results/pi-10b-owner-20261101/final-provider-control.jsonl、docs/verification/results/pi-10b-owner-20261101/final-provider-requests.jsonl、docs/verification/results/pi-10b-owner-20261101/final-source/A-index.snapshot、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/context.ts、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/example.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/removed-context.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-B-unborn/context.ts、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.ax.txt、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.jpg、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-manifest.jsonl、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.ax.txt、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.ax.txt、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.jpg、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.jpg、docs/verification/results/quit-credential-functional-release-20261101/bundle-identity.json、docs/verification/results/quit-credential-functional-release-20261101/installed-native-identity.json、docs/verification/results/quit-credential-functional-release-20261101/source-change.json、docs/verification/results/quit-credential-functional-release-20261101/components/manifest.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/result.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/source-sha.json、docs/verification/results/processes-terra-20261101/q1-1793535544818-evidence-freeze.json、docs/verification/results/quit-recovery-q1-20261101/process-owner-frozen-manifest.json、docs/verification/results/quit-recovery-q1-20261101/root-prequit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-postquit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-reopen-identity.json、docs/verification/results/pi-q1-owner-20261101/q1-original-frozen-batch.json、docs/verification/results/quit-credential-functional-native-20261101/quit-hint-owner-frozen-manifest.json、docs/verification/results/quit-credential-functional-native-20261101/root-targeted-review-and-input-observation.json

限制：Historicalactualnative UI failure; no actualOAuthlogin orsecretread. Newa78c metadata-drivenlist/form separatelysupersedes.

### MAC-UNSAVED-SETTINGS-FORM-CLOSE-SOURCE-FAIL-001

macOS arm64 installed native release / exact frozen production source; controlled Pi protocol fixture / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 / Retained independent Q1+targeted native+10b/source/component review with exact build bindings; no rerun. SET007 specifically source-only, native unexecuted. / fail / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/components/Modal.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/processes/index.tsx、apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/settings.rs

步骤：Reuse independentlyaudited19Q1 and9targeteddelta originals/AX,16componentfiles/140sourcemap; do not recapture/retest. → Personally inspect16new10boriginals;5fullAX+8completeIDdiffs+3exactSHAAXreuses; verify22frozenartifacts/sourceindex/final17rowlog. → Bind oldQ1to12ed/8737→42567 andtargetedfix/cleanup toa78c/91087; retain historicalfailures andexactreplacementlinks. → Compose originalclauses from acceptednative/sourceevidence; retain SET007sourcegap andassignedfunctionalmergepoints.

a78c冻结源码实际缺口：PRD127要求未保存设置表单关闭可放弃/继续编辑；ConnectionForm本地draft的Modal onClose直接父setEditing(null)，App外层closeModal直接setModal(null)，未传SettingsPanel onDirtyChange/无launcherDraft上报。Launcher自有取消有window.confirm，但外层设置关闭/切分类未保护。准备中的修复尚未应用/验收。

证据：docs/verification/results/q1-credential-cleanup-composite-audit-20261101/audit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-hash-review.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-request17-body.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-delta-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-credential-tail.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-native-records.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/pi-final-frozen-batch.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/functional-candidate-remaining.md、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/set007-source-manifest.json、docs/verification/results/pi-10b-owner-20261101/00-static-scope.json、docs/verification/results/pi-10b-owner-20261101/01-native-fixed-preflight.json、docs/verification/results/pi-10b-owner-20261101/02-ax-setvalue-attempt.json、docs/verification/results/pi-10b-owner-20261101/03-paste-corrected-valid.json、docs/verification/results/pi-10b-owner-20261101/04-credential-cleared.json、docs/verification/results/pi-10b-owner-20261101/05-discard-i1.json、docs/verification/results/pi-10b-owner-20261101/06-two-copies-discarded.json、docs/verification/results/pi-10b-owner-20261101/07-A-history-preview.json、docs/verification/results/pi-10b-owner-20261101/08-A-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/09-B-history-preview.json、docs/verification/results/pi-10b-owner-20261101/10-B-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/11-fake-connection-deleted.json、docs/verification/results/pi-10b-owner-20261101/12-final-before-provider-stop.json、docs/verification/results/pi-10b-owner-20261101/13-provider-stopped.json、docs/verification/results/pi-10b-owner-20261101/14-launcher-join.json、docs/verification/results/pi-10b-owner-20261101/final-provider-control.jsonl、docs/verification/results/pi-10b-owner-20261101/final-provider-requests.jsonl、docs/verification/results/pi-10b-owner-20261101/final-source/A-index.snapshot、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/context.ts、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/example.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/removed-context.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-B-unborn/context.ts、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.ax.txt、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.jpg、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-manifest.jsonl、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.ax.txt、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.ax.txt、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.jpg、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.jpg、docs/verification/results/quit-credential-functional-release-20261101/bundle-identity.json、docs/verification/results/quit-credential-functional-release-20261101/installed-native-identity.json、docs/verification/results/quit-credential-functional-release-20261101/source-change.json、docs/verification/results/quit-credential-functional-release-20261101/components/manifest.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/result.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/source-sha.json、docs/verification/results/processes-terra-20261101/q1-1793535544818-evidence-freeze.json、docs/verification/results/quit-recovery-q1-20261101/process-owner-frozen-manifest.json、docs/verification/results/quit-recovery-q1-20261101/root-prequit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-postquit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-reopen-identity.json、docs/verification/results/pi-q1-owner-20261101/q1-original-frozen-batch.json、docs/verification/results/quit-credential-functional-native-20261101/quit-hint-owner-frozen-manifest.json、docs/verification/results/quit-credential-functional-native-20261101/root-targeted-review-and-input-observation.json、docs/product/PRD.md、docs/product/REQUIREMENTS.md

限制：SOURCE-ONLY failure confirmed by exacta78c source paths/callbacks; no oldbundle dirtyformX/Esc/native action executed.；Future.work patch/component/native notcounted; source snapshots frozen beforefuturecentralchanges.

### MAC-UNIFIED-QUIT-CANCEL-SAVEFAIL-REAP-REOPEN-COMPOSITE-001

macOS arm64 installed native release / exact frozen production source; controlled Pi protocol fixture / 12ed732bf4205d38ca54b7ccd640f099e869b13541455c8ba55c4a55b3d4af5d / Retained independent Q1+targeted native+10b/source/component review with exact build bindings; no rerun. SET007 specifically source-only, native unexecuted. / pass / full

实现：apps/desktop/src/App.tsx、apps/desktop/src/components/Modal.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/processes/index.tsx、apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/settings.rs

步骤：Reuse independentlyaudited19Q1 and9targeteddelta originals/AX,16componentfiles/140sourcemap; do not recapture/retest. → Personally inspect16new10boriginals;5fullAX+8completeIDdiffs+3exactSHAAXreuses; verify22frozenartifacts/sourceindex/final17rowlog. → Bind oldQ1to12ed/8737→42567 andtargetedfix/cleanup toa78c/91087; retain historicalfailures andexactreplacementlinks. → Compose originalclauses from acceptednative/sourceevidence; retain SET007sourcegap andassignedfunctionalmergepoints.

原12ed Q1真单dirty21B+PTY9823/API15626-child15627同组/Web15697/Pi21345；退出列唯一文档+4资源，Cancel及受控444/555保存失败后同6身份全活/盘21B。恢复700/600后一次Save47B/marker1，最终无dirty退出；root12个归属PID/start/birth逐一全gone，Web先API组、端口空。原同包重开42567/markers内容行数mtimehash全不变、资源0/Pi0/请求17不重放，47B恢复。旧提示另列失败并由a78c窄复验替代。结合既有关闭保恢复稿与AI006不支持任意TUI附着边界，关闭/退出原句闭合。

证据：docs/verification/results/q1-credential-cleanup-composite-audit-20261101/audit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-hash-review.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-request17-body.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-delta-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-credential-tail.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-native-records.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/pi-final-frozen-batch.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/functional-candidate-remaining.md、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/set007-source-manifest.json、docs/verification/results/pi-10b-owner-20261101/00-static-scope.json、docs/verification/results/pi-10b-owner-20261101/01-native-fixed-preflight.json、docs/verification/results/pi-10b-owner-20261101/02-ax-setvalue-attempt.json、docs/verification/results/pi-10b-owner-20261101/03-paste-corrected-valid.json、docs/verification/results/pi-10b-owner-20261101/04-credential-cleared.json、docs/verification/results/pi-10b-owner-20261101/05-discard-i1.json、docs/verification/results/pi-10b-owner-20261101/06-two-copies-discarded.json、docs/verification/results/pi-10b-owner-20261101/07-A-history-preview.json、docs/verification/results/pi-10b-owner-20261101/08-A-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/09-B-history-preview.json、docs/verification/results/pi-10b-owner-20261101/10-B-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/11-fake-connection-deleted.json、docs/verification/results/pi-10b-owner-20261101/12-final-before-provider-stop.json、docs/verification/results/pi-10b-owner-20261101/13-provider-stopped.json、docs/verification/results/pi-10b-owner-20261101/14-launcher-join.json、docs/verification/results/pi-10b-owner-20261101/final-provider-control.jsonl、docs/verification/results/pi-10b-owner-20261101/final-provider-requests.jsonl、docs/verification/results/pi-10b-owner-20261101/final-source/A-index.snapshot、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/context.ts、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/example.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/removed-context.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-B-unborn/context.ts、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.ax.txt、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.jpg、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-manifest.jsonl、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.ax.txt、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.ax.txt、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.jpg、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.jpg、docs/verification/results/quit-credential-functional-release-20261101/bundle-identity.json、docs/verification/results/quit-credential-functional-release-20261101/installed-native-identity.json、docs/verification/results/quit-credential-functional-release-20261101/source-change.json、docs/verification/results/quit-credential-functional-release-20261101/components/manifest.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/result.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/source-sha.json、docs/verification/results/processes-terra-20261101/q1-1793535544818-evidence-freeze.json、docs/verification/results/quit-recovery-q1-20261101/process-owner-frozen-manifest.json、docs/verification/results/quit-recovery-q1-20261101/root-prequit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-postquit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-reopen-identity.json、docs/verification/results/pi-q1-owner-20261101/q1-original-frozen-batch.json、docs/verification/results/quit-credential-functional-native-20261101/quit-hint-owner-frozen-manifest.json、docs/verification/results/quit-credential-functional-native-20261101/root-targeted-review-and-input-observation.json、docs/verification/results/editor-targeted-retest-audit/audit.json、docs/verification/results/pi-native-gui-audit/audit.json

限制：Q1actualall-resource chain only12ed; a78c frontendlocal-errorfix independentlyobserved, no secondfullQ1claimed.；No arbitraryTUI attachment support invented; laterpluginpolicywrites notprovedbyearlierQ1.

### MAC-QUIT-OPERATION-ERROR-LOCALITY-NATIVE-RETEST-001

macOS arm64 installed native release / exact frozen production source; controlled Pi protocol fixture / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 / Retained independent Q1+targeted native+10b/source/component review with exact build bindings; no rerun. SET007 specifically source-only, native unexecuted. / pass / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/components/Modal.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/processes/index.tsx、apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/settings.rs

步骤：Reuse independentlyaudited19Q1 and9targeteddelta originals/AX,16componentfiles/140sourcemap; do not recapture/retest. → Personally inspect16new10boriginals;5fullAX+8completeIDdiffs+3exactSHAAXreuses; verify22frozenartifacts/sourceindex/final17rowlog. → Bind oldQ1to12ed/8737→42567 andtargetedfix/cleanup toa78c/91087; retain historicalfailures andexactreplacementlinks. → Compose originalclauses from acceptednative/sourceevidence; retain SET007sourcegap andassignedfunctionalmergepoints.

a78c真实已知guard47B追加单hint未存，受控权限一次保存+退出只在当前dialog报错；Cancel后perfilePermissionDenied仍在、无global退出toast。恢复700/600后一次Save72B/SHA0b0d88/clean/SaveDisabled，新CmdQ没有未保存文档且无旧alert。真实App/Modal六状态组件还证明pending重试/新plan/Cancel/关闭仅清局部、独立global与perfile错误保留。仅精确替代旧退出提示残留反例。

证据：docs/verification/results/q1-credential-cleanup-composite-audit-20261101/audit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-hash-review.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-request17-body.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-delta-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-credential-tail.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-native-records.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/pi-final-frozen-batch.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/functional-candidate-remaining.md、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/set007-source-manifest.json、docs/verification/results/pi-10b-owner-20261101/00-static-scope.json、docs/verification/results/pi-10b-owner-20261101/01-native-fixed-preflight.json、docs/verification/results/pi-10b-owner-20261101/02-ax-setvalue-attempt.json、docs/verification/results/pi-10b-owner-20261101/03-paste-corrected-valid.json、docs/verification/results/pi-10b-owner-20261101/04-credential-cleared.json、docs/verification/results/pi-10b-owner-20261101/05-discard-i1.json、docs/verification/results/pi-10b-owner-20261101/06-two-copies-discarded.json、docs/verification/results/pi-10b-owner-20261101/07-A-history-preview.json、docs/verification/results/pi-10b-owner-20261101/08-A-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/09-B-history-preview.json、docs/verification/results/pi-10b-owner-20261101/10-B-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/11-fake-connection-deleted.json、docs/verification/results/pi-10b-owner-20261101/12-final-before-provider-stop.json、docs/verification/results/pi-10b-owner-20261101/13-provider-stopped.json、docs/verification/results/pi-10b-owner-20261101/14-launcher-join.json、docs/verification/results/pi-10b-owner-20261101/final-provider-control.jsonl、docs/verification/results/pi-10b-owner-20261101/final-provider-requests.jsonl、docs/verification/results/pi-10b-owner-20261101/final-source/A-index.snapshot、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/context.ts、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/example.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/removed-context.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-B-unborn/context.ts、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.ax.txt、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.jpg、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-manifest.jsonl、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.ax.txt、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.ax.txt、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.jpg、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.jpg、docs/verification/results/quit-credential-functional-release-20261101/bundle-identity.json、docs/verification/results/quit-credential-functional-release-20261101/installed-native-identity.json、docs/verification/results/quit-credential-functional-release-20261101/source-change.json、docs/verification/results/quit-credential-functional-release-20261101/components/manifest.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/result.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/source-sha.json、docs/verification/results/processes-terra-20261101/q1-1793535544818-evidence-freeze.json、docs/verification/results/quit-recovery-q1-20261101/process-owner-frozen-manifest.json、docs/verification/results/quit-recovery-q1-20261101/root-prequit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-postquit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-reopen-identity.json、docs/verification/results/pi-q1-owner-20261101/q1-original-frozen-batch.json、docs/verification/results/quit-credential-functional-native-20261101/quit-hint-owner-frozen-manifest.json、docs/verification/results/quit-credential-functional-native-20261101/root-targeted-review-and-input-observation.json

限制：Unrelatedi/ii z rawobservations retained; latestuserconfirmedconcurrentmanualtyping, menuUndo restoredexact72B withoutsavingunknowntext.；Component2543ms/rawexit0 iscontrolledsave/RPC, nativeactualpermission/save isseparateproof.

### MAC-PI-SESSION-RECOVERY-OWNERSHIP-COMPOSITE-001

macOS arm64 installed native release / exact frozen production source; controlled Pi protocol fixture / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 / Retained independent Q1+targeted native+10b/source/component review with exact build bindings; no rerun. SET007 specifically source-only, native unexecuted. / pass / full

实现：apps/desktop/src/App.tsx、apps/desktop/src/components/Modal.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/processes/index.tsx、apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/settings.rs

步骤：Reuse independentlyaudited19Q1 and9targeteddelta originals/AX,16componentfiles/140sourcemap; do not recapture/retest. → Personally inspect16new10boriginals;5fullAX+8completeIDdiffs+3exactSHAAXreuses; verify22frozenartifacts/sourceindex/final17rowlog. → Bind oldQ1to12ed/8737→42567 andtargetedfix/cleanup toa78c/91087; retain historicalfailures andexactreplacementlinks. → Compose originalclauses from acceptednative/sourceevidence; retain SET007sourcegap andassignedfunctionalmergepoints.

既有真实每项目单任务/全局至多2且显式第二个、I1隐藏/A→B→A同PID/session/ownedcwd/上下文、正常审查A/B/A与断连同session手动继续，加12ed固定双Pi逐帧身份/Q1同包重开请求17不重放；新a78c实际A8/B2项目范围清理只删核定Horizon记录及先显式放弃的两copy，旧9会话集合保留。两QA连接0/0影响预览后各一次删除，UI明确Pi自有认证/外部安装与历史保留，源码只处理Horizon自有路径。项目会话/恢复/删除边界原句组合闭合。

证据：docs/verification/results/q1-credential-cleanup-composite-audit-20261101/audit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-hash-review.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-request17-body.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-delta-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-credential-tail.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-native-records.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/pi-final-frozen-batch.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/functional-candidate-remaining.md、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/set007-source-manifest.json、docs/verification/results/pi-10b-owner-20261101/00-static-scope.json、docs/verification/results/pi-10b-owner-20261101/01-native-fixed-preflight.json、docs/verification/results/pi-10b-owner-20261101/02-ax-setvalue-attempt.json、docs/verification/results/pi-10b-owner-20261101/03-paste-corrected-valid.json、docs/verification/results/pi-10b-owner-20261101/04-credential-cleared.json、docs/verification/results/pi-10b-owner-20261101/05-discard-i1.json、docs/verification/results/pi-10b-owner-20261101/06-two-copies-discarded.json、docs/verification/results/pi-10b-owner-20261101/07-A-history-preview.json、docs/verification/results/pi-10b-owner-20261101/08-A-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/09-B-history-preview.json、docs/verification/results/pi-10b-owner-20261101/10-B-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/11-fake-connection-deleted.json、docs/verification/results/pi-10b-owner-20261101/12-final-before-provider-stop.json、docs/verification/results/pi-10b-owner-20261101/13-provider-stopped.json、docs/verification/results/pi-10b-owner-20261101/14-launcher-join.json、docs/verification/results/pi-10b-owner-20261101/final-provider-control.jsonl、docs/verification/results/pi-10b-owner-20261101/final-provider-requests.jsonl、docs/verification/results/pi-10b-owner-20261101/final-source/A-index.snapshot、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/context.ts、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/example.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/removed-context.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-B-unborn/context.ts、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.ax.txt、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.jpg、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-manifest.jsonl、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.ax.txt、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.ax.txt、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.jpg、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.jpg、docs/verification/results/quit-credential-functional-release-20261101/bundle-identity.json、docs/verification/results/quit-credential-functional-release-20261101/installed-native-identity.json、docs/verification/results/quit-credential-functional-release-20261101/source-change.json、docs/verification/results/quit-credential-functional-release-20261101/components/manifest.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/result.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/source-sha.json、docs/verification/results/processes-terra-20261101/q1-1793535544818-evidence-freeze.json、docs/verification/results/quit-recovery-q1-20261101/process-owner-frozen-manifest.json、docs/verification/results/quit-recovery-q1-20261101/root-prequit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-postquit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-reopen-identity.json、docs/verification/results/pi-q1-owner-20261101/q1-original-frozen-batch.json、docs/verification/results/quit-credential-functional-native-20261101/quit-hint-owner-frozen-manifest.json、docs/verification/results/quit-credential-functional-native-20261101/root-targeted-review-and-input-observation.json、docs/verification/results/pi-native-final/pi-native.json、docs/verification/results/pi0305-functional-audit-20261101/audit.json、docs/verification/results/pi-normal-write-disconnect-auth-audit-20261101/audit.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/audit.json

限制：ExternalglobalPi auth/history notread orpretended deleted; Horizon-ownedPi sessionfolders arewithinselectedcleanup.；No additionalmodelsend/thirdproject-suite oractualcommercialproviderlogin claimed.

### MAC-PI-CREDENTIAL-OWNERSHIP-SETTINGS-COMPOSITE-001

macOS arm64 installed native release / exact frozen production source; controlled Pi protocol fixture / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 / Retained independent Q1+targeted native+10b/source/component review with exact build bindings; no rerun. SET007 specifically source-only, native unexecuted. / pass / full

实现：apps/desktop/src/App.tsx、apps/desktop/src/components/Modal.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/processes/index.tsx、apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/settings.rs

步骤：Reuse independentlyaudited19Q1 and9targeteddelta originals/AX,16componentfiles/140sourcemap; do not recapture/retest. → Personally inspect16new10boriginals;5fullAX+8completeIDdiffs+3exactSHAAXreuses; verify22frozenartifacts/sourceindex/final17rowlog. → Bind oldQ1to12ed/8737→42567 andtargetedfix/cleanup toa78c/91087; retain historicalfailures andexactreplacementlinks. → Compose originalclauses from acceptednative/sourceevidence; retain SET007sourcegap andassignedfunctionalmergepoints.

既有真实keyring/安全引用与任务环境隔离、provider/协议/endpoint/model和全局配置/项目引用/删除影响；12ed固定Test12/13无项目文本，系统保存先configured再显式verified，同ref切session/rev2/旧systemitem absent且SDK14/15实际会话引用；Q1重开Privacy真session未配置。a78c新列表明确过期、编辑框blank+过期hint+仅本次应用会话，8paired16组件覆盖有效/过期/无ref/新建/双向scope无key拒绝。10b实际ordinarypaste/rev4变有效后仅1ref清理，两个QA连接各0/0预览删除、外部provider始终存活到owner最后显式停。Pi既有认证归属说明预览Cancel如实区分，不伪造OAuth登录。运行时/模型两层及检测/验证/运行分开，凭据归属原句组合闭合。

证据：docs/verification/results/q1-credential-cleanup-composite-audit-20261101/audit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-hash-review.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-request17-body.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-delta-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-credential-tail.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-native-records.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/pi-final-frozen-batch.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/functional-candidate-remaining.md、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/set007-source-manifest.json、docs/verification/results/pi-10b-owner-20261101/00-static-scope.json、docs/verification/results/pi-10b-owner-20261101/01-native-fixed-preflight.json、docs/verification/results/pi-10b-owner-20261101/02-ax-setvalue-attempt.json、docs/verification/results/pi-10b-owner-20261101/03-paste-corrected-valid.json、docs/verification/results/pi-10b-owner-20261101/04-credential-cleared.json、docs/verification/results/pi-10b-owner-20261101/05-discard-i1.json、docs/verification/results/pi-10b-owner-20261101/06-two-copies-discarded.json、docs/verification/results/pi-10b-owner-20261101/07-A-history-preview.json、docs/verification/results/pi-10b-owner-20261101/08-A-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/09-B-history-preview.json、docs/verification/results/pi-10b-owner-20261101/10-B-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/11-fake-connection-deleted.json、docs/verification/results/pi-10b-owner-20261101/12-final-before-provider-stop.json、docs/verification/results/pi-10b-owner-20261101/13-provider-stopped.json、docs/verification/results/pi-10b-owner-20261101/14-launcher-join.json、docs/verification/results/pi-10b-owner-20261101/final-provider-control.jsonl、docs/verification/results/pi-10b-owner-20261101/final-provider-requests.jsonl、docs/verification/results/pi-10b-owner-20261101/final-source/A-index.snapshot、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/context.ts、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/example.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/removed-context.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-B-unborn/context.ts、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.ax.txt、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.jpg、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-manifest.jsonl、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.ax.txt、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.ax.txt、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.jpg、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.jpg、docs/verification/results/quit-credential-functional-release-20261101/bundle-identity.json、docs/verification/results/quit-credential-functional-release-20261101/installed-native-identity.json、docs/verification/results/quit-credential-functional-release-20261101/source-change.json、docs/verification/results/quit-credential-functional-release-20261101/components/manifest.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/result.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/source-sha.json、docs/verification/results/processes-terra-20261101/q1-1793535544818-evidence-freeze.json、docs/verification/results/quit-recovery-q1-20261101/process-owner-frozen-manifest.json、docs/verification/results/quit-recovery-q1-20261101/root-prequit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-postquit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-reopen-identity.json、docs/verification/results/pi-q1-owner-20261101/q1-original-frozen-batch.json、docs/verification/results/quit-credential-functional-native-20261101/quit-hint-owner-frozen-manifest.json、docs/verification/results/quit-credential-functional-native-20261101/root-targeted-review-and-input-observation.json、docs/verification/results/settings-privacy-candidate7-audit/audit.json、docs/verification/results/pi-native-final/pi-native.json、docs/verification/results/pi-native-gui-audit/audit.json、docs/verification/results/pi-credential-fixed-performance-audit-20261101/audit.json

限制：Realcommercialvendor inference/actualOAuthlogin untested andseparatelydocumented; ownership/display clause doesnotrequirecreatinga realaccount/login.；FirstAXsetValue/rev3 didnotconfigureeffectivecredential; onlylaterauthorizedordinarypaste/rev4+freshPrivacy已配置 counts. No silentfirstattemptsuccess.；Credential component5603ms harnessselfreport/no separateexeccompletionreceipt; exact16filemanifest preservedinitiallocatorfailure.

### MAC-PI-SELECTIVE-CREDENTIAL-HISTORY-CLEAR-NATIVE-001

macOS arm64 installed native release / exact frozen production source; controlled Pi protocol fixture / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 / Retained independent Q1+targeted native+10b/source/component review with exact build bindings; no rerun. SET007 specifically source-only, native unexecuted. / pass / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/components/Modal.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/processes/index.tsx、apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/settings.rs

步骤：Reuse independentlyaudited19Q1 and9targeteddelta originals/AX,16componentfiles/140sourcemap; do not recapture/retest. → Personally inspect16new10boriginals;5fullAX+8completeIDdiffs+3exactSHAAXreuses; verify22frozenartifacts/sourceindex/final17rowlog. → Bind oldQ1to12ed/8737→42567 andtargetedfix/cleanup toa78c/91087; retain historicalfailures andexactreplacementlinks. → Compose originalclauses from acceptednative/sourceevidence; retain SET007sourcegap andassignedfunctionalmergepoints.

10b清理前Privacy同3d3/ref-f496本次会话·已配置，唯一勾选/1项预览确认后index0；两自有pendingcopy先各显式放弃/OS路径gone，再A8与B2各真实一次preview/clear，owner逐核QA10条路径/review清零，旧9会话集合保留。四QA源与Aindex原SHA不变；Fake/main两连接分别0默认/0历史影响预览删除，说明PiOAuth/外部Agent历史保留。请求17/Pi0，provider仅最后owner明确SIGTERM2344原start/argv/cwd、端口18763无listener、launcherjoin0。

证据：docs/verification/results/q1-credential-cleanup-composite-audit-20261101/audit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-hash-review.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-request17-body.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-delta-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-credential-tail.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-native-records.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/pi-final-frozen-batch.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/functional-candidate-remaining.md、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/set007-source-manifest.json、docs/verification/results/pi-10b-owner-20261101/00-static-scope.json、docs/verification/results/pi-10b-owner-20261101/01-native-fixed-preflight.json、docs/verification/results/pi-10b-owner-20261101/02-ax-setvalue-attempt.json、docs/verification/results/pi-10b-owner-20261101/03-paste-corrected-valid.json、docs/verification/results/pi-10b-owner-20261101/04-credential-cleared.json、docs/verification/results/pi-10b-owner-20261101/05-discard-i1.json、docs/verification/results/pi-10b-owner-20261101/06-two-copies-discarded.json、docs/verification/results/pi-10b-owner-20261101/07-A-history-preview.json、docs/verification/results/pi-10b-owner-20261101/08-A-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/09-B-history-preview.json、docs/verification/results/pi-10b-owner-20261101/10-B-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/11-fake-connection-deleted.json、docs/verification/results/pi-10b-owner-20261101/12-final-before-provider-stop.json、docs/verification/results/pi-10b-owner-20261101/13-provider-stopped.json、docs/verification/results/pi-10b-owner-20261101/14-launcher-join.json、docs/verification/results/pi-10b-owner-20261101/final-provider-control.jsonl、docs/verification/results/pi-10b-owner-20261101/final-provider-requests.jsonl、docs/verification/results/pi-10b-owner-20261101/final-source/A-index.snapshot、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/context.ts、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/example.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/removed-context.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-B-unborn/context.ts、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.ax.txt、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.jpg、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-manifest.jsonl、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.ax.txt、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.ax.txt、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.jpg、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.jpg、docs/verification/results/quit-credential-functional-release-20261101/bundle-identity.json、docs/verification/results/quit-credential-functional-release-20261101/installed-native-identity.json、docs/verification/results/quit-credential-functional-release-20261101/source-change.json、docs/verification/results/quit-credential-functional-release-20261101/components/manifest.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/result.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/source-sha.json、docs/verification/results/processes-terra-20261101/q1-1793535544818-evidence-freeze.json、docs/verification/results/quit-recovery-q1-20261101/process-owner-frozen-manifest.json、docs/verification/results/quit-recovery-q1-20261101/root-prequit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-postquit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-reopen-identity.json、docs/verification/results/pi-q1-owner-20261101/q1-original-frozen-batch.json、docs/verification/results/quit-credential-functional-native-20261101/quit-hint-owner-frozen-manifest.json、docs/verification/results/quit-credential-functional-native-20261101/root-targeted-review-and-input-observation.json

限制：Recoverydraftclear actions0; SET008仍需Q2尾实际精确清自有选中checkpoint；不把本批聊天/凭据当草稿清理。；No globalhistory/realcredentials/auth.json read ormanagedruntimeuninstall; no native大JSONfixture/newacceptancegate.

### MAC-Q1-ALL-OWNED-IDENTITIES-AND-INSTALLED-REOPEN-001

macOS arm64 installed native release / exact frozen production source; controlled Pi protocol fixture / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 / Retained independent Q1+targeted native+10b/source/component review with exact build bindings; no rerun. SET007 specifically source-only, native unexecuted. / pass / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/components/Modal.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/processes/index.tsx、apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/settings.rs

步骤：Reuse independentlyaudited19Q1 and9targeteddelta originals/AX,16componentfiles/140sourcemap; do not recapture/retest. → Personally inspect16new10boriginals;5fullAX+8completeIDdiffs+3exactSHAAXreuses; verify22frozenartifacts/sourceindex/final17rowlog. → Bind oldQ1to12ed/8737→42567 andtargetedfix/cleanup toa78c/91087; retain historicalfailures andexactreplacementlinks. → Compose originalclauses from acceptednative/sourceevidence; retain SET007sourcegap andassignedfunctionalmergepoints.

Q1 root12归属进程实际退出全gone，原installed12ed新42567恢复47B/无自动命令；a78c仅2frontend变更/138sources未变，rootrelease/DMGverify/ZIPextract/deepstrict/main相同/owned安装替换和91087实际启动回执齐。10b末Pi0与externalfixtureowner精确回收分开记录，产品未随退出/删连接误停外部服务。

证据：docs/verification/results/q1-credential-cleanup-composite-audit-20261101/audit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-hash-review.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-request17-body.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-delta-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-credential-tail.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-native-records.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/pi-final-frozen-batch.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/functional-candidate-remaining.md、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/set007-source-manifest.json、docs/verification/results/pi-10b-owner-20261101/00-static-scope.json、docs/verification/results/pi-10b-owner-20261101/01-native-fixed-preflight.json、docs/verification/results/pi-10b-owner-20261101/02-ax-setvalue-attempt.json、docs/verification/results/pi-10b-owner-20261101/03-paste-corrected-valid.json、docs/verification/results/pi-10b-owner-20261101/04-credential-cleared.json、docs/verification/results/pi-10b-owner-20261101/05-discard-i1.json、docs/verification/results/pi-10b-owner-20261101/06-two-copies-discarded.json、docs/verification/results/pi-10b-owner-20261101/07-A-history-preview.json、docs/verification/results/pi-10b-owner-20261101/08-A-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/09-B-history-preview.json、docs/verification/results/pi-10b-owner-20261101/10-B-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/11-fake-connection-deleted.json、docs/verification/results/pi-10b-owner-20261101/12-final-before-provider-stop.json、docs/verification/results/pi-10b-owner-20261101/13-provider-stopped.json、docs/verification/results/pi-10b-owner-20261101/14-launcher-join.json、docs/verification/results/pi-10b-owner-20261101/final-provider-control.jsonl、docs/verification/results/pi-10b-owner-20261101/final-provider-requests.jsonl、docs/verification/results/pi-10b-owner-20261101/final-source/A-index.snapshot、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/context.ts、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/example.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/removed-context.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-B-unborn/context.ts、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.ax.txt、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.jpg、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-manifest.jsonl、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.ax.txt、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.ax.txt、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.jpg、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.jpg、docs/verification/results/quit-credential-functional-release-20261101/bundle-identity.json、docs/verification/results/quit-credential-functional-release-20261101/installed-native-identity.json、docs/verification/results/quit-credential-functional-release-20261101/source-change.json、docs/verification/results/quit-credential-functional-release-20261101/components/manifest.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/result.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/source-sha.json、docs/verification/results/processes-terra-20261101/q1-1793535544818-evidence-freeze.json、docs/verification/results/quit-recovery-q1-20261101/process-owner-frozen-manifest.json、docs/verification/results/quit-recovery-q1-20261101/root-prequit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-postquit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-reopen-identity.json、docs/verification/results/pi-q1-owner-20261101/q1-original-frozen-batch.json、docs/verification/results/quit-credential-functional-native-20261101/quit-hint-owner-frozen-manifest.json、docs/verification/results/quit-credential-functional-native-20261101/root-targeted-review-and-input-observation.json

限制：No newlistener/subscription measurements,30minrepeat,20startupseries,offline/cleanmachine/upgrade-migration/publicdistributiontrust claim.；P1/R1 activepause/resource lifecycle andfuturepolicyreopen remainassignedexistingflows.

### MAC-LAYOUT-SESSION-SEPARATION-EXISTING-EVIDENCE-COMPOSITE-001

macOS arm64 installed native release / exact frozen production source; controlled Pi protocol fixture / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 / Retained independent Q1+targeted native+10b/source/component review with exact build bindings; no rerun. SET007 specifically source-only, native unexecuted. / pass / full

实现：apps/desktop/src/App.tsx、apps/desktop/src/components/Modal.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/processes/index.tsx、apps/desktop/src-tauri/src/agent.rs、apps/desktop/src-tauri/src/settings.rs、apps/desktop/src/features/settings/AppearanceProvider.tsx、packages/appearance/src/index.ts、apps/desktop/src/styles.css

步骤：Reuse independentlyaudited19Q1 and9targeteddelta originals/AX,16componentfiles/140sourcemap; do not recapture/retest. → Personally inspect16new10boriginals;5fullAX+8completeIDdiffs+3exactSHAAXreuses; verify22frozenartifacts/sourceindex/final17rowlog. → Bind oldQ1to12ed/8737→42567 andtargetedfix/cleanup toa78c/91087; retain historicalfailures andexactreplacementlinks. → Compose originalclauses from acceptednative/sourceevidence; retain SET007sourcegap andassignedfunctionalmergepoints.

组合既有真实globalgeometry/字体跨项目、divider拖动写全局首选、三个项目会话光标/标签/树/搜索恢复；50次与八布局非零scroll/Git草稿/View1-created1-destroyed0及UI011完整生命周期证据排除重建/模型发送。既有terminal hidden/focus/A-B返回同PTY/cwd，八main G04均有真实代码；当前App updatePanels仅merge focus字段，进入/退出只改focus，不改sidebar/AI/terminal可见flags或globalgeometry，hidden呈现后退出恢复原布局。原句按已接受native+直接源码闭合，无新增截图。

证据：docs/verification/results/q1-credential-cleanup-composite-audit-20261101/audit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-original-hash-review.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/q1-request17-body.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-delta-preaudit.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-native-first7-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/fix-credential-tail.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-native-records.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/10b-complete-ax-diffs.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/pi-final-frozen-batch.json、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/functional-candidate-remaining.md、docs/verification/results/q1-credential-cleanup-composite-audit-20261101/set007-source-manifest.json、docs/verification/results/pi-10b-owner-20261101/00-static-scope.json、docs/verification/results/pi-10b-owner-20261101/01-native-fixed-preflight.json、docs/verification/results/pi-10b-owner-20261101/02-ax-setvalue-attempt.json、docs/verification/results/pi-10b-owner-20261101/03-paste-corrected-valid.json、docs/verification/results/pi-10b-owner-20261101/04-credential-cleared.json、docs/verification/results/pi-10b-owner-20261101/05-discard-i1.json、docs/verification/results/pi-10b-owner-20261101/06-two-copies-discarded.json、docs/verification/results/pi-10b-owner-20261101/07-A-history-preview.json、docs/verification/results/pi-10b-owner-20261101/08-A-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/09-B-history-preview.json、docs/verification/results/pi-10b-owner-20261101/10-B-history-cleared.json、docs/verification/results/pi-10b-owner-20261101/11-fake-connection-deleted.json、docs/verification/results/pi-10b-owner-20261101/12-final-before-provider-stop.json、docs/verification/results/pi-10b-owner-20261101/13-provider-stopped.json、docs/verification/results/pi-10b-owner-20261101/14-launcher-join.json、docs/verification/results/pi-10b-owner-20261101/final-provider-control.jsonl、docs/verification/results/pi-10b-owner-20261101/final-provider-requests.jsonl、docs/verification/results/pi-10b-owner-20261101/final-source/A-index.snapshot、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/context.ts、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/example.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-A/removed-context.txt、docs/verification/results/pi-10b-owner-20261101/final-source/PiQA-B-unborn/context.ts、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.ax.txt、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.ax.txt、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-paste-saved.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-post-setvalue-privacy.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-01-fake-save-observed.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-02-credential-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-24c70f13.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-03-discard-9d735921.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-A-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-cleared.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-04-B-chat-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-fake-deleted.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-final-d01.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-delete-preview.jpg、docs/verification/screenshots/pi-10b-terra-20261101/10b-91087-1793539395072-05-main-deleted.jpg、docs/verification/results/pi-10b-terra-20261101/10b-91087-1793539395072-manifest.jsonl、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.ax.txt、docs/verification/results/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.ax.txt、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-edit.jpg、docs/verification/screenshots/quit-credential-functional-native-20261101/hint-91087-1793538478785-07-fake-expired-list.jpg、docs/verification/results/quit-credential-functional-release-20261101/bundle-identity.json、docs/verification/results/quit-credential-functional-release-20261101/installed-native-identity.json、docs/verification/results/quit-credential-functional-release-20261101/source-change.json、docs/verification/results/quit-credential-functional-release-20261101/components/manifest.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/result.json、docs/verification/results/quit-credential-functional-release-20261101/components/credential-metadata/source-sha.json、docs/verification/results/processes-terra-20261101/q1-1793535544818-evidence-freeze.json、docs/verification/results/quit-recovery-q1-20261101/process-owner-frozen-manifest.json、docs/verification/results/quit-recovery-q1-20261101/root-prequit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-postquit-identities.json、docs/verification/results/quit-recovery-q1-20261101/root-reopen-identity.json、docs/verification/results/pi-q1-owner-20261101/q1-original-frozen-batch.json、docs/verification/results/quit-credential-functional-native-20261101/quit-hint-owner-frozen-manifest.json、docs/verification/results/quit-credential-functional-native-20261101/root-targeted-review-and-input-observation.json、docs/verification/results/appearance-functional-native-audit-20261101/additional-audit.json、docs/verification/results/appearance-functional-native-audit-20261101/additional-audit.json、docs/verification/results/editor-targeted-retest-audit/audit.json、docs/verification/results/appearance-functional-native-audit-20261101/core-audit.json、docs/verification/results/appearance-main-native-tail-audit-20261101/audit.json、docs/verification/results/appearance-boundary-ui008-ui011-audit-20261101/audit.json、docs/verification/PROCESSES_GUI.md

限制：Existingcapturesretain originalbuilds; no newfocus native orvisualpass fabricated.；SeparateUI007区域尺寸原生拖动中Esc未执行/组件6阶段边界原样保留，非本条新增硬门槛。

### MAC-NARROW-QUICK-OPEN-NAME-NATIVE-FAIL-001

macOS arm64 installed native release; no Windows pass / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 / Independent retained original/AX/hash review and exact-owned Q1 persistence receipts; no rerun. / fail / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/components/UnsavedChanges.tsx、apps/desktop/src/components/Modal.tsx、apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/processes/index.tsx

步骤：Review only completed SET007/narrow segments, retaining ca71 source identity and all raw AX failures. → Reuse 2 previously reviewed originals; first-view 16 remaining images and complete AX differences. → Compare only owned saved Q1 before/after receipts; no live profile, GUI, OS sampler or model execution.

旧a78c/PID91087实际760px两帧：搜索按钮从宽窗具名变成AX“6 button”，收起侧栏后仍无名。原图/AX先前已独审，root源码确认缺aria-label且CSS隐藏文字。历史失败保留，由ca71同窄窗具名AX精确替代。

证据：docs/verification/results/settings-unsaved-native-audit-20261102/audit.json、docs/verification/results/settings-unsaved-native-audit-20261102/README.md、docs/verification/results/settings-unsaved-native-audit-20261102/native-settings-segments-frozen-manifest.jsonl、docs/verification/results/form-git-functional-release-20261102/bundle-identity.json、docs/verification/results/form-git-functional-release-20261102/source-change.json、docs/verification/results/form-git-functional-release-20261102/installed-native-identity.json、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-chinese-narrow.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-chinese-narrow.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-narrow-sidebar-collapsed.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-narrow-sidebar-collapsed.ax.txt、docs/verification/results/settings-unsaved-native-audit-20261102/historical-narrow-name-failure.json

限制：Historical name failure only; no new old-image view/test. Separate from Git nested modal and new confirmation AX failure.

### MAC-UNSAVED-FORM-CONFIRMATION-AX-NATIVE-FAIL-001

macOS arm64 installed native release; no Windows pass / ca71ca1125f994c19254f5b56866ac64fe3f5f023ab3d2a1784d7611e0f1811a / Independent retained original/AX/hash review and exact-owned Q1 persistence receipts; no rerun. / fail / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/components/UnsavedChanges.tsx、apps/desktop/src/components/Modal.tsx、apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/processes/index.tsx

步骤：Review only completed SET007/narrow segments, retaining ca71 source identity and all raw AX failures. → Reuse 2 previously reviewed originals; first-view 16 remaining images and complete AX differences. → Compare only owned saved Q1 before/after receipts; no live profile, GUI, OS sampler or model execution.

ca71连接Escape/Cancel与AppCmdQ的未保存确认在原图清楚可见，但三份完整AX仅HTMLroot/window/menu，同SHA446f57…fc4e00。root允许使用当次图坐标完成原定链，不计AX通过。Q1方案Done确认具名可读，失败只限真实观察条件。

证据：docs/verification/results/settings-unsaved-native-audit-20261102/audit.json、docs/verification/results/settings-unsaved-native-audit-20261102/README.md、docs/verification/results/settings-unsaved-native-audit-20261102/native-settings-segments-frozen-manifest.jsonl、docs/verification/results/form-git-functional-release-20261102/bundle-identity.json、docs/verification/results/form-git-functional-release-20261102/source-change.json、docs/verification/results/form-git-functional-release-20261102/installed-native-identity.json、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-escape-empty-ax.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-escape-empty-ax.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-cancel-confirm-empty-ax.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-cancel-confirm-empty-ax.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-cmdq-empty-ax.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-cmdq-empty-ax.ax.txt、docs/verification/results/settings-unsaved-native-audit-20261102/portal-design-and-initial-failure-review.json

限制：Portal后来仅源码集成，尚未新包原生复验；不声称根因已定。；SET007功能通过不覆盖本独立AX失败。

### MAC-UNSAVED-SETTINGS-FORM-SAVE-DISCARD-NATIVE-COMPOSITE-001

macOS arm64 installed native release; no Windows pass / ca71ca1125f994c19254f5b56866ac64fe3f5f023ab3d2a1784d7611e0f1811a / Independent retained original/AX/hash review and exact-owned Q1 persistence receipts; no rerun. / pass / full

实现：apps/desktop/src/App.tsx、apps/desktop/src/components/UnsavedChanges.tsx、apps/desktop/src/components/Modal.tsx、apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/processes/index.tsx

步骤：Review only completed SET007/narrow segments, retaining ca71 source identity and all raw AX failures. → Reuse 2 previously reviewed originals; first-view 16 remaining images and complete AX differences. → Compare only owned saved Q1 before/after receipts; no live profile, GUI, OS sampler or model execution.

ca71连接name/model草稿Escape/继续与CmdQ/继续后AX逐字节相同，Cancel/放弃只关闭草稿且外层设置/空连接保留，无Save/Test/Send。真实Q1方案名加后缀，Done/继续保留，Done/放弃后重开原名；同一1767B文件/profileId/rev1/完整对象等9项不变，SHA43b501…d8d5b08。最终编辑AX与before相同、Save禁用。组合既有即时偏好、连接/方案显式保存和有效性边界，闭合原功能句，只替代旧a78c SOURCE-ONLY关闭缺口。

证据：docs/verification/results/settings-unsaved-native-audit-20261102/audit.json、docs/verification/results/settings-unsaved-native-audit-20261102/README.md、docs/verification/results/settings-unsaved-native-audit-20261102/native-settings-segments-frozen-manifest.jsonl、docs/verification/results/form-git-functional-release-20261102/bundle-identity.json、docs/verification/results/form-git-functional-release-20261102/source-change.json、docs/verification/results/form-git-functional-release-20261102/installed-native-identity.json、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-draft-filled.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-draft-filled.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-escape-empty-ax.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-escape-empty-ax.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-escape-continue.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-escape-continue.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-cmdq-empty-ax.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-cmdq-empty-ax.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-cmdq-continue.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-cmdq-continue.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-cancel-confirm-empty-ax.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-cancel-confirm-empty-ax.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-draft-discarded.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-01-draft-discarded.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-02-q1-draft.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-02-q1-draft.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-02-q1-done-confirm.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-02-q1-done-confirm.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-02-q1-continue.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-02-q1-continue.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-02-q1-reopened-original.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-02-q1-reopened-original.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-before-narrow.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-before-narrow.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-restored.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-restored.ax.txt、docs/verification/results/settings-unsaved-native-audit-20261102/q1-owned-profile-before.json、docs/verification/results/settings-unsaved-native-audit-20261102/q1-owned-profile-after.json、docs/verification/results/form-git-functional-release-20261102/components/unsaved-cancel-type-20261102/after/apps/desktop/src/components/UnsavedChanges.tsx、docs/verification/results/form-git-functional-release-20261102/components/settings-unsaved-form-20261101/manifest.json

限制：段1确认AX为空单独归UI004 ACTIVE，不被本功能pass掩盖。；Validity composes previously accepted native/source/controlled boundaries; no new invalid-GUI/secret/model/Start/save claim.；Q1 requiredExtensions[] remains empty; no L1 plugin-preflight pass.；Later Portal/Windows source not bound to ca71 native.

### MAC-NARROW-AI-ONBOARDING-SEARCH-FOCUS-NATIVE-001

macOS arm64 installed native release; no Windows pass / ca71ca1125f994c19254f5b56866ac64fe3f5f023ab3d2a1784d7611e0f1811a / Independent retained original/AX/hash review and exact-owned Q1 persistence receipts; no rerun. / pass / partial

实现：apps/desktop/src/App.tsx、apps/desktop/src/components/UnsavedChanges.tsx、apps/desktop/src/components/Modal.tsx、apps/desktop/src/features/settings/SettingsPanel.tsx、apps/desktop/src/features/agent/AgentSettings.tsx、apps/desktop/src/features/processes/index.tsx

步骤：Review only completed SET007/narrow segments, retaining ca71 source identity and all raw AX failures. → Reuse 2 previously reviewed originals; first-view 16 remaining images and complete AX differences. → Compare only owned saved Q1 before/after receipts; no live profile, GUI, OS sampler or model execution.

ca71实际760×800，搜索图标AX名称“搜索文件或命令”在AI隐藏/打开均存在，精确修复旧a78c无名反例。无连接AI引导的配置/隐藏控制可见，无composer；一次F6从HTMLroot到工作区、ShiftF6到底部项目。隐藏AI、恢复1280侧栏后wholeAX逐字节同before，代码clean/SaveDisabled、空terminal与focusoff保留。

证据：docs/verification/results/settings-unsaved-native-audit-20261102/audit.json、docs/verification/results/settings-unsaved-native-audit-20261102/README.md、docs/verification/results/settings-unsaved-native-audit-20261102/native-settings-segments-frozen-manifest.jsonl、docs/verification/results/form-git-functional-release-20261102/bundle-identity.json、docs/verification/results/form-git-functional-release-20261102/source-change.json、docs/verification/results/form-git-functional-release-20261102/installed-native-identity.json、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-before-narrow.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-before-narrow.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-narrow-search.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-narrow-search.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-narrow-ai.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-narrow-ai.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-f6.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-f6.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-shift-f6.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-shift-f6.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-ai-hidden-narrow.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-ai-hidden-narrow.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-restored.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-03-restored.ax.txt

限制：Only no-connection onboarding; no composer input/send or full focus-region cycle fabricated.；Windows125/150 unverified; work/source not platform implementation pass.；Does not supersede confirmation AX or old Git nested failure.

### MAC-GIT-BRANCH-LIST-SAME-OID-NATIVE-FAIL-001

macOS arm64 retained installed-native/source composite; no Windows pass / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 / Independent original/AX/receipt review with exact historical builds; reuse old00–07 preaudits, no rerun. / fail / partial

实现：apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx、apps/desktop/src-tauri/src/git.rs、apps/git-service/src/lib.rs

步骤：Keep old native failures and precise supersession links; do not relabel old ordinary images as new builds. → Review new15 original/AX and15owner receipts including conservative post300s gate. → Compose only original requirement clauses from existing accepted evidence and actual new repairs.

旧a78c外部同OID切到gui/no-upstream后，底栏/Push源和无上游提示正确，但缓存列表仍main=current；已刷新截图不一致，真实失败保留。

证据：docs/verification/results/git-functional-composite-audit-20261102/audit.json、docs/verification/results/git-functional-composite-audit-20261102/README.md、docs/verification/results/git-functional-composite-audit-20261102/ordinary00-03-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/ordinary04-06-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-native-audit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-frozen-manifest.json、docs/verification/results/git-terra-20261101/git-91087-1793541773799-03-no-upstream-list-mismatch.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-03-no-upstream-list-mismatch.ax.txt、docs/verification/results/git-terra-20261101/owner/03-branch-cache-issue.json

限制：无另列限制

### MAC-GIT-WRITE-CONTROL-PROJECT-RETURN-NATIVE-FAIL-001

macOS arm64 retained installed-native/source composite; no Windows pass / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 / Independent original/AX/receipt review with exact historical builds; reuse old00–07 preaudits, no rerun. / fail / partial

实现：apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx、apps/desktop/src-tauri/src/git.rs、apps/git-service/src/lib.rs

步骤：Keep old native failures and precise supersession links; do not relabel old ordinary images as new builds. → Review new15 original/AX and15owner receipts including conservative post300s gate. → Compose only original requirement clauses from existing accepted evidence and actual new repairs.

旧a78c原write PGID25926仍活，NONREPO→CORE后原Stop丢失只剩停止读取。设置toggle和原modalStop未执行；后续安全Sleep四gone不能当Stop通过。

证据：docs/verification/results/git-functional-composite-audit-20261102/audit.json、docs/verification/results/git-functional-composite-audit-20261102/README.md、docs/verification/results/git-functional-composite-audit-20261102/ordinary00-03-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/ordinary04-06-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-native-audit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-frozen-manifest.json、docs/verification/results/git-terra-20261101/git-91087-1793541773799-04-return-only-reading.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-04-return-only-reading.ax.txt、docs/verification/results/git-terra-20261101/owner/04-native-failure-and-safe-cleanup.json

限制：无另列限制

### MAC-GIT-CLONE-ABSENT-TRASH-WORDING-NATIVE-FAIL-001

macOS arm64 retained installed-native/source composite; no Windows pass / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 / Independent original/AX/receipt review with exact historical builds; reuse old00–07 preaudits, no rerun. / fail / partial

实现：apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx、apps/desktop/src-tauri/src/git.rs、apps/git-service/src/lib.rs

步骤：Keep old native failures and precise supersession links; do not relabel old ordinary images as new builds. → Review new15 original/AX and15owner receipts including conservative post300s gate. → Compose only original requirement clauses from existing accepted evidence and actual new repairs.

旧a78c慢clone停止后Git已自行删目标，清理确认仅marker幂等，却显示“残留目录已移到废纸篓”。保留真实错误文案，未发生目录Trash。

证据：docs/verification/results/git-functional-composite-audit-20261102/audit.json、docs/verification/results/git-functional-composite-audit-20261102/README.md、docs/verification/results/git-functional-composite-audit-20261102/ordinary00-03-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/ordinary04-06-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-native-audit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-frozen-manifest.json、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-cleanup-preview.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-cleanup-preview.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-cleanup-result.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-cleanup-result.ax.txt、docs/verification/results/git-terra-20261101/owner/06-cleanup-integrity.json

限制：无另列限制

### MAC-GIT-DETECTION-STAGED-HISTORY-NATIVE-001

macOS arm64 retained installed-native/source composite; no Windows pass / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 / Independent original/AX/receipt review with exact historical builds; reuse old00–07 preaudits, no rerun. / pass / partial

实现：apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx、apps/desktop/src-tauri/src/git.rs、apps/git-service/src/lib.rs

步骤：Keep old native failures and precise supersession links; do not relabel old ordinary images as new builds. → Review new15 original/AX and15owner receipts including conservative post300s gate. → Compose only original requirement clauses from existing accepted evidence and actual new repairs.

a78c实际无效Git路径→OS2/旧快照stale且禁写→有效git2.50.1与刷新恢复；非仓库明确且不init。仅tracked暂存的一次commit产生aed9d6978、index空/原盘和远端不变，同选中diff立即清空。长历史/删除文件只读与引用方向清楚。

证据：docs/verification/results/git-functional-composite-audit-20261102/audit.json、docs/verification/results/git-functional-composite-audit-20261102/README.md、docs/verification/results/git-functional-composite-audit-20261102/ordinary00-03-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/ordinary04-06-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-native-audit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-frozen-manifest.json、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01a-invalid-detect.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01a-invalid-detect.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01a-invalid-stale.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01a-invalid-stale.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01a-git-restored.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01a-git-restored.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01a-nonrepo.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01a-nonrepo.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-history-deleted.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-history-deleted.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-03-staged-before-commit.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-03-staged-before-commit.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-03-commit-staged-diff-cleared.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-03-commit-staged-diff-cleared.ax.txt

限制：git.path immediate prewrite raw presence UNKNOWN; rev31 absence is historical, not immediate. Effective git restored, no speculative reset.；Git disabled/no-refresh remains assigned P1; no full GIT001.

### MAC-GIT-DIFF-REBASE-EXISTING-COMPOSITE-001

macOS arm64 retained installed-native/source composite; no Windows pass / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 ordinary00–07; ca71ca1125f994c19254f5b56866ac64fe3f5f023ab3d2a1784d7611e0f1811a targeted03/04/source; prior accepted builds retained / Independent original/AX/receipt review with exact historical builds; reuse old00–07 preaudits, no rerun. / pass / full

实现：apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx、apps/desktop/src-tauri/src/git.rs、apps/git-service/src/lib.rs

步骤：Keep old native failures and precise supersession links; do not relabel old ordinary images as new builds. → Review new15 original/AX and15owner receipts including conservative post300s gate. → Compose only original requirement clauses from existing accepted evidence and actual new repairs.

既有真实A→B已暂存/B→C磁盘与dirty D隔离、删除/改名/二进制/大diff，加a78c中文空格未跟踪新行从1、并排index→disk、760自动行内且收浮层后三行可读，闭合差异原句。既有冲突手动保存→明确暂存与残标记拒绝，加真实rebase当前stage2目标/传入stage3重放、磁盘原标记保留和外部继续/中止说明，闭合冲突原句。

证据：docs/verification/results/git-functional-composite-audit-20261102/audit.json、docs/verification/results/git-functional-composite-audit-20261102/README.md、docs/verification/results/git-functional-composite-audit-20261102/ordinary00-03-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/ordinary04-06-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-native-audit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-frozen-manifest.json、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-chinese-inline.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-chinese-inline.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-chinese-side-by-side.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-chinese-side-by-side.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-chinese-narrow.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-chinese-narrow.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-narrow-sidebar-collapsed.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-narrow-sidebar-collapsed.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-rebase-conflict.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-rebase-conflict.ax.txt

限制：Rebase card is preview only, not a new adopt/resolve/continue/abort run; prior actual merge workflow retained.；No visual-reference pass or old successful workflow rerun.

### MAC-GIT-BRANCH-LIST-SAME-OID-NATIVE-RETEST-001

macOS arm64 retained installed-native/source composite; no Windows pass / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 ordinary00–07; ca71ca1125f994c19254f5b56866ac64fe3f5f023ab3d2a1784d7611e0f1811a targeted03/04/source; prior accepted builds retained / Independent original/AX/receipt review with exact historical builds; reuse old00–07 preaudits, no rerun. / pass / partial

实现：apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx、apps/desktop/src-tauri/src/git.rs、apps/git-service/src/lib.rs

步骤：Keep old native failures and precise supersession links; do not relabel old ordinary images as new builds. → Review new15 original/AX and15owner receipts including conservative post300s gate. → Compose only original requirement clauses from existing accepted evidence and actual new repairs.

ca71在同一已打开同步框，外部main→QA同AED9 OID切换后正常自动刷新：QA为唯一current/无上游/Push源正确；回main同框自动恢复。空remote禁三操作；空target禁pull/push而fetch可用；显式origin/main预览正确，无远端动作。精确替代旧缓存分支错标。

证据：docs/verification/results/git-functional-composite-audit-20261102/audit.json、docs/verification/results/git-functional-composite-audit-20261102/README.md、docs/verification/results/git-functional-composite-audit-20261102/ordinary00-03-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/ordinary04-06-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-native-audit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-frozen-manifest.json、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-main-before.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-main-before.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-auto-updated.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-auto-updated.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-remote-empty.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-remote-empty.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-target-empty.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-target-empty.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-target-main-keyboard.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-target-main-keyboard.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-main-restored.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-main-restored.ax.txt

限制：External owned fixture switch, not product branch-switch under dirty-index conditions.；No modal remount/manual refresh per operator chronology; no exact auto-refresh latency claim.；Tab only target→fetch→dialog; pull/push keyboard reach not proven.

### MAC-GIT-BRANCH-REMOTE-SAFETY-COMPOSITE-001

macOS arm64 retained installed-native/source composite; no Windows pass / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 ordinary00–07; ca71ca1125f994c19254f5b56866ac64fe3f5f023ab3d2a1784d7611e0f1811a targeted03/04/source; prior accepted builds retained / Independent original/AX/receipt review with exact historical builds; reuse old00–07 preaudits, no rerun. / pass / full

实现：apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx、apps/desktop/src-tauri/src/git.rs、apps/git-service/src/lib.rs

步骤：Keep old native failures and precise supersession links; do not relabel old ordinary images as new builds. → Review new15 original/AX and15owner receipts including conservative post300s gate. → Compose only original requirement clauses from existing accepted evidence and actual new repairs.

组合既有真实新分支起点/切换/脏盘拒绝、18集成dirty-switch与锁所有权不改，加ca71编译源dirty_documents对switch/pull/create+switch拒RESOURCE_BUSY，及a78c同名HEAD创建失败保可编辑输入/原refs-index-disk-stash。既有真实fetch/ffOnly pull/push与系统Git认证，加nonFF一次Push简短错误/详情/Later且无force或auto动作、ca71无上游remote/target明确门，失败原改动与47B/auth表单保留；按原句组合闭合。

证据：docs/verification/results/git-functional-composite-audit-20261102/audit.json、docs/verification/results/git-functional-composite-audit-20261102/README.md、docs/verification/results/git-functional-composite-audit-20261102/ordinary00-03-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/ordinary04-06-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-native-audit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-frozen-manifest.json、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-existing-branch-failure.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-existing-branch-failure.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-02-nonff-rejected.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-02-nonff-rejected.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-02-nonff-details.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-02-nonff-details.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-02-later-return.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-02-later-return.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-remote-empty.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-remote-empty.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-target-empty.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-target-empty.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-target-main-keyboard.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git03-target-main-keyboard.ax.txt、docs/verification/results/git-functional-composite-audit-20261102/dirty-buffer-guard-ca71-derived-excerpt.json

限制：Dirty-buffer guard is historical source plus retained production integration/dirty-state evidence, not a new native dirty-switch action.；Local owned remotes and controlled401; no real commercial credential login claimed.；Not a UI004 full-keyboard pass.

### MAC-GIT-TRASH-RECOVERY-NATIVE-RETEST-001

macOS arm64 retained installed-native/source composite; no Windows pass / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 / Independent original/AX/receipt review with exact historical builds; reuse old00–07 preaudits, no rerun. / pass / full

实现：apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx、apps/desktop/src-tauri/src/git.rs、apps/git-service/src/lib.rs

步骤：Keep old native failures and precise supersession links; do not relabel old ordinary images as new builds. → Review new15 original/AX and15owner receipts including conservative post300s gate. → Compose only original requirement clauses from existing accepted evidence and actual new repairs.

既有tracked恢复index保留暂存/dirty先处理，加a78c单层清单明确仅owned65B未跟踪文件与后果、默认Cancel，一次Cancel保留再一次确认。原路径消失，Finder废纸篓实际选中同名65B并复制owned恢复目录、原SHA35c7…1ad71f精确相同，其他文件/refs/index/remote/stash保留。精确替代旧Trash超时失败。

证据：docs/verification/results/git-functional-composite-audit-20261102/audit.json、docs/verification/results/git-functional-composite-audit-20261102/README.md、docs/verification/results/git-functional-composite-audit-20261102/ordinary00-03-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/ordinary04-06-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-native-audit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-frozen-manifest.json、docs/verification/results/git-terra-20261101/git-91087-1793541773799-05-trash-preview.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-05-trash-preview.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-05-trash-cancel.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-05-trash-cancel.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-05-trash-result.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-05-trash-result.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-05-finder-trash-selected.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-05-finder-trash-selected.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-05-finder-recovered.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-05-finder-recovered.ax.txt

限制：Recovery is allowed Finder copy, not PutBack. Fast Trash does not claim busyStop; no injected delay.

### MAC-GIT-WRITE-STOP-SETTINGS-SESSION-COMPOSITE-001

macOS arm64 retained installed-native/source composite; no Windows pass / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 ordinary00–07; ca71ca1125f994c19254f5b56866ac64fe3f5f023ab3d2a1784d7611e0f1811a targeted03/04/source; prior accepted builds retained / Independent original/AX/receipt review with exact historical builds; reuse old00–07 preaudits, no rerun. / pass / full

实现：apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx、apps/desktop/src-tauri/src/git.rs、apps/git-service/src/lib.rs

步骤：Keep old native failures and precise supersession links; do not relabel old ordinary images as new builds. → Review new15 original/AX and15owner receipts including conservative post300s gate. → Compose only original requirement clauses from existing accepted evidence and actual new repairs.

Git设置真实路径/差异/刷新来源、fetch默认off、local/local身份与ffOnly，加ca71运行中仅autoRefresh项目off→恢复应用默认，rev49→51项目/全局键均恢复缺省且原PGID1890四身份不变。NONREPO返回仍有write Stop/草稿；modalStop一次后首帧“任务已停止，操作结果需要核对”，四原身份gone，无owner信号。13门与保守300秒后11门证明无迟到提交，HEAD/index/6文件/refs/remote/stash保留，hook同hash移除；postrefresh AX同before。结合既有Search/Editor时间-stale/取消/基线拒绝及三项目编辑状态、Pi会话/审查隔离，闭合渐进状态与WS005仅余Git草稿原条件。

证据：docs/verification/results/git-functional-composite-audit-20261102/audit.json、docs/verification/results/git-functional-composite-audit-20261102/README.md、docs/verification/results/git-functional-composite-audit-20261102/ordinary00-03-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/ordinary04-06-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-native-audit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-frozen-manifest.json、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-before-start.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-before-start.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-busy-start.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-busy-start.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-return-write-stop.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-return-write-stop.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-auto-refresh-off.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-auto-refresh-off.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-auto-refresh-restored.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-auto-refresh-restored.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-sync-modal-busy.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-sync-modal-busy.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-modal-stop-terminal.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-modal-stop-terminal.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-stopped-staged-retained.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-stopped-staged-retained.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-post-refresh.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-post-refresh.ax.txt

限制：No stopping intermediate or exact exit latency observed; OUTCOME_UNKNOWN outcome-needs-review is the actual first terminal, not fabricated cancelled/success.；TaskHandle identifier not exposed; exact OS birth/chain/cwd and realStop substantiate ownership.；No new three-project model suite, five-minute wait or old Search rerun.

### MAC-GIT-CLONE-CANCEL-AUTH-PICKER-COMPOSITE-001

macOS arm64 retained installed-native/source composite; no Windows pass / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 ordinary00–07; ca71ca1125f994c19254f5b56866ac64fe3f5f023ab3d2a1784d7611e0f1811a targeted03/04/source; prior accepted builds retained / Independent original/AX/receipt review with exact historical builds; reuse old00–07 preaudits, no rerun. / pass / full

实现：apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx、apps/desktop/src-tauri/src/git.rs、apps/git-service/src/lib.rs

步骤：Keep old native failures and precise supersession links; do not relabel old ordinary images as new builds. → Review new15 original/AX and15owner receipts including conservative post300s gate. → Compose only original requirement clauses from existing accepted evidence and actual new repairs.

a78c真实已有目录拒绝保47B、401后Keep/Edit保URL/parent/name；慢clone一次Stop四精确身份gone，目标Git自删后单层Cancel/Confirm仅本次marker清理。唯一成功Wclone15:38:30后注册，HEAD742ba…d775/clean/marker-scripts原hash、无execution marker/node_modules；父目录由原产品按钮fresh helper/GoTo/匹配AX/Open返回，操作者仅补充既有事实。ca71冻结CloneForm两literal修正为条件目录提示与“克隆残留已清理”，与已执行原流程组合，不补造目录移动或重复clone。

证据：docs/verification/results/git-functional-composite-audit-20261102/audit.json、docs/verification/results/git-functional-composite-audit-20261102/README.md、docs/verification/results/git-functional-composite-audit-20261102/ordinary00-03-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/ordinary04-06-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-native-audit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-frozen-manifest.json、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-existing-rejected.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-existing-rejected.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-auth-failure.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-auth-failure.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-auth-editable.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-auth-editable.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-slow-busy.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-slow-busy.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-slow-stopped.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-slow-stopped.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-cleanup-preview.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-cleanup-preview.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-cleanup-result.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-cleanup-result.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-success-clone.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-success-clone.ax.txt、docs/verification/results/git-terra-20261101/owner/06-parent-picker-operator-clarification.json、docs/verification/results/form-git-functional-release-20261102/components/clone-cleanup-wording-20261101/manifest.json、docs/verification/results/form-git-functional-release-20261102/components/clone-cleanup-wording-20261101/source.patch、docs/verification/results/form-git-functional-release-20261102/components/clone-cleanup-wording-20261101/CloneForm.tsx

限制：W-picker selection has operator clarification, no independently saved picker panel/AX or exact Open UTC; upper bound only before15:38:30.127Z. Final field is not relabeled independent Open proof.；Cancelled directory was already absent; actual directory-to-Trash unobserved, not claimed from65B file case.；ca71 wording proof is frozen two-literal source/release plus old actual flow, not a new ca71 clone run.

### MAC-GIT-SINGLE-MODAL-FOCUS-NATIVE-RETEST-001

macOS arm64 retained installed-native/source composite; no Windows pass / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 ordinary00–07; ca71ca1125f994c19254f5b56866ac64fe3f5f023ab3d2a1784d7611e0f1811a targeted03/04/source; prior accepted builds retained / Independent original/AX/receipt review with exact historical builds; reuse old00–07 preaudits, no rerun. / pass / partial

实现：apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx、apps/desktop/src-tauri/src/git.rs、apps/git-service/src/lib.rs

步骤：Keep old native failures and precise supersession links; do not relabel old ordinary images as new builds. → Review new15 original/AX and15owner receipts including conservative post300s gate. → Compose only original requirement clauses from existing accepted evidence and actual new repairs.

a78c引用比较只有一个可读Modal、close焦点明确；Esc后Tab落History toggle。Clone清理在同一Modal替换内容，Cancel默认焦点并可返回再确认。ca71同步busyModal Stop具名可读/关闭禁用，终态后可正常关闭。精确替代旧Git嵌套AX空失败，不覆盖新未保存确认AX失败。

证据：docs/verification/results/git-functional-composite-audit-20261102/audit.json、docs/verification/results/git-functional-composite-audit-20261102/README.md、docs/verification/results/git-functional-composite-audit-20261102/ordinary00-03-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/ordinary04-06-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-native-audit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-frozen-manifest.json、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-ref-compare.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-ref-compare.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-compare-escape-focus.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-01b-compare-escape-focus.ax.txt、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-cleanup-preview.jpg、docs/verification/results/git-terra-20261101/git-91087-1793541773799-06-cleanup-preview.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-sync-modal-busy.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-sync-modal-busy.ax.txt、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-modal-stop-terminal.jpg、docs/verification/results/form-git-functional-native-20261102/form-41657-1793549150155-git04-modal-stop-terminal.ax.txt

限制：No claim pull/push keyboard focus; target Tab reachedfetch then dialog only.；MAC-UNSAVED-FORM-CONFIRMATION-AX-NATIVE-FAIL-001 remains active; Portal newsource unproven.

### MAC-GIT-2000-LINE-FIXED-RESOURCE-NATIVE-001

macOS arm64 retained installed-native/source composite; no Windows pass / a78cfd8a5523562d6252de96e7ddbaf4af56bdd1c4b46f1eddfbf4bad4365d27 / Independent original/AX/receipt review with exact historical builds; reuse old00–07 preaudits, no rerun. / pass / partial

实现：apps/desktop/src/features/git/GitPanel.tsx、apps/desktop/src/features/git/CloneForm.tsx、apps/desktop/src-tauri/src/git.rs、apps/git-service/src/lib.rs

步骤：Keep old native failures and precise supersession links; do not relabel old ordinary images as new builds. → Review new15 original/AX and15owner receipts including conservative post300s gate. → Compose only original requirement clauses from existing accepted evidence and actual new repairs.

a78c installed真实10文件/2000总差异行、仅review00显示，125.0082秒117raw，root+6常驻helpers全行rusage有效且无missingroot；两行短horizon-git/git在ps/rusage间退出保wholefootprint/CPU null。完整115/117、post60完整59/61跨64.5904秒；footprint median226710472/稳态227038152B、P95227169224/max227218376B；CPUmean0.417673/0.420471%单核，逐行归属/汇总独核一致。

证据：docs/verification/results/git-functional-composite-audit-20261102/audit.json、docs/verification/results/git-functional-composite-audit-20261102/README.md、docs/verification/results/git-functional-composite-audit-20261102/ordinary00-03-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/ordinary04-06-preaudit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-native-audit.json、docs/verification/results/git-functional-composite-audit-20261102/target03-04-frozen-manifest.json、docs/verification/results/git-functional-composite-audit-20261102/fixed07-performance-audit.json、docs/verification/results/git-fixed-performance-20261101/receipt.json、docs/verification/results/git-fixed-performance-20261101/collector.log、docs/verification/results/git-fixed-performance-20261101/members.json、docs/verification/results/git-fixed-performance-20261101/plugin-state.json、docs/verification/results/git-fixed-performance-20261101/root-pre-sample-processes.json、docs/verification/results/git-fixed-performance-20261101/native-export/horizon-diagnostics.json、docs/verification/results/git-fixed-performance-20261101/scene/metadata.json、docs/verification/results/git-fixed-performance-20261101/scene/samples.jsonl、docs/verification/results/git-fixed-performance-20261101/scene/summary.json、docs/verification/results/git-fixed-performance-20261101/scene/cycle-output.log

限制：Git自动刷新开；preF09 active0不叫全程Git0。两个短进程峰未采到，不填0/不裁掉/不宣称全生命周期峰。；RSS另报，不是private memory或nullfootprint替代。不是alloff-host200MB/20coldstarts/新版ca71资源采样。

