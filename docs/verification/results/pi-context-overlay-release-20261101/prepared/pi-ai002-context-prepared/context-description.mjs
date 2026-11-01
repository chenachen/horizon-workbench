export function contextDescription(a) {
  const source = a.source === 'buffer' ? a.bufferDirty === true ? '编辑快照 · 附加时未保存' : a.bufferDirty === false ? '编辑快照 · 附加时已保存' : '编辑内容快照' : a.source === 'gitDiff' ? '冻结 Git 差异' : '磁盘内容';
  if (!a.range || a.text === undefined) return source;
  let first = 1, last = 1;
  const end = Math.max(a.range.fromUtf16, a.range.toUtf16 - 1);
  for (let offset = 0; offset < end; offset++) {
    if (a.text.charCodeAt(offset) !== 10) continue;
    if (offset < a.range.fromUtf16) first++;
    last++;
  }
  return `${source} · 选区 第 ${first}${first === last ? '' : `–${last}`} 行`;
}
