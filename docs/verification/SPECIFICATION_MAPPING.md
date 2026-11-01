# H01–H04 规范映射

H 组是设计交付物，没有对应的应用内规范页面。[交互规格](../ux/INTERACTION_SPEC.md) 第 1 节明确此边界。本表把八套布局共用的四项规范连到需求、现行契约和实现位置；这些条目记为 `specification-mapped`，不增加原生截图或功能通过数。

| 规范页 | 产品契约与需求 | 实现映射 | 尚由实机验收负责 |
| --- | --- | --- | --- |
| H01 信息架构 | [技术设计](../architecture/TECHNICAL_DESIGN.md) 第 2、4 节；[组件契约](../ux/COMPONENT_CONTRACTS.md) 2.1、3.1；REQ-HOST-001、REQ-WS-001、REQ-WS-005、REQ-WS-006 | `App.tsx` 的工作区、项目导航、主区、设置与插件入口；Rust `state.rs` / `projects.rs` 的 Workspace/Project/session；功能模块经插件状态与插槽挂载 | 多项目完整状态隔离、全部功能停用后的操作和后台资源释放仍按对应需求验收；此映射不把信息层级图当作进程模型证明 |
| H02 视觉令牌 | [视觉规范](../../design/DESIGN_SYSTEM.md)；[外观定制](../ux/CUSTOMIZATION_DESIGN.md)；[组件契约](../ux/COMPONENT_CONTRACTS.md) 5.1；REQ-UI-002、REQ-UI-007、REQ-UI-009、REQ-UI-010 | `packages/plugins/src/builtins.ts` 的八布局/八独立主题；`packages/appearance/src` 的语义色和几何契约；`AppearanceProvider.tsx` 与 `styles.css` 的应用映射 | 八布局浅深色、混搭、字体/密度、颜色输入与持久化的原生结果、像素对照仍单列；注册表 token 一致不自动代表视觉通过 |
| H03 组件与反馈 | [组件契约](../ux/COMPONENT_CONTRACTS.md) 3.1–3.12、6；[交互规格](../ux/INTERACTION_SPEC.md) 各页焦点与状态；REQ-UI-004、REQ-STATE-001、REQ-STATE-002、REQ-SET-007 | `Modal.tsx` 的原生 dialog/焦点返回、Loading/EmptyState；`styles.css` 的主次/危险/禁用按钮、焦点环与减少动画；各功能表单的 label、pending/error 状态 | 键盘完整路径、读屏名称、错误焦点、关闭恢复、200% 字体及对比度不能由组件存在推定通过 |
| H04 响应式与区域 | [外观定制](../ux/CUSTOMIZATION_DESIGN.md) 第 2 节；[交互规格](../ux/INTERACTION_SPEC.md) 3.2；[组件契约](../ux/COMPONENT_CONTRACTS.md) 5.2；REQ-UI-003、REQ-UI-007、REQ-UI-011 | `ResizeHandle.tsx` 的拖动/方向键/重置；`App.tsx` 的侧栏/辅助/底部约束；`styles.css` 的辅助覆盖、文件侧栏浮层、单列设置与欢迎/总览规则；原生窗口最小 640×480 | 窄窗、200% 字体、可达入口、diff 行内切换、面板状态保留及尺寸不回写仍需真实窗口操作；Windows 缩放继续单列未测 |

H02/H04 原参考包含早期代码字号、面板默认宽度和固定断点。数值解释采用需求表明确引用的 0.4 [外观定制规则](../ux/CUSTOMIZATION_DESIGN.md)：UI/代码默认 13/14，文件侧栏 240（160–480）、辅助 320（240–560）、底部 220（120–480），按实际布局和可用空间钳制。早期示意图的 195–260 / 318px 等数值不覆盖这份后续契约。原参考 PNG 保留，未为匹配实现改图。

共享映射适用于 mist、paper、orbit、graphite、celadon、iris、sand、aurora。各布局独有结构由组件契约 5.2 和各自产品页截图验收；共享规范映射不把它们合并为同一个已通过布局。

原始核对与文件哈希见 [规范映射审核](results/specification-mapping/audit.json)。H05 五条实际路径继续使用已有 [流程映射](../implementation/TRACEABILITY.md) 和独立证据。
