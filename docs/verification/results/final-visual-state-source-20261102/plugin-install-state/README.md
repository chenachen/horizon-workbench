# 安装真实 apply 状态小候选（prepared only）

问题：prepare返回setInstall后，run仍在refreshPlugins；通用busy被误当安装状态，可显示“正在安装/所需权限已确认”，但用户尚未授权、没有apply任务。取消句柄用ref赋值也不保证重绘。

改动仅两文件：

- PluginCenter增加独立installing；只在既有授权安装回调通过run互斥后、调用extension_install_apply之前设true，run的finally清理。prepare/其它busy不设置它。
- PluginInstallDialog以installing决定安装标题、progress与“取消安装”/onCancel。busy继续锁对话框、主按钮与返回；权限fieldset也随busy禁用，prepare尾显示正常权限页且不能改授权。
- cancelInstall改为state。start确认返回后用setCancelInstall(() => task.cancel)保存函数，触发重绘；函数外层不可省，避免React把cancel当updater执行。cancel只在真实apply＋已获句柄时可点；结束/失败/取消仍走原finally清理。

源流静态核对（未运行测试）：prepare尾installing=false→正常权限页/权限与操作锁住；获准apply开始→progress/尚无句柄时取消disabled；start确认→state重绘可取消；任务成功/失败/取消→原await/catch/finally收口并清句柄/安装态。busyRef同步互斥、原grants与backend校验、phase/indeterminate进度、task_cancel/cooperative/晚取消语义不改。快速任务仍可能没有可拍帧，不加延迟/最短时长/百分比。

完整patch：source.patch；原/拟SHA和两份全文见manifest.json、before/、proposed/。生产两文件原SHA读回保持；未改live/GUI/appdata/native/协议/CSS、未运行类型/组件/产品测试或构建。供root完整审阅后决定集成与本次唯一后续build；本候选不构成E07原生通过。
