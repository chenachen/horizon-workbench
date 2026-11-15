import { useEffect, useRef, useState } from 'react';
import { Check, FileCode2, GitMerge, X } from 'lucide-react';
import { call, errorMessage } from '../../bridge';
import { GitModal } from './Modal';
import type { GitBlob, GitConflict, GitFile, GitSnapshot } from './types';

type BlobPage = { text?: string; binary: boolean; nextCursor: string | null };
type SourceRead = { key: string; page: BlobPage | null; firstLine: number; loading: boolean; error: string };
function NumberedSource({ text = '', firstLine = 1 }: { text?: string; firstLine?: number }) {
  const lineCount = Math.max(1, text.split('\n').length - (text.endsWith('\n') ? 1 : 0));
  return <div className="git-conflict-source" tabIndex={0}><pre className="git-conflict-line-numbers" aria-hidden="true">{Array.from({ length: lineCount }, (_, index) => firstLine + index).join('\n')}</pre><pre>{text}</pre></div>;
}
function ConflictSource({ projectId, repoId, blob, title, action, busy, placeholder, onChoose }: { projectId: string; repoId: string; blob: GitBlob | null; title: string; action?: string; busy: boolean; placeholder?: string; onChoose?(): void }) {
  const key = JSON.stringify([projectId, repoId, blob?.oid]);
  const [source, setSource] = useState<SourceRead>({ key: '', page: null, firstLine: 1, loading: false, error: '' });
  const request = useRef(0);
  const current = source.key === key;
  const page = current ? source.page : null;
  const error = current ? source.error : '';
  const loading = !!blob && (!current || source.loading);
  useEffect(() => {
    const version = ++request.current;
    setSource({ key, page: null, firstLine: 1, loading: !!blob, error: '' });
    if (blob) {
      void call<BlobPage>('git_blob_read', { repoId, blob }, projectId)
        .then(page => { if (version === request.current) setSource({ key, page, firstLine: 1, loading: false, error: '' }); })
        .catch(error => { if (version === request.current) setSource({ key, page: null, firstLine: 1, loading: false, error: errorMessage(error) }); });
    }
    return () => { request.current++; };
  }, [projectId, repoId, blob?.oid]);
  const loadNext = async () => {
    if (loading || !blob || !page?.nextCursor) return;
    const version = request.current;
    const firstLine = source.firstLine + ((page.text ?? '').match(/\n/g)?.length ?? 0);
    setSource(current => ({ ...current, loading: true, error: '' }));
    try {
      const next = await call<BlobPage>('git_blob_read', { repoId, blob, cursor: page.nextCursor }, projectId);
      if (version === request.current) setSource({ key, page: next, firstLine, loading: false, error: '' });
    } catch (error) {
      if (version === request.current) setSource(current => ({ ...current, loading: false, error: errorMessage(error) }));
    }
  };
  const message = placeholder || error || (!blob ? '此侧不存在该文件。' : page?.binary ? '此侧为二进制文件。' : loading && !page ? '读取来源…' : '');
  return <section className="git-conflict-pane">
    <header><span>{title}</span>{onChoose ? <button disabled={busy || !!placeholder || !blob} onClick={onChoose}>{action}</button> : null}</header>
    <div className="git-conflict-source-body" aria-busy={loading}>
      {message ? <div className="git-conflict-placeholder" role={error ? 'alert' : 'status'}>{message}</div> : <NumberedSource text={page?.text} firstLine={current ? source.firstLine : 1} />}
    </div>
    <div className="git-conflict-source-pagination">
      <button disabled={loading || !page?.nextCursor} style={{ visibility: page?.nextCursor ? 'visible' : 'hidden' }} onClick={() => void loadNext()}>下一页来源内容</button>
    </div>
  </section>;
}

type Props = { projectId: string; file: GitFile; snapshot: GitSnapshot; onClose(): void; onOpenFile?(): void; onChoose(choice: string): void; onStage(): void; busy: boolean; error?: string; progress?: string; inline?: boolean; onStop?(): void; stopping?: boolean };
export function ConflictViewer({ projectId, file, snapshot, onClose, onOpenFile, onChoose, onStage, busy, error: operationError, progress, inline = false, onStop, stopping = false }: Props) {
  const key = JSON.stringify([projectId, snapshot.repoId, file.fileId, snapshot.repoToken]);
  const [read, setRead] = useState<{ key: string; conflict: GitConflict | null; error: string }>({ key: '', conflict: null, error: '' });
  const [showBase, setShowBase] = useState(false);
  const conflict = read.key === key ? read.conflict : null;
  const error = read.key === key ? read.error : '';
  const loading = !conflict && !error;
  useEffect(() => {
    let current = true;
    void call<GitConflict>('git_conflict_get', { repoId: snapshot.repoId, fileId: file.fileId, expectedRepoToken: snapshot.repoToken }, projectId)
      .then(conflict => { if (current) setRead({ key, conflict, error: '' }); })
      .catch(error => { if (current) setRead({ key, conflict: null, error: errorMessage(error) }); });
    return () => { current = false; };
  }, [projectId, snapshot.repoId, file.fileId, snapshot.repoToken]);
  const result = conflict?.worktree;
  const placeholder = conflict ? undefined : error ? '未能读取来源。' : '读取来源…';
  const content = <div className={`git-conflict-surface${inline ? ' git-conflict-inline' : ''}`}>
    {inline ? <div className="git-review-tabs"><div className="git-review-tab" aria-current="page"><FileCode2 size={14} /><span>{file.displayPath.split('/').at(-1)}</span><button aria-label="关闭冲突视图" disabled={busy} onClick={onClose}><X size={12} /></button></div></div> : null}
    <header className="git-conflict-heading"><GitMerge size={16} /><span title={file.displayPath}>{file.displayPath} · 合并冲突</span><span className="git-spacer" /><button className="git-primary" disabled={busy || !conflict} onClick={onStage}><Check size={14} />暂存结果，标记已解决</button></header>
    <div className="git-conflict-body" aria-busy={loading}>
      <div className="git-conflict-feedback">
        {conflict?.operation === 'rebase' ? <p className="git-warning">正在 rebase：当前侧为重新变基的目标，传入侧为正在重放的提交。</p> : null}
        {error ? <p className="git-error" role="alert">{error}</p> : null}
        {operationError ? <p className="git-error" role="alert">{operationError}</p> : null}
        {busy ? <p className="git-progress" role="status"><span>{progress || 'Git 正在处理…'}</span>{inline && onStop ? <button disabled={stopping} onClick={onStop}>{stopping ? '正在停止…' : '停止'}</button> : null}</p> : null}
      </div>
      <div className="git-conflict-columns">
        <ConflictSource projectId={projectId} repoId={snapshot.repoId} blob={conflict?.ours ?? null} placeholder={placeholder} title={`当前侧 · ${snapshot.head.name ?? 'stage 2'}`} action="采用当前" busy={busy} onChoose={() => onChoose('stage2')} />
        <ConflictSource projectId={projectId} repoId={snapshot.repoId} blob={conflict?.theirs ?? null} placeholder={placeholder} title="传入侧 · stage 3" action="采用传入" busy={busy} onChoose={() => onChoose('stage3')} />
      </div>
      <section className="git-conflict-result">
        <header><span>合并结果 · 磁盘文件</span><span className="git-spacer" />{conflict && (!conflict.ours || !conflict.theirs) ? <button disabled={busy} onClick={() => onChoose('delete')}>按删除处理</button> : null}{onOpenFile ? <button disabled={busy || !conflict} onClick={onOpenFile}>编辑结果</button> : null}</header>
        <div className="git-conflict-source-body">
          {placeholder ? <div className="git-conflict-placeholder" role="status">{placeholder}</div> : !result ? <div className="git-conflict-placeholder">选择来源后可打开文件检查结果。</div> : !result.exists ? <div className="git-conflict-placeholder">结果文件已删除。</div> : result.binary ? <div className="git-conflict-placeholder">结果为二进制文件。</div> : result.encodingUnsupported ? <div className="git-conflict-placeholder">此结果不是 UTF-8 文本。</div> : <NumberedSource text={result.text} />}
        </div>
        {result?.truncated ? <p className="git-hint">显示前 128 KiB。打开文件可继续检查。</p> : null}
      </section>
      <div className="git-conflict-foot"><button aria-expanded={showBase} onClick={() => setShowBase(value => !value)}>{showBase ? '收起共同祖先' : '查看共同祖先 · stage 1'}</button><span>选择来源只修改磁盘；检查后再暂存。</span></div>
      {showBase ? <ConflictSource projectId={projectId} repoId={snapshot.repoId} blob={conflict?.base ?? null} placeholder={placeholder} title="共同祖先 · stage 1" busy={busy} /> : null}
    </div>
  </div>;
  return inline ? content : <GitModal title={`冲突 · ${file.displayPath}`} wide onClose={onClose} busy={busy} onStop={onStop} stopping={stopping}>{content}</GitModal>;
}
