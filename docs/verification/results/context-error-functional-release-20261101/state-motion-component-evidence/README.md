# 功能候选：搜索结果归属、减少动画、Git 分页名称

仅 `.work` prepared；产品、运行 App/Pi、app data、GUI 均未修改。旧 auxiliary 纯视觉 patch 仍 POSTPONED，未混入本批。

## 最小修正

- `search.patch`：SearchPanel 保存本次实际搜索发起时间及独立参数快照，结果始终标“搜索发起于/该次搜索快照”；选项/范围变更提示重新搜索。变化使旧 generation 失效并请求 cancel，保留已有结果、输入和滚动；不自动发第二请求、不新增计时器/监听。新 query 清空旧结果时间和旧 regex 错误；旧零结果不会被当作新条件的“没有结果”。取消请求不宣称 OS 已停止。
- `motion.patch`：共享 root policy 使已解析 data-reduced-motion=true 覆盖整个工作台及伪元素的 animation/transition/scroll；系统 fallback 排除显式 false。Agent、Git、editor 的原有系统 media 增加 false 例外；Settings 原有例外正确，无须修改。涵盖全局 spinner、Agent/Git spinner、Settings switch、plugin switch 伪元素和 editor；不改主题/密度或纯视觉几何。
- `git-pager-labels.patch`：GitPanel 两个分页 button 各加一个 `aria-label`，分别为 `${title}上一页`、`${title}下一页`，区分已/未暂存组；行为不变。按 root 指令只作源码核验，没有新建专门测试。

## 已执行定向检查

`run.mjs` 复用既有 esbuild write:false + Playwright route 设施。真实 SearchPanel、AppearanceProvider/useSettings、applyAppearance 及产品 CSS；bridge/RPC、editor draft store/commands 为受控边界。没有 native GUI、provider、文件搜索进程或产品构建。

最终单次运行 exit 0，2948ms，before/after 各4组：

1. 请求未完成时即记录发起时间，完成后时间不变；六种匹配/范围参数变化保留100条旧结果并提示，往返项目保留时间、输入和滚动，无第二请求。
2. start ACK 尚未返回时改条件，旧事件被隔离；ACK 返回后请求取消旧 task。切回原条件后仍明确“仅显示此前已接收的部分结果”，不误称完整结果；旧事件/旧结果在新搜索完成后继续迟到，仍不能混入或覆盖新状态；没有“已取消/OS stopped”提前宣称。
3. 零匹配归属原 plain-text 请求；改 regex 后无效表达式不启动任务，旧快照时间保持、旧零结果不冒充新条件；新 query 清空旧 metadata/error。
4. 真实 Provider 切换 on/off/system × 系统 reduce/no-preference 六组合，检查全局/Agent/Git 动画、Settings/plugin伪元素/editor transition 与滚动。after 全符合；on 在系统不减动画时仍全面禁用，off 在系统减动画时仍恢复正常。

before 的 `passed: true` 表示成功复现指定旧缺陷：无结果时间/旧条件说明、选项变化后旧事件继续进入、on 仅 Settings 生效、off 受系统 media 覆盖；不表示旧产品通过。原始逐阶段 DOM/任务参数/计算样式在 `result.json`。

9份产品源 SHA 前后均未变，before/after 均无 browser/console error。`source-sha.json` 保存6份候选文件的准确前后 SHA，`before/after/` 保存候选副本。`execution-receipt.json` 与 `tool-output.log` 保留执行返回；未运行全套 suite 或 desktop typecheck，后续由 root 在安全边界集成验证。

Root 指定的部分结果文案复核已完成：只复用同一窄 harness 重跑；前版结果/脚本/receipt 留作 before-partial-label-*，未扩大范围。
