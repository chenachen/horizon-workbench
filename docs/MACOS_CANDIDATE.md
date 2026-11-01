# Horizon macOS 可用候选包

更新于 2026-11-02。本页记录当前安装包与使用入口；完整首版验收仍在继续，尚未标记全部范围完成。

Windows x64 安装器已经发布，下载与验证范围见 [Windows 试用版说明](WINDOWS_TRIAL.md)。本页对应 Apple Silicon macOS 本机包。

## 下载与安装

适用于 Apple Silicon macOS，版本 0.1.0。

- [DMG 安装包](../artifacts/macos/Horizon-0.1.0-macOS-arm64.dmg)：打开后，将 Horizon 拖入 Applications。
- [ZIP 应用包](../artifacts/macos/Horizon-0.1.0-macOS-arm64.zip)：解压得到 Horizon.app。
- 本机应用：`~/Applications/Horizon.app`，已从该位置成功启动。
- [使用指南](USER_GUIDE.md)：项目、文件、Git、插件、外观、终端、项目启动和 Pi 配置。

当前应用为本机构建，使用临时签名，未进行 Developer ID 签名与公证。已完成安装包校验、ZIP 解压和应用签名完整性检查，并从最终安装位置启动到项目工作台。

安装包不包含测试项目、模型密钥或模型权重。运行 Horizon 无需 Node.js 或 Rust；Git 使用本机 Git。Pi 按需安装官方固定 1.4.0 运行时，再配置自己的服务地址、模型和认证。

## 开始使用

1. 打开 Horizon，添加自己的项目根目录。文件仍保留在原目录；移除项目登记不会删除源码。
2. 用文件树或 `⌘P` 打开文件，`⌘S` 保存；`⌘⇧F` 搜索项目。Git 面板先审查、再暂存和提交，推送另行执行。
3. 需要 AI 时，进入“设置 → AI 连接”。配置后点击“测试”；“已配置 · 未验证”表示尚未连通验证。密钥可在应用内输入，无需发到聊天里。
4. 需要运行项目时，配置并审阅启动方案后批准运行。终端同样在显式新建会话后才启动。

## 当前验证边界

- 已用 macOS 原生应用操作项目、文件、编辑、搜索、Git、插件、外观、终端和恢复流程。逐项结果与失败记录见[验收入口](verification/README.md)，不能把某个流程通过等同于全部要求通过。
- Pi 使用真实 1.4.0 进程与本机受控协议服务验证；回复由测试服务产生。尚未使用你的服务地址或密钥，真实供应商连通性未验证。
- Pi 已完成隔离副本授权写入、修改版本冲突拒绝、断连后显式继续、认证失败保留输入等原生验证。带活动资源退出已完成取消、保存失败保留、正常退出清退及重开无自动重放；会话凭据重开后确实失效。
- Git 外部分支刷新、跨项目返回后的写任务停止入口已完成定向原生复验；启动器、插件安装/更新/启停/卸载/恢复及实际进程清退也已留证。各项具体范围见[需求矩阵](verification/MACOS_ACCEPTANCE.md)。
- 对单个 Horizon 进程限制联网后，本地文件保存与 Git diff 均可用；一次远程 Fetch 返回 DNS 解析失败，随后仍能继续本地操作并正常退出。原始操作和本机验收范围见[离线记录](verification/results/offline-boundary-nfr006-audit-20261102/audit.json)。
- 未保存表单使用系统确认框。真实按钮可访问性、Esc、Return 默认继续编辑和原焦点恢复已复验。崩溃后草稿正文与选区可恢复，原文件不自动覆盖；本包还修复了恢复成功后旧提示残留，并用现存草稿完成一次原生复验。
- 此前 18:40 构建（主程序 `12ed732b…`）已测零/单/双 Pi 场景：Horizon 连同辅助进程及 Pi 的物理内存中位数分别为 189.748 / 275.585 / 380.263 MB；单 Pi 全窗口峰值 320.952 MB。受控服务另计，流式输出 CPU 不作为空闲指标；方法、原始数据与边界见[资源测量](verification/results/pi-fixed-performance-20261101/README.md)。
- 此前主程序 `4d4bca76…` 包完成[20 次独立进程启动](verification/results/final-startup20-observer-20261102/README.md)：端到端中位数 707.410 ms、P95 751.406 ms，包含自动化和可访问性探测开销，系统缓存保留。全部原始尝试、正常退出和测量后额外进程的独立清退记录均保留。
- 此前 `9316ce98…` 包全功能卸载后的 125 秒实测，包含全部归属辅助进程的稳态物理内存均值为 228.012 MB，高于 200 MB 建议值；空闲 CPU 均值为单核 0.375%。没有将此值标为内存预算通过，见[测量原件](verification/results/plugins-empty-host-performance-20261102/README.md)。
- 八布局视觉对照仍在进行；本轮补齐 AI 空态、外观方案空态和编辑工作台的正确状态，并修正已确认的组件比例。Windows x64 已有原生 CI 测试和 OS 窗口记录，前端交互与 macOS Intel 尚未实测。

## 构建身份

当前安装包于 2026-11-02 07:27（UTC+8）构建完成。本次主要修正样式：AI 侧栏与石墨模式切换外形、Git 提交区和弹窗、插件弹窗与搜索框、外观方案保存行，以及搜索空态的简短说明与换行。完整构建、签名、安装包与安装副本校验已完成；本轮原生定点复查正在进行。此前系统表单确认、Git、插件清退、Pi 和编辑器修复保留，功能及性能场景继续绑定其原测试包。

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| DMG | 20,061,909 | `18f9b7c93625e97ea3eb17741ecf9cd82fa8ba92fa88f18bb8d7b6359e271dbb` |
| ZIP | 15,897,468 | `629090ca778081008267dd0bbee809a9ef52c794e9dc57358ec552318882579b` |
| 应用主程序 | 19,911,168 | `5fa2ad4fa8af9dc05a88e1f3247f7ed1914add4e14f0bad4b98f15dea8ce5b13` |

[构建与打包回执](verification/results/search-empty-polish-release-20261102/release-build-receipt.json) · [归档与签名校验](verification/results/search-empty-polish-release-20261102/archive-verification.json) · [安装副本校验](verification/results/search-empty-polish-release-20261102/installation-copy.json)

从源码复现：在仓库根目录执行 `npm ci`，再运行 `npm run desktop:release`。需要指南中列出的 Node.js、Rust 与 Xcode Command Line Tools；输出仍为上方两个安装包路径。重新构建后的摘要可能不同，以新回执为准。
