import { describe, expect, it } from 'vitest';
import { reviewDiff } from './reviewDiff';

describe('task review line differences', () => {
  it('keeps unchanged lines aligned around inserted and removed content', () => {
    const result = reviewDiff('one\ntwo\nthree', 'one\nnew\nthree');
    expect(result.rows).toEqual([
      { kind: 'context', text: 'one', oldLine: 1, newLine: 1 },
      { kind: 'removed', text: 'two', oldLine: 2 },
      { kind: 'added', text: 'new', newLine: 2 },
      { kind: 'context', text: 'three', oldLine: 3, newLine: 3 },
    ]);
    expect([result.added, result.removed]).toEqual([1, 1]);
  });
  it('preserves both versions and line numbers for repeated, moved, Unicode and newline-only changes', () => {
    const samples = ['', 'a', 'a\n', '重复🙂\n重复🙂', 'a\nb\nc\na', 'c\na\nb', '\n\n'];
    for (const before of samples) for (const after of samples) {
      const result = reviewDiff(before, after);
      const oldRows = result.rows.filter(row => row.kind !== 'added'), newRows = result.rows.filter(row => row.kind !== 'removed');
      expect(oldRows.map(row => row.text).join('\n')).toBe(before);
      expect(newRows.map(row => row.text).join('\n')).toBe(after);
      expect(oldRows.map(row => row.oldLine)).toEqual((before ? before.split('\n') : []).map((_, i) => i + 1));
      expect(newRows.map(row => row.newLine)).toEqual((after ? after.split('\n') : []).map((_, i) => i + 1));
    }
  });
  it('bounds newline-heavy previews and marks truncation', () => {
    const result = reviewDiff('old\n'.repeat(10000), 'new\n'.repeat(10000));
    expect(result.truncated).toBe(true); expect(result.rows.length).toBe(10000);
    expect(result.rows.at(-1)?.newLine).toBe(5000);
  });
});
