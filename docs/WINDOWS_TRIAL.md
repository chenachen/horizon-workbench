# Horizon Windows 试用版

面向 Windows x64。当前正在准备首轮 Windows CI；本页将在安装器生成后补入对应 commit、下载地址和校验值。

## 安装

构建成功后，从本仓库的 Windows 预发布下载 `setup.exe` 或 `.msi`，选择一种安装即可。`SHA256SUMS.txt` 对应同次构建的安装器。

应用运行无需 Node.js 或 Rust。安装器会检查 WebView2；缺少时需要联网下载其安装程序。当前为未签名试用版，公司电脑能否安装取决于公司的软件策略。

Git 面板需要 Git for Windows。在“设置 → Git”检测 Git；未找到时选择本机 `git.exe`。项目阅读、编辑和搜索不依赖 Git。Pi 运行时在启用 AI 后单独安装，服务地址、模型与凭据由你配置。Pi 任务副本使用 PATH 中的 `git.exe`，因此需将 Git for Windows 加入 PATH；仅在 Git 设置中选择路径不会替代这一要求。

## 开始使用

1. 添加一个项目目录，用文件树或 `Ctrl+P` 打开文件；`Ctrl+S` 保存，`Ctrl+Shift+F` 搜索项目。
2. Git 面板先审查改动，再暂存和提交；推送是独立操作。
3. 终端和新建 Shell 启动步骤默认使用 PowerShell。启动自己的项目时，检查命令、工作目录和启动计划后再执行。
4. “设置 → 外观”调整布局、主题、字体和背景；外观在所有项目间共用。

更多操作见[使用指南](USER_GUIDE.md)。

## 验证范围

Windows CI 结果只对应其标注的 commit。原生编译、安装器生成及实际执行的命令检查分别列出；尚无 Windows 桌面人工操作验收。macOS 上的功能记录见[验收入口](verification/README.md)，不能直接算作 Windows 实测通过。

完整首版验收继续进行，剩余功能和八套布局视觉对照不会推迟本次试用交付。Pi 已使用真实运行时与受控本地服务验证；你的模型供应商连接仍需在应用内测试。

## 从源码构建

Windows 构建需要 Node.js 24、Rust stable MSVC、Visual Studio C++ Build Tools 和 WebView2 开发前置条件，参见 [Tauri Windows 环境准备](https://v2.tauri.app/start/prerequisites/#windows)。

```powershell
npm ci
npm run desktop:release -- --bundles nsis,msi
```

安装器位于 `apps/desktop/src-tauri/target/release/bundle/`。CI 同时发布构建身份、SHA-256 与原始日志。
