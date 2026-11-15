import { describe, expect, it } from 'vitest';
import { buildDiffRows, collapseDiffRows, parseDiff, type DiffRow, type FoldRow } from './diffModel';

const fullFilePatch = (count: number, changed: number[]) => {
  const changedLines = new Set(changed);
  const body: string[] = [];
  for (let line = 1; line <= count; line++) {
    if (changedLines.has(line)) body.push(`-old-${line}`, `+new-${line}`);
    else body.push(` line-${line}`);
  }
  return `diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1,${count} +1,${count} @@\n${body.join('\n')}\n`;
};
const folds = (rows: (DiffRow | FoldRow)[]) => rows.filter((row): row is FoldRow => row.kind === 'fold');

describe('parseDiff', () => {
  it('retains all unchanged lines beyond the former 600-line page', () => {
    const parsed = parseDiff(fullFilePatch(750, [375]));
    expect(parsed.lines).toHaveLength(751);
    expect(parsed.lines[0]).toEqual({ kind: 'context', text: 'line-1', oldLine: 1, newLine: 1 });
    expect(parsed.lines.at(-1)).toEqual({ kind: 'context', text: 'line-750', oldLine: 750, newLine: 750 });
    expect(parsed).toMatchObject({ changes: 1, added: 1, removed: 1, oldLines: 750, newLines: 750 });
  });

  it('keeps real text beginning with header-like prefixes', () => {
    const parsed = parseDiff('--- a/file\n+++ b/file\n@@ -1,2 +1,2 @@\n----old heading\n---old divider\n++++new heading\n+++new divider\n');
    expect(parsed.lines.map(line => line.text)).toEqual(['---old heading', '--old divider', '+++new heading', '++new divider']);
    expect(parsed).toMatchObject({ changes: 1, added: 2, removed: 2 });
  });

  it('accepts CRLF and blank content lines without creating a trailing row', () => {
    const parsed = parseDiff('@@ -1,2 +1,3 @@\r\n first\r\n \r\n+\r\n');
    expect(parsed.lines).toEqual([
      { kind: 'context', text: 'first', oldLine: 1, newLine: 1 },
      { kind: 'context', text: '', oldLine: 2, newLine: 2 },
      { kind: 'added', text: '', newLine: 3, changeIndex: 0 },
    ]);
  });

  it('ignores no-newline markers while keeping a replacement in one change group', () => {
    const parsed = parseDiff('@@ -1 +1 @@\n-old\n\\ No newline at end of file\n+new\n\\ No newline at end of file\n');
    expect(parsed.lines.map(line => line.text)).toEqual(['old', 'new']);
    expect(parsed).toMatchObject({ changes: 1, added: 1, removed: 1, oldLines: 1, newLines: 1 });
    expect(parsed.lines.every(line => line.changeIndex === 0)).toBe(true);
  });

  it('uses hunk coordinates and separates change groups across context and hunks', () => {
    const parsed = parseDiff('@@ -10,3 +10,3 @@\n-old-10\n+new-10\n unchanged\n-old-12\n+new-12\n@@ -90 +90 @@\n-old-90\n+new-90\n');
    expect(parsed.lines.map(line => line.changeIndex)).toEqual([0, 0, undefined, 1, 1, 2, 2]);
    expect(parsed).toMatchObject({ changes: 3, added: 3, removed: 3, oldLines: 90, newLines: 90 });
  });

  it('handles added, deleted, empty, binary and header-only patches', () => {
    expect(parseDiff('@@ -0,0 +1,2 @@\n+first\n+second\n')).toMatchObject({ changes: 1, added: 2, removed: 0, oldLines: 0, newLines: 2 });
    expect(parseDiff('@@ -1,2 +0,0 @@\n-first\n-second\n')).toMatchObject({ changes: 1, added: 0, removed: 2, oldLines: 2, newLines: 0 });
    for (const patch of ['', 'Binary files a/image and b/image differ\n', 'diff --git a/old b/new\nsimilarity index 100%\nrename from old\nrename to new\n']) {
      expect(parseDiff(patch)).toEqual({ lines: [], changes: 0, added: 0, removed: 0, oldLines: 0, newLines: 0 });
    }
  });
});

describe('buildDiffRows', () => {
  it('keeps every inline line and source index', () => {
    const parsed = parseDiff('@@ -1,2 +1,2 @@\n same\n-old\n+new\n');
    const rows = buildDiffRows(parsed.lines, false);
    expect(rows.map(row => row.kind)).toEqual(['context', 'removed', 'added']);
    expect(rows.map(row => row.sourceIndex)).toEqual([0, 1, 2]);
    expect(rows[0]).toMatchObject({ oldLine: 1, newLine: 1, oldText: 'same', newText: 'same' });
    expect(rows[1]).toMatchObject({ oldLine: 2, oldText: 'old', newText: undefined, changeIndex: 0 });
    expect(rows[2]).toMatchObject({ newLine: 2, oldText: undefined, newText: 'new', changeIndex: 0 });
  });

  it('pairs replacement lines and leaves the shorter side blank', () => {
    const parsed = parseDiff('@@ -1,3 +1,4 @@\n before\n-old-a\n-old-b\n+new-a\n+new-b\n+new-c\n');
    const rows = buildDiffRows(parsed.lines, true);
    expect(rows).toHaveLength(4);
    expect(rows[1]).toMatchObject({ kind: 'modified', sourceIndex: 1, oldText: 'old-a', newText: 'new-a', oldLine: 2, newLine: 2, changeIndex: 0 });
    expect(rows[2]).toMatchObject({ kind: 'modified', sourceIndex: 2, oldText: 'old-b', newText: 'new-b' });
    expect(rows[3]).toMatchObject({ kind: 'added', sourceIndex: 5, oldText: undefined, newText: 'new-c', newLine: 4 });
  });

  it('preserves pure additions and deletions', () => {
    const added = buildDiffRows(parseDiff('@@ -0,0 +1,2 @@\n+a\n+b\n').lines, true);
    expect(added.map(row => [row.kind, row.oldLine, row.newLine])).toEqual([['added', undefined, 1], ['added', undefined, 2]]);
    const removed = buildDiffRows(parseDiff('@@ -1,2 +0,0 @@\n-a\n-b\n').lines, true);
    expect(removed.map(row => [row.kind, row.oldLine, row.newLine])).toEqual([['removed', 1, undefined], ['removed', 2, undefined]]);
  });

  it('keeps adjacent hunks as separate change groups', () => {
    const rows = buildDiffRows(parseDiff('@@ -1 +1 @@\n-a\n+b\n@@ -5 +5 @@\n-c\n+d\n').lines, true);
    expect(rows.map(row => [row.changeIndex, row.oldText, row.newText])).toEqual([[0, 'a', 'b'], [1, 'c', 'd']]);
  });
});

describe('collapseDiffRows', () => {
  it('keeps three neighboring context lines on both sides of a middle change', () => {
    const rows = buildDiffRows(parseDiff(fullFilePatch(750, [375])).lines, true);
    const collapsed = collapseDiffRows(rows, new Set());
    expect(folds(collapsed)).toEqual([
      { kind: 'fold', sourceIndex: 0, start: 0, end: 371, hiddenLines: 371 },
      { kind: 'fold', sourceIndex: 379, start: 378, end: 750, hiddenLines: 372 },
    ]);
    expect(collapsed.filter(row => row.kind !== 'fold').map(row => row.oldLine)).toEqual([372, 373, 374, 375, 376, 377, 378]);
  });

  it('retains context beside first and last line changes', () => {
    const rows = buildDiffRows(parseDiff(fullFilePatch(20, [1, 20])).lines, true);
    const collapsed = collapseDiffRows(rows, new Set());
    expect(folds(collapsed)).toEqual([{ kind: 'fold', sourceIndex: 5, start: 4, end: 16, hiddenLines: 12 }]);
    expect(collapsed.filter(row => row.kind !== 'fold').map(row => row.oldLine)).toEqual([1, 2, 3, 4, 17, 18, 19, 20]);
  });

  it('expands exactly the range identified by its original row start', () => {
    const rows = buildDiffRows(parseDiff(fullFilePatch(30, [15])).lines, true);
    const original = collapseDiffRows(rows, new Set());
    const first = folds(original)[0];
    const expanded = new Set([first.start]);
    const result = collapseDiffRows(rows, expanded);
    expect(result.slice(0, first.end)).toEqual(rows.slice(0, first.end));
    expect(folds(result)).toHaveLength(1);
    expect(expanded).toEqual(new Set([first.start]));
  });

  it('keeps unchanged files and short context ranges intact', () => {
    const unchanged = buildDiffRows(parseDiff(fullFilePatch(750, [])).lines, true);
    expect(collapseDiffRows(unchanged, new Set())).toBe(unchanged);
    const near = buildDiffRows(parseDiff(fullFilePatch(7, [4])).lines, true);
    expect(collapseDiffRows(near, new Set())).toEqual(near);
  });

  it('expands a long unchanged region without spreading rows onto the call stack', () => {
    const rows: DiffRow[] = Array.from({ length: 150_002 }, (_, sourceIndex) => ({
      kind: sourceIndex === 0 || sourceIndex === 150_001 ? 'added' : 'context',
      sourceIndex,
      newLine: sourceIndex + 1,
      newText: `line-${sourceIndex + 1}`,
    }));
    const result = collapseDiffRows(rows, new Set([4]));
    expect(result).toHaveLength(rows.length);
    expect(result[75_000]).toBe(rows[75_000]);
    expect(result.at(-1)).toBe(rows.at(-1));
  });
});
