# UI008 / UI011：缺失组件边界证据

最终四条检查通过：2026-11-01 08:30:06.305Z–08:30:07.902Z，1597ms，exit 0。没有修改产品源码、操作 native GUI/app data、运行产品构建或广泛 suite，也未修改 canonical 记录。

真实组件与逻辑：`AppearanceProvider`、`SettingsPanel`、`backgroundObjectUrl`、`applyAppearance`、`useSettings` 和 `bridge`。仅替换 Tauri core/event 边界，返回自有 snapshot/1像素 PNG/受控延迟与失败。React 事件、effect、状态和 URL API 都真实执行；URL API 的包装只记录后再调用浏览器原实现。只读 React fiber hook state 用于区分“CSS guard 隐藏”与“旧 asset state 确已清空”，不替换 state 或镜像实现。

## 新增结果

1. **UI008，已加载图片关闭。** Provider 与 Panel 各读取并创建一个真实 Blob URL。点击真实 SettingsPanel“关闭背景”后，两个实际 asset hook state 都为 null，两个 snapshot 的 assetId 都为 null；root `--background-image: none` / `data-background=none`，preview 内联图片样式清空。两个已创建 URL 各 revoke 一次。
2. **UI008，在途 read 迟到。** 新 asset 的 Provider/Panel 两条读取均扣留；真实关闭动作完成后再返回数据。两 state/CSS 仍清空，零新增 URL。最终 2 创建 / 2 revoke；无未决 read。
3. **UI011，真实 selectLayout 延后。** 对 document 发送受控 compositionstart，真实 Provider listener 将 composing 置 true；点击真实布局按钮。等待中的 prepare/apply 均为 0。发送 compositionend 后，两者各一次，切到 Orbit、snapshot 与 CSS 同步；额外 compositionend 不重复调用。这里不是物理原生中文输入测试。
4. **UI011，apply 在提交前失败。** 真实 selectLayout 完成 prepare 后，Tauri 边界明确以“未提交”方式拒绝 apply，不修改受控宿主。Provider 和 Panel 的完整 snapshot、root style 均与前态精确相等，commit 数不变，显示真实布局恢复入口。此结果证明原态保留，不称成功 apply 后 rollback。

最终无 browser/console error，7份产品源 SHA 前后未变。App SHA `27f0cf56343e51877985e0f3d3e3bade830947786f5a7641af340db20197fee4` 与既有 navigation repair release manifest 一致；该 release 主程序 SHA 为 `7ba8676ec5884232dd7170e1ed252fdc5fccc7ba9cca37e72c2f42d4ddae0885`。本次未另测原生 App PID 89459。

## 复用与未扩大结论

- 复用 `docs/verification/results/appearance-full-native-20261101/functional-summary.json` 的 background / ime / layout-50，以及同目录原始图片/AX；本次不重做 native 导入、关闭、真实中文提交或50布局。
- `pendingAppearance.test.ts` 只验证保存合并，没有覆盖上述 URL lifetime 或 selectLayout composition 等待，所以不能替代这四条新增检查。
- 既有 Paused F14 仍只称 enablePackage 前置失败；不改称 apply 后回滚。
- **UI008 浏览器物理 decoded cache/纹理释放仍未直接测得。** 本次证明应用清空持有状态/CSS 并 revoke 所有创建的 URL，不以此、隐藏或 RSS 推导浏览器物理解码缓存释放。
- 原生“组词期间实际请求布局”的物理操作仍未新增；组件合成 CompositionEvent 与既有物理中文证据分别保留。

## 文件与执行记录

- `run.mjs`、`result.json`：实际脚本和原始最终结果；所有阶段 snapshot/call/URL 记录保留。
- `source/`：7份冻结产品源快照，SHA 位于 result。
- `execution-receipt.json`、`tool-output.log`：最终 exec_command/write_stdin 的准确返回值；时间来自 harness 自报，没有独立 OS 起止时间或分离 stderr 记录。
- `attempt-01-run.mjs`、`attempt-01.json`：首轮停于测试断言。两个 state 已清空、root CSS 已清、两个 URL 已 revoke，但 preview 的产品占位 CSS 为 linear-gradient，不能要求 computed backgroundImage=none。唯一修正为“内联清空且 computed 不含 blob URL”后完成同一窄检查；未把 fixture 断言错误算产品失败。
- `summary.json`、`manifest.json`：结果语义和文件哈希。完成后未重跑。
