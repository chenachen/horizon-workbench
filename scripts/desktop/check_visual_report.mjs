import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const report = path.join(root, 'docs/verification/visual-report.html');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(pathToFileURL(report).href);
  await page.waitForFunction(() => document.querySelector('#list')?.children.length === 584);
  const rows = JSON.parse(await fs.readFile(path.join(root, 'docs/verification/visual-matrix.json'), 'utf8'));
  const styles = [...new Set(rows.map(row => row.style))];
  for (const style of styles) {
    await page.selectOption('#style', style);
    if (await page.locator('#list button').count() !== 73) throw new Error(`${style}: expected 73 design entries`);
    await page.locator('#list button').first().click();
    await page.waitForFunction(() => {
      const image = document.querySelector('#images img');
      return image && image.complete && image.naturalWidth > 0;
    });
    await page.locator('#mode').click();
    await page.selectOption('#scale', '1280');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ scope: 'comparison report tooling only; not native application evidence', styles: styles.length, indexed: rows.length, errors }));
} finally {
  await browser.close();
}
