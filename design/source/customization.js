function createHorizonCustomization({styles, palettes, state, project, paint, toast, escape, icon, go, row, select, note}) {
  const storageKey = 'horizon.design.appearance.v1';
  const fresh = () => ({global:{}, projects:{}, presets:[]});
  let data = fresh(), scope = 'project', tokenMode = 'light';
  try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved?.global && saved?.projects && Array.isArray(saved.presets)) data = saved; } catch {}
  const fields = [
    ['sidebarWidth','文件侧栏',240,160,480], ['navigationWidth','项目导航',64,48,280],
    ['topbarHeight','顶部区域',56,40,88], ['tabHeight','文件标签高度',40,28,64],
    ['tabMinWidth','文件标签最小宽',120,80,240], ['auxiliaryWidth','辅助面板',320,240,560],
    ['bottomHeight','底部面板',220,120,480], ['statusHeight','状态栏',26,20,40],
    ['uiFontSize','界面字号',13,11,20], ['codeFontSize','代码字号',14,10,28]
  ];
  const tokens = [['accent','强调色','--h-accent'],['onAccent','强调色上的文字','--h-on-accent'],['background','工作台底色','--h-bg'],['surface','内容表面','--h-surface'],['text','正文','--h-ink'],['muted','次要文字','--h-muted'],['border','分隔线','--h-line'],['selection','选中背景','--h-tonal']];
  const current = () => data.projects[project().id] || {};
  const target = () => scope === 'global' ? data.global : (data.projects[project().id] ||= {});
  const value = (key, fallback) => current()[key] ?? data.global[key] ?? fallback;
  const origin = key => Object.hasOwn(current(),key) ? '项目覆盖' : Object.hasOwn(data.global,key) ? '全局默认' : '插件默认';
  const layout = style => styles.find(s=>s.id===value('layoutId',style.id)) || style;
  const theme = style => styles.find(s=>s.id===value('themeId',style.id)) || style;
  const geometryKey = (style,key) => `geometry:${layout(style).id}:${key}`;
  const colorKey = (style,key,mode=tokenMode) => `color:${theme(style).id}:${mode}:${key}`;
  const persist = () => { try { localStorage.setItem(storageKey,JSON.stringify(data)); } catch { toast('浏览器存储空间不足；当前预览仍可用。'); } };
  const button = (action,label,extra='',cls='outline-button') => `<button type="button" class="cursor-interaction ${cls}" data-custom-act="${action}" ${extra}>${label}</button>`;
  const scopeBar = () => `<div class="settings-scope">${select('外观设置范围',[['global','全局默认'],['project','当前项目 · '+project().short]],scope,'data-custom="scope"')}<span class="small muted">未覆盖字段继承全局</span></div>`;
  const links = () => `<div class="custom-links">${go('settings-layout','布局插件','panels-top-left')}${go('settings-sizes','区域尺寸','ruler')}${go('settings-background','背景图片','image')}${go('settings-colors','自定义配色','palette')}${go('settings-presets','外观组合','bookmark')}</div>`;
  const reset = key => button('unset','恢复继承',`data-key="${escape(key)}"`,'custom-reset');
  const defaultSize = (style, key) => key === 'navigationWidth' && layout(style).id === 'sand' ? 180 : fields.find(f=>f[0]===key)[2];
  const selectedColor = (style,key,mode=tokenMode) => {
    const cssKey=tokens.find(t=>t[0]===key)[2], raw=palettes[theme(style).id][cssKey];
    const pair=raw?.match(/light-dark\((#[\da-f]+),(#[\da-f]+)\)/i);
    let color = value(colorKey(style,key,mode), pair ? pair[mode==='dark'?2:1] : raw || '#496793');
    if (/^#[\da-f]{3}$/i.test(color)) color='#'+[...color.slice(1)].map(c=>c+c).join('');
    return color;
  };
  const mini = style => `<div class="custom-mini" data-mini-layout="${layout(style).nav}"><div class="custom-mini-top"><span class="mini-dot"></span><span class="mini-dot"></span><span class="mini-dot"></span><strong>Horizon</strong><span>${escape(layout(style).name)} · ${escape(theme(style).name)}</span></div><div class="custom-mini-body"><div class="custom-mini-nav">A<br>K<br>D</div><div class="custom-mini-tree">src<br><b>workspace.ts</b><br>theme.css<br>README.md</div><div class="custom-mini-code"><span class="keyword">const</span> workspace = {<br>&nbsp; theme: <span class="string">"${theme(style).id}"</span>,<br>&nbsp; layout: <span class="string">"${layout(style).id}"</span><br>};<div class="custom-mini-hint">即时预览</div></div></div></div>`;
  function range(style,key,label,min,max,fallback,storage=key,unit='%') {
    const n=scope==='global'?(data.global[storage]??fallback):value(storage,fallback);
    const source=scope==='global'?(Object.hasOwn(data.global,storage)?'全局默认':'插件默认'):origin(storage);
    return `<div class="custom-range"><label>${label}<small>${source}</small></label><input type="range" min="${min}" max="${max}" value="${n}" aria-label="${label}" data-custom="number" data-key="${escape(storage)}"><input type="number" min="${min}" max="${max}" value="${n}" aria-label="${label}数值" data-custom="number" data-key="${escape(storage)}"><span>${unit}</span>${reset(storage)}</div>`;
  }
  function content(part,style) {
    const l=layout(style),t=theme(style),head=(title,sub)=>`<h3>${title}</h3><p class="subtext">${sub}</p>${scopeBar()}`;
    if(part==='appearance') return head('让工作台像你喜欢的样子','布局、主题与外观偏好，各自选择，自由组合。')+mini(style)+row('主题包',select('主题包',styles.map(s=>[s.id,s.name]),t.id,'data-custom="themeId"'),origin('themeId'))+row('明暗模式',select('主题',[['system','跟随系统'],['light','浅色'],['dark','深色']],value('mode','system'),'data-setting="theme"'))+row('当前布局',`<span class="pill active">${l.name}</span>`+go('settings-layout','更换布局','','custom-reset'),'由布局插件安排区域位置')+links()+note('偏好跟随项目','全局设置会应用到未覆盖的项目。每个字段都可以恢复继承。');
    if(part==='layout') return head('布局由插件提供','八个预装布局，共享你的文件、任务和主题。')+`<div class="layout-choice-grid">${styles.map(s=>`<button type="button" class="layout-choice cursor-interaction ${s.id===l.id?'selected':''}" data-custom-act="layout" data-layout="${s.id}" aria-pressed="${s.id===l.id}"><div class="layout-thumbnail" data-nav="${s.nav}"><i></i><b></b><span></span></div><strong>${s.name}</strong><small>${s.subtitle}</small><span class="layout-package">${s.id===l.id?'使用中':'已安装'} · 布局插件</span></button>`).join('')}</div>`+`<div class="button-row">${reset('layoutId')}${go('plugins','管理布局插件','puzzle','outline-button')}${go('settings-sizes','调整区域尺寸','ruler','tonal')}</div>`+note('切换后保留工作现场','配色、未保存内容和正在进行的任务保持原状。');
    if(part==='sizes') return head('区域尺寸','调整空间比例；区域位置由当前布局插件决定。')+`<div class="custom-section-heading"><span>${l.name} · 首选尺寸</span>${go('settings-layout','更换布局','','custom-reset')}</div>`+fields.filter(f=>f[0]!=='navigationWidth'||!['tabs','dock','unified','drawer'].includes(l.nav)).map(([key,label,def,min,max])=>range(style,key,label,min,max,defaultSize(style,key),geometryKey(style,key),'px')).join('')+`<div class="button-row">${button('reset-geometry','重置本布局尺寸',`data-layout="${l.id}"`)}</div>`+note('小窗口会临时收起面板','保留首选尺寸；窗口变宽后自动恢复。顶部系统控制保持可操作。');
    if(part==='background') {
      const image=value('backgroundImage','');
      return head('一张图，也能成为你的工作台','选择本地图片，调节区域与可见度。')+`<div class="background-upload ${image?'has-image':''}" ${image?`style="background-image:url('${escape(image)}')"`:''}><div>${icon(image?'image':'image-plus')}<strong>${escape(value('backgroundName','选择一张喜欢的图片'))}</strong><span>${image?'已导入 · 仅保存在本机浏览器原型':'PNG / JPEG / WebP · 最大 20 MiB'}</span><label class="tonal cursor-interaction">${image?'替换图片':'选择图片'}<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="选择背景图片" data-custom="backgroundFile"></label></div></div>`+row('显示区域',select('背景显示区域',[['workbench','整个工作台'],['sidebar','文件侧栏'],['editor','编辑区']],value('backgroundRegion','workbench'),'data-custom="backgroundRegion"'))+row('适应方式',select('背景适应方式',[['cover','填满'],['contain','完整显示']],value('backgroundFit','cover'),'data-custom="backgroundFit"'))+range(style,'backgroundOpacity','图片可见度',0,40,12)+range(style,'backgroundOverlay','表面遮罩',40,100,85)+`<div class="button-row">${button('sample-background','试用渐变背景')}${button('remove-background','移除背景')}</div>`+note('文字保持清晰','图片只作用于所选表面。对话框、权限与错误提示使用实色背景。');
    }
    if(part==='colors') return head('搭配你自己的颜色','在主题之上微调，浅色与深色分别保存。')+row('编辑模式',select('配色模式',[['light','浅色'],['dark','深色']],tokenMode,'data-custom="tokenMode"'))+`<div class="custom-color-grid">${tokens.map(([key,label])=>`<label class="custom-color"><input type="color" value="${selectedColor(style,key)}" aria-label="${label}" data-custom="color" data-key="${escape(colorKey(style,key))}"><span>${label}<small>${selectedColor(style,key).toUpperCase()} · ${origin(colorKey(style,key))}</small></span>${reset(colorKey(style,key))}</label>`).join('')}</div>`+mini(style)+`<p class="custom-contrast" role="status">${contrastText(style)}</p><div class="button-row">${button('reset-colors','恢复当前模式配色',`data-theme="${t.id}"`)}</div>`;
    if(part==='presets') return head('保存你的外观组合','把布局、配色、尺寸与背景一起收好，随时换回。')+mini(style)+`<div class="custom-preset-save"><input type="text" aria-label="外观组合名称" placeholder="例如：晚间阅读" maxlength="48" data-custom-name>${button('save-preset','保存当前组合','','filled')}</div><div class="custom-presets">${data.presets.length?data.presets.map((p,i)=>`<div class="custom-preset"><span>${icon('bookmark')}<strong>${escape(p.name)}</strong><small>${escape(p.label)}</small></span><div>${button('apply-preset','应用',`data-index="${i}"`,'tonal')}${button('export-preset','导出',`data-index="${i}"`)}${button('delete-preset','删除',`data-index="${i}"`,'custom-reset')}</div></div>`).join(''):'<div class="custom-empty">'+icon('bookmark-plus')+'<strong>从现在的搭配开始</strong><span>保存后会出现在这里，应用到所选范围。</span></div>'}</div><label class="outline-button custom-import cursor-interaction">导入组合 JSON<input type="file" accept="application/json,.json" aria-label="导入外观组合" data-custom="presetFile"></label>`+note('组合引用已安装插件','导入不会执行或自动安装插件。JSON 导出不包含图片。');
    if(part==='layout-recovery') return head('布局未能启用','新的布局没有完成加载，已经保留上次可用布局。')+note('实验布局 · 缺少 editor 插槽','当前文件、未保存修改与任务均已保留。','error','panels-top-left')+mini(style)+`<div class="button-row">${go('settings-layout','选择可用布局','panels-top-left','filled')}${go('plugins','管理插件','puzzle','outline-button')}</div>`;
    return '';
  }
  function contrastText(style) {
    const luminance = hex => {const a=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*a[0]+.7152*a[1]+.0722*a[2];};
    const a=luminance(selectedColor(style,'text')),b=luminance(selectedColor(style,'surface')),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    return `正文 / 表面对比度 ${ratio.toFixed(1)}:1 · ${ratio>=4.5?'适合普通文本':'偏低，建议调整正文或表面颜色'}`;
  }
  function apply(el,style) {
    const l=layout(style),t=theme(style);
    el.dataset.style=l.id;el.dataset.layout=l.nav;el.dataset.themePackage=t.id;
    for(const [key,v] of Object.entries(palettes[t.id])) el.style.setProperty(key,v);
    for(const [key,,cssKey] of tokens) el.style.setProperty(cssKey,`light-dark(${selectedColor(style,key,'light')},${selectedColor(style,key,'dark')})`);
    if(state.accent!=='default') {const colors={blue:['#496793','#b2cdf8'],green:['#3f7458','#a9d7b9'],violet:['#7950a3','#dbb2ff']}[state.accent];el.style.setProperty('--h-accent',`light-dark(${colors[0]},${colors[1]})`);}
    const mode=value('mode','system');el.dataset.userTheme=mode;
    el.style.colorScheme=state.screen==='dark'?'dark':mode==='system'?(t.theme==='dark'?'dark':'light dark'):mode;
    const css = {sidebarWidth:'--h-tree',navigationWidth:'--rail-width',topbarHeight:'--custom-top',tabHeight:'--custom-tab',tabMinWidth:'--custom-tab-width',auxiliaryWidth:'--custom-aux',bottomHeight:'--custom-bottom',statusHeight:'--custom-status',uiFontSize:'--custom-ui-font',codeFontSize:'--h-font'};
    for(const [key] of fields) el.style.setProperty(css[key],value(geometryKey(style,key),defaultSize(style,key))+'px');
    const image=value('backgroundImage',''),sample=value('backgroundSample',false);
    el.dataset.background=(image||sample)?value('backgroundRegion','workbench'):'none';
    el.style.setProperty('--custom-image',image?`url('${image}')`:sample?'linear-gradient(130deg,#71adc9 0%,#d6cae7 46%,#d5b791 100%)':'none');
    el.style.setProperty('--custom-opacity',value('backgroundOpacity',12)/100);
    el.style.setProperty('--custom-overlay',value('backgroundOverlay',85)+'%');
    el.style.setProperty('--custom-region-opacity',value('backgroundOpacity',12)/100*(1-value('backgroundOverlay',85)/100));
    el.style.setProperty('--custom-fit',value('backgroundFit','cover'));
  }
  function sync() {document.querySelectorAll('#horizon-atlas .hz').forEach(el=>{const style=styles.find(s=>'horizon-'+s.id===el.id);apply(el,style);});}
  function write(key,v,repaint=true) {target()[key]=v;persist();if(repaint)paint();else sync();}
  async function change(event) {
    const el=event.target,name=el.dataset.custom;if(!name)return false;
    if(name==='scope'){scope=el.value;paint();return true;}
    if(name==='tokenMode'){tokenMode=el.value;paint();return true;}
    if(name==='number') {if(!el.checkValidity())return true;write(el.dataset.key,Number(el.value));return true;}
    if(name==='color'){write(el.dataset.key,el.value);return true;}
    if(name==='backgroundFile') {
      const file=el.files?.[0];if(!file)return true;
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024){toast('请选择不超过 20 MiB 的 PNG、JPEG 或 WebP。');return true;}
      const destination=target(),url=URL.createObjectURL(file);
      try {const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>40000000){bitmap.close();throw Error('图片像素过大');}const ratio=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();destination.backgroundImage=canvas.toDataURL('image/webp',.82);destination.backgroundName=file.name;destination.backgroundSample=false;persist();paint();toast('背景已导入，可调整显示区域与可见度。');}
      catch{toast('图片无法读取，请换一张静态图片。');}finally{URL.revokeObjectURL(url);}return true;
    }
    if(name==='presetFile') {
      const file=el.files?.[0];if(!file)return true;
      try {if(file.size>1024*1024)throw Error();const p=JSON.parse(await file.text());if(p.schemaVersion!==1||typeof p.name!=='string'||!p.values||!styles.some(s=>s.id===p.values.layoutId)||!styles.some(s=>s.id===p.values.themeId))throw Error();const safe={};for(const [k,v] of Object.entries(p.values)){if(k==='layoutId'||k==='themeId')safe[k]=v;else if(k.startsWith('geometry:')){const [_,id,key]=k.split(':'),f=fields.find(x=>x[0]===key);if(styles.some(s=>s.id===id)&&f&&Number.isFinite(v)&&v>=f[3]&&v<=f[4])safe[k]=v;}else if(/^color:[a-z]+:(light|dark):\w+$/.test(k)&&/^#[\da-f]{6}$/i.test(v))safe[k]=v;else if(k==='backgroundRegion'&&['workbench','sidebar','editor'].includes(v))safe[k]=v;else if(k==='backgroundFit'&&['cover','contain'].includes(v))safe[k]=v;else if(k==='backgroundOpacity'&&v>=0&&v<=40)safe[k]=Number(v);else if(k==='backgroundOverlay'&&v>=40&&v<=100)safe[k]=Number(v);}data.presets.push({name:p.name.slice(0,48),values:safe,label:'已导入 · 未应用'});persist();paint();toast('组合已导入，点击应用后生效。');}catch{toast('组合无法导入：格式无效或引用的布局/主题未安装。');}return true;
    }
    write(name,el.value);return true;
  }
  function input(event) {const el=event.target;if(!['number','color'].includes(el.dataset.custom)||!el.checkValidity())return false;write(el.dataset.key,el.dataset.custom==='number'?Number(el.value):el.value,false);const parent=el.closest('.custom-range');parent?.querySelectorAll('input').forEach(i=>{if(i!==el)i.value=el.value;});return true;}
  function click(event) {
    const el=event.target.closest('[data-custom-act]');if(!el)return false;
    const action=el.dataset.customAct,app=el.closest('.hz'),style=styles.find(s=>'horizon-'+s.id===app.id);
    if(action==='layout')write('layoutId',el.dataset.layout);
    else if(action==='unset'){delete target()[el.dataset.key];persist();paint();}
    else if(action==='reset-geometry'||action==='reset-colors'){const prefix=action==='reset-geometry'?`geometry:${el.dataset.layout}:`:`color:${el.dataset.theme}:${tokenMode}:`;Object.keys(target()).filter(k=>k.startsWith(prefix)).forEach(k=>delete target()[k]);persist();paint();}
    else if(action==='sample-background'){Object.assign(target(),{backgroundImage:'',backgroundSample:true,backgroundName:'晨雾渐变'});persist();paint();}
    else if(action==='remove-background'){Object.assign(target(),{backgroundImage:'',backgroundSample:false,backgroundName:''});persist();paint();}
    else if(action==='save-preset'){const name=app.querySelector('[data-custom-name]').value.trim();if(!name){toast('给这个组合起个名字。');return true;}data.presets.push({name,values:{...data.global,...current(),layoutId:layout(style).id,themeId:theme(style).id},label:layout(style).name+'布局 · '+theme(style).name+'主题'});persist();paint();}
    else if(action==='apply-preset'){Object.assign(target(),data.presets[Number(el.dataset.index)].values);persist();paint();toast('组合已应用到'+(scope==='global'?'全局默认':'当前项目')+'。');}
    else if(action==='delete-preset'){data.presets.splice(Number(el.dataset.index),1);persist();paint();}
    else if(action==='export-preset'){const p=data.presets[Number(el.dataset.index)],values={...p.values};delete values.backgroundImage;delete values.backgroundName;delete values.backgroundSample;const url=URL.createObjectURL(new Blob([JSON.stringify({schemaVersion:1,name:p.name,values},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='horizon-appearance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    return true;
  }
  return {supports:part=>['appearance','layout','sizes','background','colors','presets','layout-recovery'].includes(part),content,apply,click,change:event=>{if(event.target.dataset.setting==='theme'){state.theme=event.target.value;write('mode',event.target.value);return true;}if(!event.target.dataset.custom)return false;void change(event);return true;},input,reset:()=>{data=fresh();scope='project';tokenMode='light';},snapshot:()=>structuredClone(data)};
}
