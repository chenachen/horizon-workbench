import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Hash, ListTree } from 'lucide-react';
import { markdownHeadings } from '../../../../../packages/editor/src/outline';
import type { EditorBuffer } from '../../../../../packages/editor/src/types';
import { editorStore } from './store';

export function OutlinePanel({ buffer }: { buffer?: EditorBuffer }) {
  const [text, setText] = useState(''), [focused, setFocused] = useState(0);
  const tree = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setText(buffer?.getText() ?? ''); setFocused(0);
    if (!buffer) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = editorStore.subscribeEdits(key => { if (key !== buffer.key) return; if (timer) clearTimeout(timer); timer = setTimeout(() => setText(buffer.getText()), 150); });
    return () => { off(); if (timer) clearTimeout(timer); };
  }, [buffer?.key, buffer?.contentVersion]);
  const markdown = !!buffer && /\.(md|markdown|mdx)$/i.test(buffer.path), large = text.length > 1_048_576;
  const headings = useMemo(() => markdown && !large ? markdownHeadings(text) : [], [text, markdown, large]);
  useEffect(() => { setFocused(index => Math.max(0, Math.min(index, headings.length - 1))); }, [headings.length]);
  const move = (index: number) => { const next = Math.max(0, Math.min(headings.length - 1, index)); setFocused(next); tree.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus(); };
  const jump = (index: number) => {
    if (!buffer) return;
    // Re-read the current buffer so a heading inserted before this one cannot leave a stale jump.
    const latest = markdownHeadings(buffer.getText()), selected = headings[index];
    const heading = latest.find(item => item.line === selected.line && item.title === selected.title) ?? latest.find(item => item.title === selected.title && item.level === selected.level);
    if (heading) void editorStore.openFile(buffer.fileId, { projectId: buffer.projectId, line: heading.line });
  };
  return <section className="file-outline" aria-label="当前文件结构"><header><ListTree size={14} /><strong>文件结构</strong></header>
    {buffer ? <p className="outline-filename" title={buffer.path}><FileText size={13} />{buffer.path.split('/').pop()}</p> : null}
    {headings.length ? <div ref={tree} role="tree" aria-label="Markdown 标题">{headings.map((heading, index) => <button key={`${heading.line}-${heading.title}`} role="treeitem" aria-level={heading.level} aria-selected={focused === index} tabIndex={focused === index ? 0 : -1} style={{ paddingLeft: 10 + (heading.level - 1) * 12 }} onClick={() => { setFocused(index); jump(index); }} onKeyDown={event => { if (event.nativeEvent.isComposing) return; if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); move(index + (event.key === 'ArrowDown' ? 1 : -1)); } else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); move(event.key === 'Home' ? 0 : headings.length - 1); } }}><Hash size={13} /><span>{heading.title}</span><small>{heading.line + 1}</small></button>)}</div> : <div className="outline-empty"><ListTree size={25} /><p>{!buffer ? '打开文件后查看结构。' : large ? '此文件较大，结构导航已停用。' : markdown ? '还没有标题。在源码中添加 Markdown 标题即可导航。' : '此文件没有基础标题结构。语义符号由语言扩展提供。'}</p></div>}
    {headings.length >= 500 ? <p className="editor-empty">显示前 500 个标题。</p> : null}
  </section>;
}
