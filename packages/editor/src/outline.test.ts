import { describe, expect, it } from 'vitest';
import { markdownHeadings } from './outline';

describe('basic Markdown outline', () => {
  it('returns zero-based source lines for ATX and setext headings with CRLF', () => {
    expect(markdownHeadings('# 文档\r\n正文\r\n标题\r\n---\r\n  ### 内节 ###\r\n')).toEqual([
      { title: '文档', level: 1, line: 0 },
      { title: '标题', level: 2, line: 2 },
      { title: '内节', level: 3, line: 4 },
    ]);
  });

  it('ignores headings inside fences, including shorter or mismatched closing fences', () => {
    const source = ['# Before', '````md', '# Hidden', '```', '## Still hidden', '~~~~', '### Also hidden', '````', '## After', '~~~ts', '# Hidden again', '~~~', '### End'].join('\n');
    expect(markdownHeadings(source)).toEqual([
      { title: 'Before', level: 1, line: 0 },
      { title: 'After', level: 2, line: 8 },
      { title: 'End', level: 3, line: 12 },
    ]);
  });

  it('ignores indented code and malformed ATX markers and includes empty headings', () => {
    expect(markdownHeadings('    # code\n#nospace\n####### too many\n##\n')).toEqual([{ title: '无标题', level: 2, line: 3 }]);
  });

  it('bounds large outlines while retaining source positions', () => {
    const source = Array.from({ length: 700 }, (_, index) => '# Heading ' + index).join('\n');
    const headings = markdownHeadings(source);
    expect(headings).toHaveLength(500);
    expect(headings.at(-1)).toEqual({ title: 'Heading 499', level: 1, line: 499 });
    expect(markdownHeadings(source, 2)).toHaveLength(2);
  });
});
