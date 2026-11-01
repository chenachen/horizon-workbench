# 依赖与许可证归档

本目录保存 Horizon macOS arm64 构建的第三方声明。完整版本以 `generated/inventory.json` 为准；`generated/INDEX.md` 提供逐包链接。

- `generated/npm/`：本机已安装、与 `package-lock.json` 版本一致的 npm 包原始 LICENSE/NOTICE 和 `package.json`。
- `generated/cargo/`：三个 Cargo 工程在 `aarch64-apple-darwin` 上的依赖闭包、原始许可证、Cargo 元数据与发布提交信息。
- `generated/sources/`：MPL-2.0 crate 的未修改源码包；内容 SHA-256 等于 Cargo.lock 校验值。
- `generated/sidecars/`：现有 ripgrep 15.2.0、QuickJS-NG 0.16.2 与 rquickjs 0.14.0 原文。
- `generated/rust-standard-library/`：当前 Rust 标准库的上游完整版权报告与条款。
- `generated/locks/`：生成时使用的全部锁文件原件。
- `generated/FILES.sha256.json`：归档文件摘要，可检查改动。
- `upstream/`：发布包漏带文件时，按该包发布提交补取的许可证；SOURCES.json 固定地址、内容摘要和适用包。

`runtime` 为运行依赖闭包；`build` 为构建工具、Cargo build dependencies 和 proc-macro；`development` 为开发/测试用途。共享依赖可以同时带多个标记。这是保守清单，未进行最终二进制符号剔除分析。npm 平台编译器绑定按构建工具记录；未安装的其他平台可选包只保留排除记录。

归档按原字节复制许可证与 NOTICE，不用 SPDX 名称替代实际条款。上游仅有许可证声明/链接时，保留声明及包作者元数据，再附 SPDX license-list-data **v3.27.0** 的标准文本。标准 MIT/Zlib 文本中的占位符属于上游标准文本，不代表替上游重新署名。

在已完成 `npm ci`、三个 Cargo 工程依赖已缓存、相同 Rust 工具链环境中运行：

```sh
rtk proxy python3 scripts/archive-licenses.py
rtk proxy python3 scripts/archive-licenses.py --check
```

脚本默认离线读取 npm 安装目录和 `cargo metadata --locked --offline --filter-platform aarch64-apple-darwin`，不更新锁文件、不安装包。`--check` 在临时目录重新生成并逐文件比较。缺少必需包、版本不符、找不到原始声明、MPL 源码校验不符或上游补充文本摘要不符都会失败。

若要从固定上游地址重新取得补充文本：

```sh
rtk proxy python3 scripts/archive-licenses.py --fetch-upstream
```

URL 与 SHA-256 均保留于 SOURCES.json。更新依赖或 Rust 工具链后重新生成，并核对根目录 THIRD_PARTY_NOTICES.md 的主要版本摘要。其他平台构建需要在对应安装环境用 `--target <triple>` 生成自己的清单；本目录没有声称已验证 Windows。

Tauri 将根目录 `THIRD_PARTY_NOTICES.md` 和本目录完整复制进应用 `Contents/Resources`。安装包内可直接打开索引并沿相对链接查阅原始文本；源码 `.crate` 是标准 tar.gz 格式。
