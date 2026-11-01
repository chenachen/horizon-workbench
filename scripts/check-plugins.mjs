import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1328,height:1150},colorScheme:'light'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(`file://${root}/design/index.html`);
const styles=await page.evaluate(()=>HorizonDesign.styles);
const scenes=await page.evaluate(()=>HorizonDesign.screens.filter(s=>s.group==='插件中心'));
for(const style of styles){
  await page.evaluate(id=>{HorizonDesign.reset();HorizonDesign.show('plugins',id)},style.id);
  const app=page.locator('#horizon-'+style.id);
  const card=name=>app.locator('.px-card').filter({hasText:name});
  await card('Markdown 工具包').locator('[data-act="px-install"]').click();
  await app.locator('[data-act="px-review-install"]').click();
  assert.equal(await app.locator('[data-act="px-approve-install"]').isDisabled(),true);
  await app.locator('[data-px-consent]').check();
  await app.locator('[data-act="px-approve-install"]').click();
  await app.locator('[data-act="px-finish-install"]').click();
  assert.equal(await app.locator('.px-card').count(),5);
  assert.match(await card('Markdown 工具包').innerText(),/待激活/);
  await card('Markdown 工具包').locator('[data-act="px-disable"]').click();
  await app.locator('[data-act="px-confirm-disable"]').click();
  assert.match(await card('Markdown 工具包').innerText(),/已停用/);
  await card('Markdown 工具包').locator('[data-act="px-enable"]').click();
  assert.match(await card('Markdown 工具包').innerText(),/待激活/);
  await card('Markdown 工具包').locator('[data-act="px-detail"]').click();
  await app.locator('.px-detail-tabs [data-act="px-tab:permissions"]').click();
  assert.match(await app.locator('.px-permissions').innerText(),/读取当前文档/);
  await app.locator('[data-act="px-uninstall"]').click();
  await app.locator('[data-act="px-confirm-uninstall"]').click();
  assert.equal(await card('Markdown 工具包').count(),0);
  assert.equal(await app.locator('.px-card').count(),4);
  await app.locator('.px-nav [data-go="plugin-updates"]').click();
  await app.locator('[data-plugin="language"][data-act="px-update"]').click();
  assert.equal(await app.locator('[data-act="px-approve-update"]').isDisabled(),true);
  assert.match(await app.locator('.px-new-permission').innerText(),/新增/);
  await app.locator('[data-px-consent]').check();
  await app.locator('[data-act="px-approve-update"]').click();
  assert.equal(await app.locator('.px-updates article').count(),1);
  await app.locator('.px-nav [data-go="plugin-runtime"]').click();
  await app.locator('[data-plugin="terminal"][data-act="px-stop"]').click();
  await app.locator('[data-plugin="terminal"][data-act="px-wake"]').click();
  assert.match(await app.locator('.px-runtime-list article').filter({hasText:'集成终端'}).innerText(),/运行中/);
  await app.locator('.px-nav [data-go="plugin-installed"]').click();
  await card('集成终端').locator('[data-act="px-disable"]').click();
  await app.locator('[aria-label="停用范围"]').selectOption('project');
  await app.locator('[data-act="px-confirm-disable"]').click();
  assert.match(await card('集成终端').innerText(),/已停用/);
  await app.locator('.workspace-btn').click();
  await app.locator('.project-card[data-project="1"]').click();
  await app.locator('.plugin-entry').click();
  await app.locator('.px-nav [data-go="plugin-installed"]').click();
  assert.equal(await card('集成终端').locator('[data-act="px-disable"]').count(),1,'Other project retains global enabled state');
  await app.locator('[data-input="plugin-search"]').fill('missing-plugin');
  assert.equal(await app.locator('.px-search-empty').isVisible(),true);
}
const overflow=[];
for(const width of [736,360,320]){
  await page.setViewportSize({width,height:1150});
  for(const style of styles)for(const scene of scenes){
    await page.evaluate(([id,key])=>{HorizonDesign.reset();HorizonDesign.show(key,id)},[style.id,scene.key]);
    const stats=await page.locator('#horizon-'+style.id).evaluate(el=>{
      const c=el.querySelector('.px-center'),d=el.querySelector('.dialog');
      return {body:document.documentElement.scrollWidth,app:el.scrollWidth,appWidth:el.clientWidth,center:c?.scrollWidth,centerWidth:c?.clientWidth,dialog:d?.scrollWidth,dialogWidth:d?.clientWidth};
    });
    if(stats.body>width+2||stats.app>stats.appWidth+2||stats.center>stats.centerWidth+2||stats.dialog>stats.dialogWidth+2)overflow.push({width,style:style.id,scene:scene.key,...stats});
  }
}
await browser.close();
console.log(JSON.stringify({lifecycleStyles:styles.length,pluginScenes:scenes.length,responsiveCases:styles.length*scenes.length*3,errors,overflow},null,2));
assert.deepEqual(errors,[]);assert.deepEqual(overflow,[]);
