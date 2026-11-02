TASK037 收尾短卡：仅准备，待root正式GUI租约；此卡未生成输入、未操作App。

既有证据复用（不重跑）：源移动/有效导入与自有组合=MAC-APPEARANCE-ASSET-PRESET-001；参数/三区域/重开/关闭=MAC-APPEARANCE-BACKGROUND-002及…BACKGROUND-REGIONS-NATIVE-20261101-001；两真实effect的state/CSS/2URL各revoke一次、两迟到read零新URL=MAC-BACKGROUND-OWNED-RESOURCE-CLEANUP-COMPOSITE-001。全局项目范围沿用已审全局外观证据。精确raw入口与边界见evidence-map.json。

仅补两句的最小一轮（不预填通过）：
1. 入场记真实bundle/SHA/PID/start、项目、完整全局外观投影O（layout/theme/mode、geometry/colors、背景assetId/region/fit/opacity/overlay/x/y；revision单列），无busy后留AX+原图。已知自有资产A=613103d6e17e2e449cd5043665877a3b7192e48dc14b11a623acf4e6f64cc690（320×180，规范化PNG1684B，同SHA）；历史QA组合“外观验收 · 雾蓝背景”来自固定导出。导出不带preset实体ID，当前ID须owner只读/原生辨明，不凭同名猜。
2. 激活A且记录背景B，建议沿旧已验侧栏/cover/30%/65%/x25/y75以便看图；除这6值与assetId，其余O不动。仅当现有QA组合引用A且其余外观值与当前一致才复用；否则用“外观组合名称”保存当前组合为唯一QA-T037-Ref-20261102，记其真实ID；不碰用户/旧QA组合。A若没有可用当前入口，按inputs-plan.md从冻结自有PNG提取后原生选择，不能用用户图片替代。
3. 背景页“替换图片”原生选择超20MiB输入一次，记录真实错误、旧预览/参数和工作台原图；owner只读核appearance assetId/背景B与其他全局偏好、A文件/hash保持，出现无关变动即保fail不重试。再以同一路径选择损坏PNG一次，同样记录。两次导入失败不能因toast或仅看到缓存图就称保留成功。
4. B仍开启且QA组合仍引用A时，原生点一次“移除图片资产”。此按钮会先关闭全局背景，再请求删除；不要把这次背景关闭记成损坏导入回滚失败。预期实际RESOURCE_BUSY/“图片仍被配置或组合引用”；owner只读核A记录/PNG/preview仍在且hash同、引用方案ID未变。然后“外观方案”对同一个已记录ID点“应用”，重新进背景页留同图/同B+原图与AX，证明可重新读取被保留资产。无此实际拒绝+重应用链则这句仍pending。
5. 完整恢复：以O为准回原背景（入场关闭则点“关闭背景”），恢复原region/fit/可见度/遮罩/x/y；layout/theme/mode/geometry/colors必须与O相同（revision可因明确操作递增）。若入场是其他未确认可恢复的图片/组合，先交root定恢复入口，不能以恢复默认覆盖。仅删除本轮新建的QA-T037-Ref-20261102这一真实ID，确认“已应用设置保留”；复用的旧QA与已知A均保留。最终AX/原图+owner只读投影核O及原方案集合。不给旧冻结cleanup plan追加项目。

source仅解释路径：SettingsPanel308–315等task.result成功才换asset；appearance.rs562限制20MiB、566–604解码；SettingsPanel484–488先clear再remove；appearance.rs1000–1041保护preset引用。源码不是上述新原生结果。缓存清理只验pathSearch，不替代引用删除拒绝。双端解码/纹理/全进程增量未测照旧保留，不新增WebKit物理归零门。
