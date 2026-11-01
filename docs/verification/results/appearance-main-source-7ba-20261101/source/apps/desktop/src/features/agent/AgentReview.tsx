import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, FileDiff, RefreshCw, Trash2, TriangleAlert, X } from 'lucide-react';
import { call, errorMessage, getProjectEpoch, start } from '../../bridge';
import { reviewDiff } from './reviewDiff';
import type { Review, ReviewFile } from './types';

type FilePreview = { text: string; binary: boolean; truncated: boolean };
type ApplyResult = { results: { fileId: string; state: string; error?: { message: string }; applicationId?: string; detail?: { documentId: string; expectedEditorRevision: number; text: string; proposalId: string } }[] };
const EMPTY: FilePreview = { text: '', binary: false, truncated: false };
const PAGE_ROWS = 300;

export function AgentReview({ projectId, reviewId, onClose, onDiscard }: { projectId: string; reviewId: string; onClose: () => void; onDiscard: () => void }) {
  const [review, setReview] = useState<Review | null>(null), [selected, setSelected] = useState<ReviewFile | null>(null), [baseline, setBaseline] = useState(EMPTY), [after, setAfter] = useState(EMPTY), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [confirmDiscard, setConfirmDiscard] = useState(false), [page, setPage] = useState(0);
  const live = useRef(true), epoch = useRef(getProjectEpoch(projectId));
  const current = () => live.current && epoch.current === getProjectEpoch(projectId);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const refresh = async () => {
    const result = await call<Review>('review_get', { reviewId }, projectId);
    if (!current()) return;
    setReview(result); setSelected(value => result.files.find(file => file.file.fileId === value?.file.fileId) ?? result.files[0] ?? null);
  };
  useEffect(() => { void refresh().catch(e => { if (current()) setError(errorMessage(e)); }); }, [projectId, reviewId]);
  useEffect(() => {
    let active = true; setBaseline(EMPTY); setAfter(EMPTY); setPage(0); setLoading(Boolean(selected));
    if (!selected) return;
    const read = async (side: 'baseline' | 'after'): Promise<FilePreview> => {
      if ((side === 'baseline' && selected.baselineHash === null) || (side === 'after' && selected.afterHash === null)) return EMPTY;
      const result = await call<{ text?: string; binary: boolean; nextCursor: string | null }>('review_file_read', { reviewId, fileId: selected.file.fileId, side, limitBytes: 128 * 1024 }, projectId);
      return { text: result.text ?? '', binary: result.binary, truncated: Boolean(result.nextCursor) };
    };
    void Promise.all([read('baseline'), read('after')]).then(([a, b]) => { if (active && current()) { setBaseline(a); setAfter(b); } }).catch(e => { if (active && current()) setError(errorMessage(e)); }).finally(() => { if (active && current()) setLoading(false); });
    return () => { active = false; };
  }, [projectId, reviewId, selected?.file.fileId, selected?.afterHash]);
  const diff = useMemo(() => reviewDiff(baseline.text, after.text), [baseline.text, after.text]);
  const previewLimited = baseline.truncated || after.truncated || diff.truncated;
  const apply = async (files: ReviewFile[]) => {
    if (!current() || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const handle = await start<ApplyResult>('review_apply', { reviewId, targets: files.map(file => ({ fileId: file.file.fileId, expectedDiskRevision: file.expectedDiskRevision, expectedEditorRevision: file.expectedEditorRevision })) }, undefined, projectId);
      const result = await handle.result; let applied = 0; const failures: string[] = [];
      for (const file of result.results) {
        if (file.state === 'proposed' && file.detail) {
          let success = false;
          if (current()) {
            const { applyReviewedEdit, editorStore } = await import('../editor');
            if (current()) {
              await editorStore.openFile(file.fileId, { projectId, preview: false });
              if (current()) success = await applyReviewedEdit({ projectId, fileId: file.fileId, expectedEditorRevision: file.detail.expectedEditorRevision, text: file.detail.text, proposalId: file.detail.proposalId });
            }
          }
          await call('review_editor_result', { reviewId, applicationId: file.applicationId, documentId: file.detail.documentId, state: success ? 'applied' : 'rejected', editorRevision: file.detail.expectedEditorRevision + (success ? 1 : 0) }, projectId);
          if (success) applied++; else failures.push('文档或项目已变化，未应用过期结果。');
        } else if (file.state === 'applied') applied++; else failures.push(file.error?.message ?? '文件未应用');
      }
      if (!current()) return;
      setNotice(`${applied} 个文件已应用。打开的文档保持未保存，可撤销。`); if (failures.length) setError(failures.join('；')); await refresh();
    } catch (e) { if (current()) setError(errorMessage(e)); } finally { if (current()) setBusy(false); }
  };
  const discard = async () => { setBusy(true); try { await call('review_discard', { reviewId, deleteTaskCopy: true }, projectId); if (current()) { onDiscard(); onClose(); } } catch (e) { if (current()) setError(errorMessage(e)); } finally { if (current()) setBusy(false); } };
  const host = document.getElementById('agent-review-slot');
  if (!host) return null;
  return createPortal(<section className="agent-review-surface" aria-label="审查任务修改">
    <header className="agent-review-heading"><FileDiff size={17} /><strong>任务修改</strong><span>{review?.files.length ?? 0} 个文件</span><span className="agent-spacer" /><button className="icon-button" aria-label="刷新任务审查" disabled={busy} onClick={() => void refresh().catch(e => { if (current()) setError(errorMessage(e)); })}><RefreshCw size={15} /></button><button className="icon-button" aria-label="关闭任务审查" onClick={onClose}><X size={17} /></button></header>
    <div className="agent-review-origin">任务工作副本 <span>基线 {review?.baseline ?? '读取中…'}</span></div>
    <nav className="agent-review-files" aria-label="任务改动文件">{review?.files.map(file => <button key={file.file.fileId} aria-current={selected?.file.fileId === file.file.fileId ? 'true' : undefined} onClick={() => setSelected(file)}><span className={`agent-change-kind ${file.kind}`}>{file.kind === 'added' ? 'A' : file.kind === 'deleted' ? 'D' : 'M'}</span><span>{file.relativePath}</span>{file.applied ? <Check size={12} aria-label="已应用" /> : null}</button>)}</nav>
    {selected ? <><div className="agent-review-file-heading"><span title={selected.relativePath}>{selected.relativePath}</span><span className="agent-diff-count added">+{diff.added}</span><span className="agent-diff-count removed">−{diff.removed}</span><span className="agent-spacer" />{selected.canApply ? <button className="tonal" disabled={busy || loading} onClick={() => void apply([selected])}><Check size={14} />接受本文件</button> : <small>{selected.reason ?? (selected.applied ? '已应用' : '')}</small>}</div>
      <div className="agent-review-code" aria-label={`${selected.relativePath} 任务差异`} aria-busy={loading}>{loading ? <div className="agent-review-empty">正在读取差异…</div> : baseline.binary || after.binary ? <div className="agent-review-empty">二进制文件无法显示文本差异。</div> : diff.rows.slice(page * PAGE_ROWS, (page + 1) * PAGE_ROWS).map((row, index) => <div key={page * PAGE_ROWS + index} className={`agent-diff-line ${row.kind}`}><span className="agent-diff-number">{row.oldLine ?? ''}</span><span className="agent-diff-number">{row.newLine ?? ''}</span><span className="agent-diff-sign">{row.kind === 'added' ? '+' : row.kind === 'removed' ? '−' : ' '}</span><code>{row.text || ' '}</code></div>)}</div>
      {diff.rows.length > PAGE_ROWS ? <div className="agent-review-paging"><button disabled={page === 0} onClick={() => setPage(value => value - 1)}>上一页</button><span>第 {page + 1} / {Math.ceil(diff.rows.length / PAGE_ROWS)} 页</span><button disabled={(page + 1) * PAGE_ROWS >= diff.rows.length} onClick={() => setPage(value => value + 1)}>下一页</button></div> : null}
      {previewLimited ? <p className="agent-review-limit">预览限每侧 128 KiB、5,000 行；计数仅含已显示部分。应用使用完整文件。</p> : null}</> : <div className="agent-review-empty">{review ? '任务副本没有内容变化。' : '正在读取任务修改…'}</div>}
    {error ? <div className="agent-notice error" role="alert"><TriangleAlert size={16} />{error}</div> : null}{notice ? <div className="agent-notice good" role="status">{notice}</div> : null}
    {confirmDiscard ? <div className="agent-notice"><div>删除任务副本及未应用结果。原项目、暂存区和未保存文档保持原样。<div className="agent-button-row"><button disabled={busy} onClick={() => setConfirmDiscard(false)}>保留副本</button><button className="danger" disabled={busy} onClick={() => void discard()}>确认放弃副本</button></div></div></div> : null}
    <footer className="agent-review-footer"><button className="outline-button" disabled={busy} onClick={() => setConfirmDiscard(true)}><Trash2 size={14} />放弃任务副本</button><span className="agent-spacer" /><button className="filled" disabled={busy || !review?.files.some(file => file.canApply)} onClick={() => void apply(review!.files.filter(file => file.canApply))}><Check size={15} />{busy ? '正在应用…' : '接受全部'}</button></footer>
  </section>, host);
}
