import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X } from 'lucide-react';
import { markdownHeadings } from '../../../../../packages/editor/src/outline';
import { call } from '../../bridge';
import type { EditorBuffer } from '../../../../../packages/editor/src/types';
import { errorMessage } from '../../../../../packages/editor/src/types';
import { editorStore } from './store';
function JsonNode({ name, value, depth = 0 }: { name: string; value: unknown; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2), [limit, setLimit] = useState(200);
  if (depth > 48) return <div className="json-value">{name}：嵌套过深，请在源码中查看。</div>;
  if (value && typeof value === 'object') { const entries = Object.entries(value); return <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)} className="json-node"><summary><b>{name}</b> {Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}</summary>{expanded && <>{entries.slice(0, limit).map(([key, child]) => <JsonNode key={key} name={key} value={child} depth={depth + 1} />)}{entries.length > limit && <button onClick={() => setLimit(count => count + 200)}>加载更多 · 余 {entries.length - limit} 项</button>}</>}</details>; }
  return <div className="json-value"><b>{name}</b>: <span>{JSON.stringify(value)}</span></div>;
}
export default function Preview({ buffer, onClose }: { buffer: EditorBuffer; onClose?: () => void }) {
  return <section className="editor-preview-pane" aria-label="文件预览"><header className="preview-pane-header"><span title={buffer.path}><strong>预览</strong><span>{buffer.path.split('/').pop()}</span></span><div>{buffer.dirty && <small>未保存内容</small>}{onClose && <button onClick={onClose} aria-label="关闭预览" title="关闭预览"><X size={15} /></button>}</div></header><PreviewContent buffer={buffer} /></section>;
}
function PreviewContent({ buffer }: { buffer: EditorBuffer }) {
  const [text, setText] = useState(buffer.getText()), [image, setImage] = useState(''), [error, setError] = useState('');
  const isImage = /\.(png|jpe?g|webp)$/i.test(buffer.path);
  useEffect(() => { setText(buffer.getText()); let timer: ReturnType<typeof setTimeout> | undefined; const off = editorStore.subscribeEdits(key => { if (key !== buffer.key) return; if (timer) clearTimeout(timer); timer = setTimeout(() => setText(buffer.getText()), 180); }); return () => { off(); if (timer) clearTimeout(timer); }; }, [buffer, buffer.contentVersion]);
  useEffect(() => { if (!isImage) return; let live = true; setImage(''); setError(''); void call<{ dataUrl: string }>('image_read', { fileId: buffer.fileId }, buffer.projectId).then(result => { if (live) setImage(result.dataUrl); }).catch(e => { if (live) setError(errorMessage(e)); }); return () => { live = false; }; }, [buffer.fileId, buffer.projectId, isImage]);
  if (isImage) return <section className="image-preview" aria-label="图片预览">{error ? <p className="editor-error">{error}</p> : image ? <img src={image} alt={buffer.path} /> : <p>正在读取图片…</p>}</section>;
  if (/\.json$/i.test(buffer.path)) {
    if (text.length > 1_048_576) return <p className="editor-empty">JSON 结构预览限 1 MiB，源码仍可阅读。</p>;
    try { const value: unknown = JSON.parse(text); return <section className="json-preview" aria-label="JSON 结构"><JsonNode name="root" value={value} /></section>; } catch (e) { return <p className="editor-error">JSON 语法错误：{errorMessage(e)}</p>; }
  }
  if (text.length > 1_048_576) return <p className="editor-empty">Markdown 预览限 1 MiB，源码仍可阅读。</p>;
  const headings = markdownHeadings(text).map(heading => ({ ...heading, id: `preview-line-${heading.line + 1}` }));
  const Heading = ({ children, level, line }: { children?: React.ReactNode; level: number; line?: number }) => { const Tag = `h${level}` as 'h1'; return <Tag id={`preview-line-${line}`}>{children}</Tag>; };
  return <section className="markdown-preview" aria-label="Markdown 预览"><details className="markdown-outline"><summary>标题导航 · {headings.length}</summary>{headings.map(h => <button key={h.id} style={{ paddingLeft: h.level * 10 }} onClick={() => document.getElementById(h.id)?.scrollIntoView({ block: 'start', behavior: 'auto' })}>{h.title}</button>)}</details>{!text.trim() && <p className="editor-empty">文档为空。在源码中输入 Markdown 即可预览。</p>}<article><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={url => url.startsWith('#') || /^(https?:|mailto:)/i.test(url) ? url : ''} components={{ img: ({ alt }) => <span className="preview-blocked-image">[图片：{alt || '资源默认禁用'}]</span>, a: ({ children, href }) => href?.startsWith('#') ? <a href={href}>{children}</a> : href ? <button className="preview-external-link" title={`用系统应用打开 ${href}`} onClick={() => void call('url_open_external', { url: href }).catch(editorStore.reportError)}>{children} ↗</button> : <span title="此链接协议不可用">{children}</span>, h1: ({ children, node }) => <Heading level={1} line={node?.position?.start.line}>{children}</Heading>, h2: ({ children, node }) => <Heading level={2} line={node?.position?.start.line}>{children}</Heading>, h3: ({ children, node }) => <Heading level={3} line={node?.position?.start.line}>{children}</Heading>, h4: ({ children, node }) => <Heading level={4} line={node?.position?.start.line}>{children}</Heading>, h5: ({ children, node }) => <Heading level={5} line={node?.position?.start.line}>{children}</Heading>, h6: ({ children, node }) => <Heading level={6} line={node?.position?.start.line}>{children}</Heading> }}>{text}</ReactMarkdown></article></section>;
}
