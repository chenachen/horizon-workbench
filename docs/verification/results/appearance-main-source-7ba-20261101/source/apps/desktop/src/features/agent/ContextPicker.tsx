import { useEffect, useState } from 'react';
import { FileText, Plus, Search, X } from 'lucide-react';
import { call, errorMessage } from '../../bridge';
import { Modal } from '../../components/Modal';
import { editorStore } from '../editor/store';
import { agentView } from './store';
import type { Attachment } from './types';
export function ContextPicker({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [selected, setSelected] = useState<Attachment[]>(() => [...agentView.get(projectId).attachments]), [query, setQuery] = useState(''), [paths, setPaths] = useState<{ file: { fileId: string; displayPath: string } }[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState('');
  const buffers = [...editorStore.getSnapshot().buffers.values()].filter(b => b.projectId === projectId && b.mode === 'editor');
  useEffect(() => { let live = true; const timer = setTimeout(() => { void call<{ items: typeof paths }>('path_query', { query, generation: Date.now(), limit: 40 }, projectId).then(r => { if (live) setPaths(r.items); }).catch(e => { if (live) setError(errorMessage(e)); }); }, 120); return () => { live = false; clearTimeout(timer); }; }, [query, projectId]);
  const total = selected.reduce((sum, a) => sum + a.byteLength, 0);
  const add = async (fileId: string, label: string, source: 'disk' | 'buffer', selection = false) => {
    setError(''); setBusy(fileId);
    try {
      const buffer = editorStore.getBuffer(projectId, fileId); let item: Attachment;
      if (source === 'buffer') {
        if (!buffer?.meta) throw new Error('编辑文档已关闭');
        if (buffer.evicted) await editorStore.openFile(fileId, { projectId, activate: false });
        await editorStore.flushDrafts(projectId);
        const text = buffer.getText(), range = selection && buffer.selection.anchor !== buffer.selection.head ? { fromUtf16: Math.min(buffer.selection.anchor, buffer.selection.head), toUtf16: Math.max(buffer.selection.anchor, buffer.selection.head) } : undefined;
        item = { key: fileId, label, source, fileId, documentId: buffer.meta.documentId, editorRevision: buffer.version, text, range, byteLength: new TextEncoder().encode(range ? text.slice(range.fromUtf16, range.toUtf16) : text).byteLength };
      } else {
        const stat = await call<{ revision: { byteLength: string } }>('file_stat', { fileId }, projectId);
        item = { key: fileId, label, source, fileId, expectedDiskRevision: stat.revision, byteLength: Number(stat.revision.byteLength) };
      }
      setSelected(items => [...items.filter(i => i.fileId !== fileId), item]);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  };
  return <Modal title="选择本次上下文" onClose={onClose} className="agent-context-modal"><div className="agent-context-picker">
    <p className="agent-form-intro">发送冻结快照。聊天仅接收附加文本；任务可读取整个工作副本。</p>
    <div className="agent-context-budget"><span>{selected.length} / 20 项</span><span>{Math.ceil(total / 1024)} / 256 KiB</span></div>
    <div className="agent-selected-context">{selected.length ? selected.map(a => <div key={a.key}><FileText size={14} /><span>{a.label}<small>{a.source === 'buffer' ? '当前编辑内容' : a.source === 'gitDiff' ? '冻结 Git 差异' : '磁盘内容'}{a.range ? ' · 选区' : ''}</small></span><button className="icon-button" aria-label={`移除 ${a.label}`} onClick={() => setSelected(items => items.filter(i => i.key !== a.key))}><X size={14} /></button></div>) : <p className="agent-muted">尚未选择上下文。</p>}</div>
    {buffers.length ? <><h4>已打开文档</h4><div className="agent-context-files">{buffers.map(b => <div key={b.fileId}><span><FileText size={14} />{b.path}<small>{b.dirty ? '含未保存编辑' : '已保存'}</small></span><div><button disabled={!!busy} onClick={() => void add(b.fileId, b.path, 'disk')}>磁盘</button><button disabled={!!busy} onClick={() => void add(b.fileId, b.path, 'buffer')}>编辑内容</button>{b.selection.anchor !== b.selection.head ? <button disabled={!!busy} onClick={() => void add(b.fileId, b.path, 'buffer', true)}>选区</button> : null}</div></div>)}</div></> : null}
    <label className="agent-path-search"><Search size={15} /><input aria-label="查找上下文文件" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索项目文件" /></label>
    <div className="agent-path-results">{paths.map(({ file }) => <button key={file.fileId} disabled={!!busy} onClick={() => void add(file.fileId, file.displayPath, 'disk')}><FileText size={14} /><span>{file.displayPath}</span><Plus size={14} /></button>)}</div>
    {agentView.get(projectId).profile === 'task' ? <div className="agent-notice">新任务会以完整缓冲区作为选中文件的基线；选区只限制消息附加文本。现有任务副本保留初始基线，使用不同基线需新建任务。其他未保存文档使用磁盘版本。</div> : null}
    {error ? <div className="agent-notice error" role="alert">{error}</div> : null}{total > 256 * 1024 || selected.length > 20 ? <div className="agent-notice error">超出附件上限，请删减后发送。不会自动截断。</div> : null}
    <div className="agent-form-actions"><button onClick={onClose}>取消</button><button className="filled" disabled={!!busy || total > 256 * 1024 || selected.length > 20} onClick={() => { agentView.patch(projectId, { attachments: selected }); onClose(); }}>附加上下文</button></div>
  </div></Modal>;
}
