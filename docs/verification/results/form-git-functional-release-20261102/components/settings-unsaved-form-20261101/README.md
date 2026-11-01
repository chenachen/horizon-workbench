# SET007 / PRD127 — PREPARED ONLY

候选只在本目录，未写产品源码、构建/安装或操作原生 GUI。`manifest.json` 是交接入口：列完整源码 SHA、原始运行回执及最终候选对既有组件证据的精确继承依据。`source.patch` 仅含 5 文件。

- App 汇总 SettingsPanel / ConnectionForm / LauncherPanel 的表单 dirty 与保存 busy，保护完成、X/Esc、插件/恢复导航、项目切换导致的 launcher draft 清除，以及 prepareStop 导致的设置卸载。
- SettingsPanel 接已有 dirty；新组合名称加入 dirty；快捷键冲突保存成功后才清草稿，失败保留。项目切换取消用 `cancelled` 返回，继续编辑不误报激活失败。仅 `formDirty && busy` 阻止拆表单；普通设置 busy 不扩拦。
- ConnectionForm 对初值逐字段比较；API key 只以非空判 dirty，不进入比较快照/存储。X/Esc/取消提供继续编辑/放弃；校验、保存失败保字段和 key，成功后清 key 并关闭。新 connectionId 在组件生命周期内稳定，失败重试沿用该 id。
- LauncherPanel 与同 id 已保存 profile 比较实际内容；新建/导入未保存方案为 dirty。共享取消与外关闭使用同 dirty；已有方案未改直接关闭，改后继续保稿，还原内容后直接取消。busy 只随存在的表单汇总，无 draft 的 Detect 不扩拦。
- 新 `UnsavedChanges.tsx` 仅供这些表单使用，复用现有 Modal；确认层 X/Esc 等价“继续编辑”，阻断向父层传播。默认焦点为继续编辑，无新 CSS、backend、导航框架或持久化草稿。

AI/launcher 分类访问后用 `hidden` 保留，切分类不提示；preset/shortcut 状态也保留。其已有显式局部取消语义保持。放弃只关闭相应表单/执行原导航，不调用配置写入或清 editor buffer；已即时生效的偏好保持。

保存按原显式操作调用 `credential_set` 后再保存 connection；本次不把此前成功的 credential 写入称作回滚。失败保内存 draft，放弃本身不追加保存或删除凭据。

## 组件证据

真实 App/DesktopShell、SettingsPanel、AppearanceProvider/useSettings、AgentSettings/ConnectionForm、LauncherPanel/useLauncher、Modal、ErrorNotice、bridge。隔离 Tauri IPC/事件、插件服务/插件中心、Agent store 列表刷新、恢复面板与 editor store。编辑器用受控 dirty buffer sentinel 核无误清/误保存；不冒充重新验证真实磁盘保存。仅使用无效合成 key；报告脱敏，local/session storage 未出现该 key，未发模型请求。

10 组 before/after 用户可见路径：连接 X/Esc/取消；外层完成/X/Esc与分类保留；插件/恢复导航；组合名称与快捷键失败；连接 scope 校验与保存失败/key 重试；连接保存 busy；方案取消/失败/busy；切项目取消及 quit；无 draft settings 进入原退出计划/局部退出错误不串全局/Cancel新计划重置；已有方案 clean/dirty/还原及无 draft Detect busy。

before 的 passed 表示预期旧行为被观察到（其中原退出局部错误及分类保留本已正确），**不表示旧产品满足未保存表单契约**。after 对候选断言成立；不是原生通过。

原始报告保持不变：

1. `attempt-01/result.json`：旧版9组、候选前3组通过；第4组采集器只看首个 error 标题，实际文本仍有快捷键冲突，未正确读取它。
2. `attempt-02/result.json`：仅继续候选第4–6组通过；第7组局部/全局同文案使 Playwright 定位不唯一。
3. `attempt-03/result.json`：仅继续候选第7–9组通过；该目录另存首轮已测候选 `source.patch` / `source-sha.json`，可结合完整 before 重建，旧报告未改。
4. `attempt-04/result.json`：Launcher 内容比较收窄后的3 states通过，独立绑定其 hash；同目录保该次 patch/hash/脚本。
5. 当前 `result.json`：最终 `saving && !!draft` 收窄、补无 draft Detect 关闭后，Launcher3 states通过，6917ms。没有重跑连接等无关组。

最终 App/SettingsPanel/AgentSettings/共享 hook 与首轮已测版本 SHA 相同。只有 processes 的 dirty 比较与无 draft busy 规则收窄；原先新建 draft 组仍走 revision=0 的相同 dirty 分支，且最终 Launcher组另有直接复核。具体继承/最终复核逐组见 manifest，不把旧结果改写成同一次运行。

原 a78c 的 `applyStop` / `StopConfirmation` 局部错误代码保持原样，相关接线另有上述定向检查；Agent credential metadata / scope 校验源保留，key 失败重试已直接覆盖。产品目标4文件每次运行结束 SHA 均不变。交 root 统一 review/integrate/build。
