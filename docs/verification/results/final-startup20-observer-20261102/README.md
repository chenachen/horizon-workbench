# Mac 20 次独立进程启动

实测包 main SHA `4d4bca76055afb46f403811035a718b2b8a8f892ca2e7e8ddc5ed2c5dbe5a135`，Apple M2 Pro / 32 GiB / macOS 26.3.1 (25D2128) / arm64。相同1280×800、100%、底部导航/极光深色、代码审查四能力、无活动项目/功能任务；侧栏首选271。系统与文件缓存保留，没有purge。

20次真实CUA启动，20组不同PID/内核出生时间。端点为启用的原生AXButton「打开本地项目」。CUA调用前UTC到只读observer首次ready返回UTC，包含调度、扫描和probe开销，不做扣除。中位数 **707.410 ms**，P95 **751.406 ms**，最大 **833.848 ms**；20条均低于原建议2000ms。仅进程出生到ready的诊断列单独保留，不替代端到端列。`root-statistics-review.json`用整数UTC重算，和原浮点summary差小于0.001ms。

全部20条保留完整Welcome图/AX、原始调用前后UTC与performance、正常Quit计划/输入与对应gone。第一条ready之后只读查看非默认271持久化，末条ready之后恢复原自定义8能力和侧栏有效240。原29条扩展登记中24默认仍安装/启用/未暂停，5条自有历史QA仍未安装；项目私有策略、3份恢复稿、原53B文件和其余偏好保持。

原20之后，最后退出后的旧binding AX读取期间出现额外PID75589。它的birth/ready/gone全保留，未作为补测或替换样本；单独正常清退后collector退出0。`observed_new_processes=21`与20条原请求索引均为真实值，不删额外记录。不能仅凭邻近时序断言产品自动重启。

原生记录在相邻`final-startup20-native-20261102/`；首次271设置原图下部控件部分被footer裁切，完整AX为271。最终只读owner确认所有21个观察到的main均不存在，相关责任进程无残留。原owner的all24错误谓词把5未安装登记算入而返回false；原件保留，reviewed记录基于同一快照正确限定24 installed，不重采样。

可复现观察器与mac_metrics/Swift只读probe源码同目录归档；原执行参数、probe SHA、机器和时钟信息在metadata.json。所有启动/退出仍须原生GUI执行，observer不会启动或向Horizon发信号。此记录不外推Windows、其他架构、物理冷缓存或整体内存预算。

本Mac包在Windows测试stderr阶段诊断加入前已构建并完成原生恢复复验；release目录source-change保留实际编译源SHA。之后4d27只在cfg(test,windows)增加安装错误上下文，非test表达式保持原样，本次包未替换或重建。
