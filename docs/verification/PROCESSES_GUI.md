# 终端与项目启动器 macOS 验收

candidate5 已完成下述真实桌面流程。candidate6 已通过终端、方案保存与 URL 子进程回收的针对性原生 GUI 复测；不将服务测试等同于 GUI 通过。

## 构建与原始记录

- 应用：`apps/desktop/src-tauri/target/release/bundle/macos/Horizon.app`，release candidate5，macOS aarch64，版本 0.1.0。
- GUI 时段：2026-10-30 19:42:33–20:08:40 UTC。PID 91978，原生窗口 13912。1280×800 开始，实拖至 1101×714，结束恢复 1280×800。
- 全程原生点击、键盘、菜单与文件选择器，没有内部 JS 调用。PNG 由 macOS 原生窗口截图取得；010 是应用实际打开的浏览器窗口。
- [实际动作](results/processes-gui/candidate5-actions.jsonl)、[GUI 诊断原文件](results/processes-gui/candidate5-after-processes.json)、[退出核对](results/processes-gui/candidate5-exit.json)。
- verification 独立采样 1800.0044 秒、871 样本；退出后确认 69 个归属 PID＋启动身份全部消失。见[生命周期采样](results/candidate5-lifecycle-30m/)。

## 服务级证据

实现：`apps/desktop/src-tauri/src/processes.rs`、`apps/desktop/src/features/processes/`。

[原服务测试](results/processes-gui/service-tests.log)和[candidate6 修复后回归](results/processes-gui/candidate6-service-tests.log)均为 21 通过、0 失败、1 个辅助测试忽略；全量 `desktop:check` 通过。

```sh
rtk proxy cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --lib processes::tests -- --test-threads=1
rtk npm run desktop:check
```

另覆盖：8 MiB 隐藏输出持续消费与 2 MiB 历史上限、输入背压期间停止、凭据跨包脱敏、依赖环拒绝、后台服务失败清理、租约自然退出释放。`http_fixture_server` 是 HTTP 测试实际派生的辅助进程，外层 ignored 不代表 HTTP 未测。

原生事件名使用 `horizon:terminal:v1`、`horizon:process:v1`、`horizon:launch:v1`、`horizon:extension:v1`。AppHandle 回归采用 MockRuntime；下述真实 PTY/运行状态更新另证明 WebView 接收链路。

## 隔离样本

主目录 `/tmp/horizon-processes-gui.XifnCp`。七个 .mjs 在运行前通过语法检查，准备阶段没有执行脚本。package scripts 为 api、web、fail、slow、中文、once。

| 方案 | 用途 |
| --- | --- |
| 01-双服务.horizon.json | API 59130 HTTP 就绪后启动 Web 59131；保存手动 URL；API 派生子进程 |
| 02-失败回收.horizon.json | API 就绪后第二步退出 23；测试默认清理、界面改为保留排错 |
| 03-超时回收.horizon.json | 服务 2.5 秒后监听 59132，方案超时 500 ms |
| 04-PTY中文.horizon.json | 中文 stdout 标记就绪，自动定位 PTY |
| 05-一次性.horizon.json | 备用；本轮一次性任务由发现→草稿编辑→保存得到 |
| 06-取消启动.horizon.json | 等待不存在的就绪标记 30 秒，留出实际取消时间 |

第二项目 `/var/folders/9j/xnw538c934b2s559tl01cc800000gn/T/horizon-processes-other.7w7xhipb` 使用不占端口的常驻服务，验证跨项目隔离。

## candidate5 真实结果

| 项目 | 观察与证据 |
| --- | --- |
| 空终端不启动 shell | 展开前后没有 Horizon 子 shell；新建后 PID 98648、父 PID 91978。见 [002](screenshots/processes/002-empty-terminal.png)、[003](screenshots/processes/003-pty-chinese-pid-size.png)、[PID](results/processes-gui/terminal-pid.txt) |
| 中文、复制、Ctrl+C、F6 | 中文粘贴回显；双击 COPY_TOKEN_中文 后 Cmd+C 得到原文，前台 sleep 仍运行；Ctrl+C 停止 sleep，shell 继续执行。F6 聚焦已打开的 package.json 编辑器。见 [005](screenshots/processes/005-copy-ctrlc.png)、动作记录 |
| 真实系统输入法 | 简体拼音逐键 n/i/h/a/o，AX 出现 ni hao 组合态；Space 提交“你好”，Return 后中文回声。不是粘贴模拟。见 [019](screenshots/processes/019-real-pinyin-ime.png)、[IME](results/processes-gui/ime.json) |
| 原生窗口 resize | stty size 从 9×126 变为 9×101。见 [004](screenshots/processes/004-pty-native-window-resize.png) |
| 隐藏、专注、切项目保留 | shell 进入 terminal-cwd 持续输出；隐藏、专注、切 Aurora 再返回，PID 98648、cwd 保持，输出序号继续推进。见 [006](screenshots/processes/006-persistent-pid-cwd.png) |
| 发现、草稿、保存 | 发现六个脚本时没有执行生成的 PID/log；once 加入草稿、改为一次性命令并保存。见 [007](screenshots/processes/007-script-discovery-readonly.png)、[基线](results/processes-gui/discovery-baseline.json) |
| 首次审阅与复用 | 审阅实际 npm 路径、run/once 参数、cwd、就绪策略；批准后日志 ONESHOT_DONE，再启动未重复授权。见 [008](screenshots/processes/008-first-command-approval.png)、动作记录 |
| 导入、导出 | 导入为新 ID、未授权草稿，保存后首次启动须批准；原生保存器导出成功，profileId/projectId 为空、revision=0。见[实际导出](results/processes-gui/exported-dual.horizon.json) |
| 双服务依赖、端口、日志 | API 5987、child 5988、Web 5992；真实 HTTP/TCP 归属匹配，均显示就绪已验证；运行中启动禁用，Web 日志 WEB_READY 59131。见 [009](screenshots/processes/009-dualservice-ready.png)、[OS 归属](results/processes-gui/dualservice-running.json) |
| 手动 URL | 浏览器显示“API → Web 依赖启动通过”。见 [010](screenshots/processes/010-manual-open-url.png)。URL helper 回收缺陷见下方 |
| 重启、逆序停止 | 自有端口不误报冲突；旧组三 PID 消失，新组 7104/7105/7109 就绪。两次 stop-order 均 web→api；停止后新组三 PID 消失，直接终端仍活。见[重启](results/processes-gui/restart.json)、[停止](results/processes-gui/dualservice-stopped.json) |
| 默认失败清理 | 第二步退出 23，API 13655/child 13656 消失；另一项目 12301、终端 98648 仍活。错误可见。见 [012](screenshots/processes/012-default-failure-cleanup.png)、[OS 结果](results/processes-gui/default-failure.json) |
| 保留排错 | 修改策略后重新审阅；显示部分运行，API 14449/child 14450 仍活；手动停止后消失。见 [013](screenshots/processes/013-keep-running-on-failure.png)、[记录](results/processes-gui/keep-running.json) |
| 就绪超时 | 500 ms 超时报错；无 Horizon 所属 slow 进程、59132 无监听；另一项目仍活。见 [014](screenshots/processes/014-readiness-timeout.png)、[OS 结果](results/processes-gui/timeout.json) |
| 取消 | 等待中点击取消，PID 16615 消失，界面显示操作已取消；另一项目仍活。见 [015](screenshots/processes/015-launch-cancellable.png)、[取消](results/processes-gui/cancel.json) |
| 外部端口 | 工具另起 listener 17195；预检拒绝 59130 占用，外部 PID 仍活且返回 EXTERNAL_OWNER。验证后工具清理自己的 listener。见 [016](screenshots/processes/016-external-port-not-stopped.png)、[结果](results/processes-gui/external-port.json) |
| 来源变化重审 | 给实际 api.mjs 追加无行为变化的注释，hash 改变后重新审阅；取消后没有执行。见 [017](screenshots/processes/017-source-change-reapproval.png)、[hash](results/processes-gui/source-change.json) |
| PTY 方案与插件依赖 | 就绪后自动关闭设置并选中 PID 20065，中文交互正常。暂停当前项目终端的预案列出直接终端 98648＋启动器 PTY 20065，确认后均消失；另一项目 12301 继续运行。见 [018](screenshots/processes/018-launch-pty-chinese-auto-focus.png)、[020](screenshots/processes/020-terminal-pause-plan.png)、[结果](results/processes-gui/terminal-pause.json) |
| 跨项目与最终清理 | 第二项目服务始终保留，最后由其底栏停止，stopped.log 为 SIGTERM。全部活动夹具 PID 消失。见 [011](screenshots/processes/011-other-project-running.png)、[最终核对](results/processes-gui/all-fixture-processes-stopped.json) |
| 原生退出 | 采样结束后 Cmd+Q 出现退出确认，处理并退出后 91978 消失。退出前活动服务已清理，不据此声称带活动服务退出通过。见 [022](screenshots/processes/022-native-cmdq-confirm.png)、退出核对 |

## 实机问题与 candidate6 修复

均已通过服务回归和 TypeScript 检查；下表明确区分 candidate6 GUI 已复测与仅服务级覆盖。

| 问题 | 修复与复测 |
| --- | --- |
| 两层终端标题，与 E01 单层不符 | TerminalPanel 增加启动方案/关闭回调，宿主省去重复标题；candidate6 [023](screenshots/processes/023-candidate6-single-header-live.png) 为单层标题 |
| 运行中显示退出码 (null) | 按可空退出码渲染；candidate6 运行中 PID 41752 不显示 null，结束后显示实际退出码 1 |
| 保存后仍显示“未授权草稿” | 保存成功清除过期导入提示；candidate6 导入 PTY04、改名 PTY candidate6 并保存后实际消失 |
| 设置保存后，底栏仍“在设置添加启动方案” | 保存/删除发同项目失效通知，底栏刷新并选中新方案；candidate6 关闭设置后立即选中新方案，直接从底栏启动成功 |
| 失败/超时步骤缺 PID | spawn 完成即记录，不等就绪；此次短回归没有重跑失败/超时 GUI |
| 历史运行顺序随 HashMap 快照变化 | 返回 createdAt，界面按创建时间降序显示最近五次；此次短回归没有构造多次历史 GUI |
| URL helper 6508 留 defunct 约 17 分钟 | spawn 后丢 Child 改为 status 回收短命 open，非零退出报错；candidate6 连续实际打开同一 URL 三次，每次 OS 检查均无 open 或僵尸子进程 |

## candidate6 针对性复测

同一 release 路径，PID 33304、窗口 14467、1280×800。2026-10-30 20:16:55 UTC 导出初始诊断，20:27:52 导出末诊断，随后交回 GUI；没有退出或重建此采样中的应用。

- [实际动作](results/processes-gui/candidate6-actions.jsonl)。恢复当前项目终端插件，导入 PTY04 为新草稿，改名并保存。底栏立即选中 `PTY candidate6`；从底栏审阅并启动后自动聚焦终端。
- 点击终端“结束进程”，界面切为已退出 (1)，`ps` 确认 PID 41752 消失。见 [OS 核对](results/processes-gui/candidate6-pty-stop.json)及 [023](screenshots/processes/023-candidate6-single-header-live.png)。
- 双服务实际运行 PID 43698、子进程 43699、Web 43703；同一“打开 URL”按钮连续三次，浏览器三个新标签均为 `http://127.0.0.1:59131/`、标题“Horizon 启动验收”。每次检查父 PID 33304 的子进程，均只有两个服务，无 `open` 或 `Z` 状态。见[服务归属](results/processes-gui/candidate6-dualservice.json)、[三次 URL 记录](results/processes-gui/candidate6-open-url.jsonl)。
- 实际点击“停止全部”，上述双服务三 PID 与 PTY PID 全部消失。见[最终核对](results/processes-gui/candidate6-all-stopped.json)。
- [前诊断](results/processes-gui/candidate6-before-processes.json)、[后诊断](results/processes-gui/candidate6-after-processes.json)均经原生设置→数据与隐私→导出诊断→保存器得到。两次 watchers=1、subscriptions=2；后诊断 openDocuments=1，taskRecords.active=1 是任务记录计数，不是测试服务残留。[024](screenshots/processes/024-candidate6-diagnostic-export.png)显示导出成功。

[001](screenshots/processes/001-project-context-expired.png) 的新项目红条是上一项目休眠后旧 scope 异步打开留下的错误；打开文件后清除。editor 已定位并另行修复。

## 本轮 GUI 未证明的边界

- candidate6 的失败/超时 PID 提前显示、多个历史记录排序没有额外 GUI 复测；其余上述实机修复已完成针对性复测。
- 各主题/布局的逐项视觉对照：本轮是 Mist 浅色和两种窗口宽度，不能扩写为八布局全部通过。
- 隐藏高吞吐与背压上限由真实 PTY 服务测试证明，未另作本轮 GUI 压力记录。
- 带活动终端/启动器的应用退出、禁用的同类资源清理，结合主线后续验收；本轮明确验证暂停。
- 没有可控真实 OS 停止超时夹具。忽略 SIGTERM 后被 SIGKILL 成功回收，不能算 TIMEOUT 残留保留通过。

## candidate7 条件补齐（源码冻结，待原生复测）

按 PRD 的保存触发条件补上 `onReady.autoOpenUrl`：默认手动，明确勾选后在对应步骤达到所选就绪条件时打开保存快照中的 URL，每次运行每步骤只尝试一次；日志文本不能触发打开。活跃方案删除改为显示运行组、步骤与 PID 的确认框，取消不停止或删除，确认后必须先全部停止成功才删除配置。运行期间保存新配置会提示当前运行版本与新保存版本，重启审阅显示版本变化。Windows 程序路径在 macOS 预检提示编辑为当前平台路径。

[candidate7 服务回归](results/processes-gui/candidate7-service-tests.log)：24 通过、0 失败、1 个辅助测试忽略，6.08 秒；`desktop:check` 通过。新增真实进程断言覆盖保存新版本后旧运行快照不变、重启采用新版、活跃实例阻止删除、停止后删除仅影响配置；失败依赖者确实没有执行写标记。自动 URL 测试经过生产启动调度，只替换最终系统打开函数为计数器，证明就绪后调用一次、保存变化不改旧 URL、未就绪与任意日志 URL 不调用；实际浏览器仍待 candidate7 GUI。

专用夹具仅准备，未启动常驻服务。见[准备记录](results/processes-gui/candidate7-fixture-preparation.json)。本节不将源码修复或服务测试扩写为候选7 GUI 通过。

## candidate8 停止失败的受控服务证据

[定向原始日志](results/processes-gui/candidate8-controlled-stop-failure.log)、[实际身份与状态记录](results/processes-gui/candidate8-controlled-stop-failure.json)：一个定向测试通过，0 失败，0.51 秒；TypeScript 检查通过。真实 shell 97048 与子进程 97049 属于 PGID 97048；第二个真实服务 97050 在文件闸门放行后退出 23。测试仅针对这一真实运行组，在发送 OS 信号前注入一次停止错误，随后走生产清理状态机。

失败后实际 PID/PGID 仍在，运行保持 `partial`，步骤保持 `stopping` 并记录停止错误，资源与扩展租约仍可见；重复启动和删除配置均返回 `RESOURCE_BUSY`，没有新运行组。重试使用真实系统信号，三个 PID、进程组和资源全部消失，租约释放，停止错误清除。

由此修正后台失败清理只检查 `stop_run` 是否返回成功、却忽略其 `failed[]` 的缺陷：只有失败列表为空才能标为已完成失败清理。停止错误现由真实步骤状态传至界面。注入表和触发点均为 `cfg(test)`，release 没有开关。本证据证明真实自有进程在受控停止错误下的生产状态处理；不声称复现 OS 拒杀、不可杀进程或 GUI 停止失败。
