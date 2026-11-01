# Horizon 编码入口

当前产品与接口基线 **0.4.0 / 2026-10-31**，桌面应用版本 **0.1.0**。macOS release 应用已实现，正在逐项完成原生操作、视觉和性能验收。

使用与构建见 [使用指南](USER_GUIDE.md) 和[仓库入口](../README.md)。继续开发时，按[执行与验收条款](implementation/EXECUTION_ACCEPTANCE.md)、[需求验收矩阵](verification/MACOS_ACCEPTANCE.md)及[条件级缺口](verification/CONDITION_GAPS.md)定位工作。[开工审查](implementation/READINESS.md)保留编码前的决策与验证快照；当前运行结果以 `verification/` 为准。

| 要确定的问题 | 权威文档 |
| --- | --- |
| 做什么、首版边界、默认行为 | [PRD](product/PRD.md) |
| 如何验收每个需求 | [REQUIREMENTS](product/REQUIREMENTS.md)：110 条，104 条首版、6 条后续 |
| 界面行为、状态与键盘 | [INTERACTION_SPEC](ux/INTERACTION_SPEC.md)、[COMPONENT_CONTRACTS](ux/COMPONENT_CONTRACTS.md) |
| 布局/主题/尺寸/图片/配色 | [CUSTOMIZATION_DESIGN](ux/CUSTOMIZATION_DESIGN.md) |
| 模块、进程、存储与资源 | [TECHNICAL_DESIGN](architecture/TECHNICAL_DESIGN.md) |
| 跨模块数据与命令 | [INTERFACES](architecture/INTERFACES.md) |
| 为什么这样选择 | [DECISIONS](architecture/DECISIONS.md)、[PLUGIN_SYSTEM_RESEARCH](architecture/PLUGIN_SYSTEM_RESEARCH.md) |
| Pi 的实证范围与待验证项 | [PI_AGENT_RESEARCH](architecture/PI_AGENT_RESEARCH.md) |
| 先做哪些、依赖与完成定义 | [IMPLEMENTATION_PLAN](implementation/IMPLEMENTATION_PLAN.md)：45 项，39 项首版、6 项后续 |
| 需求、页面、接口与任务对应 | [TRACEABILITY](implementation/TRACEABILITY.md) |
| 看界面与试交互 | [设计图集](../design/index.html)、[页面索引](../design/SCREEN_INDEX.md)：8 套 × 73 场景 |

用户直接要求优先于文档。文档冲突按表内职责核对并修改同一条基线，不在编码中另建同义协议。研究报告与 `design/archive/` 是历史探索，不能覆盖 0.4 中的 React、Cordis、八套布局插件及 Pi 范围。

`research/experiments/cordis-react/` 是已运行的浏览器研究样例；`design/` 是可操作视觉原型。二者都不代表已完成桌面、文件/Git/Agent、原生输入或性能验收。
