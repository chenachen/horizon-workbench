> Root 2026-11-01: 本隔离探针已用下述 `-parse-as-library` 命令编译通过（见 compile-receipt.json），仍未运行。GUI 启动时父日志写入 fixture/actions.jsonl；保留子 stdout JSON。

# 短命原生选择器：可行性与待运行探针

仅准备源文件，未编译、未启动、未改Horizon产品源码。编辑器热24等固定测量结束后，由根任务分配独立GUI/采样空档。

## 当前判断

可以进行一次有判别力的进程生命周期实验；尚不能作为透明替换落地。现有 `scripts/desktop-run.mjs:27–34` 构建并复制target后缀侧车，`apps/desktop/src-tauri/tauri.conf.json:32` 声明externalBin，`src/git.rs:132–154,228–284` 已有同目录可执行文件定位、stdin/stdout、PID登记和wait。新增按需picker可复用这条管线，不需要新文件管理器或常驻服务。

主要限制是窗口语义：`beginSheetModal(for:)`的参数是调用进程中的NSWindow对象；rfd的raw-window-handle同样转换为本进程对象指针，不能把Horizon的指针传给另一个进程。独立helper只能拥有自己的原生面板，无法直接附着Horizon窗口成为当前sheet。这会改变模态关系、Esc/Cmd-W行为、窗口层次、Spaces和焦点。若必须保持当前sheet，则否决此方案；探针的CPU收益不能消除此限制。

路径与取消可以保留：子进程返回一条JSON（status、绝对路径或null），宿主继续生成现有selection token并负责实际文件读写。异常exit/无结果需与用户Cancel区分。非沙盒当前构建可用路径访问；若未来启用App Sandbox，helper获得的访问授权不能假设仅凭路径转给宿主，当前探针不验证该场景。

rfd可在子进程主线程使用同步FileDialog，返回路径后正常结束；也可直接使用现有AppKit依赖。当前探针选择系统AppKit，排除Tauri/rfd实现差异。生产若改用Rust+rfd，仍须另验实际构建，不把Swift探针结果当成集成通过。

## 最小因果验证

`PanelLifetimeProbe.swift`是同一可执行文件的两种模式：

- 父模式：一个原生窗口，file/folder/save三个按钮；spawn自身加 `--picker`，记录子PID与终止结果；关闭子面板后父窗口和父进程继续存在。
- 子模式：Accessory AppKit app，不新增Dock项；真实NSOpenPanel/NSSavePanel完成或Cancel后复制路径、输出JSON，下一次主队列调度调用公开 `NSApplication.terminate`。不调用orderOut/close额外补丁，不杀任何系统进程。
- 不替用户写保存文件，仅验证选中路径或取消；真实导出文件写入仍属于产品集成验收。
- 不强抢返回焦点。回报面板完成及子退出后的frontmost PID，实际检查父窗口焦点；缺少焦点回归就是待解决的代价。

根任务给空档后再构建，以下命令当前均未执行：

```sh
rtk proxy mkdir -p .work/picker-lifetime-probe/PanelLifetimeProbe.app/Contents/MacOS
rtk proxy cp .work/picker-lifetime-probe/Info.plist .work/picker-lifetime-probe/PanelLifetimeProbe.app/Contents/Info.plist
rtk proxy xcrun swiftc -swift-version 5 -parse-as-library -O -framework AppKit .work/picker-lifetime-probe/PanelLifetimeProbe.swift -o .work/picker-lifetime-probe/PanelLifetimeProbe.app/Contents/MacOS/PanelLifetimeProbe
```

在同级 `fixture/` 准备专用空目录及一个小文本文件，原生GUI启动Probe.app无需参数。可选父进程参数可覆盖为其他明确归属的夹具目录；禁止选择用户真实项目。源文件尚未经编译验证，首次构建应只修正编译问题，不顺带扩展功能。

1. 记录父PID/start/binary hash、Horizon旧PID及旧panel40868身份；后者一直留在Horizon原组。
2. 先记录父窗口空闲和所有现存OpenSavePanel helper；点一个按钮，记录子PID、实际新生helper PID/start与归属。原生操作真实选文件/目录/保存路径，或Cancel。不得关闭父窗口。
3. 子正常exit后父仍运行，继续用既有 `scripts/desktop/sample_macos.py` 采125秒；沿用前60秒预热政策，并保留开始/结束进程身份快照。复用 `--members` 显式登记已证明关联的子/系统helper，采样器的retained identity追踪继续计存活helper。
4. 所有新生服务，即使责任PID继承父或退出后重新归属，也必须继续计入。出现一条新的panel PID但无法证明归属时保留为未明成员，不能靠切换responsibility分组降低总量。
5. 一次OpenPanel成功与一次Cancel若均显示子退出、父存活、新服务退出且总CPU回基线，再补SavePanel路径与取消，确认不是单一面板行为。若第一例helper仍存活且高CPU，停止扩展此方案，保留失败。
6. 全部完成后，才关闭父窗口让父正常退出。父退出后helper消失只能作为补充，不能替代“父仍存活时子退出”的核心证据。

## 判定与真实代价

进程responsibility是计量归属，不足以证明XPC连接的生存期。父/子同可执行文件、同bundle身份，可直接观察父保持存活是否仍使子创建的服务留存；不能预先假设child PID就是service责任PID。成功门槛是原始PID/start证据、正常子退出、长期父存活和所有关联资源总量，不是stdout出现了结果。

如果子正常exit后服务仍由父持有，或只把服务改归其他进程却继续消耗，则否决收益。若服务确实释放，仍需权衡：每次冷启AppKit/XPC的时延与瞬时内存；一个额外签名/打包的Mach-O和macOS构建分支；宿主单次请求并发、用户取消、宿主退出的协调；独立窗口及焦点变化。耗时与包体不能在未构建前量化。当前已有stdio/PID管线能降低接入成本，但不能省掉这些行为验收。

不准备自动杀服务、不增加私有AppKit调用、不修改系统文件面板默认视图、不让采样排除helper。维持Horizon现有原生选择器，直到实验与窗口/焦点取舍明确。

公开依据：[modeless panel](https://developer.apple.com/documentation/appkit/nssavepanel/begin(completionhandler:))、[sheet parent](https://developer.apple.com/documentation/appkit/nssavepanel/beginsheetmodal(for:completionhandler:))、[正常应用退出](https://developer.apple.com/documentation/appkit/nsapplication/terminate(_:))、[Accessory activation policy](https://developer.apple.com/documentation/appkit/nsapplication/activationpolicy-swift.enum/accessory)、[应用激活仅为尝试](https://developer.apple.com/documentation/appkit/nsrunningapplication/activate(options:))。本机实现入口与行号见上文；没有把公开API定义扩大为服务退出保证。
