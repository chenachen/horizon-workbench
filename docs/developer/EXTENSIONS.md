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
- 布局、主题、语法高亮与语言服务器包可使用 `runtime.kind: "declarative"`；布局必须满足插槽与尺寸约束，主题必须提供完整浅深色令牌。
- `trusted-main` 留给应用内置模块，不能由本地第三方包申请。
- 安装拒绝依赖缺失、版本冲突、依赖环、贡献 ID 冲突以及不受支持的 API/运行时。

ZIP 上限：归档 28 MiB、256 个条目、单文件解压后 4 MiB、合计 20 MiB。绝对路径、路径穿越、符号链接、重复路径或大小写冲突均被拒绝。检查和安装之间会重新核对摘要；包变化需重新检查。摘要用于确认内容一致，不代表发布者签名。

## 语言与语法高亮插件

语言插件使用 `runtime.kind` 为 `declarative`，由宿主加载 TextMate JSON 语法。`contributes.languages` 声明语言 ID、显示名称 `aliases`、文件后缀 `extensions` 和可选精确文件名 `filenames`。文件名匹配优先，后缀采用最长匹配，例如 `.d.ts` 优先于 `.ts`。

`contributes.grammars` 将语言 ID 映射到 `scopeName` 和包内语法路径 `path`。语法文件的 `scopeName` 必须与清单一致。辅助语法可以省略 `language`，注入语法通过 `injectTo` 声明目标 scope。语法文件使用包内相对 JSON 路径，例如 `syntaxes/toy.tmLanguage.json`。

下面的示例为 `.toy` 文件提供关键字、注释、数字和字符串高亮。创建 `toy-language/manifest.json`。

```json
{
  "id": "local.language.toy",
  "name": "Toy 语言支持",
  "version": "0.1.0",
  "description": "为 .toy 文件提供语法高亮。",
  "author": "Example",
  "apiVersion": 1,
  "engines": { "horizon": ">=0.1.0 <0.2.0" },
  "runtime": { "kind": "declarative" },
  "activation": ["onLanguage:toy"],
  "requires": {},
  "optional": {},
  "capabilities": [],
  "contributes": {
    "languages": [
      { "id": "toy", "aliases": ["Toy"], "extensions": [".toy"] }
    ],
    "grammars": [
      {
        "language": "toy",
        "scopeName": "source.toy",
        "path": "syntaxes/toy.tmLanguage.json"
      }
    ]
  }
}
```

创建 `toy-language/syntaxes/toy.tmLanguage.json`。

```json
{
  "scopeName": "source.toy",
  "patterns": [
    { "name": "comment.line.number-sign.toy", "match": "#.*$" },
    { "name": "keyword.control.toy", "match": "\\b(let|if|else|end)\\b" },
    { "name": "constant.numeric.toy", "match": "\\b\\d+(?:\\.\\d+)?\\b" },
    {
      "name": "string.quoted.double.toy",
      "begin": "\"",
      "end": "\"",
      "patterns": [
        { "name": "constant.character.escape.toy", "match": "\\\\." }
      ]
    }
  ]
}
```

在仓库根目录执行打包命令。

```sh
node packages/plugins/package-extension.mjs ./toy-language ./toy-language.horizon-extension
```

在插件中心安装并启用生成的包，然后打开包含 `let answer = "hello" # comment` 的 `.toy` 文件。插件按语言加载。暂停、停用或卸载后，已打开文件切换为纯文本显示，重新启用后恢复语法高亮。默认附带的语言支持也可在“语言”分类中管理。

### 主题语法配色

主题定义的 `tokenColors` 为浅色和深色模式分别提供 TextMate scope 配色。省略某个模式时，宿主按应用颜色生成默认语法配色。提供规则数组时，该模式使用主题声明的语法配色，其余文本沿用正文颜色。空数组使用统一正文颜色。下面的字段放在 `contributes.themes[]` 的主题对象中。

```json
{
  "tokenColors": {
    "light": [
      { "scope": "keyword", "settings": { "foreground": "#7046a3" } },
      { "scope": ["comment", "meta.preprocessor"], "settings": { "foreground": "#667788", "fontStyle": "italic" } }
    ],
    "dark": [
      { "scope": "keyword", "settings": { "foreground": "#c6a0f6" } },
      { "scope": "string", "settings": { "foreground": "#a6da95", "fontStyle": "" } }
    ]
  }
}
```

`scope` 接受选择器字符串或字符串数组，`foreground` 使用六位 HEX 颜色。`fontStyle` 接受空字符串，或用空格组合 `italic`、`bold`、`underline`、`strikethrough`。空字符串清除继承的字体样式。切换主题、明暗模式或主题配色后，已打开文件同步更新。

## 语言服务器与代码跳转插件

语义插件通过 `contributes.languageServers` 声明本地 LSP 服务器，授权能力为 `language.server`。宿主负责文档同步、协议传输与导航界面，Rust 宿主负责启动进程和双向 stdio。声明式包无需 JavaScript 入口。服务器程序需要自行安装，Horizon 当前不自动下载。

语法高亮与语义服务分别管理。语义包通过 `requires` 依赖 `horizon.editor` 和对应语言包，打开匹配语言文件时按需启动；只启用高亮不会启动语义服务器。内置包为 `horizon.semantic.typescript` 和 `horizon.semantic.rust`，分别依赖 `horizon.language.javascript` 与 `horizon.language.rust`。停用编辑器时，其语义插件和服务器随依赖级联停止。TS/JS/JSX/TSX 共用一个 TypeScript 服务，Rust 使用 rust-analyzer。

下面是接入 rust-analyzer 的完整清单。测试这个包时，先暂停当前项目的内置 Rust 语义插件，避免同时启用两个 Rust 定义提供者。

```json
{
  "id": "local.semantic.rust",
  "name": "Rust 代码跳转示例",
  "version": "0.1.0",
  "description": "使用本机 rust-analyzer 提供定义跳转。",
  "author": "Example",
  "apiVersion": 1,
  "engines": { "horizon": ">=0.1.0 <0.2.0" },
  "runtime": { "kind": "declarative" },
  "activation": ["onLanguage:rust"],
  "requires": { "horizon.editor": "^0.1.0", "horizon.language.rust": "^0.1.0" },
  "optional": {},
  "capabilities": ["language.server"],
  "contributes": {
    "languageServers": [
      {
        "id": "rust-local",
        "languageIds": ["rust"],
        "rootMarkers": ["Cargo.toml", "rust-project.json"],
        "command": "rust-analyzer",
        "args": []
      }
    ],
    "settings": [
      { "key": "server.rust-local.command", "label": "rust-analyzer 程序", "type": "path", "default": "rust-analyzer" },
      { "key": "server.rust-local.args", "label": "启动参数（JSON 数组）", "type": "string", "default": "[]" }
    ]
  }
}
```

`languageIds` 引用语言包中的 ID；`rootMarkers` 用于识别语义工作区。`command` 是程序名或可执行文件路径，`args` 是参数数组，按 stdio LSP 方式启动。`initializationOptions` 与 `settings` 可选，均为 JSON 对象，分别传入初始化选项与服务器配置。服务器 ID 在同一清单中必须唯一。

插件可以声明 `server.<serverId>.command` 和 `server.<serverId>.args` 设置，供用户在“插件详情 → 插件设置”覆盖启动方式。参数设置使用 JSON 数组文本，例如 `["--stdio"]`，不要输入整条 shell 命令。设置允许全局默认与当前项目覆盖；保存变更后暂停并恢复语义插件，让新会话使用新配置。

内置 TypeScript 插件默认启动 `tsc --lsp --stdio`，需要 TypeScript 7 的原生语言服务器。请独立安装并将 `server.typescript.command` 指向它；项目已有 TypeScript 5/6 的编译器不能直接作为该原生服务使用，也无需为使用跳转而修改项目依赖。需要旧 tsserver 生态时，可自行安装 `typescript-language-server`，将程序改为其可执行文件，参数改为 `["--stdio"]`。该后端使用旧版 TypeScript 语言服务。

编辑中的未保存内容会增量同步，发起定义请求前先发送待同步修改。标签切换复用工作区会话；项目休眠、插件暂停、停用、卸载与应用退出时停止所属服务器。恢复后按语言文件重新启动。F12 或 macOS 的 ⌘+点击（Windows 为 Ctrl+点击）跳到定义；返回多个位置时由用户选择目标。服务器返回的文件仍通过宿主的项目文件与已授权外部文件边界打开。

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

QuickJS 插件不能直接访问 DOM、Tauri、Node.js、磁盘或网络。声明式语言服务器使用经授权的本地进程；其通信与生命周期由宿主管理。原生通信通道绑定实例身份；JavaScript 不能通过伪造扩展 ID 或项目 ID 获得其他实例权限。暂停、停用、卸载或故障后，旧租约被撤销，在途 SDK 工作按实例取消。

在 `deactivate()` 或 `subscriptions` 中释放自身注册。宿主提供执行超时、消息与内存限制；清理失败会保留错误状态供重试停止，不会显示为已完成。

## 更新、回退与开发目录

重新打包新版本，在“更新”中选择本地包；新增权限需重新授权。成功更新先停止旧实例，再登记已校验版本。复制或安装失败保留旧包；详情页可回退至保留的前一个版本。卸载默认保留私有设置；“同时删除扩展私有设置”只影响该扩展数据。

“开发者”页需显式开启开发者模式，随后选择包含清单的目录。目录按相同权限边界和文件限制复制安装，不直接在工作区执行。修改源码后选择“检查并重载”，重新检查与授权，再释放旧实例并安装新副本。日志可在详情页查看。关闭开发者模式后，不能继续加载或重载目录；已安装包仍按正常生命周期管理。

## 自动验证

```sh
npx tsx --test packages/plugins/tests/runtime.test.ts
npx tsx --test packages/plugins/tests/validation.test.ts
npx tsx --test packages/plugins/tests/language-servers.test.ts
npx vitest run --root apps/desktop src/features/editor
node packages/editor/tests/syntax-plugins.mjs
node packages/editor/tests/language-services.mjs
node packages/editor/tests/semantic-navigation.mjs
HORIZON_TEST_TYPESCRIPT_LSP=/path/to/tsc node packages/editor/tests/real-language-services.mjs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test extensions_policy
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test syntax_extensions
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test language_servers
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml language_servers --lib
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml package_tests --lib
```

语言服务浏览器用例使用真实 CodeMirror 和 LSP 客户端、可控的原生传输替身；`real-language-services.mjs` 进一步连接真实 TypeScript 7，检查未保存跨文件跳转、服务重连后的缓冲恢复、UTF-16 定位及磁盘内容保持。原生集成用例检查真实 stdio、会话隔离与资源释放。另可通过 `HORIZON_TEST_TYPESCRIPT_LSP` 和 `HORIZON_TEST_RUST_ANALYZER` 指定已安装的服务程序，运行 `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test language_servers -- --ignored` 验证真实 TypeScript 7 与 Rust 工作区跳转。

这些检查覆盖 Cordis 生命周期、项目范围、权限/依赖策略及 ZIP 校验。真实 macOS 安装、授权、Git 数据与停用/卸载操作证据单独记录在 `docs/verification/`。
