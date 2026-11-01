# UI004 同一 native dialog 确认 surface — PREPARED ONLY

仅 Modal / UnsavedChanges 两文件候选，产品未 apply，未构建原生、重启应用或操作 GUI/appdata。

0546/PID19076 的原 native 失败保留：Connection 已收起、Settings + 新确认可见，但完整 AX 与 fresh 仍空 HTML 根；Continue 后字段保留，焦点在表单关闭按钮，不能记作恢复到 model。此轮 native 没有 CmdQ。提供的失败图/AX SHA 见 native-failure-inputs。该结果否定已测试的 portal / suspend-top 方案，不继续复用其通过假设。

Modal 删除 replaceTop/suspend，精确回到原 81ef 实现。Unsaved 发现已有 top native dialog 时，只把局部 role=alertdialog surface portal 到那个同一 dialog，完全不调用它的 showModal/close，不卸载表单。先在 layout effect 捕获原 activeElement，inline 按钮不使用 autoFocus；再设置确认命名并聚焦继续编辑、隔离背景。host 原 aria-label/labelledby/describedby 与背景每个 HTML 子节点的 inert、aria-hidden、完整 inline style 均保存原字符串并精确恢复，包括非空值。Tab 在确认三个按钮内双向循环；Esc 直接继续编辑；host cancel 用 capture + preventDefault/stopImmediatePropagation，不能调用父业务 cancel。

确认 cleanup 恢复背景与命名，仅在 host 仍 connected/open、原焦点仍 connected 时恢复该元素焦点。没有 showModal 恢复步骤，因此不复活已卸载的 host。无既有 native dialog 时保留原 body portal + Modal 分支。pending/resolver、busy、卸载取消、草稿/key 逻辑未改；无全局 modal 框架、计时器或重试。

已运行的限定验证：

- 复用两组 after 的 20 次确认条件，8349ms，通过。连接路径 native 数保持 2，Launcher 路径保持 1；每次都是同一 host，确认期间 HTML showModal/close 调用均 0。背景隔离、非空属性原值恢复、双向 Tab、host cancel 拦截、字段/key 保留、明确放弃及父卸载无复活通过。Esc 与受控 App close 路径事先把实际 model 输入设为焦点，返回后断言原元素身份相同；不是仅断言在父层内。
- X 触发后的首个取消检查改为派发 cancel event 验证 capture；原报告 label 沿用“X confirmation Escape”，实际动作见 run.mjs。其他 Escape 检查仍用键盘。所有 App close 均为组件边界受控事件，不是此次 native CmdQ 证据。
- 无 native host 的单个 fallback smoke：旧 Modal 的 Escape/放弃与原触发按钮焦点恢复通过。零 browser/console 错误，浏览器已关闭。
- 两文件 TypeScript noEmit 一次通过，零诊断，906ms；git apply --check 通过；产品及四份调用源码 SHA 未变。

结果、执行源码、前后快照、基线与工件 SHA 见 result / typecheck-result / source-sha / manifest。复现命令为 `rtk proxy node .work/unsaved-inline-native-20261102/run.mjs` 与同目录 run-typecheck.mjs。只有 headless Chromium 的 DOM/键盘/焦点检查；不以 role 查询或 Tab 结果外推 Wry/macOS AX 已修好。root 仍需在下一既定安全包边界集成后原生核验。
