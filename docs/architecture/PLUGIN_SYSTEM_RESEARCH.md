# 插件系统与 DeepSeek Harness 调研

版本 0.4.0 · 2026-10-31。结论：采用 **React + Cordis core** 进入 M0；借鉴 Harness 的服务、插槽、主题及生命周期分层，自行实现 Tauri 安装/权限桥、持久化与布局协议。此文与 [定制设计](../ux/CUSTOMIZATION_DESIGN.md) 是本轮新增基线。

## 1. 核验范围与证据

Harness 源码固定于 `ce7073d51254c26cd63b22a60835b8f948deb447`（2026-10-29），核验于 2026-10-31。链接固定版本，避免后续主分支变化影响复核。

| 观察 | 源码依据 | Horizon 处理 |
| --- | --- | --- |
| 布局声明 sidebar / main / rightbar / shell.bottom / shell.overlay 等插槽，并依赖 slots/theme/locale/shortcuts | [ui-layout 客户端入口](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/client/ui-layout/src/client/index.ts) | 采用稳定 slot ID、模式与贡献所有权；不照搬其聊天产品布局 |
| 插槽注册账本与 React 渲染分离；渲染端订阅快照 | [ui-slots](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/client/ui-slots/README.zh.md)、[renderer](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/client/ui-slots/src/renderer.ts) | Cordis 服务提供 register/dispose、getSnapshot/subscribe；React 使用 useSyncExternalStore，稳定快照减少无关渲染 |
| React createRoot/hydrateRoot 的挂载结果提供 unmount 清理 | [ui-renderer 客户端入口](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/client/ui-renderer/src/client/index.ts) | UI dispose 与后端资源租约分开；React/ReactDOM/Cordis 在同一 realm 共享单例 |
| 主题独立提供语义变量与状态 | [ui-theme](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/client/ui-theme/README.zh.md) | 布局包与主题包独立；用户覆盖叠在主题令牌之上 |
| 面板尺寸是布局组件暂态，刷新会重置 | [ui-layout 说明](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/client/ui-layout/README.zh.md) | 自行保存尺寸，区分首选尺寸与窗口约束后的有效尺寸 |
| 客户端通过模块注册表、延迟工厂组织依赖；宿主含 Node 环境机制 | [modules](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/client/modules/README.zh.md)、[Web client](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/subsystems/web-client.zh.md) | 不直接移植 Node Loader；Tauri 包安装和入口解析由 Rust 与构建产物适配 |
| 使用基于 rc.11 修改的 scoped Cordis，包含生命周期补丁 | [vendor](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/vendor/README.md) | 独立验证上游 rc.12，不能把 Harness 的补丁行为当上游保证 |

Harness 的包根 `src/index.ts` 有宿主侧空入口；实际 UI 逻辑在 `src/client/`。README 的概括不替代入口、依赖声明与生命周期源码。它使用 Electron 桌面与 Node 宿主，不能据此推出 Tauri 内存、权限或卸载能力。

## 2. Cordis 的职责与限制

[Cordis](https://cordis.js.org/) 是插件运行时与服务依赖组织工具；上游 [core 源码](https://github.com/cordiverse/cordis/tree/main/packages/core) 与 [4.0.0-rc.12 发布包](https://registry.npmjs.org/cordis/4.0.0-rc.12) 是此次验证来源。core 可打包进入浏览器；Node Loader 属于另一层，不能直接带入 WebView。

- **提供**：Context、服务注入、依赖就绪/失效、事件及 effect 清理。
- **Horizon 负责**：包来源/校验、版本兼容、权限、进程、IPC、持久化、UI 插槽、布局/主题协议、故障恢复与性能测量。
- **不提供**：OS 沙箱、VSIX 兼容、任意插件安全保证、模块缓存完全释放、桌面资源预算达标证明。

## 3. Horizon 的分层与包类型

```text
Rust kernel
  安装记录 / 版本与权限 / 配置与资产 / 资源租约 / 进程与 IPC
       ↕ 带 activationId + scope 的消息边界
WebView：共享 React + Cordis core
  服务代理 → slots → layout renderer → 功能视图
           ↘ theme / appearance / command / locale
按需进程：第一方 native service、隔离 JS 宿主、Pi、终端
```

| 包类型 | MVP 表达形式 | 执行/清理 |
| --- | --- | --- |
| 布局 | `declarative` + layout JSON；默认八包 `horizon.layout.{mist,paper,orbit,graphite,celadon,iris,sand,aurora}` | 无专属进程；仅选中布局注册树；切走注销布局贡献，尺寸偏好保留 |
| 主题 | `declarative` + light/dark 语义颜色、圆角、密度资源 | 无 JS；切换令牌；主题不能改变 slot 位置 |
| 第一方 UI | `trusted-main` 的 React 模块；共用运行时 | Cordis effect 管订阅；React unmount 管 UI；ESM 模块可滞留，必要时安全重载 |
| 第三方逻辑 | QuickJS runtime + Horizon SDK broker，作为 M0 待验证适配 | 不在每个 runtime 内再运行 Cordis；消息转成 Cordis 服务代理；销毁 runtime 回收对象与任务 |
| 原生业务 | 按需、可退出的服务进程 | Rust 持有资源租约，停止确认后才算释放 |

布局 DSL 支持 row/column、固定 slot、导航方式与 tabs 容器；主题只能声明受支持的令牌。首版第三方可组合这些构件，不开放任意主 DOM/CSS/React 代码。新型渲染构件通过后续 SDK 版本扩展。第一方 React 代码与主窗口同权，Cordis 不是隔离边界。

**双层生命周期不能重复掌权。** Rust 决定安装、启用、权限和 activation 状态；Cordis 只组织已获准激活实例的前端服务依赖。服务失效时 Cordis 清理消费者，同时 Rust 吊销租约。UI 等后端完成回执，不能因为面板消失就显示“已停止”。项目禁用不由依赖自动恢复绕过。

**布局不拥有文档。** 文档/EditorState、Git 草稿、Agent run 属于功能扩展与项目会话。主题/尺寸只更新变量；结构切换由稳定 viewId 对应的挂载槽协调。能移动现有 EditorView 容器时复用；必须重建视图时先保留同一 EditorState、历史、光标与滚动。IME composition 期间排队切换，不强制中断输入。这一链路需原生实测。

**恢复路径。** 当前布局卸载/禁用前先选择另一个已启用布局；若无可用包，进入宿主极简恢复页，允许设置、安装布局、查看恢复草稿。恢复页只承担管理，不作为隐藏的完整业务布局。八个预装布局与其他包经过同一安装与生命周期 API。

## 4. 已完成的小型验证

代码、lockfile、运行方法及原始报告位于 [research/experiments/cordis-react](../../research/experiments/cordis-react/README.md)。本地 macOS arm64、Chromium 151.0.7922.34，React/DOM **19.3.1**、Cordis **4.0.0-rc.12**、esbuild **0.28.2**。

| 实验 | 结果 |
| --- | --- |
| 浏览器中没有 process / require 全局仍能激活 core | 通过 |
| 服务缺失时等待，提供后激活，移除时清理，恢复后再次激活 | 通过 |
| 停用消费者后事件与定时器停止；关闭后 React 订阅为 0 | 通过 |
| 配色/几何更新保留同一 textarea 节点与未保存内容 | 通过 |

实验产物 254060 bytes 是这段样例的打包大小，不是应用包体或内存。实验未覆盖任意布局树迁移、CodeMirror、中文 IME、QuickJS SDK、Tauri WKWebView/WebView2 或 Harness 插件兼容。

## 5. 编码前结论与首批门禁

没有待用户决定的产品问题。可按 [实施计划](../implementation/IMPLEMENTATION_PLAN.md) 开始 M0：

1. 固定 Tauri/Rust/React/Vite/CodeMirror 精确组合；移植上述 Cordis 样例到双端 release WebView，确认单例及 CSP/模块加载。
2. 用两个真实布局包切换 CodeMirror，验证撤销、选区、滚动、IME、Git 草稿与运行任务保持；失败保留上个有效布局。
3. 验证默认 Git 包卸载/恢复与隔离只读 JS 示例的安装/停用/租约回收；确认 Cordis 桥不会复活被禁用实例。
4. 测量背景资源、布局切换和插件启停循环；和基础阅读预算一并报告全进程资源。

Cordis RC 的具体 API 若不满足门禁，保持 Horizon SDK/消息边界不变，记录差异后使用小型自有生命周期适配层；不自动更换前端栈。QuickJS 的版本、binding 与 SDK 桥仍需 M0 确认，不能把 RC 浏览器实验当作其已通过。

Pi 继续是唯一首版外部 Agent 候选。参考 Harness 的 UI 插件机制不扩大为复制其 Agent、模型循环或全套桌面宿主；后续若直接采用代码，保留对应版本许可与 notices。
