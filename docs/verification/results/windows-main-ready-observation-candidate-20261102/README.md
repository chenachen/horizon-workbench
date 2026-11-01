仅候选，未应用/未执行

基于main 4d27cfb22304f784bb811dce7365dfffbaf3b14d，范围严格为：
- scripts/windows-startup-smoke.ps1
- 新 scripts/windows-uia-ready.ps1（52行、ASCII；中文按钮名经pwsh7的Windows Unicode参数传入WindowsPowerShell5.1，避免旧PowerShell按ANSI读无BOM中文脚本）。

行为：原5s OS快照及status/frontend_interactive字段、原单次main启动、精确PID/start清退块全部逐字保留。新增Host观察从5s快照后开始，剩余预算=max(0,30s-本次process实际UTC年龄)，Stopwatch限制剩余等待，最多每250ms检查同PID/start存活及正确Roaming目录下2个文件是否存在。两文件均出现时只解析一次JSON，记录schema/结构是否有效及第一次观测UTC/进程年龄；没有读配置全文输出，没有appdata写入。若未观察到/进程退出/读取异常，记录诊断状态，不更改原发布门。

必写依据（host-markers-source.txt为4d冻结源码）：HostState::new100–108总会mkdir并atomic_json根registry.json；fresh初始化extensions::initialize195→read_registry165–178总会写extensions/registry.json（builtin记录）。既有脚本已要求两个appdata目录此前不存在，故这里不依赖懒写的settings/appearance文件。只观察到文件不等于完整setup/前端已交互。

Host文件观察后，仅一次独立WindowsPowerShell5.1只读UIA helper：验证目标PID/start和HWND所有者，FromHandle该窗口，FindFirst Descendants中Name=打开本地项目且ControlType.Button。只读Name/IsEnabled/IsOffscreen/rectangle，禁止Invoke、SetFocus、输入或项目访问。父脚本以剩余3s WaitForExit限制helper，超时只停止同PID/start的自有helper；原main清退保持不变。不循环UIA、不重试、不再启动Horizon。原frontend_interactive依旧not_evaluated。

观察结果只增加host_readiness/frontend_readiness与独立artifact JSON/stdout/stderr，不修改原9tests/workflow/release gate。按钮未找到、UIA不可用、超时或Host未出现记录not_observed/observation_error，不能据此自动认定产品故障。首次观察时间是采样上界，不是精确setup耗时，也不是2秒启动性能或实际点击通过。历史a721权限失败仍未解释，现有4d trial不受阻塞。

静态验证：去掉新增函数和诊断块，startup原件逐字重建一致；main启动点仍1、只读helper启动点1；helper FindFirst仅1、无循环/Invoke/焦点。参数/managed UIA/.NET API签名及ps7/WindowsPowerShell5.1引用已静态审查；git apply --check exit0。未本机编译、未执行PowerShell/UIA/GUI/主程序/服务/CI、未触碰产品或真实appdata。

manifest.json给patch与before/after SHA；static-review.json给明确静态边界，非运行通过。两个新报告已位于现有artifact目录，workflow无需修改。

官方API依据：
https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.automationelement.fromhandle?view=windowsdesktop-9.0
https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.automationelement.findfirst?view=windowsdesktop-9.0
https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.automationelement.automationelementinformation.isenabled?view=windowsdesktop-9.0
https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/start-process?view=powershell-7.5
