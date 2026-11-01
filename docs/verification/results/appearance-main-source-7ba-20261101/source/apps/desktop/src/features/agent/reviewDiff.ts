export type ReviewDiffRow = { kind: 'context' | 'added' | 'removed'; text: string; oldLine?: number; newLine?: number };
export type ReviewDiff = { rows: ReviewDiffRow[]; added: number; removed: number; truncated: boolean };
const MAX_LINES = 5000;

function previewLines(text: string) {
  const lines: string[] = [];
  if (!text) return { lines, truncated: false };
  let from = 0;
  while (lines.length < MAX_LINES) {
    const end = text.indexOf('\n', from);
    if (end < 0) { lines.push(text.slice(from)); return { lines, truncated: false }; }
    lines.push(text.slice(from, end)); from = end + 1;
  }
  return { lines, truncated: from <= text.length };
}

/** Patience anchors keep unchanged lines aligned without a quadratic line matrix. */
export function reviewDiff(baseline: string, after: string): ReviewDiff {
  const a = previewLines(baseline), b = previewLines(after), rows: ReviewDiffRow[] = [];
  const context = (i: number, j: number) => rows.push({ kind: 'context', text: a.lines[i], oldLine: i + 1, newLine: j + 1 });
  const walk = (startA: number, endA: number, startB: number, endB: number, depth: number) => {
    while (startA < endA && startB < endB && a.lines[startA] === b.lines[startB]) context(startA++, startB++);
    let tail = 0;
    while (startA < endA - tail && startB < endB - tail && a.lines[endA - tail - 1] === b.lines[endB - tail - 1]) tail++;
    const stopA = endA - tail, stopB = endB - tail;
    const anchors: { a: number; b: number }[] = [];
    if (depth < 32 && startA < stopA && startB < stopB) {
      const positionsA = new Map<string, number>(), positionsB = new Map<string, number>();
      for (let i = startA; i < stopA; i++) positionsA.set(a.lines[i], positionsA.has(a.lines[i]) ? -1 : i);
      for (let j = startB; j < stopB; j++) positionsB.set(b.lines[j], positionsB.has(b.lines[j]) ? -1 : j);
      const candidates: { a: number; b: number }[] = [];
      for (let i = startA; i < stopA; i++) {
        const j = positionsB.get(a.lines[i]);
        if (positionsA.get(a.lines[i]) === i && j !== undefined && j >= 0) candidates.push({ a: i, b: j });
      }
      const tails: number[] = [], previous = new Array<number>(candidates.length).fill(-1);
      for (let i = 0; i < candidates.length; i++) {
        let lo = 0, hi = tails.length;
        while (lo < hi) { const mid = (lo + hi) >>> 1; if (candidates[tails[mid]].b < candidates[i].b) lo = mid + 1; else hi = mid; }
        if (lo) previous[i] = tails[lo - 1]; tails[lo] = i;
      }
      for (let i = tails.at(-1) ?? -1; i >= 0; i = previous[i]) anchors.push(candidates[i]);
      anchors.reverse();
    }
    if (anchors.length) {
      for (const anchor of anchors) { walk(startA, anchor.a, startB, anchor.b, depth + 1); context(anchor.a, anchor.b); startA = anchor.a + 1; startB = anchor.b + 1; }
      walk(startA, stopA, startB, stopB, depth + 1);
    } else {
      for (let i = startA; i < stopA; i++) rows.push({ kind: 'removed', text: a.lines[i], oldLine: i + 1 });
      for (let j = startB; j < stopB; j++) rows.push({ kind: 'added', text: b.lines[j], newLine: j + 1 });
    }
    for (let i = 0; i < tail; i++) context(stopA + i, stopB + i);
  };
  walk(0, a.lines.length, 0, b.lines.length, 0);
  return { rows, added: rows.filter(row => row.kind === 'added').length, removed: rows.filter(row => row.kind === 'removed').length, truncated: a.truncated || b.truncated };
}
