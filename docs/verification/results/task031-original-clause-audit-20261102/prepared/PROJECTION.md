# 选区投影 helper — prepared only

`project_selection_projection.py` 未运行。只有 root 在原 loading 批 finalowner 后给正式门才执行。

固定 EditorQA `e1111892-…` / visual.md `1b55b505…`，原377B/SHA29b982…；引用原 `editor-before.json` 的固定SHA。每次只读一次 registry，输出该项目 revision、6个session字段/12tabs及 visual.md 实际anchor/head/scroll、由UTF-16实际范围切出的完整selected文本。没有其它session/恢复稿/配置输出，也没有GUI/OS/API调用或appdata写。

输入格式（仅示意；当前不运行）：

```text
rtk proxy python3 .work/task031-existing-evidence-20261102/project_selection_projection.py <before-selection|after-roundtrip|restored> --gui-image <本阶段原图绝对路径> --gui-ax <本阶段AX绝对路径> --out-dir <root指定的同一证据目录绝对路径>
```

每阶段绑定图/AX实际路径、bytes、SHA，写 `<phase>.json`，存在则在读取registry前拒绝；实际落盘也用exclusive创建。after引用同目录真实before receipt，核实际范围和全文相同。restored核原235/235、scroll61及6session字段（含broken-link active、12tabs）恢复；不固定旧revision。失败保留实值/错误，不自动重读或操作。

范围是持久session投影，不能称AX直接读出的anchor/head；GUI图/AX与root正式identity另行绑定。没有新增metrics/注入，也不运行原09post。准备文件SHA见 `projection-helper-manifest.json`。
