同一次主窗口 PNG 观察候选（未应用、未执行）

仅 scripts/windows-startup-smoke.ps1 一文件。baseline96834fef…；after5980359d…。
新增78行：一个只读屏幕复制函数和一个调用。完整diff见source.patch，完整SHA见manifest.json。

可行性/边界：当前原始结果证明Windows Session2、main HWND与同PID存活，但UIA button_not_observed未确认可见内容。Windows标准System.Drawing Graphics.CopyFromScreen支持把实际屏幕像素复制到Bitmap，再保存PNG。新调用位于既有Host/唯一UIA观察结束之后、原Horizon精确PID/start清退之前，不启动额外主程序或helper。

观测只读：
- 复核同PID/start；用原5s记录的HWND再次GetWindowThreadProcessId确认归属。
- GetWindowRect读取实际窗口外框（含resize边框）；仅观察线程临时PER_MONITOR_AWARE_V2，finally恢复，避免GetWindowRect的DPI虚拟化混淆物理像素。目标Horizon的DPI/窗口状态不变。
- 只截窗口与虚拟屏幕的交集，记录完整矩形/实际复制矩形/裁剪/前台HWND，不激活、不置顶、不输入。可见屏幕上的遮挡内容会如实进入图像。
- 仅一次CopyFromScreen，成功后保存artifacts/windows/main-window.png并记录bytes/SHA/UTC。旧UIA负结果及所有10tests/发布gate/原清退块逐字保持。

显示会话限制：原Session0/WebView2缺失门继续skip。隐藏/最小化/无屏幕交集、.NET绘图或系统像素复制不可用时记录capture_unavailable和原异常，不创建替代图、不重试、不扩大平台。Session2并不单独证明桌面可抓取；本候选尚未在Windows执行，不能宣称已得截图。captured只表示系统复制/PNG保存成功，仍须亲看真实图，不能自动把黑屏/遮挡/负UIA改判成前端通过。

归档：现有workflow artifacts/windows/ always-upload自然包含PNG与startup-smoke.json中的截图元数据。无需改workflow，正式release仍是原5资产；PNG可从本次job artifact取回，不新增GUI/启动轮或诊断框架。

静态核对：删除新增函数及调用后原脚本逐字重建；main/helper启动数量不变，UIA脚本SHA不变且FindFirst仍1；截图函数没有循环或输入/焦点调用；CopyFromScreen/Save各1。git apply --check exit0。没有PowerShell执行、Add-Type编译、屏幕/API探测、产品构建/修改、GUI、VM、CI触发或新依赖安装。

Microsoft原API依据/语义见api-basis.json（已只读核官方原文）：
- GetWindowThreadProcessId确认HWND的创建进程。
- GetWindowRect返回窗口屏幕矩形且会DPI虚拟化，右/下为exclusive边界。
- SetThreadDpiAwarenessContext仅改调用线程，返回旧context供恢复。
- Graphics.CopyFromScreen执行真实屏幕像素块复制；调用失败可抛Win32Exception。

此目录无实际PNG证据。Root可在下一次必要Windows发布前审查是否集成，Nav不应用、不触发。
