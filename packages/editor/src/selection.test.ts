import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { clampSelection, editorTextLength } from './selection';

describe('persisted editor selections', () => {
  it.each(['', '中文 🧭', '一\n二\n', '一\r\n二\r\n', '一\r二\r', '一\r\n二\n三\r四', '\ufeff中文\r\n🧭\r\n'])('uses CodeMirror document positions for %j', text => {
    const actual = EditorState.create({ doc: text });
    expect(editorTextLength(text)).toBe(actual.doc.length);
    const selection = clampSelection({ anchor: text.length + 100, head: -3 }, editorTextLength(text));
    const restored = EditorState.create({ doc: text, selection });
    expect(restored.selection.main.anchor).toBe(actual.doc.length);
    expect(restored.selection.main.head).toBe(0);
  });

  it('keeps a valid backwards selection and normalizes non-finite or fractional positions', () => {
    expect(clampSelection({ anchor: 7, head: 2 }, 10)).toEqual({ anchor: 7, head: 2 });
    expect(clampSelection({ anchor: Infinity, head: NaN }, 10)).toEqual({ anchor: 0, head: 0 });
    expect(clampSelection({ anchor: -0.5, head: 4.9 }, 10)).toEqual({ anchor: 0, head: 4 });
  });
});
