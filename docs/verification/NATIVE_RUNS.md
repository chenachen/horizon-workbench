# macOS 原生操作记录

## MAC-NATIVE-INITIAL-001 · debug 初期工作流

操作由主测试者通过 computer use 完成；后台验收协作者不发送 GUI 输入。此轮为 bundled debug，源码仍在开发，未关闭完整需求。

1. 通过原生应用打开首次欢迎页，存在“添加本地项目”“插件中心”“设置”等真实 AX 控件。
2. 使用系统项目选择器，选中专用临时目录 `/var/folders/9j/xnw538c934b2s559tl01cc800000gn/T/horizon-ui-qa-7rvjqo02/aurora-web`。
3. 项目显示为 `Aurora Web`，展开 `src`，打开真实 `workspace.ts`。
4. 真实键盘输入 ASCII；通过粘贴输入 `// 粘贴验收：你好，地平线。`，执行真实保存，主测试者核对磁盘一致。
5. 后台独立读取磁盘，确认上述中文粘贴完整存在，保存字节及 SHA-256 已存档。
6. 在 F01 设置中应用当前项目浅色覆盖，界面实际切换到浅色；重启持久化、其他项目不受影响与恢复继承尚未检验。

证据：[首次欢迎页](screenshots/dev/001-welcome-mist-dark.png)、[外观设置](screenshots/dev/002-settings-before-layout-fix.png)、[保存后的编辑器](screenshots/dev/003-editor-mist-light-before.png)、[独立磁盘核对](results/native-file-initial/disk-observation.json)、[保存字节副本](results/native-file-initial/workspace.saved.ts)。

已观察到 `cua.typeText` 直接注入中文时汉字缺失，磁盘保留 `// ：，。` 一行；剪贴板粘贴中文正确。该现象尚未区分自动化注入链与真实输入法行为，**不能据此宣称中文 IME 通过，也不先归因为应用 IME 缺陷**。主测试者后续使用真实输入法组合验证。

视觉仍有明确差异，已分派修正。欢迎页为深色且与 A01 浅色参考条件不匹配；F01 对话框宽度、信息层次和底部操作与参考不同；文件树附加表头/底色及编辑器底部状态布局需对照修正。保留当前截图作为修正前证据，不计视觉通过。

本轮仅部分覆盖：项目打开、文件树/文件打开、基本编辑与保存、项目外观覆盖。去重/只读/路径失败、保存竞争/外部变更、撤销/查找、真实 IME、重启/恢复等仍待验收。

## MAC-NATIVE-GIT-001 · debug 文件级暂存与提交

同一专用临时 `Aurora Web` 仓库，主测试者原生点击 Git → `theme.css` 磁盘差异 → 单文件暂存 → 已暂存差异（HEAD→index），输入 `test: verify staged theme change from native Horizon UI` 并提交。UI 显示提交 `9a51a595e`、尚未推送。

后台独立只读 Git 核对：HEAD 为 `9a51a595e5654a85725dd522dbb07a8d51c95414`，本次只提交 `src/theme.css`；暂存区为空，`src/workspace.ts` 仍未暂存、`notes.txt` 仍未跟踪。临时库没有 remote，没有推送。

证据：[原生提交截图](screenshots/dev/004-git-staged-commit.png)、[独立 Git 核对](results/native-git-initial/git-observation.json)。该路径仅部分证明文件级暂存及提交范围，不覆盖 hook/签名失败、提交前范围变化、取消与并发等分支。

**MAC-GIT-STALE-DIFF-001：旧 debug 构建发现待修行为。** 提交成功后左侧“已暂存”计数已为 0，右侧仍显示旧差异并标“已暂存更改 / HEAD·基准版本 / 暂存区·当前版本”，未显示历史或过期标记。当前 HEAD→index 实际为空；该视图不能继续被当作当前已暂存状态。已交 Git 实现者核对提交后的选中差异失效/重读，保留失败证据，待新包原生复测后替代结论。

## MAC-NATIVE-BOM-CRLF-001 · release 候选 2 的 BOM/CRLF 保存

主测试者通过系统项目选择器注册第二项目 `UI Kit`，打开 `src/换行测试.txt`，原生状态栏显示 `UTF8BOM · CRLF`。粘贴 `第三行：中文保存` 与一个换行后执行 Cmd+S。后台独立读取实际文件：51 字节、UTF-8 BOM 保留、3 个 CRLF、0 个裸 LF，末行 CRLF 保留，三行中文与预期完全一致。

证据：[原生编辑器](screenshots/release-candidate/006-ui-kit-bom-crlf.png)、[独立字节核验](results/native-file-release-candidate/disk-observation.json)、[保存字节副本](results/native-file-release-candidate/saved-file.txt)。构建为候选 2，PID 72108、窗口 13201，非最终 release。此轮只证明该项目添加、普通文件打开和 BOM/CRLF 粘贴保存子项；真实 IME 组合输入、LF/无末行换行、新文件、版本竞争及完整多项目隔离仍待验收。

同轮 [F01 修正中截图](screenshots/release-candidate/005-settings-mist-light.png) 已显示约 790px 参考宽度；左导航仍按内容居中、固定完成 footer 仍缺失。已登记修正与未解决差异，未计视觉通过。

## MAC-NATIVE-PROJECT-SEARCH-001 · 未保存跨项目与中文磁盘搜索

候选 2 中，主测试者在 UI Kit 文件追加未保存第四行 `未保存：跨项目保留`，切到 Aurora Web 恢复 `workspace.ts`，再回 UI Kit。第四行、行 5 列 1 光标及树展开状态仍在。Cmd+Z 撤销第四行，Cmd+Shift+Z 恢复；Cmd+W 显示三选确认，取消后内容保留。随后搜索磁盘内容 `中文保存`，返回 1 处/1 文件，点击第三行命中回到已有脏缓冲区，状态为行 3 列 5。

独立磁盘核验仍为先前 51 字节、三行 BOM/CRLF 文件；第四行未被切项目、关闭取消或搜索隐式保存。证据：[搜索与脏缓冲区](screenshots/release-candidate/007-search-dirty-project.png)、[操作报告与磁盘核验](results/native-project-search/observation.json)。截图只呈现最终搜索状态，切换/撤销/关闭对话框步骤来自主测试者的原生操作报告。

两项候选包失败保留待修：**MAC-EDITOR-UNDO-DIRTY-001**，撤销到与磁盘相同文本后仍显示脏；**MAC-EDITOR-CLOSE-FOCUS-001**，关闭确认取消后焦点落到 HTML root，未返回编辑器。已交编辑器实现者，需新包原生复测后关闭。两项目子项不代替三个项目完整标签/选区/滚动/草稿/聊天隔离验收。

## MAC-RECOVERY-NATIVE-001 / MAC-RECOVERY-RELAUNCH-FAIL-001 · 候选 3 恢复与退出重开

退出候选 2 前，后台独立固定 UI Kit 恢复稿：editorRevision 4、27 字符、73 UTF-8 字节，包含第四行 `未保存：跨项目保留`；磁盘仍为先前 51 字节 BOM/CRLF 三行文件。旧候选 Cmd+Q 退出后，主测试者随即调用的应用 AX 获取曾重新启动旧包；这是自动化按 bundle 重新取得应用的副作用，不能解释为退出失败或自动保存。第二次 Cmd+Q 后只读进程核验确认退出。

候选 3 冷启动显示恢复提示。主测试者打开只读比较，看到恢复稿第四行、磁盘三行；点击显式恢复后，编辑器显示第四行与未保存标记。后台独立读盘确认字节仍为 51、BOM 保留、3 CRLF、0 裸 LF，SHA-256 `77fbe3adb6b5117f9ce42396a4c93f542b608fa0d7f4d9c5c55667bbe64b32d3` 未变。随后 Cmd+Q 已进入统一退出确认，取消有效。

再次 Cmd+Q，选择保留草稿并退出，主测试者用 ps 确认原进程消失。但重启出现 **`Selection points outside of document`**，重试仍失败。已交 editor 修复 session/recovery 的换行与选区边界。首次比较/显式恢复不写盘仅部分通过；完整退出重开恢复路径仍失败，不以初次成功覆盖。

证据：[退出前稿与磁盘](results/native-recovery-before-candidate3/observation.json)、[恢复后独立磁盘核验及操作报告](results/native-recovery-candidate3/observation.json)。短暂 GUI 过程未由后台及时截屏，界面步骤来自主测试者原生操作报告。

## 候选 4a · 恢复重开与休眠退出复测

主程序 SHA-256 `52aa5d3af6b69c0c07c7f808ffd9606e57af324b6809fab72050d7f17b716b09`。这是候选 4a，后续主题注册表同步与 Pi 隔离修订尚未纳入，不能当作最终发行包。

主测试者从 Aurora 切入此前休眠的 UI Kit，磁盘三行正常显示，光标位于第 4 行；显式恢复后第四行及脏标记正常。Cmd+Q 选择保留恢复稿并执行，进程退出；重启正常显示三行磁盘与一份待恢复提示，无 `Selection points outside of document`。后台独立读盘仍为 51 字节、BOM、3 CRLF，SHA-256 与原基线相同。恢复提示截图在窗口已经关闭后才执行，因此没有声称取得该图；步骤依据原生操作报告，字节核验有独立副本。见 [恢复复测](results/native-recovery-candidate4a/observation.json)。

随后 UI Kit 磁盘三行、待恢复稿状态下执行项目休眠，返回欢迎页。Cmd+Q 正常出现退出对话框并退出，无旧 scope 错误。再次启动仍是欢迎页；[原窗 PNG](screenshots/recovery-candidate4a/02-sleep-relaunch-welcome.png) 独立核对成立。读出的 app session `activeProjectId=null`，UI Kit 的标签、选区和搜索草稿仍保存，见 [休眠与持久化](results/native-recovery-candidate4a/sleep-observation.json)。这替代候选 3 的两个具体失败，尚不覆盖异常崩溃、活跃终端/Pi/服务或 30 分钟自动休眠。


## Candidate6 Git：首批独立复核

真实GUI前14张原始PNG与16份只读Git/磁盘快照已复核，16项精确比对通过。仅暂存提交后当前暂存差异归零，旧 `MAC-GIT-STALE-DIFF-001` 由实机证据关闭。已证实双基线、fetch不改文件、快进pull/显式push、非快进与脏切分支拒绝、hook失败保留后重试、冲突来源/结果和显式暂存、tracked discard取消/恢复index。

未跟踪文件移废纸篓实际失败：等待中取消/X禁用且无停止，随后Finder AppleEvent `-1712`；原件仍在。未进行外部强杀恢复（sent=false），不把文件名 `15-after-trash.json` 当成功依据。推送错误同时出现在sidebar/modal/toast，toast遮挡底部按钮区域，视觉缺陷留待新包。

[首批审计](results/git-gui-candidate6-audit/initial-audit.json)只覆盖上述子条件；Git操作者仍在继续历史/克隆/大差异，不提前关闭整条需求。


## 候选7 · DMG与ZIP归档核验

独立执行DMG校验及只读挂载、ZIP完整性检查与临时解包。两归档中的Horizon.app均为2,115文件、35,616,966字节，逐文件SHA与已审候选7相同；主程序为`84c6cf3bfadaa7a481648f051e34ed07e0f08ed0875d771720916ede2409ab38`。四个可执行文件均保留0755；全部许可证与资源相同。DMG含`Applications → /Applications`安装链接。自有镜像已卸载，临时目录已清理，没有启动第二应用或操作当前窗口。

这是候选产物一致性核验，未宣称全部验收完成、全新安装/版本升级或签名公证通过。[归档核验](results/package-candidate7/audit.json)。


## 2026-11-01 settings-project 活动30分钟完成

`results/settings-project-active-workflow-30m/audit.json` 独立审核867样本、1800.0051秒与实际 exit0，root34128从未缺席，所有关联helper持续计入。编辑/搜索/缓存/八布局为真实GUI工作流；四次F09快照有原始文件及时间。此记录只证明当前包连续活动观察与进程归属覆盖，不能替代最终包、同状态无增长、空闲预算或退出清退。

## 2026-11-01 E1/E2 追加审核

`results/editor-resume-e1-e2-audit/audit.json`完成24张原始JPEG、实际文件/Trash字节与100000路径核对。FILE005搜索原句和FILE012编码换行按原生+既有生产证据组合闭合；新统一包Stop/cancel仍归STATE003。新建/改名/预览、find替换、unknown纯文本、autosave及100k已完成部分从待办移出；未执行新GUI或测试。118条证据，22完整/74部分/6失败/2未验。

## 2026-11-01 W1 当前包与退出

`results/workspace-resume-w1-audit/audit.json`保留Add不自启、alias去重、只读及权限恢复原ID实证。权限无恢复入口、缺失后台根阻止退出计划分别登记WS002/RUN004失败，等新包真实复核；源修复不撤销原生失败。恢复测试根后正常退出，03:47:16.405Z旧11身份全消失，见`results/settings-project-normal-quit-20261101/post-quit-initial.json`。122证据，22完整/72部分/8失败/2未验。
