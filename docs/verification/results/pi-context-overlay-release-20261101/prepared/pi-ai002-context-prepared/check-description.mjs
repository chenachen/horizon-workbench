import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { contextDescription } from './context-description.mjs';
const buffer = (text, fromUtf16, toUtf16, bufferDirty = true) => ({ source: 'buffer', bufferDirty, text, range: { fromUtf16, toUtf16 } });
const dirty = '编辑快照 · 附加时未保存', saved = '编辑快照 · 附加时已保存';
const cases = [
  ['dirty snapshot', { source: 'buffer', bufferDirty: true }, dirty],
  ['saved snapshot', { source: 'buffer', bufferDirty: false }, saved],
  ['legacy unknown status stays neutral', { source: 'buffer' }, '编辑内容快照'],
  ['disk source unchanged', { source: 'disk' }, '磁盘内容'],
  ['git source unchanged', { source: 'gitDiff', label: 'example.txt · index → worktree' }, '冻结 Git 差异'],
  ['LF Chinese single line', buffer('甲\n乙\n丙', 2, 3), `${dirty} · 选区 第 2 行`],
  ['LF exclusive end after newline', buffer('甲\n乙\n丙', 2, 4), `${dirty} · 选区 第 2 行`],
  ['LF two lines', buffer('甲\n乙\n丙', 0, 4), `${dirty} · 选区 第 1–2 行`],
  ['CRLF exclusive end after newline', buffer('甲\r\n乙\r\n丙', 3, 6), `${dirty} · 选区 第 2 行`],
  ['CRLF Chinese multiple lines', buffer('甲\r\n乙\r\n丙', 0, 4), `${dirty} · 选区 第 1–2 行`],
  ['CRLF end between CR and LF', buffer('甲\r\n乙\r\n丙', 3, 5), `${dirty} · 选区 第 2 行`],
  ['UTF16 emoji offsets', buffer('甲🙂\r\n乙🙂\r\n丙', 5, 10), `${dirty} · 选区 第 2 行`],
  ['newline-only selection belongs to preceding line', buffer('甲\n乙', 1, 2), `${dirty} · 选区 第 1 行`],
  ['EOF without newline', buffer('甲\n乙', 2, 3, false), `${saved} · 选区 第 2 行`]
];
for (const [name, value, expected] of cases) assert.equal(contextDescription(value), expected, name);
const path = new URL('./context-description.mjs', import.meta.url);
const body = await readFile(path);
const report = { checkedAt: new Date().toISOString(), method: 'Exact proposed private helper body; only TypeScript parameter annotation removed and export added for standalone Node execution', helperSha256: createHash('sha256').update(body).digest('hex'), passed: cases.length, cases: cases.map(([name]) => name), productSourceApplied: false, reactRendered: false, nativeOrProviderStarted: false };
await writeFile(new URL('./calculation-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, output: new URL('./calculation-check.json', import.meta.url).pathname }));
