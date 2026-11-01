# macOS 文件选择服务

`Picker.swift` 每次运行处理一个原生文件、目录或保存位置选择。首次标准输入行是 JSON 请求，之后保持输入管道打开；`{"command":"cancel"}` 或 EOF 通过 AppKit 取消面板。正常选中、取消或 Cmd-Q 返回一行 JSON 后退出。宿主负责文件读写与 selection token，服务只返回所选路径。

从仓库根运行 `npm run desktop` 或 `npm run desktop:release -- --bundles app`，构建入口会编译并进行本地 ad-hoc 签名。开发产物位于 `target/HorizonPicker.app`，release 将其放入 `Horizon.app/Contents/Helpers/`。此处的签名用于本机构建，不代表 Developer ID 签名或公证。

Rust 适配位于 `apps/desktop/src-tauri/src/picker.rs`：限制单次请求、等待子进程退出、恢复宿主窗口与焦点，并将活动进程计入资源清单。正常关闭先取消面板；仅取消超时才终止自有子进程。系统 OpenSavePanel 服务由正常客户端退出释放，不由宿主终止。

隔离生命周期实验与生产集成验证分别记录在 `docs/verification/results/picker-lifetime-probe-20261101/` 和 `docs/verification/results/picker-integration-unit-20261101/`。原生 release 验收结果以 `docs/verification/` 中的对应构建报告为准。
