# Aurora G01 冷恢复原帧独审

**当前建议：差异，只有树骨架行距明确需修。** 真实局部加载已发生；不把源码或这一套当8套视觉通过。

- 已亲看同录像原始6帧：69/70＝树8条；72/89/90＝中央12条、树已就绪；91＝恢复原先选中的 broken-link 错误页。公共 decoded/index.json 的PTS/每帧SHA已核，录像SHA/exit0与f0a2身份绑定。两区只按自然先后阶段组合，不称同帧。
- **树25对参考41px，明确CSS差异。** Modal的内层普通block令14px上下margin合并：11+14=25。设计`.tree`是纵向flex+gap2，margin不合并：11+14+14+2=41。`source.patch`只给tree骨架内层同样flex/gap2；高度、宽度、颜色、中央pitch32均不改。候选未apply/build/test。
- **中央首条y135对参考y181是路径条件差，不是18px padding或条距错误。** 中央12条的pitch32/宽度序列/11px高度匹配；设计先渲染现成breadcrumb，再骨架。真实restore逐tab `activate:false`，最后才选保存的active file；中间无active buffer，Workbench不会虚构路径行，约45px breadcrumb加边界细节即约46px差。无需全局补46px，也不造路径。
- 69尚是lazy树、70多了真实目录工具条，首条因此再下移约35px；这是实功能和进度阶段。69/70中央welcome与view恢复尚未进入真实可见pending的阶段相符，视频本身不能证明精确RPC边界。91的原broken-link不是本轮新失败；保持恢复/重试入口即可。

证据与源码责任、精确hash/PTS见 `review.json`；唯一未应用候选见 `manifest.json`/`source.patch`。只读审查，无GUI/appdata/新解码/新测试/生产或canonical变更；后续是否组合或补新原生证据由root/Verifier决定。
