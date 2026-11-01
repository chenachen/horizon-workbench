# Git 分支缓存刷新 — PREPARED ONLY

仅 `GitPanel.tsx` 候选，产品/后端/真实仓库未改；没有产品构建、原生 GUI 或全 Git 测试。组件进程已结束。交接：`source.patch`、`source-sha.json`、`manifest.json`、原始 `result.json` / `attempt-01/result.json`。

原生依据：`docs/verification/results/git-terra-20261101/git-91087-1793541773799-03-no-upstream-list-mismatch.{jpg,ax.txt}`。AX 中 `gui/no-upstream` 的 Push / 无上游提示已更新，`main` 仍显示当前分支并跟踪 origin/main。旧失败保持原证，不重试原生链。

根因：同 repoId 的 status 刷新不失效 branches；effect 又只看 repoId 且 branches 非空不读取。同项目在途 branches 只受项目 generation 保护，旧结果/错误/finally 还能晚到。`value || default` 在新增重读后还会重填用户明确清空的字段。

最小修改：

- 刷新开始使旧 branch 请求序号失效，成功 status 清 branches；仅展开 branches 时随新 snapshot 对象重读，关闭保持 lazy。成功 mutation 原清 branches 处也使旧 read 失效，不改提交/diff路径。
- loadBranches 捕获该请求的 snapshot，成功/catch/finally 都核项目 generation 与 branch 序号。backend repoToken 不覆盖全部非当前 refs/remote，不能作为唯一缓存失效 key；若返回 token 已不同，则复用现有 STALE_VERSION/stale，保字段、禁写、不自动重试。正常手动 refresh 成功仍沿原逻辑清该错误。
- remote/目标分支/比较终点用 touched 布尔保明确输入，包含空值；未编辑的分支默认值依据新 snapshot。新分支名、起点、比较起点等不重置。现存 remote 被外删则保原值并显示“已移除”，相关网络操作禁用；不迁移/替换已选远端。
- 原 busyRef/stale 写锁、expectedRepoToken、staging/commit/openDiff/选中 diff 链及既有轮询间隔保持。没有新监听、轮询、自动 fetch 或通用缓存框架。

真实组件验证使用 GitPanel、GitModal、bridge；仅 Tauri 的 status/branches/订阅响应、plugin enabled、editor store 与无关 diff/conflict 内容受控。不调用真实 Git，不写 refs/index/config，不启动模型或服务；所有调用均限定现有读取/订阅/ack。

6组 before/after：缓存 main/current 与新 status 的真实矛盾；同 token 的 refs/remote 变化及明确草稿/空值；旧成功晚到及 finally 不清新 loading；旧失败不污染新列表；旧项目结果不触新项目；不同 token 的现有 stale 路径与手动刷新恢复清错。

before passed 表示观察到预期旧行为（项目 generation 隔离原本正确），不表示旧产品符合当前分支显示要求。after 6组全过，最终运行5942ms，零 browser/console 错误；不宣称原生修复通过。

首轮 cached-current 通过后，fixture 按 exact label 查 remote select 超时；原始 DOM 状态中该控件存在。保留 `attempt-01/` 的原脚本/结果/patch/SHA，只改为真实 `.git-sync select` 控件定位后，复用已过首组并完成剩余 before 与全部 after。候选 source SHA 未变化；manifest 精确关联两次原始回执，没有改写旧结果。
