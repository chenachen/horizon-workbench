import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1328,height:1120},colorScheme:'light'});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(`file://${root}/design/index.html?style=mist&screen=settings-appearance`);
  const app=page.locator('#horizon-mist');
  await app.getByRole('heading',{name:'让工作台像你喜欢的样子'}).waitFor();
  await page.evaluate(()=>HorizonDesign.reset());
  const show=key=>page.evaluate(key=>HorizonDesign.show(key,'mist'),key);
  await show('settings-appearance');
  await app.getByLabel('主题包',{exact:true}).selectOption('paper');
  await show('settings-layout');
  await app.locator('[data-custom-act="layout"][data-layout="orbit"]').click();
  assert.equal(await app.getAttribute('data-style'),'orbit');
  assert.equal(await app.getAttribute('data-theme-package'),'paper');
  assert.equal(await app.locator('.project-tabs').isVisible(),true);
  await show('settings-sizes');
  await app.getByLabel('文件侧栏数值',{exact:true}).fill('310');
  await app.getByLabel('文件侧栏数值',{exact:true}).dispatchEvent('change');
  assert.equal(await app.evaluate(el=>el.style.getPropertyValue('--h-tree')),'310px');
  await show('settings-layout');
  await app.locator('[data-custom-act="layout"][data-layout="graphite"]').click();
  await show('settings-sizes');
  await app.getByLabel('顶部区域数值',{exact:true}).fill('72');
  await app.getByLabel('顶部区域数值',{exact:true}).dispatchEvent('change');
  assert.equal(await app.locator('.appbar').evaluate(el=>el.getBoundingClientRect().height),72);
  await show('settings-layout');
  await app.locator('[data-custom-act="layout"][data-layout="orbit"]').click();
  assert.equal(await app.evaluate(el=>el.style.getPropertyValue('--h-tree')),'310px');
  await show('settings-sizes');
  await app.getByLabel('外观设置范围').selectOption('global');
  await app.getByLabel('文件侧栏数值',{exact:true}).fill('270');
  await app.getByLabel('文件侧栏数值',{exact:true}).dispatchEvent('change');
  assert.equal(await app.evaluate(el=>el.style.getPropertyValue('--h-tree')),'310px','project override wins');
  await app.getByLabel('外观设置范围').selectOption('project');
  await app.locator('[data-key="geometry:orbit:sidebarWidth"][data-custom-act="unset"]').click();
  assert.equal(await app.evaluate(el=>el.style.getPropertyValue('--h-tree')),'270px','unset resumes current global value');
  await show('settings-colors');
  await app.getByLabel('强调色',{exact:true}).fill('#aa4477');
  await app.getByLabel('强调色',{exact:true}).dispatchEvent('change');
  assert.match(await app.evaluate(el=>el.style.getPropertyValue('--h-accent')),/#aa4477/);
  await app.getByLabel('配色模式').selectOption('dark');
  assert.notEqual(await app.getByLabel('强调色',{exact:true}).inputValue(),'#aa4477','separate dark palette');
  await show('settings-background');
  await app.getByLabel('选择背景图片').setInputFiles({name:'test-background.png',mimeType:'image/png',buffer:Buffer.from(await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d');ctx.fillStyle='#88aabb';ctx.fillRect(0,0,32,32);return canvas.toDataURL('image/png').split(',')[1];}),'base64')});
  await app.locator('.background-upload.has-image').waitFor();
  await app.getByLabel('背景显示区域').selectOption('editor');
  assert.equal(await app.getAttribute('data-background'),'editor');
  await show('settings-presets');
  await app.getByLabel('外观组合名称').fill('晚间阅读');
  await app.locator('[data-custom-act="save-preset"]').click();
  assert.equal(await app.locator('.custom-preset').count(),1);
  const downloadPromise=page.waitForEvent('download');
  await app.locator('[data-custom-act="export-preset"]').click();
  const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'horizon-appearance.json');
  await page.reload();
  await show('settings-presets');
  assert.equal(await app.locator('.custom-preset').count(),1,'persist saved preset');
  assert.equal(await app.getAttribute('data-style'),'orbit');
  assert.equal(await app.getAttribute('data-theme-package'),'paper');
  assert.equal(await app.getAttribute('data-background'),'editor');
  await show('settings-layout-recovery');
  await app.getByRole('button',{name:'选择可用布局'}).click();
  assert.equal(await page.evaluate(()=>HorizonDesign.state.screen),'settings-layout');
  const responsive=[];
  for(const width of [1024,736,360,320]) {
    await page.setViewportSize({width,height:1120});
    for(const key of ['settings-appearance','settings-layout','settings-sizes','settings-background','settings-colors','settings-presets','settings-layout-recovery']) {
      await show(key);
      const overflow=await app.evaluate(el=>[el,...el.querySelectorAll('.dialog,.settings-pane,.custom-range,.custom-color')].some(n=>n.scrollWidth>n.clientWidth+2));
      if(overflow)responsive.push({width,key});
    }
  }
  assert.deepEqual(responsive,[]);
  assert.deepEqual(errors,[]);
  await page.setViewportSize({width:1328,height:1120});
  await page.evaluate(()=>HorizonDesign.reset());
  await mkdir(path.join(root,'.work'),{recursive:true});
  for(const key of ['settings-layout','settings-sizes','settings-background','settings-colors','settings-presets']) {
    await show(key);await app.screenshot({path:path.join(root,'.work',`${key}.png`)});
  }
  const report={status:'passed',checks:['layout_theme_independence','per_layout_geometry','global_project_inheritance','topbar_size_preview','light_dark_token_independence','local_image_import','preset_export_persistence','layout_recovery','28_responsive_cases'],errors,responsive};
  await writeFile(path.join(root,'.work','customization-check-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
