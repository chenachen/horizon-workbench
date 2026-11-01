import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'design/exports');
const styles = JSON.parse(await readFile(path.join(root, 'design/source/styles.json'), 'utf8'));
const screens = JSON.parse(await readFile(path.join(root, 'design/source/screens.json'), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
await mkdir(path.join(out, 'pdf'), { recursive: true });
await mkdir(path.join(root, '.work'), { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1328, height: 1150 }, colorScheme: 'light', deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`file://${root}/design/index.html`);
await page.locator('#horizon-mist .code-line').first().waitFor();
const manifest = [];
for (const style of styles) {
  await mkdir(path.join(out, 'png', style.id), { recursive: true });
  for (const screen of screens) {
    await page.evaluate(({ key, id }) => { HorizonDesign.reset(); HorizonDesign.show(key, id); }, { key: screen.key, id: style.id });
    const app = page.locator(`#horizon-${style.id}`);
    // Export design reference pages in full; application windows retain their 800 px stage.
    if (screen.group === '设计规范') await app.evaluate(el => { el.style.height = 'auto'; el.style.minHeight = '800px'; el.querySelector('.spec-page').style.overflow = 'visible'; });
    const file = `png/${style.id}/${screen.id}-${screen.key}.png`;
    const box = await app.boundingBox();
    await app.screenshot({ path: path.join(out, file), animations: 'disabled' });
    manifest.push({ style: style.id, styleName: style.name, ...screen, file, width: Math.round(box.width), height: Math.round(box.height) });
    await app.evaluate(el => { el.style.removeProperty('height'); el.style.removeProperty('min-height'); });
  }
  console.log(`${style.name}: ${screens.length} PNG files`);
}
if (errors.length) throw new Error(errors.join('\n'));
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({ version: '0.1.0', styles: styles.length, scenes: screens.length, files: manifest }, null, 2));

const imageFor = (style, key, prefix = '') => prefix + manifest.find(x => x.style === style && x.key === key).file;
const baseCss = `*{box-sizing:border-box}body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;color:#253549;background:#f5f7fa}h1,h2,p{margin:0}h1{font-size:40px;font-weight:500;letter-spacing:-1px}h2{font-size:21px;font-weight:500}a{color:#496793;text-decoration:none}header{padding:42px 56px 28px}header p{color:#65738a;margin-top:8px}img{display:block;width:100%;height:auto}figure{margin:0}figcaption{padding:14px 0 8px;color:#65738a;font-size:13px}small{color:#65738a}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px 28px}.cell{min-width:0}footer{font-size:12px;color:#65738a;padding:24px 56px}.tag{display:inline-block;border:1px solid #d7e0eb;padding:3px 9px;border-radius:20px;font-size:12px;color:#65738a;margin-left:10px}`;
const cover = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Horizon · 八套界面方向</title><style>${baseCss}body{background:#f5f7fa}.overview{padding:0 56px 20px}.cell h2{margin:0 0 12px}.cell img{border-radius:12px;border:1px solid #e0e6ed}</style><body><header><small>HORIZON / DESIGN EXPLORATIONS / 0.1</small><h1>地平线，八种打开方式。</h1><p>同一组功能，八种导航与视觉节奏。每套覆盖 ${screens.length} 个页面与状态。</p></header><main class="overview grid">${styles.map(s => `<section class="cell"><h2>${s.name}<span class="tag">${s.subtitle}</span></h2><img src="${imageFor(s.id, 'home')}" alt="${s.name}默认工作台"><figcaption>${s.description}</figcaption></section>`).join('')}</main><footer>Horizon · Material-inspired desktop workbench · 交互原型 / 非桌面应用实测</footer></body></html>`;
await writeFile(path.join(out, 'overview.html'), cover);
await page.setViewportSize({ width: 1680, height: 1200 });
await page.goto(`file://${out}/overview.html`);
await page.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
await page.screenshot({ path: path.join(out, 'horizon-eight-directions.png'), fullPage: true });

const printCss = `${baseCss}@page{size:1440px 1040px;margin:0}body{background:white}.sheet{width:1440px;height:1040px;padding:35px 48px 30px;page-break-after:always;display:flex;flex-direction:column}.sheet:last-child{page-break-after:auto}.sheet-header{display:flex;align-items:baseline;gap:16px;margin-bottom:18px}.sheet-header small{margin-left:auto}.sheet-header h1{font-size:24px;letter-spacing:0}.image-area{min-height:0;flex:1;display:flex;align-items:center;justify-content:center;background:#f5f7fa;border-radius:14px;overflow:hidden}.image-area img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}.sheet-note{font-size:13px;color:#65738a;padding-top:14px;min-height:44px}.cover-sheet h1{font-size:52px;margin:8px 0}.cover-sheet .lead{font-size:19px;color:#65738a;margin-bottom:30px}.cover-sheet img{border-radius:18px}.cover-sheet .sheet-note{margin-top:auto}.style-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;flex:1;min-height:0}.style-grid figure{min-height:0;display:flex;flex-direction:column}.style-grid img{min-height:0;object-fit:contain;flex:1;border-radius:12px}.style-grid figcaption{flex-shrink:0;padding:6px 0 0}.cover-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:20px}.cover-cards p{font-size:13px;margin-top:7px;color:#65738a}`;
const printDocument = body => `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Horizon design</title><style>${printCss}</style><body>${body}</body></html>`;
const printPage = await browser.newPage({ viewport: { width: 1440, height: 1040 }, colorScheme: 'light' });
async function pdf(html, name) {
  const source = path.join(out, `${name}.print.html`);
  await writeFile(source, printDocument(html));
  await printPage.goto(`file://${source}`);
  await printPage.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
  await printPage.pdf({ path: path.join(out, 'pdf', `${name}.pdf`), printBackground: true, preferCSSPageSize: true });
  await unlink(source);
}
for (const style of styles) {
  const first = `<section class="sheet cover-sheet"><small>HORIZON / ${style.id.toUpperCase()} / 0.1</small><h1>${style.name} · ${style.subtitle}</h1><p class="lead">${style.description}</p><div class="image-area"><img src="${imageFor(style.id, 'home')}" alt="默认工作台"></div><p class="sheet-note">${screens.length} 个页面与状态 · 密度：${style.density} · 主题默认：${style.theme === 'dark' ? '深色' : '浅色'} · 设计原型</p></section>`;
  const body = screens.map((screen, i) => `<section class="sheet"><div class="sheet-header"><span>${screen.id}</span><h1>${screen.title}</h1><small>${style.name} · ${screen.group} · ${i + 1}/${screens.length}</small></div><div class="image-area"><img src="${imageFor(style.id, screen.key)}" alt="${screen.title}"></div><p class="sheet-note">${screen.note}</p></section>`).join('');
  await pdf(first + body, `horizon-${style.id}`);
  console.log(`${style.name}: PDF complete`);
}
const summaryCover = `<section class="sheet cover-sheet"><small>HORIZON / DESIGN EXPLORATIONS / 0.1</small><h1>地平线，八种打开方式。</h1><p class="lead">八套结构完整的 Material 界面方向 · ${screens.length} 个页面与状态 · ${manifest.length} 张设计图</p><div class="cover-cards">${styles.map(s => `<div><img src="${imageFor(s.id, 'home')}" alt="${s.name}"><h2>${s.name}</h2><p>${s.subtitle}<br>${s.density} · ${s.theme === 'dark' ? '深色' : '浅色'}</p></div>`).join('')}</div><p class="sheet-note">先比较导航结构，再确认颜色与密度。详细页面见每套独立 PDF；交互入口为 design/index.html。</p></section>`;
const compareKeys = ['home', 'git-changes', 'ai-chat', 'settings-appearance'];
const summarySheets = styles.map(s => `<section class="sheet"><div class="sheet-header"><h1>${s.name} · ${s.subtitle}</h1><small>${s.description}</small></div><div class="style-grid">${compareKeys.map(key => `<figure><img src="${imageFor(s.id, key)}" alt="${key}"><figcaption>${screens.find(x => x.key === key).title}</figcaption></figure>`).join('')}</div><p class="sheet-note">${s.density} · 圆角基准 ${s.radius}px · 完整页面与状态见 horizon-${s.id}.pdf</p></section>`).join('');
await pdf(summaryCover + summarySheets, 'horizon-design-overview');
const pluginScreens = screens.filter(s => s.group === '插件中心');
const pluginCover = `<section class="sheet cover-sheet"><small>HORIZON / PLUGIN CENTER / 0.2</small><h1>插件中心 · 让能力按需组合</h1><p class="lead">15 个管理场景 · 八套视觉方向 · 安装、权限、启停、更新、运行与开发</p><div class="cover-cards">${styles.map(s => `<div><img src="${imageFor(s.id, 'plugins')}" alt="${s.name}插件中心"><h2>${s.name}</h2><p>${s.subtitle}</p></div>`).join('')}</div><p class="sheet-note">本册采用雾蓝作为流程示例；其余七套的完整插件页面见对应风格设计册与 PNG 目录。</p></section>`;
const pluginSheets = pluginScreens.map((screen,i) => `<section class="sheet"><div class="sheet-header"><span>${screen.id}</span><h1>${screen.title}</h1><small>插件中心 · 雾蓝 · ${i+1}/${pluginScreens.length}</small></div><div class="image-area"><img src="${imageFor('mist',screen.key)}" alt="${screen.title}"></div><p class="sheet-note">${screen.note}</p></section>`).join('');
await pdf(pluginCover + pluginSheets, 'horizon-plugins');
const customKeys=['settings-appearance','settings-layout','settings-sizes','settings-background','settings-colors','settings-presets','settings-layout-recovery'];
const customScreens=customKeys.map(key=>screens.find(s=>s.key===key));
const customCover=`<section class="sheet cover-sheet"><small>HORIZON / CUSTOMIZATION / 0.4</small><h1>把工作台，调成你的样子</h1><p class="lead">布局插件 × 独立主题 × 区域尺寸 × 本地图片 × 自定义配色</p><div class="cover-cards">${styles.map(s=>`<div><img src="${imageFor(s.id,'settings-layout')}" alt="${s.name}"><h2>${s.name}</h2><p>${s.subtitle}</p></div>`).join('')}</div><p class="sheet-note">八套预设全部为布局插件。后续页面以雾蓝呈现设置流程；全局默认与项目覆盖逐字段生效。</p></section>`;
const customSheets=customScreens.map((screen,i)=>`<section class="sheet"><div class="sheet-header"><span>${screen.id}</span><h1>${screen.title}</h1><small>UI 定制 · ${i+1}/${customScreens.length}</small></div><div class="image-area"><img src="${imageFor('mist',screen.key)}" alt="${screen.title}"></div><p class="sheet-note">${screen.note}</p></section>`).join('');
await pdf(customCover+customSheets,'horizon-customization');


const gallery = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Horizon · 全部设计图</title><style>${baseCss}body{max-width:1600px;margin:auto}header a{margin-right:20px}nav{padding:0 56px 26px;display:flex;gap:12px;flex-wrap:wrap}select{font:inherit;padding:8px 12px;border:1px solid #ccd7e5;border-radius:9px;background:white;color:#253549}main{padding:0 56px}.gallery{display:grid;grid-template-columns:1fr 1fr;gap:24px}figure{background:white;border:1px solid #e0e6ed;border-radius:12px;overflow:hidden}figure img{aspect-ratio:1.6;object-fit:contain;background:#eef2f7}figcaption{padding:14px 18px 18px}figcaption strong{font-size:15px;color:#253549;font-weight:500}figcaption p{margin-top:5px;font-size:12px}[hidden]{display:none!important}@media(max-width:700px){header{padding:24px}nav{padding:0 24px 20px}main{padding:0 24px}.gallery{grid-template-columns:1fr}h1{font-size:28px}footer{padding:24px}}</style><body><header><small>HORIZON / DESIGN LIBRARY</small><h1>全部设计图</h1><p>8 套风格 · ${screens.length} 个场景 · ${manifest.length} 张 PNG</p><p><a href="../index.html">交互图集</a><a href="overview.html">八套总览</a><a href="pdf/horizon-design-overview.pdf">设计总览 PDF</a><a href="pdf/horizon-plugins.pdf">插件设计册</a><a href="pdf/horizon-customization.pdf">UI 定制设计册</a><a id="style-pdf" href="pdf/horizon-mist.pdf">当前风格完整 PDF</a></p></header><nav><label>风格 <select id="style">${styles.map(s => `<option value="${s.id}">${s.name} · ${s.subtitle}</option>`).join('')}</select></label><label>分组 <select id="group"><option value="all">全部场景</option>${[...new Set(screens.map(s => s.group))].map(g => `<option>${g}</option>`).join('')}</select></label></nav><main class="gallery">${manifest.map(m => `<figure data-style="${m.style}" data-group="${m.group}" ${m.style === styles[0].id ? '' : 'hidden'}><a href="${m.file}" target="_blank"><img src="${m.file}" alt="${escape(m.styleName + ' · ' + m.title)}" loading="lazy"></a><figcaption><strong>${m.id} · ${m.title}</strong><p>${m.note}</p></figcaption></figure>`).join('')}</main><footer>PNG 点击查看原图。交互、任务状态及内容均为设计示例。</footer><script>const style=document.getElementById('style'),group=document.getElementById('group');function filter(){document.querySelectorAll('figure').forEach(f=>f.hidden=f.dataset.style!==style.value||(group.value!=='all'&&f.dataset.group!==group.value));document.getElementById('style-pdf').href='pdf/horizon-'+style.value+'.pdf';}style.onchange=filter;group.onchange=filter;</script></body></html>`;
await writeFile(path.join(out, 'index.html'), gallery);
await writeFile(path.join(root, 'design/SCREEN_INDEX.md'), '# Horizon 页面索引\n\n8 套风格共用以下 ' + screens.length + ' 个场景。交互图集：[index.html](index.html)；导出图册：[exports/index.html](exports/index.html)。\n\n| 编号 | 分组 | 场景 | 关键设计 |\n| --- | --- | --- | --- |\n' + screens.map(s => `| ${s.id} | ${s.group} | [${s.title}](index.html?screen=${s.key}) | ${s.note} |`).join('\n') + '\n');
await browser.close();
console.log(`Exported ${manifest.length} PNGs, ${styles.length + 3} PDFs, overview and searchable gallery.`);
