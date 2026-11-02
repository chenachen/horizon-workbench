# 原生安装等待界面的合法负载输入

同一只读更改列表扩展，原 manifest.json 与 index.js 字节不变；追加 128 份非执行静态测试资源，每份 128 KiB，共 16 MiB。完整解包 16,779,663 字节，低于产品 20 MiB 总量、256 条目与单文件 4 MiB 上限。此输入不是原 2,663 字节小包，未据此推算小包耗时或性能。

`manifest.json` 保存实际 ZIP 摘要、130 个成员摘要、尺寸及压缩方式。`build_fixture.py` 为本次实际使用的原脚本，`read-only-base.horizon-extension` 是其原始两成员输入。复现时将脚本 BASE 改为本目录的 base 文件、native_source 改为本地仓库对应 extensions.rs 路径，并在空输出目录运行；固定资源与成员元数据，ZIP 压缩输出绑定记录的 Python/zlib 版本。原包和原脚本不覆盖。原生安装、卸载、进度画面仍须以本次真实操作和系统录像为准。
