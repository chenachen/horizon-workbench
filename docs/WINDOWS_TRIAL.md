# Horizon Windows 试用版

面向 Windows x64。[当前试用版已发布](https://github.com/chenachen/horizon-workbench/releases/tag/windows-ae6bdba42eff)，对应 commit `ae6bdba42eff324c3e409c3d046d648aec1f0d6b`。后续构建见[发行列表](https://github.com/chenachen/horizon-workbench/releases)。

## 安装

下载 [setup.exe](https://github.com/chenachen/horizon-workbench/releases/download/windows-ae6bdba42eff/Horizon_0.1.0_x64-setup.exe) 或 [MSI](https://github.com/chenachen/horizon-workbench/releases/download/windows-ae6bdba42eff/Horizon_0.1.0_x64_en-US.msi)，选择一种安装即可。两份安装器已下载并核对 [SHA256SUMS.txt](https://github.com/chenachen/horizon-workbench/releases/download/windows-ae6bdba42eff/SHA256SUMS.txt)。

应用运行无需 Node.js 或 Rust。安装器会检查 WebView2；缺少时需要联网下载其安装程序。当前为未签名试用版，公司电脑能否安装取决于公司的软件策略。

Git 面板需要 Git for Windows。在“设置 → Git”检测 Git；未找到时选择本机 `git.exe`。项目阅读、编辑和搜索不依赖 Git。Pi 运行时在启用 AI 后单独安装，服务地址、模型与凭据由你配置。Pi 任务副本使用 PATH 中的 `git.exe`，因此需将 Git for Windows 加入 PATH；仅在 Git 设置中选择路径不会替代这一要求。

## 开始使用

1. 添加一个项目目录，用文件树或 `Ctrl+P` 打开文件；`Ctrl+S` 保存，`Ctrl+Shift+F` 搜索项目。
2. Git 面板先审查改动，再暂存和提交；推送是独立操作。
3. 终端和新建 Shell 启动步骤默认使用 PowerShell。启动自己的项目时，检查命令、工作目录和启动计划后再执行。
4. “设置 → 外观”调整布局、主题、字体和背景；外观在所有项目间共用。

更多操作见[使用指南](USER_GUIDE.md)。

## 验证范围

该构建完成 Windows 原生编译和双安装器生成；QuickJS、进程 Job、终端、存储、Pi 通信与凭据等 9 项测试各实际通过 1 次，包括真实终端的中文输出、窗口尺寸调整与停止，以及真实 Pi 运行时的受控短会话。主进程启动 5 秒后仍存活，Horizon 窗口存在且响应。完整结果见[构建记录](https://github.com/chenachen/horizon-workbench/actions/runs/41345035358)。尚无 Windows 桌面人工操作验收；macOS 功能记录见[验收入口](verification/README.md)。

完整首版功能与八套布局视觉验收继续进行。你的模型供应商连接仍需在应用内测试。

## 从源码构建

Windows 构建需要 Node.js 24、Rust stable MSVC、Visual Studio C++ Build Tools 和 WebView2 开发前置条件，参见 [Tauri Windows 环境准备](https://v2.tauri.app/start/prerequisites/#windows)。

```powershell
npm ci
npm run desktop:release -- --bundles nsis,msi
```

安装器位于 `apps/desktop/src-tauri/target/release/bundle/`。CI 同时发布构建身份、SHA-256 与原始日志。
