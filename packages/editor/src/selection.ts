import type { Selection } from './types';

/** CodeMirror counts CRLF as one document position, like LF and standalone CR. */
export function editorTextLength(text: string): number {
  let length = text.length;
  for (let index = text.indexOf('\r\n'); index !== -1; index = text.indexOf('\r\n', index + 2)) length--;
  return length;
}

export function clampSelection(selection: Selection | undefined, length: number): Selection {
  const position = (value: number | undefined) => Number.isFinite(value) ? Math.max(0, Math.min(length, Math.trunc(value!))) : 0;
  return { anchor: position(selection?.anchor), head: position(selection?.head) };
}
