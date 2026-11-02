# TASK-031 最小剩余审查（只读；未执行补证）

结论供 root 裁决：旧“编辑预览更新未验”已陈旧；释放子句可按现有真实关闭/停用、Markdown 真卸载、全 off 资源计数及精确生产清理源码组合，不新增“Markdown 专属 metrics 必须实测0”门。**真正需要新原生一次的只剩窄窗非空选区完整往返对照。** 不重 Markdown 生命周期、不重装/卸载/全 off/125；E07 的09总 post 仍未获执行门。

原文（`docs/implementation/IMPLEMENTATION_PLAN.md:352–359`）逐字：

> **验收步骤**：打开含标题、代码块、内部链接、外部资源和 HTML 的 Markdown；编辑源码后更新预览；窄窗切换不丢选区；标题跳到正确文档版本；暂停/卸载后订阅和视图释放。

> **必要测试**：预览内容边界、链接策略、标题行号/版本、延迟更新与取消、扩展卸载资源计数。

> **完成定义**：无需 LSP 提供真实标题导航；默认不会执行文档脚本或自动获取远程资源；启停和核心生命周期一致。

原文确有“扩展卸载资源计数”，没有要求新增专属指标、每种停法重新实测或专属 listener=0。以下组合区分实际原生动作、已有计数与源码依据，不能相互冒充。

| 原子句 | 精确可复用证据 / 边界 |
| --- | --- |
| Markdown 内容与标题导航 | `MAC-MARKDOWN-PREVIEW-CONSOLIDATED-CANDIDATE7-001`；candidate7 `84c6cf3b…`，`editor-candidate7-final-audit/actions.jsonl:9`，原15/16图：README 309B，标题 Steps 第5行→源码5:1，代码块/内部锚链接/分栏/源码可读。脚本/HTML及默认远程资源边界沿已接受的安全渲染组合，不声称原生点过远程链接或加载过脚本。 |
| 编辑源码后更新预览 | `MAC-MARKDOWN-NARROW-NATIVE-PICKER-001`；旧 `abc31e6b…` / PID21917，`editor-native-picker-20261101/actions.jsonl:41–43` 与041–043原图/AX。真实823×800；042预览 dirty、AX含 `NARROW_UNDO_1101`；043回源码 Undo 后 clean、无 marker，原377B/hash不变。marker在042 AX中，不能说该原图视口内拍到了屏幕下方 marker。043 AX两tab的selected标注混时刻，活动文件以原图为准。 |
| 标题跳到正确文档版本 | 旧15图/第9动作是真实初始版本5:1；`OutlinePanel.tsx:21–26`每次点击重读同一 buffer，再按标题/行匹配；`Preview.tsx:22,30–32`标题和正文来自同一当前 text。两文件与candidate7源清单 SHA完全相同，可沿既有组合；不冒称另拍过“编辑移行后跳转”的原生帧，不据此扩大一次补证。 |
| 暂停/卸载后释放 | 第9原动作记录真实关闭预览→全源码同caret→显式全局disable（dirty0/resource0）；关闭后的独立after截图未额外拍，保留该原动作证据层级。candidate7 `App.candidate7.tsx:179,389`→生产 `App.tsx:203,441` 的 `previewEnabled`；生产 `EditorWorkbench.tsx:97` 同一条件卸载React Preview。`Preview.tsx:22`真实 `off()` + `clearTimeout(timer)`，第23行图片异步回调 `live=false`；store第32行移除同一编辑订阅；runtime第48行同gate排除pause/disable/absent。暂停释放为明确同gate组合，不冒实际paused-preview截图。 |
| 原有卸载资源计数责任 | `MAC-PLUGIN-FINAL-UNINSTALL-PRIVATE-CLEAR-F09-NATIVE-001`：已冻结 `plugins-functional-native-20261102/cleanup-74714-1793562020579-actions.jsonl:241–244` 精确 `horizon.markdown` 真卸载，计划dirty0/resource0；`61-all-27-uninstalled-owner.json` 保原记录；同批 `diag-alloff/horizon-diagnostics.json` exportedAt `2026-11-01T21:02:28.371881+00:00`：native documents/subscriptions/watchers/cursors/activeTasks=0，CodeMirror viewCount0、created4/destroyed4，pluginInstances/disposing/worker feature=0。此为真正整体计数，与上行真实预览close及精确cleanup组合；不是“Markdown活跃时独占卸载”的专属前后计数，也不声称私有editListeners已由native直接读到0。 |

**不能使用的替代**：`MAC-EDITOR-FILEOPS-PREVIEW-PATHS-RESUME-001` 20→20→21是编辑器干净预览标签复用/编辑固定，不是Markdown视图/订阅数。F09 `editor.viewCount`是CodeMirror，`workerViews`是QuickJS贡献；都不能改名为Markdown专属数。当前没有该专属字段不是新增工程/补测理由。

绑定：生产 `Preview.tsx` SHA `52175732e04dc7f2ba86ca7434c6b0f124adec0540330fd339ca9a3dd78447c2`、`OutlinePanel.tsx` SHA `d059fb09a79584cda26356375ecf094e50b8e68293e2ea6ab70378fb5f6e9eda`、runtime SHA `c9bcd830665d6ad464f68c960a6327a9782c511144e74841524baa77cab49845`，均与candidate7源清单/对应冻结副本相同。Workbench 当前SHA `6d794619c7c119d5914c450cd8ca56a6fde664d876fa28a242aa316c9832efd4` 含后续G01等变更；仅比较上述精确gate，不将新整文件SHA冒旧build源码。完整原件/源SHA及固定动作摘录见 `evidence-map.json`。本次亲看旧15/16及041–043原图，不改canonical。

## 唯一窄窗选区补证卡（等 batch finalowner 后独立 root 租约）

复用固定 `loading-states-eight-native-20261102/editor-before.json`，不新fixture：Editor Resume QA ID `e1111892-92c6-4985-b285-f5dcbe4d11f3`，root `/private/var/folders/9j/xnw538c934b2s559tl01cc800000gn/T/horizon-resume-editor-yesw9ppu/Editor Resume QA`。既有12tabs；`native-remainder/visual.md` 377B/SHA `29b9829eb04ae840847d63b0bbc4c8d247bda63dbf527910d962450a186ca4a7`，既有fileId `1b55b505cb43887136a112502128cae6d37082c40f3048e14355e774363c58be`；原selection235/235、scroll61。原active broken-link fileId `666a2ffb89eef243bd0676831eb2f22557da727d963c941eaf452b836481382f`。实际身份/末尾基线由root到时给，不把历史PID18459永久当新租约。

1. **原批先收口**：本窄卡不能进入仍在进行的loading批；其Editor finalowner及Plugin09均按各自正式门。完成后只选已有visual.md，不编辑/Save/Undo/新增或关闭tab/改preset。保留原broken-link、tab顺序和其余11tab状态。
2. 源码保持原caret235/235，窄窗823×800（小于现有850px阈值）；只切出源码/预览标签。旧043固定AX源码转录在内存严格复核为原377B/SHA，UTF-16长度235，故235=27:1/EOF。可从原caret物理 **ShiftLeft×6**，得到预期 `anchor235/head229`，完整选中文本 **`自有夹具。\n`**；不产生文档编辑。留 before 原图/完整AX，并按下面真实读取方式取得实际范围，不用预期值冒实测。
3. 只点“预览”→“源码”各一次；不改文档/点击标题/重新选择文本。留 after 原图/AX，核相同非空选区 **实际anchor/head/完整selected文本**，不只比caret或底栏行列。
4. 选区核完物理 **ArrowRight** 折回235/235。恢复原窗口/面板几何；优先全程不滚动，保原scroll61。若实际重排改变scroll，CUA文档公开 `App.scroll(target,direction,{pixels:n})`，可有界到顶再下61px；这是请求距离，不是实际scrollTop读回，仍须最终已有session投影确认，不把GUI请求当61已还原。返回原broken-link active；最终核visual.md235/235、scroll61及12tabs/其他字段完整恢复、377B/hash不变。不得直接写session来“恢复”。

### 选区读取的真实能力边界

Terra只查已加载文档确认：native公开 `getAXState` / `getAXStateAndScreenshot` 树，无 `AXSelectedTextRange`、anchor/head或任意AX属性的独立只读端点；树可能给Selected text但未承诺。`selectText`是操作，不是读回。**不提供猜测的CUA调用，不声称AX直接给完整anchor/head。** 即便AX仅给location/length，也不能从范围推断方向。

因此原图/AX给可见高亮、源码/预览状态和文档身份；精确范围可复用现有Editor owner的**同一owned session只读投影**：`registry.json → sessions[e1111892-…].tabs[visual.md fileId].selection{anchor,head}/scrollTop`，同一source UTF-16切片得完整selected文本。现成模式在 `.work/loading-states-editor-post.py:19–24`；本卡只提取本project，不扫其它session/恢复稿，不新API/前端注入/metrics。store第234行随实际选择持久化，第342–355行正常400ms debounce；原生截图后只读一次实际已落定revision/范围，不以旧缓存值当结果，不加轮询。

若root采纳：before-selection / after-roundtrip 两个极窄固定投影分别与对应图AX绑定；恢复后最终一次投影可并root现成末核，验证235/61/broken-link/12tabs。输出必须标“持久session实际值”，不是AX属性值；与GUI时刻/预期范围不符则保实值，不能补造成功。**当前未运行任何投影/GUI/OS/appdata/test/生产修改。**
