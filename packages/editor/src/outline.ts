export type MarkdownHeading = { title: string; level: number; line: number };

/** Basic Markdown headings; fenced code is never treated as document structure. */
export function markdownHeadings(text: string, limit = 500): MarkdownHeading[] {
  const lines = text.split(/\r\n?|\n/), headings: MarkdownHeading[] = [];
  let fence: { character: string; length: number } | undefined;
  for (let line = 0; line < lines.length && headings.length < limit; line++) {
    const value = lines[line], marker = /^ {0,3}(`{3,}|~{3,})/.exec(value);
    if (fence) { if (marker && marker[1][0] === fence.character && marker[1].length >= fence.length && value.slice(marker[0].length).trim() === '') fence = undefined; continue; }
    if (marker) { fence = { character: marker[1][0], length: marker[1].length }; continue; }
    const atx = /^ {0,3}(#{1,6})(?:\s+(.+?)\s*|\s*)$/.exec(value);
    if (atx) { headings.push({ title: (atx[2] ?? '').replace(/\s+#+\s*$/, '') || '无标题', level: atx[1].length, line }); continue; }
    if (/\S/.test(value) && !/^ {4}/.test(value) && /^ {0,3}(?:=+|-+)\s*$/.test(lines[line + 1] ?? '')) {
      headings.push({ title: value.trim(), level: lines[line + 1].trim().startsWith('=') ? 1 : 2, line }); line++;
    }
  }
  return headings;
}
