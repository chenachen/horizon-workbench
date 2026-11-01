import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1328, height: 1120 }, colorScheme: 'light' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto(`file://${root}/design/index.html`);
await page.locator('#horizon-mist .code-line').first().waitFor();
const { styles, screens } = await page.evaluate(() => window.HorizonDesign);
const issues = [];
let rendered = 0;
for (const style of styles) {
  for (const screen of screens) {
    await page.evaluate(({ key, id }) => { HorizonDesign.reset(); HorizonDesign.show(key, id); }, { key: screen.key, id: style.id });
    const stats = await page.locator(`#horizon-${style.id}`).evaluate(el => ({
      width: el.clientWidth, scrollWidth: el.scrollWidth,
      text: el.innerText.length,
      dialogOverflow: [...el.querySelectorAll('.dialog')].some(d => d.scrollWidth > d.clientWidth + 2),
      specOverflow: [...el.querySelectorAll('.spec-page')].some(d => d.scrollWidth > d.clientWidth + 2),
    }));
    if (stats.width < 300 || stats.text < 40 || stats.scrollWidth > stats.width + 2 || stats.dialogOverflow || stats.specOverflow) issues.push({ style: style.id, screen: screen.key, ...stats });
    rendered++;
  }
  const app = page.locator(`#horizon-${style.id}`);
  await page.evaluate(id => { HorizonDesign.reset(); HorizonDesign.show('home', id); }, style.id);
  assert.equal(await app.locator('.assistant').count(), 0, 'AI closed by default');
  assert.equal(await app.locator('.terminal').count(), 0, 'Terminal closed by default');
  await app.locator('.appbar [data-go="ai-chat"]').click();
  await app.locator('[data-input="ai"]').fill('解释当前文件');
  await app.locator('[data-act="send-ai"]').click();
  assert.match(await app.locator('.ai-messages').innerText(), /解释当前文件/);
  await app.locator('.appbar [data-go="settings-appearance"]').click();
  await app.locator('[data-setting="theme"]').selectOption('dark');
  assert.equal(await app.getAttribute('data-user-theme'), 'dark');
  await page.evaluate(id => { HorizonDesign.reset(); HorizonDesign.show('git-changes', id); }, style.id);
  const filenameWidth = await app.locator('.git-entry .file-name').first().evaluate(el => el.getBoundingClientRect().width);
  assert.ok(filenameWidth >= 60, `${style.id}: Git filenames retain readable width`);
  await app.locator('[data-act="stage"]').first().click();
  await app.locator('[data-input="commit"]').fill('fix: restore project session');
  await app.locator('[data-act="commit"]').click();
  assert.equal(await page.evaluate(() => HorizonDesign.state.screen), 'git-history');
}
const responsive = [];
for (const width of [1024, 736, 360, 320]) {
  await page.setViewportSize({ width, height: 1200 });
  for (const style of styles) {
    for (const screen of ['home', 'projects', 'ai-chat', 'settings-appearance', 'settings-ai-add', 'git-conflict', 'components']) {
      await page.evaluate(({ key, id }) => { HorizonDesign.reset(); HorizonDesign.show(key, id); }, { key: screen, id: style.id });
      const stats = await page.evaluate(id => {
        const el = document.getElementById('horizon-' + id);
        const dialog = el.querySelector('.dialog');
        return { bodyWidth: document.documentElement.clientWidth, bodyScroll: document.documentElement.scrollWidth,
          appWidth: el.clientWidth, appScroll: el.scrollWidth,
          dialogWidth: dialog?.clientWidth, dialogScroll: dialog?.scrollWidth };
      }, style.id);
      if (stats.bodyScroll > width + 2 || stats.appScroll > stats.appWidth + 2 || (stats.dialogScroll && stats.dialogScroll > stats.dialogWidth + 2)) issues.push({ width, style: style.id, screen, ...stats });
      responsive.push({ width, style: style.id, screen });
    }
    if (width === 360) {
      await page.evaluate(id => { HorizonDesign.reset(); HorizonDesign.show('home', id); }, style.id);
      const app = page.locator(`#horizon-${style.id}`);
      await app.locator('.editor-top [data-act="sidebar"]').click();
      assert.equal(await app.locator('.sidebar').isVisible(), true);
      await app.locator('.sidebar [data-act="sidebar"]').click();
      assert.equal(await app.locator('.sidebar').isVisible(), false);
    }
  }
}
const report = { desktopScenes: rendered, responsiveScenes: responsive.length, interactionStyles: styles.length, errors, issues };
await mkdir(path.join(root, '.work'), { recursive: true });
await writeFile(path.join(root, '.work/check-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
assert.deepEqual(errors, []);
assert.deepEqual(issues, []);
