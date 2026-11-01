# Horizon QuickJS 扩展宿主

`horizon-extension-host` 是按激活创建的 Rust sidecar。每个 `{extensionId, activationId, projectId}` 独占一个 QuickJS runtime 和一个进程。声明式包及未激活包不创建进程；暂停、禁用、卸载、项目休眠和退出均 dispose 后 wait/reap，500 ms 未退出则由父进程终止并确认回收。

初版采用逐激活进程，增加少量进程开销，避免共享宿主崩溃连带其他项目或扩展。引擎固定 `rquickjs 0.14.0`，其 vendored engine 为 `QuickJS-NG 0.16.2`，由 Cargo.lock 固定。SDK 与安装协议沿用 `packages/plugins/src/sdk.d.ts`、`docs/architecture/INTERFACES.md` §6.3。

## 执行与权限

- 每 runtime 最大堆 32 MiB、栈 256 KiB；不启用会绕过引擎内存上限的 `rust-alloc` / `allocator` feature。
- 每次同步执行或 Promise job 使用 50 ms interrupt deadline；同一操作累计执行预算 500 ms，异步 broker 等待不计入执行预算。操作总等待上限 30 秒；父进程在 31 秒无响应时终止并回收。
- 不注册 Node、`std/os`、文件、网络、子进程、定时器或外部模块加载器。包入口须是自包含 ES module，导出 `activate(context)` 与可选 `deactivate()`。
- SDK native binding 只接五种能力方法，以及清单声明的命令和声明式列表/树/文本视图。绑定函数与控制对象保留在 Rust handle / JS 闭包，未写入 `globalThis`。
- 父进程根据拥有的 channel 绑定扩展、激活与项目身份；每次能力请求再由 `extensions::broker_call` 核验安装、启用、暂停、激活租约、grants 和项目。JS 无法自填身份。
- 只读 Git 数据仍经过真实 Git 扩展服务；卸载或暂停 Git 后不可绕过服务 gate。扩展私有存储由父进程管理，JS 不获得磁盘路径 API。
- 这是 QuickJS 引擎边界和进程故障隔离，不宣称操作系统沙箱。

## 私有进程协议

全部 stdin/stdout 消息使用 4 字节 big-endian 长度 + UTF-8 JSON，最大 1 MiB，stdout 不写日志。该通道不使用 Pi 的 JSONL。

父进程发送 `hello`，子进程回显 `protocolVersion / hostEpoch / packageDigest`；之后 `request(method: activate | execute)`、`reply`、`event`、`dispose/disposed` 按 §6.3 传输。激活参数包含父进程读取并核验的已安装源码与 manifest。SDK capability 请求反向通过同一通道，requestId 匹配，最多 32 个并发等待。传输控制方法不属于公开扩展 SDK。

桌面集成在 `apps/desktop/src-tauri/src/extension_host.rs`。`apps/desktop/src/features/plugins/workerHost.ts` 为兼容现有调用保留文件名与 exports，仅订阅声明式贡献和派发原生命令；不再创建 Web Worker、Blob URL 或在主 WebView 执行扩展代码。

## 构建与复现

```sh
rtk cargo build --release --manifest-path apps/extension-host/Cargo.toml
rtk cargo test --release --manifest-path apps/extension-host/Cargo.toml
rtk cargo test --release --manifest-path apps/extension-host/Cargo.toml unresolved_activation_has_a_30_second_deadline -- --ignored
rtk proxy python3 apps/extension-host/measure.py
```

无窗口原生集成使用独立临时 dataDir、真实 ZIP 安装和真实 Git 服务，并通过 `AppHandle` 订阅真实 Tauri 事件：

```sh
rtk cargo build --manifest-path apps/extension-host/Cargo.toml
rtk cargo build --manifest-path apps/git-service/Cargo.toml
rtk cargo run --manifest-path apps/desktop/src-tauri/Cargo.toml --example extension_smoke
```

`examples/extension_smoke.rs` 覆盖明确授权、安装不运行、A/B 独立激活与数据、项目暂停/恢复、暂停跨原生重启、全局禁用不可绕过、故障后在途 Git 请求及所属进程回收、实体包卸载、默认 Git 的 tombstone 与显式恢复。故障测试通过生产设置 API 指定延迟包装器，再执行系统 Git；不替换 broker 或服务实现。原始事件、PID 与逐步骤结果写入 `evidence/native-smoke.json`。该驱动使用调试版原生宿主，不创建窗口，也不计作 GUI 验收。

构建输出 `apps/extension-host/target/release/horizon-extension-host`。桌面统一脚本把对应 debug/release 产物复制为 `apps/desktop/src-tauri/binaries/horizon-extension-host-<target-triple>`，Tauri `externalBin` 配置 `binaries/horizon-extension-host`，安装后与主 executable 同目录。

`tests/isolation.rs` 运行真实子进程，覆盖异步请求、无限循环、Promise 微任务循环、超堆分配、其他激活存活、危险 API 缺席、跨激活拒绝、帧上限、30 次启停及真实临时 Git 数据驱动官方示例。另覆盖并发命令 busy 后继续运行、权限拒绝 Promise、异步等待中 dispose；普通 12 项之外，30 秒等待期限测试独立执行。该测试中的能力 broker 是受控测试驱动；完整安装、授权和桌面生命周期由应用集成/GUI验收覆盖，不能用这里的测试替代。

`evidence/release-sidecar.json` 保留原始性能样本、机器信息、二进制摘要和测量口径。RSS 是侧宿主驻留内存，不是全应用 physical footprint；Horizon、WebView 与其它 helper 需一起另测。

## 上游依据与许可证

- [rquickjs Runtime API](https://docs.rs/rquickjs/0.14.0/rquickjs/struct.Runtime.html)：heap limit、stack limit、interrupt 与 Promise jobs。
- [rquickjs Module API](https://docs.rs/rquickjs/0.14.0/rquickjs/struct.Module.html)：ES module 的声明/执行与 namespace。
- [QuickJS memory / interrupt](https://bellard.org/quickjs/quickjs.html#Memory-handling)：引擎隔离机制。

rquickjs、QuickJS-NG 均为 MIT；完整版权与授权文本存于 `licenses/`。其余 Cargo 依赖以锁文件版本为准。
