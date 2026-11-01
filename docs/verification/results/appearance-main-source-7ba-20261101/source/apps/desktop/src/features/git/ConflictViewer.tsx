import { useEffect, useState } from 'react';
import { Check, FileCode2, GitMerge, X } from 'lucide-react';
import { call, errorMessage } from '../../bridge';
import { GitModal } from './Modal';
import type { GitBlob, GitConflict, GitFile, GitSnapshot } from './types';

type BlobPage = { text?: string; binary: boolean; nextCursor: string | null };
function NumberedSource({ text = '', firstLine = 1 }: { text?: string; firstLine?: number }) {
  const lineCount = Math.max(1, text.split('\n').length - (text.endsWith('\n') ? 1 : 0));
  return <div className="git-conflict-source" tabIndex={0}><pre className="git-conflict-line-numbers" aria-hidden="true">{Array.from({ length: lineCount }, (_, index) => firstLine + index).join('\n')}</pre><pre>{text}</pre></div>;
}
function ConflictSource({ projectId, repoId, blob, title, action, busy, onChoose }: { projectId: string; repoId: string; blob: GitBlob | null; title: string; action?: string; busy: boolean; onChoose?(): void }) {
  const [page, setPage] = useState<BlobPage | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const [firstLine, setFirstLine] = useState(1);
  useEffect(() => { let current = true; setPage(null); setFirstLine(1); setError(''); if (blob) { setLoading(true); void call<BlobPage>('git_blob_read', { repoId, blob }, projectId).then(result => { if (current) setPage(result); }).catch(e => { if (current) setError(errorMessage(e)); }).finally(() => { if (current) setLoading(false); }); } return () => { current = false; }; }, [projectId, repoId, blob?.oid]);
  const loadNext = async () => { setLoading(true); try { const result = await call<BlobPage>('git_blob_read', { repoId, blob, cursor: page?.nextCursor }, projectId); setFirstLine(line => line + ((page?.text ?? '').match(/\n/g)?.length ?? 0)); setPage(result); } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); } };
  return <section className="git-conflict-pane"><header><span>{title}</span>{onChoose ? <button disabled={busy || !blob} onClick={onChoose}>{action}</button> : null}</header>{error ? <p className="git-error" role="alert">{error}</p> : !blob ? <p className="git-empty">此侧不存在该文件。</p> : page?.binary ? <p className="git-empty">此侧为二进制文件。</p> : loading && !page ? <p className="git-empty">读取来源…</p> : <NumberedSource text={page?.text} firstLine={firstLine} />}{page?.nextCursor ? <button disabled={loading} onClick={() => void loadNext()}>下一页来源内容</button> : null}</section>;
}

type Props = { projectId: string; file: GitFile; snapshot: GitSnapshot; onClose(): void; onOpenFile?(): void; onChoose(choice: string): void; onStage(): void; busy: boolean; error?: string; progress?: string; inline?: boolean; onStop?(): void; stopping?: boolean };
export function ConflictViewer({ projectId, file, snapshot, onClose, onOpenFile, onChoose, onStage, busy, error: operationError, progress, inline = false, onStop, stopping = false }: Props) {
  const [conflict, setConflict] = useState<GitConflict | null>(null), [error, setError] = useState(''), [showBase, setShowBase] = useState(false);
  useEffect(() => { let current = true; setError(''); void call<GitConflict>('git_conflict_get', { repoId: snapshot.repoId, fileId: file.fileId, expectedRepoToken: snapshot.repoToken }, projectId).then(c => { if (current) setConflict(c); }).catch(e => { if (current) setError(errorMessage(e)); }); return () => { current = false; }; }, [projectId, file.fileId, snapshot.repoToken]);
  const result = conflict?.worktree;
  const content = <div className={`git-conflict-surface${inline ? ' git-conflict-inline' : ''}`}>
    {inline ? <div className="git-review-tabs"><div className="git-review-tab" aria-current="page"><FileCode2 size={14} /><span>{file.displayPath.split('/').at(-1)}</span><button aria-label="关闭冲突视图" disabled={busy} onClick={onClose}><X size={12} /></button></div></div> : null}
    <header className="git-conflict-heading"><GitMerge size={16} /><span title={file.displayPath}>{file.displayPath} · 合并冲突</span><span className="git-spacer" /><button className="git-primary" disabled={busy || !conflict} onClick={onStage}><Check size={14} />暂存结果，标记已解决</button></header>
    {conflict?.operation === 'rebase' ? <p className="git-warning">正在 rebase：当前侧为重新变基的目标，传入侧为正在重放的提交。</p> : null}
    {error ? <p className="git-error" role="alert">{error}</p> : null}{operationError ? <p className="git-error" role="alert">{operationError}</p> : null}{busy ? <p className="git-progress" role="status"><span>{progress || 'Git 正在处理…'}</span>{inline && onStop ? <button disabled={stopping} onClick={onStop}>{stopping ? '正在停止…' : '停止'}</button> : null}</p> : null}
    {!conflict ? <p className="git-empty">读取冲突来源…</p> : <><div className="git-conflict-columns"><ConflictSource projectId={projectId} repoId={snapshot.repoId} blob={conflict.ours} title={`当前侧 · ${snapshot.head.name ?? 'stage 2'}`} action="采用当前" busy={busy} onChoose={() => onChoose('stage2')} /><ConflictSource projectId={projectId} repoId={snapshot.repoId} blob={conflict.theirs} title="传入侧 · stage 3" action="采用传入" busy={busy} onChoose={() => onChoose('stage3')} /></div>
    <section className="git-conflict-result"><header><span>合并结果 · 磁盘文件</span><span className="git-spacer" />{!conflict.ours || !conflict.theirs ? <button disabled={busy} onClick={() => onChoose('delete')}>按删除处理</button> : null}{onOpenFile ? <button disabled={busy} onClick={onOpenFile}>编辑结果</button> : null}</header>{!result ? <p className="git-hint">选择来源后可打开文件检查结果。</p> : !result.exists ? <p className="git-empty">结果文件已删除。</p> : result.binary ? <p className="git-empty">结果为二进制文件。</p> : result.encodingUnsupported ? <p className="git-empty">此结果不是 UTF-8 文本。</p> : <NumberedSource text={result.text} />}{result?.truncated ? <p className="git-hint">显示前 128 KiB。打开文件可继续检查。</p> : null}</section>
    <div className="git-conflict-foot"><button aria-expanded={showBase} onClick={() => setShowBase(value => !value)}>{showBase ? '收起共同祖先' : '查看共同祖先 · stage 1'}</button><span>选择来源只修改磁盘；检查后再暂存。</span></div>{showBase ? <ConflictSource projectId={projectId} repoId={snapshot.repoId} blob={conflict.base} title="共同祖先 · stage 1" busy={busy} /> : null}</>}
  </div>;
  return inline ? content : <GitModal title={`冲突 · ${file.displayPath}`} wide onClose={onClose} busy={busy} onStop={onStop} stopping={stopping}>{content}</GitModal>;
}
