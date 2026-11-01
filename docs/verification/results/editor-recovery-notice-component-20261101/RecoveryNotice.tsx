import { useEffect, useRef, useState } from 'react';
import { FileClock, X } from 'lucide-react';
import { call } from '../../bridge';
import { errorMessage, type RecoveryDraft, type RecoveryItem } from '../../../../../packages/editor/src/types';
import { editorStore, useEditor } from './store';

type Comparison = { draft: RecoveryDraft; disk?: string; diskError?: string };

/** Refresh on dirty transitions and checkpoint cleanup receipts, not every edit. */
export function RecoveryNotice({ projectId, projectEpoch }: { projectId: string; projectEpoch: number }) {
  const snapshot = useEditor();
  const recoveryState = JSON.stringify([...snapshot.buffers.values()]
    .filter(buffer => buffer.projectId === projectId && (buffer.checkpointId || buffer.recoveryPending || buffer.savedVersion > 0))
    .map(buffer => [buffer.fileId, buffer.checkpointId, buffer.dirty, buffer.recoveryPending, buffer.savedVersion, buffer.evicted]));
  const [items, setItems] = useState<RecoveryItem[]>([]);
  const [selected, setSelected] = useState('');
  const [comparison, setComparison] = useState<Comparison>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const request = useRef(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const token = ++request.current;
    setItems([]); setSelected(''); setComparison(undefined); setError(''); setBusy(false);
    void call<{ items: RecoveryItem[] }>('recovery_list', { projectId }).then(result => {
      if (request.current !== token) return;
      setItems(result.items.filter(item => item.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    }).catch(reason => { if (request.current === token) setError(errorMessage(reason)); });
    return () => { ++request.current; };
  }, [projectId, projectEpoch, refresh, recoveryState]);
  useEffect(() => {
    if (!comparison) return;
    returnFocus.current = document.activeElement as HTMLElement;
    closeButton.current?.focus();
    return () => { if (returnFocus.current?.isConnected) returnFocus.current.focus(); };
  }, [!!comparison]);
  const candidates = items.filter(item => ![...snapshot.buffers.values()].some(buffer => buffer.projectId === projectId && buffer.checkpointId === item.checkpointId && (buffer.dirty || buffer.recoveryPending)));
  const selectedItem = candidates.find(item => item.checkpointId === selected) ?? candidates[0];
  const compare = async () => {
    if (!selectedItem) return;
    const token = request.current;
    setBusy(true); setError('');
    try {
      const draft = await call<RecoveryDraft>('recovery_read', { checkpointId: selectedItem.checkpointId });
      if (request.current !== token) return;
      if (draft.projectId !== projectId) throw new Error('恢复草稿属于其他项目。');
      const result: Comparison = { draft };
      try {
        const fileId = draft.file?.fileId ?? draft.fileId;
        if (!fileId) throw new Error('草稿缺少原文件信息。');
        const buffer = await editorStore.openFile(fileId, { projectId, preview: false, activate: false });
        if (!buffer?.meta) throw new Error('原文件当前无法作为文本读取。草稿可在设置中导出。');
        const disk = await call<{ text: string }>('document_disk_read', { documentId: buffer.meta.documentId }, projectId);
        result.disk = disk.text;
      } catch (reason) { result.diskError = errorMessage(reason); }
      if (request.current === token) setComparison(result);
    } catch (reason) { if (request.current === token) setError(errorMessage(reason)); }
    finally { if (request.current === token) setBusy(false); }
  };
  const restore = async (checkpointId: string) => {
    const token = request.current;
    setBusy(true); setError('');
    try {
      await editorStore.restoreDraft(checkpointId, projectId);
      if (request.current === token) { setItems(previous => previous.filter(item => item.checkpointId !== checkpointId)); setComparison(undefined); }
    } catch (reason) { if (request.current === token) setError(errorMessage(reason)); }
    finally { if (request.current === token) setBusy(false); }
  };
  if (!candidates.length && !error) return null;
  return <>
    <div className="editor-notice" role="status">
      <FileClock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
      {candidates.length ? <><strong>{candidates.length} 份未保存草稿待恢复</strong><select aria-label="选择待恢复草稿" value={selectedItem?.checkpointId ?? ''} onChange={event => setSelected(event.target.value)} style={{ maxWidth: '35%', marginLeft: 10 }} disabled={busy}>{candidates.map((item, index) => <option key={item.checkpointId} value={item.checkpointId}>{item.file?.displayPath ?? `恢复草稿 ${index + 1}`} · {new Date(item.updatedAt).toLocaleString()}</option>)}</select><button disabled={busy} onClick={() => void compare()}>比较草稿与磁盘</button><button disabled={busy || !selectedItem} onClick={() => selectedItem && void restore(selectedItem.checkpointId)}>恢复到编辑器</button></> : <strong>恢复草稿暂时无法读取</strong>}
      {error && <p role="alert">{error}<button disabled={busy} onClick={() => setRefresh(value => value + 1)}>重新读取</button></p>}
    </div>
    {comparison && <section className="disk-compare" role="dialog" aria-modal="true" aria-label="恢复草稿与磁盘内容比较" onKeyDown={event => {
      if (event.key === 'Escape' && !busy) setComparison(undefined);
      if (event.key === 'Tab') { const elements = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),pre[tabindex]')]; const first = elements[0], last = elements.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    }}>
      <header><strong>{comparison.draft.file?.displayPath ?? '恢复草稿'} · 只读比较</strong><span><button disabled={busy} onClick={() => void restore(comparison.draft.checkpointId)}>恢复到编辑器</button><button ref={closeButton} disabled={busy} onClick={() => setComparison(undefined)} aria-label="关闭恢复比较"><X size={16} /></button></span></header>
      {error && <p className="editor-error" role="alert">{error}</p>}
      <div><section><h3>恢复草稿 · {new Date(comparison.draft.updatedAt).toLocaleString()}</h3><pre tabIndex={0} aria-label="恢复草稿内容，只读">{comparison.draft.text.slice(0, 200_000)}</pre>{comparison.draft.text.length > 200_000 && <p className="editor-empty">预览显示前 200,000 字符，恢复包含全文。</p>}</section><section><h3>当前磁盘内容</h3>{comparison.diskError ? <p className="editor-error">{comparison.diskError}</p> : <><pre tabIndex={0} aria-label="当前磁盘内容，只读">{comparison.disk?.slice(0, 200_000)}</pre>{(comparison.disk?.length ?? 0) > 200_000 && <p className="editor-empty">预览显示前 200,000 字符。</p>}</>}</section></div>
    </section>}
  </>;
}
