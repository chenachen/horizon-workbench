# ResizeHandle / AppearanceProvider 组件回归

最终运行：6/6通过，exit0，2.12秒。使用当前产品源码：ResizeHandle、AppearanceProvider、applyAppearance、内置布局/主题。App几何保存适配采用产品相同的 `appearance.setGeometry(key, value).catch(reportError)`；没有挂载完整App。

测试只替换 bridge RPC 与事件，用受控 Promise 实现宿主 revision 校验、外观变更通知和真实 Promise reject。内存转译后挂载到 headless Chromium；鼠标/键盘事件由 Playwright 发送。不是原生 Horizon UI 验收，也没有调用产品构建。

通过项目：

1. active drag260→285；Esc恢复CSS/ARIA/实际元素宽度260，随后pointerup零写入。
2. Right260→261、ShiftRight→271保存完成；普通Esc保持271，不新增写入。
3. 原地真实浏览器dblclick271→240：两次pointerup不写，只重置一次patch/revision；已经240再双击零写入。
4. 多次pointermove到275，mouseup后只有一次patch。
5. 快速连续键盘产生276、277、287；未应答前最大在途patch1。依序用revision44、45、46；中间snapshot回来时CSS/ARIA仍保持最新preview287，最终host/snapshot287，无版本冲突。
6. 297预览遭受控宿主真实拒绝，宿主权威值283/revision48；失败刷新后CSS/ARIA/元素宽度/snapshot/host全283，原错误对象只上报一次，不重试；随后284保存成功，队列未堵塞。

`result.json` 保留每阶段CSS、ARIA、host、snapshot、patch计数和完整RPC/事件记录；`receipt.json` 保留命令、起止时间、退出码；`sources/` 保存执行时源码及hash。源码执行前后均未变化。浏览器与本地测试HTTP服务器已正常关闭。

第一次仅测试入口 JSX loader 配置错误，零阶段执行；原始 run/result/receipt/stdout/stderr 全保存在 `attempt-01-loader-error/`。修正 `.work` 测试入口 loader 后执行上述最终通过运行，没有改产品源码。
