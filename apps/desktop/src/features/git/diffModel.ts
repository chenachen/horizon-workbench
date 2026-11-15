export type DiffLine = {
  kind: 'context' | 'added' | 'removed';
  text: string;
  oldLine?: number;
  newLine?: number;
  changeIndex?: number;
};

export type DiffRow = {
  kind: 'context' | 'added' | 'removed' | 'modified';
  sourceIndex: number;
  oldLine?: number;
  newLine?: number;
  oldText?: string;
  newText?: string;
  changeIndex?: number;
};

export type FoldRow = {
  kind: 'fold';
  sourceIndex: number;
  start: number;
  end: number;
  hiddenLines: number;
};

export function parseDiff(patch: string): {
  lines: DiffLine[];
  changes: number;
  added: number;
  removed: number;
  oldLines: number;
  newLines: number;
} {
  const lines: DiffLine[] = [];
  let oldLine = 0, newLine = 0, oldRemaining = 0, newRemaining = 0;
  let changes = 0, added = 0, removed = 0, oldLines = 0, newLines = 0;
  let changeIndex: number | undefined;

  for (const raw of patch.split('\n')) {
    const text = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(text);
    if (header) {
      oldLine = Number(header[1]);
      oldRemaining = header[2] === undefined ? 1 : Number(header[2]);
      newLine = Number(header[3]);
      newRemaining = header[4] === undefined ? 1 : Number(header[4]);
      changeIndex = undefined;
      continue;
    }
    if ((!oldRemaining && !newRemaining) || !text || text.startsWith('\\')) continue;

    if (text[0] === ' ') {
      lines.push({ kind: 'context', text: text.slice(1), oldLine, newLine });
      oldLines = Math.max(oldLines, oldLine++);
      newLines = Math.max(newLines, newLine++);
      oldRemaining--;
      newRemaining--;
      changeIndex = undefined;
    } else if (text[0] === '-' || text[0] === '+') {
      if (changeIndex === undefined) changeIndex = changes++;
      if (text[0] === '-') {
        lines.push({ kind: 'removed', text: text.slice(1), oldLine, changeIndex });
        oldLines = Math.max(oldLines, oldLine++);
        oldRemaining--;
        removed++;
      } else {
        lines.push({ kind: 'added', text: text.slice(1), newLine, changeIndex });
        newLines = Math.max(newLines, newLine++);
        newRemaining--;
        added++;
      }
    }
  }
  return { lines, changes, added, removed, oldLines, newLines };
}

export function buildDiffRows(lines: DiffLine[], split: boolean): DiffRow[] {
  const rows: DiffRow[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!split || line.kind === 'context') {
      rows.push({
        kind: line.kind,
        sourceIndex: index,
        oldLine: line.oldLine,
        newLine: line.newLine,
        oldText: line.kind === 'added' ? undefined : line.text,
        newText: line.kind === 'removed' ? undefined : line.text,
        changeIndex: line.changeIndex,
      });
      index++;
      continue;
    }

    const removed: { line: DiffLine; index: number }[] = [];
    const added: { line: DiffLine; index: number }[] = [];
    while (index < lines.length && lines[index].kind !== 'context' && lines[index].changeIndex === line.changeIndex) {
      const item = { line: lines[index], index };
      if (item.line.kind === 'removed') removed.push(item);
      else added.push(item);
      index++;
    }
    for (let row = 0; row < Math.max(removed.length, added.length); row++) {
      const old = removed[row], next = added[row];
      rows.push({
        kind: old && next ? 'modified' : old ? 'removed' : 'added',
        sourceIndex: Math.min(old?.index ?? Infinity, next?.index ?? Infinity),
        oldLine: old?.line.oldLine,
        newLine: next?.line.newLine,
        oldText: old?.line.text,
        newText: next?.line.text,
        changeIndex: line.changeIndex,
      });
    }
  }
  return rows;
}

export function collapseDiffRows(rows: DiffRow[], expanded: Set<number>, context = 3): (DiffRow | FoldRow)[] {
  if (!rows.some(row => row.kind !== 'context')) return rows;
  const result: (DiffRow | FoldRow)[] = [];
  const append = (start: number, end: number) => {
    for (let index = start; index < end; index++) result.push(rows[index]);
  };
  const keep = Math.max(0, Math.floor(context));
  for (let index = 0; index < rows.length;) {
    if (rows[index].kind !== 'context') {
      result.push(rows[index++]);
      continue;
    }
    const start = index;
    while (index < rows.length && rows[index].kind === 'context') index++;
    const end = index;
    const foldStart = start + (start > 0 ? keep : 0);
    const foldEnd = end - (end < rows.length ? keep : 0);
    if (foldEnd <= foldStart || expanded.has(foldStart)) {
      append(start, end);
      continue;
    }
    append(start, foldStart);
    result.push({ kind: 'fold', sourceIndex: rows[foldStart].sourceIndex, start: foldStart, end: foldEnd, hiddenLines: foldEnd - foldStart });
    append(foldEnd, end);
  }
  return result;
}
