# Horizon macOS 首版安装与验收

更新于 2026-11-02。本页记录当前 Apple Silicon macOS 首版安装包、已完成的本机验收与使用入口。Windows 与其它架构未测范围单列。

Windows x64 安装器已经发布，下载与验证范围见 [Windows 试用版说明](WINDOWS_TRIAL.md)。本页对应 Apple Silicon macOS 本机包。

## 下载与安装

适用于 Apple Silicon macOS，版本 0.1.0。

- [DMG 安装包](../artifacts/macos/Horizon-0.1.0-macOS-arm64.dmg)：打开后，将 Horizon 拖入 Applications。
- [ZIP 应用包](../artifacts/macos/Horizon-0.1.0-macOS-arm64.zip)：解压得到 Horizon.app。
- 本机应用：`~/Applications/Horizon.app`，当前 `5a0a6c5a…` 副本已从该位置正常启动到项目工作台。
- [使用指南](USER_GUIDE.md)：项目、文件、Git、插件、外观、终端、项目启动和 Pi 配置。

当前应用为本机构建，使用临时签名，未进行 Developer ID 签名与公证。已完成安装包校验、ZIP 解压、应用签名完整性与安装副本检查，并从最终安装位置正常启动到项目工作台。

安装包不包含测试项目、模型密钥或模型权重。运行 Horizon 无需 Node.js 或 Rust；Git 使用本机 Git。Pi 按需安装官方固定 1.4.0 运行时，再配置自己的服务地址、模型和认证。

## 开始使用

1. 打开 Horizon，添加自己的项目根目录。文件仍保留在原目录；移除项目登记不会删除源码。
2. 用文件树或 `⌘P` 打开文件，`⌘S` 保存；`⌘⇧F` 搜索项目。Git 面板先审查、再暂存和提交，推送另行执行。
3. 需要 AI 时，进入“设置 → AI 连接”。配置后点击“测试”；“已配置 · 未验证”表示尚未连通验证。密钥可在应用内输入，无需发到聊天里。
4. 需要运行项目时，配置并审阅启动方案后批准运行。终端同样在显式新建会话后才启动。

## 当前验证边界

- macOS 原定项目、文件、编辑、搜索、Git、插件、外观、终端、启动器、Pi 与恢复条款已完成真实操作及必要的生产组件验证。矩阵保留全部 104 条需求、39 项任务：103 条需求完整，1 条因 Windows 125%／150% 缩放未测保留部分；38 项任务完整，1 项因 Windows 文件占用未测保留部分。逐项证据与历史失败见[验收入口](verification/README.md)。
- Pi 使用真实 1.4.0 进程与本机受控协议服务验证；回复由测试服务产生。尚未使用你的服务地址或密钥，真实供应商连通性未验证。
- Pi 已完成隔离副本授权写入、修改版本冲突拒绝、断连后显式继续、认证失败保留输入等原生验证。带活动资源退出已完成取消、保存失败保留、正常退出清退及重开无自动重放；会话凭据重开后确实失效。
- Git 外部分支刷新、跨项目返回后的写任务停止入口已完成定向原生复验；启动器、插件安装/更新/启停/卸载/恢复及实际进程清退也已留证。各项具体范围见[需求矩阵](verification/MACOS_ACCEPTANCE.md)。
- 对单个 Horizon 进程限制联网后，本地文件保存与 Git diff 均可用；一次远程 Fetch 返回 DNS 解析失败，随后仍能继续本地操作并正常退出。原始操作和本机验收范围见[离线记录](verification/results/offline-boundary-nfr006-audit-20261102/audit.json)。
- 未保存表单使用系统确认框。真实按钮可访问性、Esc、Return 默认继续编辑和原焦点恢复已复验。崩溃后草稿正文与选区可恢复，原文件不自动覆盖；本包还修复了恢复成功后旧提示残留，并用现存草稿完成一次原生复验。
- 此前 18:40 构建（主程序 `12ed732b…`）已测零/单/双 Pi 场景：Horizon 连同辅助进程及 Pi 的物理内存中位数分别为 189.748 / 275.585 / 380.263 MB；单 Pi 全窗口峰值 320.952 MB。受控服务另计，流式输出 CPU 不作为空闲指标；方法、原始数据与边界见[资源测量](verification/results/pi-fixed-performance-20261101/README.md)。
- 此前主程序 `4d4bca76…` 包完成[20 次独立进程启动](verification/results/final-startup20-observer-20261102/README.md)：端到端中位数 707.410 ms、P95 751.406 ms，包含自动化和可访问性探测开销，系统缓存保留。全部原始尝试、正常退出和测量后额外进程的独立清退记录均保留。
- 此前 `9316ce98…` 包全功能卸载后的 125 秒实测，包含全部归属辅助进程的稳态物理内存均值为 228.012 MB，高于 200 MB 建议值；空闲 CPU 均值为单核 0.375%。没有将此值标为内存预算通过，见[测量原件](verification/results/plugins-empty-host-performance-20261102/README.md)。
- 八布局的 528 个适用产品状态已通过原生视觉对照，包括最后 16 个真实安装中与文件加载状态；明显差异已修正。另有 8 个空宿主参考状态与“布局和主题已全部卸载”的条件互斥，单列不适用，不计通过。完整原图与对照见[视觉报告](verification/visual-report.html)。Windows x64 已有十项原生测试与实际欢迎页截图，前端交互、125%／150% 缩放与 macOS Intel 尚未实测。
- 最终验收后正常退出，七个归属进程全部结束；38 个自有测试项目登记及精确关联数据已移入本机私有备份。两个原项目、229 条登记路径、24 个默认插件与全局偏好均保留。同一安装副本已正常重开到欢迎页，应用保持打开，见[最终整理与启动记录](verification/results/final-cleanup-quit-native-20261102/README.md)。

## 构建身份

当前安装包于 2026-11-02 11:50（UTC+8）构建完成，11:52 从安装目录正常启动。保留此前 AI 弹窗、窄窗导航避让及插件检查/安装状态修正；编辑器在真实文件读取与会话恢复期间显示加载骨架，已就绪的内容和错误入口保留；20 项针对性回归已通过，真实冷恢复录像已取得。本次按原生对照将文件树骨架行距由 25px 修正为 41px，八套加载状态对照已完成。自定义扩展包可正常选择、权限默认未勾选，实际安装和卸载已验证；数据与既有插件状态保留。构建、签名、归档及安装副本校验已完成；各功能和性能结果均注明其实际测试构建。

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| DMG | 20,061,536 | `4e16a8dbd4f9ef6be1a1896318de48d3070eb4123062660b4a0a36e31d00a50f` |
| ZIP | 15,899,619 | `62cc373cc1825097d8ccb56b78a0f13be583b71e09569145fece67a357eb636e` |
| 应用主程序 | 19,911,168 | `5a0a6c5a6edca82751a54abe34d0dc40a798f60d49182b70a47bad21e233190d` |
| 原生文件选择器 | 166,992 | `5750db7bf0f848e165f08c3b982321d693e3a9d9978d15b5297f3588d1e101e3` |

[构建与打包回执](verification/results/loading-spacing-release-20261102/release-build-receipt.json) · [归档与签名校验](verification/results/loading-spacing-release-20261102/archive-verification.json) · [当前安装副本](verification/results/loading-spacing-release-20261102/installation-copy.json) · [原生启动身份](verification/results/loading-spacing-release-20261102/native-installed-identity.json)

从源码复现：在仓库根目录执行 `npm ci`，再运行 `npm run desktop:release`。需要指南中列出的 Node.js、Rust 与 Xcode Command Line Tools；输出仍为上方两个安装包路径。重新构建后的摘要可能不同，以新回执为准。
