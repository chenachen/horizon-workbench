# AI002 / D03 最小展示补丁

只准备source.patch；未改产品源码、构建或GUI，未启动provider/Pi。App通过现有project.displayName把真实项目名传到AgentPanel/ContextPicker，不新请求或解析ID。

真正缺口：已选附件只显示“选区”，未给行号；buffer统一称当前内容，缺冻结时已保存/未保存来源；Picker未显示当前项目名。补丁在创建buffer附件的既有冻结点记录UI-only bufferDirty，显示“附加时已保存/未保存”。行范围只从已有冻结完整text与UTF16 range派生，to为exclusive；selected变化时memo一次，不因搜索输入重扫全文。

原文件label与DiffViewer的file · labels[0] → labels[1]已经满足文件/差异方向，完整保留。sendAgent显式字段映射未改，新UI标记不进入snapshot/发送payload；20项/256KiB与原effect/lifecycle不动。首次安装已有downloadBytes N MB，不扩安装后大小或接口。

按vercel-react-best-practices的derived-state-no-effect与昂贵扫描memo原则；预算等简单表达式不额外memo。没有新增产品测试文件。仅对新私有展示函数做14个纯计算断言，覆盖LF/CRLF、中文/emoji的UTF16、exclusive end、来源分支：

```sh
rtk proxy node .work/pi-ai002-context-prepared/check-description.mjs
```

计算检查不证明React/原生D03通过。root中央typecheck/必要build后由既定真实D03与HTTP上下文批次验，不重复旧发送/上限/lifecycle验收。
