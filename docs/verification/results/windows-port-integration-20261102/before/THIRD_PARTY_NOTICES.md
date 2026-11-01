# Third-party notices / 第三方软件说明

Horizon 自有代码、设计源码与文档采用仓库 [MIT License](LICENSE)。下列组件保留各自许可证和版权声明。

本次归档对应 **macOS arm64 / `aarch64-apple-darwin`**。完整精确版本、直接与间接依赖、运行/构建/开发用途、上游地址、包校验值和每份许可证 SHA-256，见 [依赖索引](licenses/third-party/generated/INDEX.md) 与 [机器可读清单](licenses/third-party/generated/inventory.json)。版本来自 `package-lock.json` 和三个 Rust `Cargo.lock`，不用 `package.json` 的版本范围代替实际版本。

| 组件 | 本次精确版本 | 用途与许可证 |
| --- | --- | --- |
| Tauri / Tauri JS API | 2.12.5 / 2.12.4 | 桌面宿主与 IPC；Apache-2.0 OR MIT |
| Tauri dialog plugin | 2.8.4 | 原生文件选择；Apache-2.0 OR MIT |
| rfd | 0.17.2 | 原生文件面板；上游 crates.io 原版，MIT。已撤回的 macOS 生命周期实验及来源记录保存在[调查归档](docs/verification/results/settings-project-panel-source-audit/experiment/HORIZON_PROVENANCE.json)，不再作为运行依赖补丁 |
| Tauri runtime / Wry runtime / Wry / Tao | 2.12.2 / 2.12.3 / 0.57.1 / 0.37.2 | 原生窗口与系统 WebView；各自原文见完整索引 |
| React / React DOM | 19.3.1 / 19.3.1 | 桌面界面；MIT |
| CodeMirror state / view | 6.7.6 / 6.43.15 | 编辑器；MIT。语言、搜索、补全、命令及 Lezer 的独立精确版本均列于索引 |
| Cordis / Cosmokit | 4.0.0-rc.12 / 1.8.1 | 插件服务与生命周期；MIT |
| xterm / addon-fit | 6.0.0 / 0.11.0 | 终端渲染与尺寸适配；MIT |
| react-markdown / remark-gfm | 10.1.0 / 4.0.1 | Markdown 与 GFM；MIT。解析器和其他间接依赖见索引 |
| lucide-react / Lucide design atlas | 0.468.0 / 0.468.0 | 产品与设计稿图标；ISC，保留 Feather 来源版权说明 |
| rquickjs / rquickjs-core / rquickjs-sys | 0.14.0 / 0.14.0 / 0.14.0 | 独立扩展宿主；MIT |
| QuickJS-NG | 0.16.2 | rquickjs-sys 内置 JS 引擎；MIT |
| ripgrep | 15.2.0 | `horizon-rg` 搜索侧进程；Unlicense OR MIT |

Rust 原生运行依赖包括 Tokio、Serde、reqwest/rustls、portable-pty、notify、image、keyring、trash、regex、zip 等；全部按实际锁定版本归档，连同其传递依赖和原始 NOTICE。`build` 标记包含 Cargo build dependencies 与 proc-macro；`development` 标记包含测试/工具依赖。同一包有多种用途时全部列出。此清单是保守的依赖闭包，不能把每一行理解为编译后仍保留的独立代码模块。

前端的 Vite、TypeScript、tsx、Vitest、Tauri CLI、esbuild/Rollup/Rolldown 平台绑定和 Playwright 属于构建、测试或设计检查工具；不作为运行工具分发给用户。其许可证仍归档以复现开发环境。未安装的其他平台可选 npm 包单独列于 JSON，未计作本 macOS 包中的组件。Lucide 设计稿脚本虽然在根项目中属于开发依赖，其图标原文亦单独保留。

QuickJS 原始版权和完整条款位于 [QuickJS-NG MIT](licenses/third-party/generated/sidecars/QuickJS-NG/quickjs-ng-MIT.txt) 与 [rquickjs MIT](licenses/third-party/generated/sidecars/QuickJS-NG/rquickjs-MIT.txt)。ripgrep 的 [COPYING](licenses/third-party/generated/sidecars/ripgrep/COPYING)、[MIT](licenses/third-party/generated/sidecars/ripgrep/LICENSE-MIT) 和 [UNLICENSE](licenses/third-party/generated/sidecars/ripgrep/UNLICENSE) 与固定 SHA-256 的上游 release 包一起取得；下载版本与校验值由 `scripts/prepare-ripgrep.mjs` 固定。

当前 Rust 工具链为 **rustc 1.99.1 (58cf8f9c3 2026-10-13)**。随应用静态链接的标准库版权报告及条款另存于 [Rust standard-library notices](licenses/third-party/generated/rust-standard-library/COPYRIGHT-library.html)。归档保留上游报告的完整范围；Rust 编译器本身不随应用分发。

MPL-2.0 组件 `cssparser 0.37.0`、`cssparser-macros 0.7.1`、`dtoa-short 0.3.5`、`option-ext 0.2.0`、`selectors 0.38.0` 的**未修改原始源码包**位于 `licenses/third-party/generated/sources/`，已核对 `Cargo.lock` SHA-256。可直接用 `tar -xzf <name-version.crate>` 解包；许可证和源码保留其原始形式。

少数 npm/crate 发布包不携带完整许可证文件。`upstream/SOURCES.json` 记录从对应发布提交补回的原始文本、固定 URL 和 SHA-256。objc2 系列上游使用许可证声明及链接，归档保留该声明、发布包作者信息和 SPDX 3.27.0 的对应标准条款；未编造上游版权文本。详情与复现命令见 [归档说明](licenses/third-party/README.md)。

Pi 由用户明确启用后单独安装，不包含在 Horizon 应用包内；其发行包及依赖保留自身许可证。系统 Git、用户 shell、Node、macOS WebKit 与系统 frameworks 也不由 Horizon 重新分发。

Material Design 仅作为视觉原则参考，Horizon 没有打包 Material UI。项目名称由创作者取自 Apex Legends 角色；未包含游戏美术、角色形象、Logo 或其他游戏素材，也不代表与 Google 或游戏权利方存在关联。
