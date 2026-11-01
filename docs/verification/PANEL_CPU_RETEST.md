# 原生文件选择器空闲CPU复测

状态：2026-11-01 settings-project构建同PID A/B/C/D已完成；关闭OpenPanel/SavePanel后仍超出1%建议。生命周期实验已从源码撤回，旧二进制仍含实验。完整结果、栈、公开API边界与撤回记录见[本次调查](results/settings-project-panel-source-audit/README.md)。候选6/7原始失败继续保留；不同场景不作优化前后比较。

## 已有定位

候选6停止Pi后，完整125秒场景内Pi为零。后60秒Horizon全关联CPU平均13.858%；responsiblePid=33304的openAndSavePanelService35619贡献13.676%，其余约0.181%。CPU约每5秒脉冲。后续4.22秒只读栈显示主线程等待，工作线程在`TNode::SynchronizeChildren → TFSInfoSynchronizer::FetchChildren`枚举目录和读取属性；不确定具体目录或触发源。`lsof`只确认cwd为`/`，不能据此认定正在浏览根目录。

证据：[固定场景](results/candidate6-pi-dormant-125s/audit.json)、[归属](results/candidate6-pi-dormant-125s/panel-helper-attribution.json)、[栈与假设](results/candidate6-pi-dormant-125s/panel-helper-investigation.json)。

## 同包、同场景对照

1. 正常退出旧包、启动候选7，确认主二进制hash。恢复相同项目、文件、聊天结束状态、1280×800、Mist浅色、同面板/插件状态；不先打开系统文件选择器。禁止编译/生成压力夹具。所有其他持续外部工作须如实记录。
2. A基线：保持UI不动125秒，前60秒预热、后至少60秒统计。原生导出会打开选择器，所以A阶段前的资源计数可缺失；不得为补计数破坏“未用选择器”条件。
3. B空目录：通过原生GUI导出到新建专用空临时目录，确认保存面板已关闭、返回相同场景；再静置125秒。采样日志写另一目录，不与被浏览目录混用。计入所有责任进程，包括关闭后保留的文件面板helper。
4. 若A/B存在差异，或B未复现旧脉冲，才追加C原目录对照：使用原先实际浏览/导出目录，记录其规范路径、文件数/层数和是否持续变化，然后同样关闭后125秒。若发现原目录为1万/10万压力目录，**保留大目录浏览及关闭后成本**，不能用空目录达标撤销该场景失败。
5. 仅在同场景复现证据足够后定位源码/系统服务边界。若做修复，重跑受影响的同一目录场景；不能杀helper后以低CPU报通过。

每阶段保留：实际原生动作时间、窗口/活动项目/插件与会话状态、目录条件、全部PID+start/responsibility、原始samples/summary/metadata。CPU按单核100%，全关联平均值判断1%建议；Horizon/单Pi/测试provider分别列，所有权不明先列未知，不随意排除。

## 已有采集脚本

继续使用`sample_macos.py`，不另建实现相同的采样器。下列PID/快照/目录是执行时占位符，须替换为真实已记录值。正式输出先放独立临时目录，结束后再原样复制到对应结果目录并记录hash。

```sh
rtk proxy python3 scripts/desktop/sample_macos.py \
  --pid ACTUAL_CANDIDATE7_PID \
  --output /private/tmp/horizon-panel-cpu-retake/STAGE_A_NEW_DIR \
  --scenario candidate7-panel-cpu-A-before-any-picker \
  --build release --build-id candidate7 \
  --plugin-state /private/tmp/horizon-panel-cpu-retake/actual-stage-A-state.json \
  --members /private/tmp/horizon-panel-cpu-retake/actual-members.json \
  --activity-log /private/tmp/horizon-panel-cpu-retake/native-actions.jsonl \
  --duration 125 --interval 1 \
  --cache-condition 'OS cache retained; same native scene; no concurrent compile; picker not yet used'
```

B/C只改实际state、scenario、cache-condition和新output目录。A不伪造空闲诊断；B实际导出可用`--resources`引用并保留`capturedAt`，该快照不等于每秒实时值。采样结束前GUI操作者保持状态，任何消息到来由协调者记录并决定是否影响固定场景。

结果判定：A通过/B失败表明选择器相关增量；A/B都失败仍需逐进程查实际成本；仅C失败则明确目录规模/变化触发。任何情况都保留候选6事实，复测成功只限定匹配条件。


## 候选7实际结果

[A](results/candidate7-panel-cpu-a-125s/audit.json)与[B](results/candidate7-panel-cpu-b-125s/audit.json)均为125.005秒、118样本，使用同包同PID37993、同2560×1337小文件/Git场景；前后原图一致。A没有SavePanel，B包含SavePanel55971/QuickLook55972/Safari56004。B实际导航专用空目标，预览过期拒绝写盘，不能记作成功导出。A低B高已复现关闭后脉冲，先定位现有证据；C场景暂不扩展。

原始A记录误复用启动时1280×800，已保留原始metadata并以实际PNG/CG2560×1337纠正；不用于1280视觉通过。B无诊断导出，runtime计数仍未测。


## 2026-11-01 隔离短命选择器实验

[完整归档](results/picker-lifetime-probe-20261101/README.md)保留探针源码、编译身份、原生图/AX、四例结果与全部进程身份。目录选择/取消、保存路径选择/取消均由真实原生GUI完成、子exit0。父38330保持运行时，四个子和12个新面板服务全部消失，末例后至少107.5秒仍未回来；旧Horizon34128/面板40868及完整旧组11身份保留。

此结果支持短命客户端生命周期的隔离方案；尚未集成Horizon，不能撤销旧包CPU失败或声称最终空闲预算通过。CPU收益仅根据这些身份已终止推断。子使用独立bundleID；父不自动回焦点、跨进程不再是宿主sheet，保存路径选择也未写导出文件。首例同bundle路由失败和5.413秒跨段记录间隔均明确保留，不作为通过证据。
