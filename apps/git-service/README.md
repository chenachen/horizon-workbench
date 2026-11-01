# Horizon Git extension service

`horizon-git` 是独立 Rust 可执行程序。桌面宿主的 `src-tauri/src/git.rs` 只承担扩展租约、文件 ID/路径转换、串行调度、任务流和进程组回收；Git 解析与业务写操作不链接进宿主二进制。

每次请求启动一个独立 sidecar。stdin 接收一份 JSON 请求，stdout 输出 JSON Lines：`progress`、`result` 或 `error`。真实 Git 子进程继承该进程组。扩展停用、任务取消和外部只读插件撤销请求均通过宿主停止对应进程组，不影响无关项目或 Git 任务。

```sh
rtk cargo test --manifest-path apps/git-service/Cargo.toml
rtk cargo build --release --manifest-path apps/git-service/Cargo.toml
rtk proxy python3 apps/git-service/tests/benchmark.py --output apps/git-service/evidence/benchmark-macos.json
rtk proxy python3 apps/git-service/tests/benchmark.py --cancel-only --large-mib 1 --output apps/git-service/evidence/cancel-macos.json
```

测试均创建独立临时仓库；不提交、推送或改写 Horizon 源仓库。

桌面开发时自动查找 `apps/git-service/target/debug/horizon-git` / `target/release/horizon-git`。打包时 `horizon-git` 应位于主程序同目录；`HORIZON_GIT_SIDECAR` 可显式指定测试可执行路径。系统 Git 路径读取全局/项目有效 `git.path` 设置，默认 `git`，凭据与提交签名沿用用户 Git 工具链。

## 真实行为

- porcelain v2 保留 index/worktree 两列，同一文件可同时出现在已暂存、未暂存分组。
- repoToken 包含 HEAD/status/index 与可写范围的磁盘内容；排队后重新核对。外部 Git 不受本进程锁约束，token 不冒充跨进程事务锁。
- 提交核对整个已暂存文件集合，执行 `git commit -m`，不传 paths、不自动暂存、不自动推送。hook/签名失败保留索引与前端说明。
- 整文件暂存/取消暂存；初始仓库与部分暂存支持；重命名取消暂存同时覆盖新旧 index 路径。
- 历史分页、父提交/任意两个引用比较、已删除历史文件、二进制说明、diff 分页。
- 冲突展示 stage 1/2/3 对象，缺失对象显示不存在；整文件选择只改工作目录。显式暂存后才解除 Git 冲突标记；仍含冲突分隔符时拒绝暂存。
- fetch 不修改工作目录；pull 只允许 ffOnly；push 显示 source/target/remote，没有 force 字段。切分支和 pull 要求干净工作目录；宿主另检查未保存文档。
- 放弃计划绑定当前仓库版本和精确文件清单，恢复默认来源为 index；未跟踪文件移到废纸篓，没有永久删除回退。逐文件失败保留结果。
- clone 只使用新目录，成功后才登记项目。失败/取消残留保留，显式清理只接受本次未完成克隆标记。

## 有界数据

status 最多返回 10,000 个文件，超限明确截断并禁止写操作；面板每组显示 100 项。diff 捕获上限 16 MiB，页面上限 128 KiB，优先在完整行边界分页；超长行明确标注续读。前端每页最多 600 行，保留最多 4 个片段。sidecar 缓存最多 20 份 / 32 MiB，游标与放弃计划 10 分钟过期。

## 验证证据

`evidence/test-report.json` 保存命令、时间、平台、完整 stdout/stderr 与退出码；`tests/workflow.rs` 当前 18 项真实 Git 集成测试：

| 场景 | 核验 |
| --- | --- |
| HEAD A / index B / disk C | staged diff A→B、unstaged diff B→C；提交只含 B，磁盘仍 C |
| unborn + 中文空格文件名 | 暂存后磁盘继续变化，取消暂存仍保留磁盘 |
| stale snapshot / 提交范围扩大 | 写入拒绝，要求刷新审查 |
| pre-commit hook 失败 | index 与 unborn HEAD 状态保留 |
| 放弃未暂存与旧计划 | 恢复 index，旧计划拒绝 |
| merge 冲突 | stage 来源正确，选择整文件后仍需显式暂存 |
| 大 diff / binary | 有界分页、二进制标识 |
| clone | 成功复制，拒绝现存目录与路径穿越 |
| rename / deleted history | 新旧路径同时取消暂存，删除文件历史仍可读 |
| 本地 bare remote | fetch、ffOnly pull、push 成功；分歧拒绝且 HEAD 不变 |
| 引用比较 / 无效输入 | 明确比较起终点，拒绝参数与路径注入 |
| 大 blob 流式读取 | 超过 16 MiB 的对象按页读取，UTF-8 字符不截断 |
| index.lock | 返回 GIT_LOCKED，原锁内容保留，外部释放锁后重试成功 |
| 脏树分支 | 拒绝自动切换，不 stash；只创建不切换仍可用 |
| unborn / detached / 父仓库 / Git 缺失 | 四类状态明确分开，配置身份包含 local 来源 |
| modify/delete 冲突 | 缺失 stage 返回 null，整文件选择后仍需显式暂存 |
| merge 历史 | 两个父提交保留，详情默认比较第一父提交，旧游标拒绝 |
| diff 隔离 / rename | 缓存不能跨仓库读取，重命名保留新旧路径 |

`evidence/benchmark-macos-before.json` 和 `evidence/benchmark-macos.json` 记录 macOS arm64 release 压力采样。后者使用有界状态解析：10 万路径由约 7.14 s / 97 MiB 降至约 0.57 s / 19.4 MiB；50 MiB 文件生成 diff 预览约 347 ms / 72.5 MiB。采样只合计 sidecar 与同进程组 Git 子进程，包含采样开销，不包含桌面/WebView，也不是多次统计或完整产品预算结论。最新报告包含 release 二进制 SHA-256；旧 before 样本未记录旧二进制 hash，保留这一限制，不补造历史标识。真实 hook 子进程组取消后没有残留，未产生提交。`cancel-macos.json` 单独记录 hook 确认启动后，SIGTERM 到退出观测约 25 ms（含轮询开销）；它不包括桌面 `task_cancel` 链。原 pressure 报告的 `durationMs` 是完整提交请求耗时，不能当作取消延迟。

桌面原生点击、八布局视觉对照和全应用资源验收由集成验收继续覆盖；这里的 CLI 证据不替代 GUI 验收。
