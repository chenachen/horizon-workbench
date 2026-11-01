# Horizon 本地扩展开发

Horizon SDK v1 通过隔离的 QuickJS 子进程执行第三方 JavaScript。每个项目的激活实例独立；宿主按安装权限、项目范围与激活租约处理 SDK 调用。安装只登记包，不启动代码。

## 运行示例

仓库自带 `packages/plugins/examples/read-only-changes/`：读取当前项目的真实 Git 状态，贡献命令、声明式更改列表和“显示未跟踪文件”设置。

```sh
node packages/plugins/package-extension.mjs
```

命令生成 `packages/plugins/examples/read-only-changes.horizon-extension`。这是标准 ZIP，根目录包含 `manifest.json` 和 `index.js`。插件中心选择“安装本地扩展”，核对来源、依赖与权限后安装；启用扩展，再在“运行状态”中激活。示例要求 `horizon.git` 已安装且启用，并授权 `git.read`、`storage`。

在专用测试 Git 仓库修改或新建文件，运行“读取更改列表”可看到真实状态。当前项目暂停后，另一个项目的实例继续工作；停用或卸载会撤销 SDK 租约、停止所属进程并移除命令和视图。再次恢复或启用不会自动执行命令。

插件中心的“能力预设”提供极简阅读、代码审查、项目开发和自定义。应用前会列出新增启用、停止的能力、受影响项目、未保存文档路径与资源归属；开发预设可分别选择终端和项目启动器，应用预设不会创建 shell 或运行方案。缺包只列清单，需要用户明确安装。全局默认保留项目覆盖，项目选择不能绕过全局停用。

停止或应用预设前，宿主核对计划中的依赖、扩展版本、文档编辑版本和资源。文档决策只接受计划内对象；拒绝、过期或清理失败时保留未保存文档，成功停止后才移出打开文档并保留恢复稿。

## 包与清单

`manifest.json` 声明唯一 ID、版本、Horizon 兼容范围、运行时入口、激活事件、必需/可选依赖、能力和贡献点。完整格式见示例清单与 `packages/plugins/src/types.ts`。

- 第三方代码使用 `runtime.kind: "quickjs"`，入口导出 `activate(context)`，可选导出 `deactivate()`。
- 命令与视图 ID 必须先在清单声明；第三方视图使用 `renderer: "declarative"`。
- 布局与主题包使用 `runtime.kind: "declarative"`；布局必须满足插槽与尺寸约束，主题必须提供完整浅深色令牌。
- `trusted-main` 留给应用内置模块，不能由本地第三方包申请。
- 安装拒绝依赖缺失、版本冲突、依赖环、贡献 ID 冲突以及不受支持的 API/运行时。

ZIP 上限：归档 28 MiB、256 个条目、单文件解压后 4 MiB、合计 20 MiB。绝对路径、路径穿越、符号链接、重复路径或大小写冲突均被拒绝。检查和安装之间会重新核对摘要；包变化需重新检查。摘要用于确认内容一致，不代表发布者签名。

## SDK 与资源释放

类型定义在 `packages/plugins/src/sdk.d.ts`。当前 SDK 提供：

| API | 所需能力 | 行为 |
| --- | --- | --- |
| `context.project.read(fileId)` | `project.read` | 当前项目文件，单次最多 1 MiB |
| `context.git.status()` | `git.read` | 当前项目真实 Git 状态，依赖 Git 插件 |
| `context.storage.get/set(key, value)` | `storage` | 扩展私有 JSON，单项 64 KiB、合计 4 MiB；同扩展实例共享 |
| `context.settings.get(key)` | 无额外能力 | 已声明设置，项目值覆盖全局值及默认值 |
| `context.commands.register(id, handler)` | 清单贡献 | 注册命令，返回可释放对象 |
| `context.views.register(id, view)` | 清单贡献 | 注册 tree/list/text 声明式视图 |
| `context.subscriptions.add(disposable)` | 无额外能力 | 将清理对象绑定至当前激活 |

插件不能直接访问 DOM、Tauri、Node.js、磁盘或网络。原生通信通道绑定实例身份；JavaScript 不能通过伪造扩展 ID 或项目 ID 获得其他实例权限。暂停、停用、卸载或故障后，旧租约被撤销，在途 SDK 工作按实例取消。

在 `deactivate()` 或 `subscriptions` 中释放自身注册。宿主提供执行超时、消息与内存限制；清理失败会保留错误状态供重试停止，不会显示为已完成。

## 更新、回退与开发目录

重新打包新版本，在“更新”中选择本地包；新增权限需重新授权。成功更新先停止旧实例，再登记已校验版本。复制或安装失败保留旧包；详情页可回退至保留的前一个版本。卸载默认保留私有设置；“同时删除扩展私有设置”只影响该扩展数据。

“开发者”页需显式开启开发者模式，随后选择包含清单的目录。目录按相同权限边界和文件限制复制安装，不直接在工作区执行。修改源码后选择“检查并重载”，重新检查与授权，再释放旧实例并安装新副本。日志可在详情页查看。关闭开发者模式后，不能继续加载或重载目录；已安装包仍按正常生命周期管理。

## 自动验证

```sh
npx tsx --test packages/plugins/tests/runtime.test.ts
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test extensions_policy
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml package_tests --lib
```

这些检查覆盖 Cordis 生命周期、项目范围、权限/依赖策略及 ZIP 校验。真实 macOS 安装、授权、Git 数据与停用/卸载操作证据单独记录在 `docs/verification/`。
