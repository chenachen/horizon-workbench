# 外观与设置实机验收

日期：2026-10-31。环境：macOS，本机 Tauri release 应用。所有操作通过 macOS 应用的真实按钮和键盘完成；源码测试不计作 GUI 通过。

候选 2 的 appearance-01 至 appearance-07 截图原字节为 CUA JPEG，文件名后缀虽为 `.png`，未转换或修改内容。这些图可核对功能观察，不能作为原始 PNG 像素验收；已从视觉验收矩阵排除。后续候选使用原生窗口 `screencapture` PNG。导出图片与组合的独立核验见 [原始导出及摘要](results/appearance-candidate2/observation.json)、[逐像素相等核验](results/appearance-candidate2/pixels.json)。

## 候选 2：缺陷定位

- 工作区：默认工作区；项目：临时验收夹具 UI Kit。
- 起始编辑状态：`src/换行测试.txt` 未保存，第 4 行 `未保存：跨项目保留`；搜索词 `中文保存`，1 个文件、1 处匹配。
- 起始布局/主题：雾蓝/雾蓝。实机截图：[雾蓝工作台](screenshots/release-candidate/appearance-01-mist.png)。
- 操作：设置 → 布局插件 → 暖纸。
- 结果：失败，提示 `未知字段 fromLayoutId`；旧布局和未保存文本保留。证据：[布局切换错误](screenshots/release-candidate/appearance-02-layout-apply-error.png)。
- 根因：前端把布局预检的完整返回对象传给执行接口，携带了只读预览字段；后端严格参数校验拒绝。
- 修复：执行请求显式投影成 `{ planId, digest }`。`npm run desktop:check` 通过。需用更新后的 release 复测，再推进其余七套布局。

## 当前仍待继续验证

- 候选 4 的青瓷“更多项目”折叠导航、尺寸设计顺序、设置分类切换滚动复位。
- 项目休眠 epoch 变化后的外观元数据读取修复。
- 自定义配色浅深分离/单项恢复、IME 合成期间延迟切换，以及背景解码资源实际回收测量。
- 八套布局与设计稿的完整视觉差异闭环；本报告中的功能通过不等于全部页面视觉通过。

## 候选 2：尺寸、背景与组合

- 尺寸：将当前项目文件侧栏从 240 改为 280，来源显示“项目覆盖”。切到全局设置仍为 240；全局改为 260，项目保留 280；项目“恢复继承”后为 260，来源显示“全局默认”。全局再次恢复继承后，项目回到 240 / 插件默认。通过。截图：[项目覆盖](screenshots/release-candidate/appearance-03-size-project-override.png)、[恢复继承](screenshots/release-candidate/appearance-04-size-inherited.png)。
- 背景导入：本机文件选择器导入 320×180 PNG 渐变夹具，显示“图片已导入 · 320 × 180”。源文件移动后关闭并重开设置，缩略预览及编辑区/完整显示/40%可见度/40%遮罩仍正确。资产复制路径通过。截图：[原图移动后预览](screenshots/release-candidate/appearance-06-background-source-moved.png)。夹具位于 `/var/folders/9j/xnw538c934b2s559tl01cc800000gn/T/horizon-appearance-qa-5rijtry8`。
- 快速连改背景：范围/适应方式/透明度连续操作出现前项回退；逐项等待保存则正常。根因是旧保存回包覆盖后续乐观值。已增加待确认改动重叠处理和两个延迟确认回归用例；外观/诊断共 5 项测试及类型检查通过。待候选 3 实机复测。
- 主界面图片显示：未通过。编辑区内层实色背景遮挡了图片，40%可见度/40%遮罩仍看不到图片。已交主界面 owner 修复 CSS。证据：[编辑区背景被遮挡](screenshots/release-candidate/appearance-05-background-editor.png)。
- 外观组合：保存中文名称“外观验收 · 雾蓝背景”；勾选“导出时包含背景”，通过原生保存对话框导出 JSON。文件包含 schemaVersion、name、packageRefs、values 和 1 项带 SHA-256 的图片数据。经原生文件选择器导入后显示独立组合，未自动应用；关闭当前背景后点击导入组合的“应用”，提示“已应用到当前项目”，重新进入背景页确认图片引用和四项设置恢复。通过。截图：[导入后应用](screenshots/release-candidate/appearance-07-preset-import-apply.png)。
- 本轮仅测试本地临时项目与临时夹具；未改动 Horizon 源仓库的项目文件。未保存文档内容保持原样。
- 跨主题组合：当前布局雾蓝，独立选择暖纸主题，外观预览显示“雾蓝布局 · 暖纸主题”，当前布局仍雾蓝；切换成功。明暗模式菜单已确认包含跟随系统、浅色、深色，候选 3 继续实际切换截图。

## 候选 3：八套布局、背景修复与撤销链

本轮窗口 1280×800，release PID 33639 / macOS 窗口 13433。正式图片直接由系统 `screencapture -x -o -l 13433` 保存原始 PNG；逐一核验 PNG 文件头和尺寸，未经过格式转换、缩放或像素编辑。候选 2 与 `release-candidate/appearance-08-candidate3-settings.png`、`appearance-layout-mist.png` 来自 CUA 观察截图，实际为 JPEG 字节，仅作操作观察，不计作原 PNG 视觉证据。

操作场景：切到临时项目 Aurora Web 的 `src/workspace.ts`，追加 `// layout-switch-undo-check`，将光标移到第 1 行第 1 列。依次切换雾蓝→暖纸→深空→石墨→青瓷→鸢尾→砂岩→极光→雾蓝，每次先切布局再独立选择对应主题。八次均成功，未再出现 `fromLayoutId` 参数错误。每步检查文件仍未保存、标记文本仍在、光标仍为第 1 行第 1 列。最后在编辑器按 Cmd+Z，标记消失、文件恢复已保存状态，原有中文内容保留。布局往返与撤销链通过。

| 布局 / 主题 | 明暗 | 密度 | 原窗截图 |
|---|---|---|---|
| 雾蓝 / 雾蓝 | 浅色 | comfortable | [01-mist](screenshots/appearance-candidate3/01-mist.png) |
| 暖纸 / 暖纸 | 浅色 | comfortable | [02-paper](screenshots/appearance-candidate3/02-paper.png) |
| 深空 / 深空 | 深色 | comfortable | [03-orbit](screenshots/appearance-candidate3/03-orbit.png) |
| 石墨 / 石墨 | 浅色 | compact | [04-graphite](screenshots/appearance-candidate3/04-graphite.png) |
| 青瓷 / 青瓷 | 浅色 | comfortable | [05-celadon](screenshots/appearance-candidate3/05-celadon.png) |
| 鸢尾 / 鸢尾 | 浅色 | spacious | [06-iris](screenshots/appearance-candidate3/06-iris.png) |
| 砂岩 / 砂岩 | 浅色 | comfortable | [07-sand](screenshots/appearance-candidate3/07-sand.png) |
| 极光 / 极光 | 深色 | comfortable | [08-aurora](screenshots/appearance-candidate3/08-aurora.png) |

截图 01–08 均使用各布局当前 manifest 默认尺寸，无尺寸与密度项目覆盖；主题均为同名配对。默认侧栏 240、顶部 56、页签 40、辅助面板 320、底部 220、状态栏 26、界面字号 13、代码字号 14；独立导航宽度分别为雾蓝 64、石墨 55、鸢尾 94、砂岩 180。默认值来自 0.4 外观基线，早期 B01 参考的局部尺寸仍存在差异，须在视觉报告明确核对。

- 真实结构：独立项目栏、一体侧栏、顶部项目标签、紧凑工具栏、独立 Expressive 区域、展开项目目录、底部项目栏均可辨。青瓷仍缺设计中的“工作区项目 / 更多项目”折叠组，不能把本轮青瓷视觉记为通过；Root 已在源码补齐，待候选 4。
- 背景遮挡复测：应用候选 2 保存的图片组合到 Aurora Web。编辑区图片可见，代码与行号保持实色文字。分别改为文件侧栏、整个工作台，所选区域均显示图片，其余区域保持对应表面。证据：[编辑区](screenshots/appearance-candidate3/09-background-editor.png)、[文件侧栏](screenshots/appearance-candidate3/10-background-sidebar.png)、[整个工作台](screenshots/appearance-candidate3/11-background-workbench.png)。
- 快速修改复测：先确认数值输入焦点，再连续键盘写入可见度 30%、遮罩 65%（同一连续输入调用约 0.54 秒），水平 25%、垂直 75%。关闭并重开设置后六项值为文件侧栏 / 填满 / 30 / 65 / 25 / 75，未回退。关闭背景后按钮禁用、工作台恢复实色。多次混合原生下拉和旧 AX 索引的自动化批处理曾未准确聚焦前部字段；该不可靠输入不计作回退证据。最终有效键盘焦点路径通过。
- 设置 footer 与导航修复已实机出现；原窗图：[外观页](screenshots/appearance-candidate3/13-settings-appearance.png)。尺寸页仍是旧键序，证明源码排序修订未进候选 3；证据：[尺寸页](screenshots/appearance-candidate3/12-settings-sizes.png)。待候选 4 校验修订。
- 本轮结束：Aurora Web / workspace.ts 已保存，雾蓝布局+雾蓝主题+浅色，背景关闭。没有提交或推送仓库。

候选 4 已准备源码：尺寸按设计顺序显示；切换设置分类滚动回顶；`appearance_get` 允许 app scope 读取已登记项目，`extension_list` / `settings_get` 同样改只读 app scope，写操作仍要求匹配项目 scope。新增读跨 epoch、写拒绝 app scope、未知项目拒绝回归；8 项 Rust 外观测试、5 项 TypeScript 外观/诊断测试和类型检查通过。

## 候选 4 前的主题配色修复

独立视觉复核确认同名主题与设计源存在色板漂移，包含暖纸强调色、石墨强调色、深空深色强调色、极光深色表面等。已按 `design/source/atlas.css` 的八套声明与 `base.css` 的共享状态色恢复 8×2×11=176 项主题 token；浅深模式各自保存。另增加 80 项设计表面映射，使 low/high、选中前景、成功/错误表面使用原设计值，避免 `color-mix` 近似造成偏色；用户修改相关 token 时回到已有派生规则。

源码一致性记录：[appearance-palette-parity.json](results/appearance-palette-parity.json)。5 项 TypeScript 外观/诊断测试与类型检查通过；布局统一尺寸未修改。已有应用登记会缓存内置主题声明，已交插件负责人补齐同版本、已安装内置主题的声明同步，保留启停与用户配置。此项仍需新包实际截图确认，候选 3 图片代表修复前状态。
