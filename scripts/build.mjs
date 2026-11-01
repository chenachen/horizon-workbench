import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFile(path.join(root, 'design/source', name), 'utf8');
const [markup, base, extra, app, screensRaw, stylesRaw, pluginScript, pluginCss, customScript, customCss] = await Promise.all([
  read('atlas.html'), read('base.css'), read('atlas.css'), read('app.js'),
  read('screens.json'), read('styles.json'),
  read('plugin-center.js'), read('plugin-center.css'), read('customization.js'), read('customization.css'),
]);
const cssVars = block => Object.fromEntries([...block.matchAll(/(--h-[\w-]+):([^;}{]+)/g)].filter(([,key])=>!['--h-tree','--h-font','--h-row'].includes(key)).map(([,key,value])=>[key,value]));
const basePalette = {...cssVars(base.match(/#horizon-atlas \.hz\{([^}]+)/)[1]), ...cssVars(extra.match(/#horizon-atlas \.hz\{([^}]+)/)[1])};
const palettes = {mist:basePalette};
for (const [,id,block] of extra.matchAll(/#horizon-atlas \.hz\[data-style="([^"]+)"\]\{([^}]+)/g)) palettes[id]={...basePalette,...cssVars(block)};
const data = { screens: JSON.parse(screensRaw), styles: JSON.parse(stylesRaw), palettes };
const fragment = `${markup}\n<style>\n${base}\n${extra}\n${pluginCss}\n${customCss}\n</style>\n<script>\nwindow.HorizonDesignData=${JSON.stringify(data)};\n${pluginScript}\n${customScript}\n${app}\n</script>\n`;
await mkdir(path.join(root, 'design/assets'), { recursive: true });
await mkdir(path.join(root, 'design/exports'), { recursive: true });
await writeFile(path.join(root, 'design/horizon-atlas.fragment.html'), fragment);
await writeFile(path.join(root, 'design/horizon-plugins.fragment.html'), fragment.replace(`window.HorizonDesignData=${JSON.stringify(data)};`, `window.HorizonDesignData=${JSON.stringify({...data,startScreen:'plugins'})};`));
await copyFile(path.join(root, 'node_modules/lucide/dist/umd/lucide.min.js'), path.join(root, 'design/assets/lucide.min.js'));
await copyFile(path.join(root, 'node_modules/lucide/LICENSE'), path.join(root, 'design/assets/LUCIDE-LICENSE'));
const exportMarkup = fragment.replace('class="viz-carousel"', 'class="export-variants"');
const standalone = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Horizon · 八套界面设计图集</title>
<style>
:root{color-scheme:light dark;--background:light-dark(#fff,#15191f);--foreground:light-dark(#273142,#e3e8f1);--muted-foreground:light-dark(#677386,#abb7c9);--border:light-dark(#e1e6ed,#364253);--muted:light-dark(#f1f4f8,#222b39)}
*{box-sizing:border-box}body{margin:0;padding:24px;background:var(--background);color:var(--foreground);font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif}button,input,select,textarea{font:inherit}button{cursor:pointer}button:focus-visible,select:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #7699cc;outline-offset:2px}[hidden]{display:none!important}.cursor-interaction{cursor:pointer}
#horizon-atlas{max-width:1440px;margin:0 auto}.export-style-control{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:0 auto 18px;max-width:1440px}.export-style-control label{font-size:12px;color:var(--muted-foreground)}.export-style-control select{background:var(--background);color:var(--foreground);border:1px solid var(--border);padding:8px 10px;border-radius:9px;max-width:100%}.export-style-control small{margin-left:auto;color:var(--muted-foreground)}.export-style-control a{color:inherit;text-decoration:none;border-bottom:1px solid var(--border)}
@media(max-width:640px){body{padding:12px}.export-style-control small{width:100%;margin:0}.export-style-control{margin-bottom:15px}}
</style>
<script src="assets/lucide.min.js"></script></head>
<body><div class="export-style-control"><label for="export-style">界面风格</label><select id="export-style">${data.styles.map(s=>`<option value="${s.id}">${s.name} · ${s.subtitle}</option>`).join('')}</select><small>${data.styles.length} 套风格 · ${data.screens.length} 个场景 · <a href="exports/index.html">全部设计图</a></small></div>
${exportMarkup}
<script>
const stylePicker=document.getElementById('export-style');
function setStyle(id){document.querySelectorAll('#horizon-variants>section').forEach(s=>s.hidden=s.querySelector('.hz').id!=='horizon-'+id);}
stylePicker.addEventListener('change',()=>setStyle(stylePicker.value));
const requested=new URLSearchParams(location.search);if(requested.get('style')&&window.HorizonDesign.styles.some(s=>s.id===requested.get('style'))){stylePicker.value=requested.get('style');setStyle(stylePicker.value);}if(requested.get('screen'))window.HorizonDesign.show(requested.get('screen'),stylePicker.value);
</script></body></html>`;
await writeFile(path.join(root, 'design/index.html'), standalone);
console.log(`Built ${data.styles.length} styles × ${data.screens.length} scenes. Fragment ${(Buffer.byteLength(fragment)/1024).toFixed(0)} KiB.`);
