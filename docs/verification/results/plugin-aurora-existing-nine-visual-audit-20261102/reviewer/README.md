# Aurora 插件原图独立审查

已亲看九组 reference/native；只读源码、原图、AX/manifest。未GUI、改live、test/build、安装/启用、写fixture/policy或canonical。

| 项 | 判定 | 原证结论 |
|---|---|---|
| E03 | pass（旧0546结构/层级） | 全页详情/操作/tab/两栏/元信息完整；真实QA与原型数据不同。只限此Aurora旧native。 |
| E05 | differences | 三列卡片与section旧缺失已补；真实input双边框。root已source修，待native。 |
| E08 | differences | 真首次授权、未勾/按钮禁用；共享modal宽/圆角/底色差异。 |
| E09 | differences | 真项目覆盖；标题22px低于设计26px、scope系统select更小。单bool非假formatter，保真实字段。 |
| E11 | differences | 真旧/新增权限分组；共享modal差异。保source/engine/unpacked/逐cap授权。 |
| E12 | 条件不符 | 图27在runtime底部，无标题/统计；名为runtime-six替代图实际是installed页。不能冒完整运行页。 |
| E13 | differences | 真A停用依赖与1PID清单；共享modal差异，确认按钮仍描边而设计填充。仅preview足够。 |
| E14 | differences | 真全局41项目/2PID/保私有checked；列表有内滚且底部可见。共享modal及危险按钮填充差异。 |
| E15 | 条件不符 | 真installed0空态成立，但Aurora主题/布局同时已卸，实际内置回退外观/左rail。保互斥限制，不重卸八轮。 |

共享modal最终设计：atlas.css124–125为510px、radius+8；base.css126为h-low底。旧native570px/固定22/h-surface。root已集成三属性和input selector修复；此批无新包原图，仍登记旧差异和待native复验。标题20→22、停止/卸载按钮描边→原型填充是剩余minor记录；本轮不再扩CSS候选。

原始宽/圆角候选：`.work/plugin-visual-modal-candidate-20261102/source.patch`；搜索selector候选：`.work/plugin-visual-search-candidate-20261102/source.patch`。两份均未由plugin_sol应用；root集成另加背景delta。所有权限、来源、项目/文档/进程信息保留，不用删字段对齐高度。

精确9组路径/原SHA/截图时间、PID/start/mainSHA、逐项观察、current源码快照与边界见audit.json；18项原图/AX对manifest hash全匹配。canonical仅由verification_sol登记；此审查不覆盖新build或其它七样式。旧功能套件全部复用。
