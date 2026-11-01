# NFR006 单次离线边界 — PREPARED，未启动

本卡只补原句“离线文件与本地 Git 工作，远程能力单独失败”。root 后续确认下列精确 launcher flag 后才启动一次。不是 final20 第21次，不重跑旧 Git/CPU/生命周期，不复用旧复制重签方案。

## 固定对象

- 原包 `/Users/chenpengxiang/Applications/Horizon.app`，原 Mach-O `Contents/MacOS/horizon-desktop`。
- 精确 SHA256 `4d4bca76055afb46f403811035a718b2b8a8f892ca2e7e8ddc5ed2c5dbe5a135`，19911168B。准备时实际核同；Info.plist 和 CodeResources 也已记录。原包没有复制、修改或重签。
- 唯一新夹具 `/var/folders/9j/xnw538c934b2s559tl01cc800000gn/T/horizon-offline-boundary-20261102-ujs5fg1r/OfflineBoundary-1102`。
- 只跟踪 `offline.txt`，原文 `Offline boundary baseline 2026-11-02` 加 LF；SHA `644c3916e763ecd641d673472b96c02b3e03ccbc646e5d4f2fb4e0bedbb9be41`。
- `main` 只有一个本地基线提交 `c8b69b3653ee58056f840945364c0c1d1e5e6d1a`，index 干净；HEAD/index/config/源文件与原 bytes 备份见 `fixture-prepared.json`、`baseline/`。没有提交或推送 Horizon 仓库。
- 唯一 `origin=https://github.com/octocat/Hello-World.git`，公开只读 fetch 目标，绝非 Horizon 主源仓库。准备阶段未访问 remote。fixture 自有作者、禁用签名/hooks，credential.helper 为空；launcher 只对本进程设置 Git 无交互及无 global/system Git config，不修改任何全局文件/网络/代理。

## root 一次启动门（当前不执行）

root 完整审阅 `offline_owner.py` 后，确认本精确 flag，才运行：

```sh
rtk proxy python3 .work/offline-boundary-20261102/offline_owner.py launch --execute-network-denied-horizon-once-4d4
```

脚本检查原 main/Info.plist/CodeResources 和本夹具基线、无已有 Horizon main/helper；不杀进程、不修状态。单次 claim 独占后仅执行 `/usr/bin/sandbox-exec -p '(version 1)(allow default)(deny network*)' ORIGINAL_MAIN`，stdout/stderr 原文保留。没有 `open -a`、app 副本或重签。观察到同一 exec 后原 main 路径/PID/birth 只说明进程存在，不说明 GUI ready 或离线通过。失败保 claim/原错误，禁止自动重试。

产物固定 `docs/verification/results/offline-boundary-native-20261102/owner/`；本阶段尚无 launch 产物。普通 spawn 子树继承本限制；responsibility/XPC 归属不是 sandbox 继承证明。历史 `.work/offline-network-isolation-20261101` CLI probe 不重跑。

## Terra 唯一原生单链

1. owner 给 `launch.json` 的真实原 main PID/birth 后，Terra 只绑定已经活着的该实例。不能用一次新的 getApp/LaunchServices 另起无沙箱实例；绑定不符先 HOLD。Welcome/窗口/按钮须实际原图/full AX，owner 不调用 AX probe。
2. 原生“打开本地项目”选择上方唯一新 `OfflineBoundary-1102` 路径。picker 只在产品实际打开后 fresh 绑定原 installed 完整 helper 路径，不能预启动 helper。无用户项目或既有 dirty/staged QA 操作。
3. 打开 `offline.txt`，在原文之后只追加一行 `OFFLINE_NATIVE_1102` 并保存一次。显示 clean/保存 disabled；原生 Git 查看本地修改/小 diff，只有该行，未暂存。owner 执行一次 `record --stage after-save` 验源字节/HEAD/index/config、同 PID。
4. 对这个仓库唯一 origin **原生 Fetch 一次**。保实际完整错误/原图/full AX；网络权限拒绝/EPERM 可按字面记录，缺 remote、AUTH、坏路径或泛化错误不能自动称离线通过。不能 Push/Pull/合并或改 remote，不另发 AI 请求。owner `record --stage after-fetch` 只读配对；helper 不运行 fetch/网络探针。
5. 同实例回到 `offline.txt` 确认保存内容仍可读，再看同一本地 Git diff 仍可用。owner `record --stage after-local-recheck`。只补隔离边界，不扩完整 Git 套件。
6. 原生正常 CmdQ/实际退出一次（仅本 QA clean、无未知资源；有未知 dirty/资源先 HOLD）。Apply 完成后不再调用 CUA getApp/getAXState，避免旧 binding 读产生额外启动；由 owner `record --stage after-quit` 只读看原 PID/已观察子树/原 bundle helpers gone、原包 hashes 保持。

原生截图/AX/actions 使用新 `docs/verification/results/offline-boundary-native-20261102/`，不能追加 final20 或修改旧失败。GUI 仅 Terra；owner 只做下列离散只读记录，不启动 watcher/CPU sampler。

```sh
rtk proxy python3 .work/offline-boundary-20261102/offline_owner.py record --stage after-save
rtk proxy python3 .work/offline-boundary-20261102/offline_owner.py record --stage after-fetch
rtk proxy python3 .work/offline-boundary-20261102/offline_owner.py record --stage after-local-recheck
rtk proxy python3 .work/offline-boundary-20261102/offline_owner.py record --stage after-quit
```

这些 owner Git 命令带 `--no-optional-locks`，只读本夹具 HEAD/status/index/remotes；它们在沙箱外执行，不冒充原生离线 Git 证据。离散观察可能错过快退 Git 子进程；没有实际 PID/errno就保留限制，不补造网络归因。

## 正常收尾与保留边界

- 退出受限 main/子树后，此限制结束，无全局网络状态要恢复。不能尝试给仍活进程“解除 sandbox”，不改系统 Wi-Fi/代理/防火墙/权限，不装依赖。
- 原 app/签名保持；不重建包、不重签、不为了离线改变 appdata 路径或覆盖原用户设置/草稿。新 QA 的登记/session 是本次已授权原生打开产生的实际变化，记录保留，不由脚本回滚真实 appdata。
- 唯一允许的文件变化是本新 QA 的 `offline.txt` marker。正常结束保留该修改、基线 HEAD、未暂存 index 逻辑条目、固定 origin 与全部证据；不新增提交、reset、删目录或自动 Remove 项目。若 index 原始字节因正常 stat 刷新变化，如实记录并比较逻辑条目，不能擅自覆盖。
- 后续若需清理/恢复，只由 root 决定是否把本 QA 源文件恢复到 `baseline/offline.txt` 或移除其新登记，且先确认全部归属进程退出；不触及任何旧 QA/用户项目。此恢复不在当前单链内自动执行。
- 方法只证明本次受限 native/普通 Git 子树的业务隔离，不称整机断网或所有独立 WebKit/XPC 服务离线；未测到/失败原样保留。不重复历史 probe，不建服务/VM/新框架。

## 当前准备状态

仅创建了这个合成单文件 Git 夹具和卡片/helper。helper 未执行，未运行 `--help`/AST/工具自检；没有 sandbox/app/GUI/network 启动，也没有原生通过结论。等待 root 完整审阅并明确 launcher flag。
