# Git04 写任务往返恢复 — PREPARED ONLY

唯一产品候选仍是 `GitPanel.tsx`。`source.patch` 为 frozen 产品 `ab271f73…` → 最终 `d9a89130…`（包含已接受的 branch-refresh）；`delta-from-branch-refresh.patch` 仅为冻结 `0cc88799…` → 本次04增量。旧 `.work/git-branch-refresh-20261101` 与6组原证保持不变。产品、bridge、后端、真实仓库均未改，无产品构建/安装/GUI/真实 Git 操作。

原生失败依据：`docs/verification/results/git-terra-20261101/git-91087-1793541773799-04-return-only-reading.{jpg,ax.txt}` 与 `owner/04-live-start.json`、`04-after-hidden-return.json`。owner 确认同一 PGID25926 / Git25932 / hook25933 / sleep25934 仍活，界面却只剩状态读取。其后原生 Sleep 是安全 cleanup，不记作原 Stop 通过；本次未重试该原生链。

根因是项目 effect 清 task/busy 并使旧 generation 回调失效。bridge 原 channel/result 实际仍消费任务，但 UI 丢了 handle；返回又先发会受仓库写锁阻塞的 status。host 的 get/attach/cancel 均须已知 taskId，没有任务枚举接口；本次复用原 TaskHandle，无新 backend/API/poll。

最小实现：同文件按 projectId 保一条写记录，用 React 订阅；start 前同步占位，含未 ack 阶段。原 handle、进度、cancelRequested 与基底 snapshot 跟随任务。返回或组件卸载重挂时恢复该记录，显示原写任务/Stop，不先发 status，也不重启提交。写开始使旧 status/branch read 失效；Stop 只调用该项目原 handle，cancel 回执不提前解锁或宣称 OS 已停。

进度/终态先更新所属记录，所有旧视图 then 仍核项目、generation 与 record token；成功快照仅交当前正确视图。隐藏终态只留成功/失败摘要及 commit 草稿关联，去掉 base、result snapshot、handle；返回走现有 fresh status，消费后释放。仅确认成功且 storage 草稿仍匹配本次 message 时，用原 persistDraft 清一次；失败/unknown、新 A 草稿、B 草稿均保留。该恢复针对同 renderer 内的视图生命周期，没有新持久化草稿或历史缓存机制。

history effect 拆回 repoId/history（另随 busy 解除恢复），branches 独立依 snapshot/branches；不为 branch 刷新重复读取慢 history。返回 fresh status 尚无 snapshot 时也能显示已有错误/刷新入口。原 commit/stagingAction/openDiff 入口与选中 diff JSX 不改，不重跑原生 staged-diff 链。

## 原始组件证据

真实 GitPanel、GitModal、bridge；mock Tauri Task channel/ack/cancel/终态、仓库锁导致的 status 等待，以及 plugin enabled/editor store/无关 DiffViewer、ConflictViewer 内容。真实请求事件触发组件，不镜像 run/恢复实现；所有命令、taskId、scope/epoch、DOM 草稿/Stop/错误均在原始报告。

- `result.json`：7组 × before/after，一次全过，7153ms，零 browser/console 错误。before 是已冻结0cc组件，passed 表示成功复现04缺陷或保留已有隔离，不表示原生/旧产品通过。
- 组别：pending 写 A→NONREPO→A及真实卸载重挂/同 task Stop；迟到 ack 与同步双 submit 单写；隐藏成功/草稿清一次/终态不重播；新 A 草稿和 B 草稿不被旧成功清；隐藏失败返回；history 随同 repo status 刷新由3读→1读；旧 status 晚到不覆盖已确认的新 commit 快照。
- `branch-subset-result.json`：最终源仅复核 cached-current / late-success 两个相关 after，1119ms，全过。未重跑其余已冻结 branch 组，继承依据见 manifest。
- Stop 的原生 PID/OS 清退未在本轮重做；这里只验证组件发往唯一所属 TaskHandle 的取消、等待真实受控终态后释放。新包仍待 root 集成后安排最短原生补证。

`manifest.json` 含完整 SHA、准确命令/时间/原始结果与源连续性。测试及 headless browser 全部已结束，不再追加用例；等待 root 统一集成。
