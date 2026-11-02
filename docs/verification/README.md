# macOS 验收与性能工具

本目录维护真实应用证据。功能矩阵覆盖 104 条首版需求、39 项首版任务；视觉索引保留 8 × 73 项设计。当前状态看 [功能矩阵](MACOS_ACCEPTANCE.md)、[视觉矩阵](VISUAL_MATRIX.md) 与 [交互对照报告](visual-report.html)。工具自检不等于应用通过。

实测结果与未测场景见 [性能报告](PERFORMANCE.md)。

2026-11-02 本次交付：356 条功能证据，需求 103 完整 / 1 部分，任务 38 完整 / 1 部分；528 个适用视觉状态通过，8 个参考条件不适用。部分项分别为 Windows 125%／150% 缩放与文件占用未测。macOS 安装包与最终数据整理见[安装说明](../MACOS_CANDIDATE.md)，Windows 原生测试、欢迎页实拍和安装器见[试用说明](../WINDOWS_TRIAL.md)。

工具自检：`rtk proxy python3 scripts/desktop/check_tools.py --fixture /absolute/fixture --output /tmp/tools-check.json`；对照报告浏览器检查：`rtk proxy node scripts/desktop/check_visual_report.mjs`。已有真实工具记录见 [2026-10-31 工具自检](results/tool-selfcheck-2026-10-31.json)。

## 最终安装包核对

完成源码冻结与 release 构建后，核对 DMG / ZIP 与同次应用本体：

```sh
rtk proxy python3 scripts/desktop/audit_macos_package.py \
  --bundle apps/desktop/src-tauri/target/release/bundle/macos/Horizon.app \
  --dmg artifacts/macos/Horizon-0.1.0-macOS-arm64.dmg \
  --zip artifacts/macos/Horizon-0.1.0-macOS-arm64.zip \
  --output /absolute/new-package-audit
```

工具只读挂载 DMG、解压到自有临时目录、核对文件字节/权限/符号链接与代码签名，随后卸载并清理临时副本；不启动应用。每个命令的原始输出、包哈希和比较清单均保留。签名校验通过不代表 Developer ID 公证，也不代替实际安装位置启动。可将下述 20 次启动安排在从最终包复制到安装位置的同一应用，保持同一哈希和数据状态，避免另做一套重复启动。

## 验收顺序

1. 默认 Git 卸载/恢复、全部功能关闭后宿主可管理、A/B 项目作用域、依赖/权限拒绝、资源真实退出。
2. 保存时继续输入、脏文档与外部改动竞争、异常退出恢复、三项目标签/选区/滚动/草稿隔离、中文 IME。
3. HEAD=A / index=B / disk=C / buffer=D；提交只含 B；hook 失败、初次提交、冲突、仅快进与本地 remote。
4. Pi 真实 RPC、工具执行前授权、拒绝/断桥无副作用、取消与任务副本版本核验；真实供应商缺口单列。
5. PTY 隐藏继续、退出停止；启动方案依赖/失败/重启、外部端口占用不误杀、跨项目归属。
6. 八布局真实结构、主题独立、IME 延后、撤销和 EditorState 保留；背景/尺寸/继承跨重启。
7. 同条件实机视觉对照及修复复查；release 压力/资源/启动测量；安装与升级保留数据。

验收原始条件来自 [REQUIREMENTS](../product/REQUIREMENTS.md)、[实施计划](../implementation/IMPLEMENTATION_PLAN.md)、[本次执行条款](../implementation/EXECUTION_ACCEPTANCE.md)。本机功能以 macOS 实测交付；Windows x64 另有原生 CI 测试和试用安装器，其未测交互与其它架构保持单列。

## 可重建压力数据

从仓库根运行：

```sh
rtk proxy python3 scripts/desktop/fixtures.py
```

输出唯一临时目录中的 `fixture.json`，记录 seed、版本、实际字节数、哈希及 Git 基线。默认全量；`--smoke` 仅用于生成器检查，不能作为压力场景。`--output` 只能指定不存在的新目录，脚本不覆盖或删除已有目录。

| 数据 | 固定规模 / 用法 |
| --- | --- |
| paths-10k / paths-100k | 10,000 / 100,000 个 TypeScript 路径；100 文件/目录，按层展开 |
| wide-directory | 同层 10,000 个文件 |
| deep | 120 层目录；末端 leaf.txt |
| large-files | 10 / 50 / 101 MiB，99,999 / 100,000 / 100,001 / 1,000,000 字符单行，二进制 |
| common | 五个 180 KiB 文件；BOM、CRLF、末行无换行、非 UTF-8、Unicode/空格、符号链接环/失效链接、权限拒绝 |
| project-a / b / c | 同名相对路径、独立内容 |
| git-stress | 10,000 个普通改动；200,000 行每侧大 diff；十文件/2,000 行 review diff；A/B/C 双基线 |
| remote.git / git-peer | 临时本地 bare remote 与第二副本，可做真实 fetch/pull/push/冲突 |
| long-output | 100,000 行终端文本、10,000 条合成会话，验证有界渲染；不冒充 Pi 响应 |

`permission-denied` 模式为 000。清理时先对该目录 `chmod 700`；只删除本次明确生成的临时目录。生成器不会自动删除数据或清理用户仓库。

固定阅读预算另用 `rtk proxy python3 scripts/desktop/fixtures.py --reading-only`：创建一个干净 Git 项目，共 10,000 个已跟踪文件，其中根目录 `hot-1.ts`–`hot-5.ts` 各 184,320 字节，可在同一项目同时打开五个标签。manifest 记录五文件哈希、Git 基线和精确数量。不要把分属不同项目的 `paths-10k` 与 `common` 拼称为同一个已测阅读场景。

固定 diff 预算用 `rtk proxy python3 scripts/desktop/fixtures.py --review-only`：独立项目仅十个改动文件，每个增加/删除各 100 行，共 2,000 行，manifest 记录实际 `git diff --numstat` 总数。它与包含一万项改动的大压力仓库分开；操作时逐个查看十个文件，再保留固定选中状态。

## 后台全进程采样

```sh
rtk proxy python3 scripts/desktop/sample_macos.py \
  --pid APP_PID --output /tmp/horizon-reading-run-01 \
  --scenario reading-10k-five-tabs --build release --build-id RELEASE_ID \
  --fixture-manifest /tmp/FIXTURE/fixture.json \
  --plugin-state /tmp/plugin-state.json --duration 120 --interval 1
```

不激活应用、不点击、不提权。`APP_PID` 为本轮原生应用 PID。进程归属顺序：显式 PID、父子关系、macOS responsibility SPI、相同进程身份的后续采样。WebKit/GPU 常不在简单父子树中，因此每个样本保留未归属 WebKit 候选。核对候选后才能宣称全关联进程完整。

Pi、开发服务、本地模型等单独分组；`--members /tmp/process-members.json` 每次重读：

```json
{
  "12345": {"group": "pi", "reason": "Horizon diagnostics: project A, owned session S1"},
  "12346": {"group": "development", "reason": "Horizon launch profile R1, owned process P2"}
}
```

只填当前真实 PID 和归属证据。未知候选不能凭名称全算到 Horizon；漏掉候选也不能报告完整预算。采集器保留逐项 `reason`，可检查主进程退出后尚存的已归属进程。

- `metadata.json`：机器、OS、架构、代码状态、构建标识、可执行文件 SHA-256、fixture、插件/窗口状态、采集口径。
- `samples.jsonl`：时间、逐进程 physical footprint / RSS / CPU、分组、总量、阶段、资源诊断、未归属候选。
- `summary.json`：中位/P95/峰值、60 秒后的 footprint/RSS/CPU、首末一分钟、线性趋势。固定场景运行 125 秒，可保留预热后至少 60 秒观察；是否稳态还须核对该窗口中场景未变且无 GUI 操作。没有数据保留 null，不填 0 冒充测量。
- `cycle-output.log`：只有显式启用循环驱动才有输出。

`physical footprint` 来自本机 SDK 的 `RUSAGE_INFO_V2.ri_phys_footprint`；CPU 的 user+system 原值为 Mach 时间单位，先按 `mach_timebase_info` 的 numer/denom 转纳秒，再取差值除以墙钟时长，100% 表示一个核心。本机转换比例为 125/3，不转换会低报约 41.7 倍。RSS 为 `ps` 的 KiB 转字节。footprint 合计与 RSS 合计分别报告，RSS 不等同私有内存。采样可能漏掉寿命短于采样间隔的进程。

实现依据：[Apple libproc 实现](https://github.com/apple-oss-distributions/xnu/blob/main/libsyscall/wrappers/libproc/libproc.c)、[Apple rusage 结构](https://github.com/apple/darwin-xnu/blob/main/bsd/sys/resource.h)、[XNU CPU 计数填充](https://github.com/apple-oss-distributions/xnu/blob/main/osfmk/kern/bsd_kern.c)、[XNU Mach 时间计数测试](https://github.com/apple-oss-distributions/xnu/blob/main/tests/recount/recount_tests.c)、[WebKit footprint 读取](https://github.com/WebKit/WebKit/blob/main/Source/WTF/wtf/spi/darwin/ProcessMemoryFootprint.h)。responsibility 为可选 SPI；不可用时明确降为手工成员归属，不把工具失效当零占用。

## 30 分钟生命周期循环

主测试者执行真实项目/面板/插件操作时，后台运行：

```sh
rtk proxy python3 scripts/desktop/sample_macos.py \
  --pid APP_PID --output /tmp/horizon-lifecycle-30m-01 \
  --scenario project-panel-plugin-cycles --build release --build-id RELEASE_ID \
  --duration 1800 --interval 1 --members /tmp/process-members.json \
  --phase-file /tmp/horizon-phase.txt --activity-log /tmp/horizon-native-actions.jsonl \
  --resources /tmp/horizon-live-resources.json
```

阶段文件写当前真实操作，如 `project A / Git paused`。操作日志记录时间、原生动作、项目/实例、可观察结果及截图。资源文件由应用诊断实际导出监听/订阅/缓存/进程数；没有此数据则 null，不能以进程数代替监听数。

已有原生驱动可用 `--cycle-command '["/absolute/native-driver","--cycle"]' --cycle-every 30`。默认没有动作驱动；30 分钟静止采样不会变成“循环通过”。持续增长、资源未释放、停止失败须按阶段回看；单一斜率或终点值不自动判通过。

## 20 次启动到可交互

本次最终测量使用 CUA 原生应用接口启动及正常退出。固定同一 release bundle、1280×800、100% 缩放、代码审查预设、无活动项目的欢迎页；先确认 Pi、PTY 和启动方案均已结束。20 次分别使用新进程，保留 OS 文件缓存，不执行 `purge`。

启动记录器 [cua_startup.mjs](../../scripts/desktop/cua_startup.mjs) 只导出函数，导入不会启动应用。通过 `cua_repl` 调用；不要用 shell 执行该文件冒充原生操作：

```js
var startupRecorder = await import('/absolute/Horizon/scripts/desktop/cua_startup.mjs');
var launch = await startupRecorder.captureNativeStartup(cua, {
  iteration: 1,
  output: '/absolute/unique-startup-run',
  bundle: '/absolute/Horizon.app',
  executable: '/absolute/Horizon.app/Contents/MacOS/horizon-desktop',
  expectedHash: '实际 release 可执行文件的 SHA-256',
});
nodeRepl.write(launch.record);
```

记录器在 `cua.getApp` 前后使用单调时钟，直到实际欢迎页暴露启用的“打开本地项目”按钮；保留完整 AX、原始 PNG/JPEG、哈希和动作时间。结果包含自动化启动与 AX 观察开销，是用户可交互的观察上界，不是进程生成时间或精确首帧绘制时间。截图在计时终点之后采集。控件未就绪或观察失败时保留失败记录，不重写为成功。

每次记录后：

1. 只读核对本次主 PID、启动时间、同一 bundle SHA 及关联 helper，保存独立进程身份记录。
2. 通过当前 `launch.app.pressKey('super+q')` 打开正常退出确认，读取新 AX；确认无脏文档和活动任务后，按当前控件索引点击“处理并退出”。保留实际退出计划。
3. 核对本轮 PID + 启动时间对应的全部已知身份消失，再开始下一次。不能用 `kill` 代替这段正常退出。
4. 依次记录 20 次尝试；汇总全部成功计时的中位数及 nearest-rank P95（20 个值取排序第 19 个），同时单列失败、缺失或未正常退出的次数。任一异常不能从样本数中悄悄剔除。

全程不并行构建、测试、其他 GUI 操作或后台性能采样。功能齐备性及退出资源释放仍须对应功能证据，启动数值不能替代这些结论。

只读 AX 探针可辅助核对已运行应用，不启动或操作窗口：

```sh
rtk proxy xcrun swiftc scripts/desktop/ax_probe.swift -o /tmp/horizon-ax-probe
rtk proxy /tmp/horizon-ax-probe --environment
rtk proxy /tmp/horizon-ax-probe --pid APP_PID --dump
rtk proxy /tmp/horizon-ax-probe --pid APP_PID --windows
```

探针不激活窗口、不发送输入。readiness 必须匹配实际启用控件，如 `--role AXButton --label 打开本地项目`。窗口存在或进程启动均不当作可交互。

`--windows` 返回该 PID 的真实窗口 ID/尺寸；后台截图可用 `rtk proxy screencapture -x -o -l WINDOW_ID /absolute/native-window.png`。核对截图像素、窗口逻辑尺寸与 DPR，保留采集工具返回的原始 PNG/JPEG 字节，不为对齐参考图缩放或隐藏内容。

旧 `launch_benchmark.py` / `launch_app.swift` 保留为历史工具；其 shell 启动和 SIGTERM 收尾方式不用于本次最终 CUA 测量。不要把旧工具存在或自检通过当成 20 次应用实测。

热文件打开、切项目、滚动、搜索/Git刷新及取消需另保留原生动作和可读/完成终点。150 ms 目标需高精度时间证据；按秒的人类观察不能证明该目标。应用内计时可补充，但启动动作仍需来自真实 GUI。

编辑器诊断导出后，可用 `rtk proxy python3 scripts/desktop/summarize_editor_metrics.py /absolute/editor-diagnostics.json --output /tmp/editor-timings.json --build release --build-id RELEASE_ID --native-actions /absolute/native-actions.jsonl`。支持语言取 `max(durationMs, highlightReadyMs)`；高亮未就绪不计完成，plain/cold 分组独立。该终点是 CodeMirror 可见布局和语法树就绪后的 rAF 代理，不宣称精确像素 paint；`languageReadyMs` 仅模块加载时间，不当高亮完成。

## 功能证据格式

把实际记录写入 `evidence.json` 数组，再运行：

```sh
rtk proxy python3 scripts/desktop/acceptance_matrix.py
rtk proxy python3 scripts/desktop/acceptance_matrix.py --check
```

每条结构：

```json
{
  "id": "MAC-FILE-001",
  "requirements": ["REQ-FILE-007"],
  "tasks": ["TASK-006"],
  "outcome": "pass",
  "coverage": "partial",
  "platform": "macOS version / arm64",
  "build": "release identifier + binary SHA-256",
  "method": "native-gui + disk-byte-check",
  "implementation": ["apps/desktop/src/actual-implementation.ts"],
  "steps": ["真实操作第一步", "磁盘核对第二步"],
  "artifacts": ["docs/verification/results/actual-evidence.json"],
  "observed": "填写实际操作、预期、结果；不要复制这一模板为实测。",
  "limitations": ["仅验证一个保存竞争子场景，其余条件待测。"]
}
```

`pass/full` 才关闭该需求或任务；`pass/partial` 保留部分证实。失败优先保留；修复后的复测记录用 `supersedes: ["旧证据ID"]` 替代旧结论，历史记录继续保留。全部 artifact 与 implementation 路径必须存在。构建、原型、静态审查不能单独声明完整验收。

范围解释另存 [acceptance-scope-decisions.json](acceptance-scope-decisions.json)，要求绑定原条款、已通过证据与明确限制；原始结果不改，不能替代活动失败。建议内存预算未达与已履行测量报告义务分开记录。

## 视觉证据格式

真实截图写入 `visual-records.json`，每项对应 `mist/B01` 等设计索引；八套布局共 584 项。H 组是规范映射，G07 是未测平台，其余 536 项为 macOS 产品页面/状态。完整 UI 流程不应被说明图强行扩展成新功能。

```json
{
  "case": "mist/B01",
  "screenshot": "/absolute/native-window.png",
  "capture_method": "screencapture-window",
  "app_build": "actual release id",
  "platform": "macOS version / arm64",
  "captured_at": "actual timestamp",
  "viewport": [1280, 800],
  "pixel_ratio": 2,
  "zoom": 1,
  "theme": "light",
  "density": "舒适",
  "state": "说明真实项目、标签、文件和插件状态；数据差异另注。",
  "actions": ["原生点击打开项目", "原生点击文件"],
  "review": "unreviewed",
  "differences": []
}
```

```sh
rtk proxy python3 scripts/desktop/visual_matrix.py
rtk proxy python3 scripts/desktop/visual_matrix.py --check
```

H 组规范另记 `specification-records.json`：列适用布局/规范页、需求、实际映射与证据。完成记为 `specification-mapped`，不计原生视觉通过，也不要求创建应用内规范页面。H05 原参考图仍保留旧版四路径；修订来源与五路径核对证据分别列明。

E15 的“卸载所有布局与主题”与八套命名样式互斥，八格经 [visual-applicability.json](visual-applicability.json)绑定真实空宿主证据后记为 `not-applicable`，不计通过；原设计和历史条件不符记录保留。

报告提供原设计/实机并排、透明度叠加及原逻辑尺寸查看，原始图像字节不变。只有视口、缩放、主题、密度和实际图像像素比例一致且全部差异已修复，才允许记录 `review: pass`。原始 JPEG 可参与人工视觉验收；仅当压缩妨碍某个具体子项判断时保留该项不确定，不因格式整体拒收。`differences` 每项注明 category、expected、actual、severity、status、fix_evidence，保留修复前后截图。截图是否真实仍需审阅采集动作和构建来源，工具校验不能替代人工视觉判断；功能观察不能外推未对照的视觉状态。

## 建议预算与结论

空宿主 200 MB、阅读 350 MB、Horizon diff/会话 450 MB、单 Pi 组合 600 MB、Pi 空闲增量 120 MB、稳定空闲 CPU 单核 1%、启动 P95 2 秒、≤200 KB 热文件 P95 150 ms。预算采用十进制 MB；原始记录统一 bytes，并可另列 MiB。报告必须写稳态/峰值、全工作流总量及各组增量。超目标先定位、优化后相同场景复测；未测不填通过。
