# 插件第四批：策略重开通过，手动休眠清退失败

0546/App19076/start02日03:08:28，仅冻结14对原图/AX、47actions、42SHA。14原图亲看、13唯一AX（9全文/4完整差分，另1完全相同），全部哈希与31项原收据派生核对匹配。正常重开12项政策检查另保。没有GUI/新测试/采样或当前插件后缀读取。

真实正常Quit/同安装位置新包重开后，主QA全局已恢复、A项目仍暂停，optional只A禁用、B继承、config/grants/version/包/storage/gate保留，无自动nativeQA。四张policy图/AX分别证明A已暂停/项目覆盖和B实际已休眠/0实例/项目继承；不误写成待激活。随后只有明确A项目Resume与两次实际A/B命令才产生A43795/start03:21:20和B44677/start03:21:45。该策略条件通过，不能当资源修复通过。

freshbefore19:21:55显示nativeopenDocuments0/tasks0，Abort2/Event2/Commands4/Views2、instances10/dispose0。唯一clean A项目Sleep确认19:24:39.511，nativeSleep日志19:24:39.641，done原图/AX19:24:40；B返回19:24:48，freshafter19:25:01。postOS19:25:13证A43795gone/Aactivation清/Asleeping，B原ee5c89de+44677完整身份保持且active；后续持久元数据也没有新Aactivation。不是投影早于Sleep或A重新激活。lastActivity是内存不可得，lastOpenedAt独立保留且不替代；workspaceActive字段空，当前B由GUI及state共同证明。

失败保持：after仍Abort2/Event2/Commands4/Views2/instances10、dispose0，前端A资源映射未清，故RUN003/NFR004失败；disposing0不构成修复。before底层PluginCenter、after底层工作台，观察者与总listener差值不单判leak。OS后样本还含picker51402，不说所有进程归零。未强制refresh、重Sleep或新命令掩盖。

旧f544 disposing4失败保留，不由这次普通重开零计数替代。root源码定位manual-close缺通知只属分析，新9316构建不在此原生证据内。UI004另批失败不混；HOST005/fault/R2/WS004/alloff等后半仍未完成，无视觉或Windows新增通过。
