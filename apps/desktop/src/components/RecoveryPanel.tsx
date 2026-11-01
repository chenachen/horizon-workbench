import { useCallback, useEffect, useState } from 'react';
import { Download, FileClock, FolderOpen, RefreshCw, RotateCcw } from 'lucide-react';
import { call, errorMessage } from '../bridge';
import type { Project } from '../workspace';

type RecoveryItem = { checkpointId: string; documentId: string; projectId: string; editorRevision: number; updatedAt: string; byteCount: number; file?: { projectId: string; fileId: string; displayPath: string } };
type RecoveryDraft = RecoveryItem & { text: string; file: { projectId: string; fileId: string; displayPath: string }; encoding: string; eol: string };

export function RecoveryPanel({ projects, canRestore, onRestore }: { projects: Project[]; canRestore: (projectId: string) => boolean; onRestore: (checkpointId: string, projectId: string) => Promise<void> }) {
  const [items, setItems] = useState<RecoveryItem[]>([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<string>();
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState<RecoveryDraft>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    setError('');
    try { const result = await call<{ items: RecoveryItem[] }>('recovery_list', filter ? { projectId: filter } : {}); setItems(result.items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); setPage(current => Math.min(current, Math.max(0, Math.ceil(result.items.length / 100) - 1))); }
    catch (reason) { setError(errorMessage(reason)); }
  }, [filter]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    setDraft(undefined); setError('');
    if (!selected) return;
    let current = true;
    void call<RecoveryDraft>('recovery_read', { checkpointId: selected }).then(value => { if (current) setDraft(value); }).catch(reason => { if (current) setError(errorMessage(reason)); });
    return () => { current = false; };
  }, [selected]);
  const exportDraft = async () => {
    if (!draft) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const directory = await call<{ selectionToken: string | null }>('project_pick_directory');
      if (!directory.selectionToken) return;
      const filename = draft.file.displayPath.split(/[\\/]/).at(-1) || 'untitled';
      await call('recovery_export', { checkpointId: draft.checkpointId, expectedEditorRevision: draft.editorRevision, destinationSelectionToken: directory.selectionToken, name: `${filename}.recovered-${Date.now()}.txt` });
      setNotice('恢复稿已导出。原文件保持不变。');
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  };
  return <div className="recovery-panel">
    <p className="form-intro">查看未保存编辑的恢复副本。可导出为文件，或恢复到编辑器后继续处理。</p>
    <div className="recovery-toolbar"><label><span className="sr-only">筛选恢复稿项目</span><select aria-label="筛选恢复稿项目" value={filter} onChange={event => { setSelected(undefined); setPage(0); setFilter(event.target.value); }}><option value="">全部项目</option>{projects.map(project => <option key={project.id} value={project.id}>{project.displayName}</option>)}</select></label><span>{items.length} 份恢复稿</span><button onClick={() => void refresh()} aria-label="刷新恢复草稿"><RefreshCw size={14} /></button></div>
    {error ? <p className="inline-error" role="alert">{error}</p> : null}
    {notice ? <p className="success-note" role="status">{notice}</p> : null}
    <div className="recovery-columns"><div className="recovery-list" aria-label="恢复草稿列表">
      {!items.length ? <div className="empty-state"><FileClock size={26} /><h3>没有待恢复的草稿</h3><p>未保存的编辑会自动保留恢复副本。</p></div> : items.slice(page * 100, (page + 1) * 100).map((item, index) => <button key={item.checkpointId} className={item.checkpointId === selected ? 'selected' : ''} onClick={() => { setSelected(item.checkpointId); setNotice(''); }}><FileClock size={17} /><span><strong>{item.file?.displayPath ?? `恢复草稿 ${page * 100 + index + 1}`}</strong><small>{projects.find(project => project.id === item.projectId)?.displayName ?? '已移除项目'} · {new Date(item.updatedAt).toLocaleString()}</small></span></button>)}
      {items.length > 100 ? <div className="recovery-pages"><button disabled={page === 0} onClick={() => setPage(value => value - 1)}>上一页</button><span>{page + 1} / {Math.ceil(items.length / 100)}</span><button disabled={(page + 1) * 100 >= items.length} onClick={() => setPage(value => value + 1)}>下一页</button></div> : null}
    </div><div className="recovery-preview">
      {draft ? <><header><FolderOpen size={16} /><strong>{draft.file.displayPath}</strong><span>{draft.encoding} · {draft.eol}</span></header><pre tabIndex={0} aria-label="恢复稿内容预览">{draft.text.slice(0, 200_000)}</pre>{draft.text.length > 200_000 ? <p className="form-intro">预览显示前 200,000 字符。导出与恢复包含全文。</p> : null}<footer><button disabled={busy} onClick={() => void exportDraft()}><Download size={15} />导出恢复稿</button><button className="primary-button" disabled={busy || !canRestore(draft.projectId)} onClick={async () => { setBusy(true); setError(''); try { await onRestore(draft.checkpointId, draft.projectId); } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(false); } }}><RotateCcw size={15} />恢复到编辑器</button></footer>{!canRestore(draft.projectId) ? <p className="form-intro">{projects.some(project => project.id === draft.projectId) ? '启用此项目的编辑器插件后可直接恢复；现在仍可预览和导出。' : '此项目已移除，恢复稿仍可预览和导出。'}</p> : null}</> : <div className="empty-state"><FileClock size={28} /><h3>{selected ? error ? '恢复稿读取失败' : '正在读取草稿…' : '选择一份恢复稿'}</h3><p>这里的预览不会修改原文件。</p></div>}
    </div></div>
  </div>;
}
