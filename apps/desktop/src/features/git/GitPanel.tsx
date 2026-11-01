import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowUpDown, Check, GitBranch, History, RefreshCw } from 'lucide-react';
import { call, errorMessage, start, subscribe, type TaskHandle } from '../../bridge';
import { usePluginEnabled } from '../plugins/service';
import { editorStore } from '../editor/store';
import { ConflictViewer } from './ConflictViewer';
import { DiffViewer } from './DiffViewer';
import { GitModal } from './Modal';
import type { DiffSelection, DiscardPlan, GitBranches, GitCommit, GitFile, GitSnapshot, GitStatusFile, MutationResult } from './types';
import './git.css';

export type GitPanelProps = { projectId: string; onOpenFile?: (file: GitFile) => void; onError?: (error: unknown) => void; onOpenDiff?: (review: { projectId: string; selection: DiffSelection; snapshot: GitSnapshot; onToggleStage?: () => void }) => void; onSnapshot?: (value: { projectId: string; snapshot: GitSnapshot }) => void; conflictTargetId?: string; onConflictVisibilityChange?: (projectId: string, visible: boolean) => void };
type Page = { items: GitCommit[]; nextCursor: string | null; shallow: boolean };
type Compare = { commit?: GitCommit; source: string | null; target: string; items: { file: GitFile; status: string; originalPath?: string }[]; truncated: boolean };
const staged = (f: GitStatusFile) => f.index !== '.' && f.index !== ' ' && f.index !== '?' && f.kind !== 'unmerged';
const unstaged = (f: GitStatusFile) => f.worktree !== '.' && f.worktree !== ' ' && f.kind !== 'unmerged';
const dirtyFiles = (projectId: string) => [...editorStore.getSnapshot().buffers.values()].filter(b => b.projectId === projectId && b.dirty);
const DRAFT = 'horizon.git.commitDraft.';
const draftTimers = new Map<string, ReturnType<typeof setTimeout>>();
function persistDraft(projectId: string, commitDraft: string) {
  clearTimeout(draftTimers.get(projectId));
  draftTimers.set(projectId, setTimeout(() => { draftTimers.delete(projectId); void call('session_update', { commitDraft }, projectId).catch(() => {}); }, 600));
}
type WriteError = { message: string; code: string };
type GitWrite = { token: symbol; pending: boolean; operation: string; message?: string; base?: GitSnapshot; task: TaskHandle<MutationResult> | null; progress: string; cancelRequested: boolean; error?: WriteError; failedOperation?: string; notice?: string; stale?: boolean; draftCleared?: boolean };
const writes = new Map<string, GitWrite>(), writeListeners = new Set<() => void>();
const writeError = (error: unknown): WriteError => ({ message: errorMessage(error), code: typeof error === 'object' && error && 'code' in error ? String(error.code) : '' });
function publishWrite(projectId: string, value: GitWrite | null) { if (value) writes.set(projectId, value); else writes.delete(projectId); writeListeners.forEach(listener => listener()); }
function patchWrite(projectId: string, token: symbol, changes: Partial<GitWrite>) { const current = writes.get(projectId); if (current?.token === token) publishWrite(projectId, { ...current, ...changes }); }
function releaseWrite(projectId: string, token: symbol) { const current = writes.get(projectId); if (current?.token === token && !current.pending) publishWrite(projectId, null); }
function useGitWrite(projectId: string) {
  return useSyncExternalStore(useCallback(listener => { writeListeners.add(listener); return () => { writeListeners.delete(listener); }; }, []), useCallback(() => writes.get(projectId) ?? null, [projectId]));
}
function settleWrite(projectId: string, token: symbol, outcome: Pick<GitWrite, 'error' | 'failedOperation' | 'notice' | 'stale'>) {
  const current = writes.get(projectId); if (current?.token !== token) return;
  const draftCleared = !outcome.error && current.operation === 'commit' && current.message !== undefined && sessionStorage.getItem(DRAFT + projectId) === current.message;
  if (draftCleared) { sessionStorage.setItem(DRAFT + projectId, ''); persistDraft(projectId, ''); }
  // A hidden terminal record needs no file list, result snapshot or live handle.
  publishWrite(projectId, { token, pending: false, operation: current.operation, message: current.message, task: null, progress: '', cancelRequested: false, draftCleared, ...outcome });
}
function stopWrite(projectId: string) {
  const current = writes.get(projectId); if (!current?.pending || !current.task || current.cancelRequested) return;
  patchWrite(projectId, current.token, { cancelRequested: true });
  void current.task.cancel().catch(error => { if (writes.get(projectId)?.pending) patchWrite(projectId, current.token, { cancelRequested: false, error: writeError(error) }); });
}
const recoveryText: Record<string, string> = { GIT_AUTH_REQUIRED: '请检查系统 Git 凭据助手、SSH 密钥与远端权限，再重试。', GIT_NON_FAST_FORWARD: '远端与本地历史分歧。请获取远端并比较分支，再在外部 Git 处理；不会强制推送。', GIT_LOCKED: '其他 Git 操作可能正在运行。结束该操作后刷新；不会自动删除锁。', OUTCOME_UNKNOWN: '请先刷新并核对 HEAD、暂存区和远端，再决定是否重试。', GIT_NOT_FOUND: '请在设置中配置可用的 Git 路径。', NOT_FOUND: '可单独添加真正的仓库根目录；不会自动初始化仓库。', STALE_VERSION: '仓库已变化。刷新后重新核对范围，再执行操作。' };
const errorSummary: Record<string, string> = { GIT_AUTH_REQUIRED: '远端身份验证未通过。', GIT_NON_FAST_FORWARD: '远端包含本地尚未合并的提交。', GIT_LOCKED: 'Git 仓库被其他操作锁定。', GIT_COMMAND_FAILED: 'Git 命令未完成，请展开查看原因。', OUTCOME_UNKNOWN: '任务已停止，操作结果需要核对。', GIT_NOT_FOUND: '未找到可用的 Git。' };
function ErrorContent({ error }: { error: { message: string; code: string } }) {
  const summary = errorSummary[error.code] ?? error.message;
  return <><strong>{summary}</strong>{recoveryText[error.code] && error.code !== 'NOT_FOUND' ? <p>{recoveryText[error.code]}</p> : null}{summary !== error.message ? <details className="git-error-details"><summary>查看 Git 详情</summary><pre>{error.message}</pre></details> : null}</>;
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return <span className={`git-refresh-icon${spinning ? ' is-spinning' : ''}`} aria-hidden="true"><RefreshCw size={14} /></span>;
}

export function GitPanel({ projectId, onOpenFile, onOpenDiff, onSnapshot, conflictTargetId, onConflictVisibilityChange }: GitPanelProps) {
  const enabled = usePluginEnabled('horizon.git', projectId);
  const [snapshot, setSnapshot] = useState<GitSnapshot | null>(null), [stale, setStale] = useState(false), [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code: string } | null>(null), [notice, setNotice] = useState(''), [failedOperation, setFailedOperation] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true), [autoFetch, setAutoFetch] = useState(false);
  const [filePages, setFilePages] = useState({ index: 0, disk: 0 });
  const [tab, setTab] = useState<'changes' | 'history' | 'branches'>('changes'), [draft, setDraft] = useState(() => sessionStorage.getItem(DRAFT + projectId) ?? '');
  const [readTask, setReadTask] = useState<TaskHandle<GitSnapshot> | null>(null);
  const write = useGitWrite(projectId), task = write?.pending ? write.task : null, busy = !!write?.pending, progress = write?.progress ?? '', cancelRequested = write?.cancelRequested ?? false;
  const [selection, setSelection] = useState<DiffSelection | null>(null), [conflictFile, setConflictFile] = useState<GitFile | null>(null), [plan, setPlan] = useState<DiscardPlan | null>(null), [dirtyStage, setDirtyStage] = useState<GitStatusFile | null>(null);
  const [historySelection, setHistorySelection] = useState('');
  const [history, setHistory] = useState<Page | null>(null), [branches, setBranches] = useState<GitBranches | null>(null), [compare, setCompare] = useState<Compare | null>(null);
  const [remote, setRemote] = useState(''), [remoteBranch, setRemoteBranch] = useState(''), [newBranch, setNewBranch] = useState(''), [startPoint, setStartPoint] = useState('HEAD'), [switchAfter, setSwitchAfter] = useState(true), [branchFilter, setBranchFilter] = useState('');
  const [compareSource, setCompareSource] = useState('HEAD'), [compareTarget, setCompareTarget] = useState('');
  const conflictListener = useRef(onConflictVisibilityChange); conflictListener.current = onConflictVisibilityChange;
  useEffect(() => { conflictListener.current?.(projectId, !!conflictFile); return () => { conflictListener.current?.(projectId, false); }; }, [projectId, conflictFile?.fileId]);
  const stagingAction = useRef<(fileId: string, base: DiffSelection['base']) => Promise<boolean>>(() => Promise.resolve(false));
  const snapshotRef = useRef<GitSnapshot | null>(null);
  const snapshotListener = useRef(onSnapshot); snapshotListener.current = onSnapshot;
  const refreshing = useRef(false);
  const generation = useRef(0), statusRequest = useRef(0), branchRequest = useRef(0), busyRef = useRef(false), currentProject = useRef(projectId);
  currentProject.current = projectId;
  busyRef.current = busy;
  const consumedWrite = useRef<symbol | null>(null);
  const branchEdits = useRef({ remote: false, target: false, compareTarget: false });
  const fail = useCallback((e: unknown) => { setError({ message: errorMessage(e), code: typeof e === 'object' && e && 'code' in e ? String(e.code) : '' }); }, []);
  const refresh = useCallback(async (quiet = false) => {
  if (!enabled || writes.get(projectId)?.pending) return; const version = generation.current, request = ++statusRequest.current; ++branchRequest.current; refreshing.current = true; if (!quiet) setLoading(true);
    try { let value: GitSnapshot; if (quiet) value = await call<GitSnapshot>('git_status', { refresh: true }, projectId); else { const handle = await start<GitSnapshot>('git_status', { refresh: true }, undefined, projectId); if (version === generation.current) setReadTask(handle); value = await handle.result; } if (version !== generation.current || request !== statusRequest.current) return; snapshotRef.current = value; setSnapshot(value); setBranches(null); setStale(false); if (!quiet) setError(null); snapshotListener.current?.({ projectId, snapshot: value }); }
    catch (e) { if (version === generation.current && request === statusRequest.current) { setStale(true); if (!quiet) fail(e); } }
    finally { if (version === generation.current && request === statusRequest.current) { refreshing.current = false; setReadTask(null); setLoading(false); } }
  }, [projectId, enabled, fail]);
  useEffect(() => { generation.current++; ++branchRequest.current; branchEdits.current = { remote: false, target: false, compareTarget: false }; consumedWrite.current = null; const pending = writes.get(projectId); const base = pending?.pending ? pending.base ?? null : null; snapshotRef.current = base; setSnapshot(base); setReadTask(null); setLoading(false); refreshing.current = false; setHistory(null); setBranches(null); setCompare(null); setSelection(null); setConflictFile(null); setPlan(null); setDirtyStage(null); setDraft(sessionStorage.getItem(DRAFT + projectId) ?? ''); setError(null); setNotice(''); setFailedOperation(''); setRemote(''); setRemoteBranch(''); if (base) snapshotListener.current?.({ projectId, snapshot: base }); if (enabled && !pending) void refresh(); return () => { generation.current++; statusRequest.current++; }; }, [projectId, enabled]);
  useEffect(() => {
    if (!enabled || !write || writes.get(projectId)?.token !== write.token) return;
    if (write.pending) { if (write.error) setError(write.error); return; }
    if (consumedWrite.current === write.token) return; consumedWrite.current = write.token;
    const version = generation.current;
    setError(write.error ?? null); setNotice(write.notice ?? ''); setFailedOperation(write.failedOperation ?? ''); setStale(write.stale ?? false);
    if (write.draftCleared) setDraft(value => value === write.message ? '' : value);
    if (write.error) setLoading(true);
    void refresh(!!write.error).finally(() => { if (version === generation.current && currentProject.current === projectId) releaseWrite(projectId, write.token); });
  }, [projectId, enabled, write, refresh]);
  useEffect(() => { let alive = true; void call<{ commitDraft?: string }>('session_get', {}, projectId).then(session => { if (alive && sessionStorage.getItem(DRAFT + projectId) === null) { const value = session.commitDraft ?? ''; setDraft(value); sessionStorage.setItem(DRAFT + projectId, value); } }).catch(() => {}); return () => { alive = false; }; }, [projectId]);
  useEffect(() => {
  if (!enabled) return; let alive = true; let close: (() => Promise<unknown>) | undefined;
    const read = () => { void call<{ effective: Record<string, unknown> }>('settings_get', { projectId }, projectId).then(value => { if (alive) { setAutoRefresh(value.effective['git.autoRefresh'] !== false); setAutoFetch(value.effective['git.autoFetch'] === true); } }).catch(() => {}); };
    read(); void subscribe(['horizon.settings.v1'], read, projectId).then(s => { if (alive) close = s.close; else void s.close(); }).catch(() => {});
    return () => { alive = false; void close?.(); };
  }, [projectId, enabled]);
  useEffect(() => { if (!enabled || !autoRefresh) return; const interval = window.setInterval(() => { if (document.visibilityState === 'visible' && !busyRef.current && !refreshing.current) void refresh(true); }, 6000); const focus = () => { if (!busyRef.current && !refreshing.current) void refresh(true); }; window.addEventListener('focus', focus); return () => { clearInterval(interval); window.removeEventListener('focus', focus); }; }, [enabled, autoRefresh, refresh]);
  const writeDraft = (value: string) => { setDraft(value); sessionStorage.setItem(DRAFT + projectId, value); persistDraft(projectId, value); };
  const openDiff = (selection: DiffSelection) => { setConflictFile(null); if (tab === 'branches') setTab('changes'); if (onOpenDiff && snapshot) onOpenDiff({ projectId, selection, snapshot, onToggleStage: selection.base === 'commitToParent' ? undefined : () => stagingAction.current(selection.file.fileId, selection.base) }); else setSelection(selection); };
  const run = async (params: Record<string, unknown>, method = 'git_mutate'): Promise<boolean> => {
    const base = snapshotRef.current;
    if (!base || writes.has(projectId) || busyRef.current || stale || !enabled) return false;
    if (['switch', 'pull'].includes(String(params.operation)) || (params.operation === 'createBranch' && params.switchAfter)) {
      const dirty = dirtyFiles(projectId); if (dirty.length) { fail(new Error(`请先保存或关闭 ${dirty.length} 个未保存文件，再切换分支或拉取。`)); return false; }
    }
    const version = generation.current, token = Symbol();
    const currentView = () => version === generation.current && currentProject.current === projectId;
    busyRef.current = true; ++statusRequest.current; ++branchRequest.current; refreshing.current = false; setReadTask(null); setLoading(false);
    publishWrite(projectId, { token, pending: true, operation: String(params.operation ?? method), message: params.operation === 'commit' ? String(params.message) : undefined, base, task: null, progress: '等待 Git…', cancelRequested: false });
    setError(null); setFailedOperation(''); setNotice('');
    try {
      const handle = await start<MutationResult>(method, { repoId: base.repoId, expectedRepoToken: base.repoToken, ...params }, event => { if (event.payload.type === 'progress') patchWrite(projectId, token, { progress: event.payload.phase ?? 'Git 正在处理…' }); }, projectId);
      patchWrite(projectId, token, { task: handle });
      const result = await handle.result;
      const failures = result.perFile?.filter(f => f.state === 'failed');
      const error = failures?.length ? writeError(new Error(failures.map(f => f.error?.message ?? '部分文件操作失败').join('；'))) : undefined;
      const notice = error ? '' : result.commitOid ? `已提交 ${result.commitOid.slice(0, 9)}，尚未推送。` : '操作已完成。';
      if (currentView()) consumedWrite.current = token;
      settleWrite(projectId, token, { error, notice, stale: false });
      if (!currentView() || writes.get(projectId)?.token !== token) return false;
      snapshotRef.current = result.snapshot; setSnapshot(result.snapshot); setStale(false); snapshotListener.current?.({ projectId, snapshot: result.snapshot }); ++branchRequest.current; setBranches(null); setHistory(null);
      if (writes.get(projectId)?.draftCleared) setDraft(value => value === params.message ? '' : value);
      if (error) setError(error); else setNotice(notice);
      releaseWrite(projectId, token); busyRef.current = false; return !error;
    } catch (error) {
      if (currentView()) consumedWrite.current = token;
      settleWrite(projectId, token, { error: writeError(error), failedOperation: String(params.operation ?? method), stale: true });
      if (!currentView() || writes.get(projectId)?.token !== token) return false;
      setFailedOperation(String(params.operation ?? method)); fail(error); setStale(true); await refresh(true);
      if (currentView()) { releaseWrite(projectId, token); busyRef.current = false; } return false;
    }
  };
  useEffect(() => {
    if (!enabled || !autoFetch) return;
    const interval = window.setInterval(() => { if (busyRef.current || !snapshotRef.current) return; void call<GitBranches>('git_branches', { repoId: snapshotRef.current.repoId }, projectId).then(b => { if (b.remotes[0]) return run({ operation: 'fetch', remote: b.remotes[0] }); }).catch(fail); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [enabled, autoFetch, projectId]);
  const stageFile = async (f: GitStatusFile, diskOnly = false) => { if (!diskOnly && dirtyFiles(projectId).some(b => b.fileId === f.file.fileId)) { setDirtyStage(f); return false; } return run({ operation: 'stage', fileIds: [f.file.fileId], allowDirtyDisk: diskOnly }); };
  stagingAction.current = async (fileId, base) => { const file = snapshotRef.current?.files.find(item => item.file.fileId === fileId); if (!file || busyRef.current || stale || !enabled) return false; if (base === 'headToIndex' && staged(file)) return run({ operation: 'unstage', fileIds: [fileId] }); if (base === 'indexToWorktree' && unstaged(file)) return stageFile(file); return false; };
  const discard = async (f: GitStatusFile) => {
    if (!snapshot) return;
    if (dirtyFiles(projectId).some(b => b.fileId === f.file.fileId)) { fail(new Error('此文件有未保存内容。请先保存或关闭该文件，再放弃磁盘更改。')); onOpenFile?.(f.file); return; }
    try { const result = await call<DiscardPlan>('git_discard_plan', { repoId: snapshot.repoId, fileIds: [f.file.fileId], source: 'index' }, projectId); if (currentProject.current === projectId) setPlan(result); } catch (e) { fail(e); }
  };
  const loadHistory = async (more = false) => { const version = generation.current; setLoading(true); try { const page = await call<Page>('git_history', { repoId: snapshot?.repoId, limit: 30, cursor: more ? history?.nextCursor : undefined }, projectId); if (version === generation.current) setHistory(old => more && old ? { ...page, items: [...old.items, ...page.items] } : page); } catch (e) { if (version === generation.current) fail(e); } finally { if (version === generation.current) setLoading(false); } };
  const loadBranches = async () => {
    const base = snapshotRef.current; if (!base || refreshing.current) return;
    const version = generation.current, request = ++branchRequest.current; setLoading(true);
    try {
      const result = await call<GitBranches>('git_branches', { repoId: base.repoId }, projectId);
      if (version !== generation.current || request !== branchRequest.current) return;
      if (result.repoToken !== base.repoToken) { setStale(true); fail({ code: 'STALE_VERSION', message: '仓库已变化，请刷新后重新核对分支与同步目标。' }); return; }
      setBranches(result);
      if (!branchEdits.current.remote) setRemote(value => value || result.remotes[0] || '');
      if (!branchEdits.current.target) setRemoteBranch(base.head.name ?? '');
      if (!branchEdits.current.compareTarget) setCompareTarget(base.upstream?.name ?? '');
    } catch (e) { if (version === generation.current && request === branchRequest.current) fail(e); }
    finally { if (version === generation.current && request === branchRequest.current) setLoading(false); }
  };
  useEffect(() => { if (enabled && snapshot && !busy && tab === 'history' && !history) void loadHistory(); }, [tab, enabled, snapshot?.repoId, history, busy]);
  useEffect(() => { if (enabled && snapshot && !busy && tab === 'branches' && !branches) void loadBranches(); }, [tab, enabled, snapshot, branches, busy]);
  const showCompare = async (target: string, source?: string, commit?: GitCommit) => { const version = generation.current; setLoading(true); setCompare(null); try { const result = await call<Compare>('git_compare', { repoId: snapshot?.repoId, target, source }, projectId); if (version === generation.current) { if (commit && result.items[0]) { setHistorySelection(commit.oid); const item = result.items[0]; openDiff({ file: item.file, base: 'commitToParent', commitOid: result.target, parentOid: result.source ?? undefined, originalPath: item.originalPath, commit, commitFiles: result.items }); } else { setTab('changes'); setCompare({ ...result, commit }); } } } catch (e) { if (version === generation.current) fail(e); } finally { if (version === generation.current) setLoading(false); } };
  const commit = async () => { if (!snapshot || !draft.trim()) return; const text = draft; if (await run({ operation: 'commit', message: text, stagedFileIds: snapshot.files.filter(staged).map(f => f.file.fileId) })) { if (sessionStorage.getItem(DRAFT + projectId) === text) writeDraft(''); } };
  const group = (title: string, items: GitStatusFile[], index: boolean) => { const key = index ? 'index' : 'disk'; const page = Math.min(filePages[key], Math.max(0, Math.ceil(items.length / 100) - 1)); return <section className="git-file-group"><h3 title={index ? 'HEAD → 暂存区' : '暂存区 → 磁盘'}><span>{title} · {items.length}</span>{!index ? <button className="git-refresh-button" onClick={() => { if (loading && readTask) void readTask.cancel().catch(fail); else void refresh(); }} disabled={busy || (loading && !readTask)} aria-label={loading ? '停止刷新 Git 状态' : '刷新 Git 状态'} title={loading ? '停止刷新 Git 状态' : '刷新 Git 状态'} aria-busy={loading}><RefreshIcon spinning={loading} /></button> : null}</h3>{items.length ? items.slice(page * 100, (page + 1) * 100).map(f => <div className="git-file-row" key={`${index ? 'index' : 'disk'}-${f.file.fileId}`}><button className="git-file-name" title={f.originalPath ? `${f.originalPath} → ${f.file.displayPath}` : f.file.displayPath} onClick={() => openDiff({ file: f.file, base: index ? 'headToIndex' : 'indexToWorktree', originalPath: f.originalPath })}><span className="git-file-type">{f.file.displayPath.endsWith('.ts') || f.file.displayPath.endsWith('.tsx') ? 'TS' : f.file.displayPath.endsWith('.css') ? '#' : '·'}</span><span className="git-file-label">{f.file.displayPath.split('/').at(-1)}</span><span className="git-status-code">{f.kind === 'untracked' ? '?' : index ? f.index : f.worktree}</span></button><button disabled={busy || stale} title={`${index ? '取消暂存' : '暂存磁盘内容'} ${f.file.displayPath}`} aria-label={`${index ? '取消暂存' : '暂存'} ${f.file.displayPath}`} onClick={() => index ? void run({ operation: 'unstage', fileIds: [f.file.fileId] }) : void stageFile(f)}>{index ? '−' : '+'}</button>{!index ? <button className="git-danger-text" disabled={busy || stale} title={`放弃 ${f.file.displayPath} 的未暂存更改`} aria-label={`放弃 ${f.file.displayPath} 的未暂存更改`} onClick={() => void discard(f)}>↶</button> : null}</div>) : <p className="git-empty-small">无更改</p>}{items.length > 100 ? <div className="git-list-pages"><button aria-label={`${title}上一页`} disabled={page === 0} onClick={() => setFilePages(p => ({ ...p, [key]: page - 1 }))}>‹</button><span>{page + 1}/{Math.ceil(items.length / 100)}</span><button aria-label={`${title}下一页`} disabled={(page + 1) * 100 >= items.length} onClick={() => setFilePages(p => ({ ...p, [key]: page + 1 }))}>›</button></div> : null}</section>; };
  const stop = () => stopWrite(projectId);
  if (!enabled) return <div className="git-panel"><p className="git-empty">Git 扩展未启用。可在插件中心恢复。</p></div>;
  const pushFailed = !!error && failedOperation === 'push';
  const remoteAvailable = !!remote && !!branches?.remotes.includes(remote);
  const noRepository = !snapshot && error?.code === 'NOT_FOUND' && error.message.includes('不是 Git 仓库');
  const conflictTarget = conflictTargetId ? document.getElementById(conflictTargetId) : null;
  const conflictContent = snapshot && conflictFile ? <ConflictViewer inline={!!conflictTarget} projectId={projectId} file={conflictFile} snapshot={snapshot} busy={busy} onStop={task ? stop : undefined} stopping={cancelRequested} error={error ? errorSummary[error.code] ?? error.message : undefined} progress={progress} onClose={() => setConflictFile(null)} onOpenFile={onOpenFile ? () => { onOpenFile(conflictFile); setConflictFile(null); } : undefined} onChoose={choice => { if (dirtyFiles(projectId).some(b => b.fileId === conflictFile.fileId)) { fail(new Error('请先保存或关闭此文件的未保存内容。')); return; } void run({ fileId: conflictFile.fileId, choice }, 'git_conflict_resolve'); }} onStage={() => { const f = snapshot.files.find(f => f.file.fileId === conflictFile.fileId); if (f) void stageFile(f).then(ok => { if (ok) setConflictFile(null); }); }} /> : null;
  const conflicts = snapshot?.files.filter(f => f.kind === 'unmerged') ?? [], stagedFiles = snapshot?.files.filter(staged) ?? [];
  return <div className="git-panel" aria-label="Git 源代码管理">
    {snapshot?.head.state !== 'branch' && (snapshot || (loading && !error)) ? <header className="git-panel-heading"><span title={snapshot?.rootDisplayPath}>{snapshot?.head.state === 'detached' ? `分离 HEAD · ${snapshot.head.oid?.slice(0, 8)}` : snapshot?.head.state === 'unborn' ? `${snapshot.head.name ?? 'main'} · 尚无提交` : '检测仓库…'}</span></header> : null}
    {noRepository ? <section className="git-repository-empty" aria-label="未发现 Git 仓库">
      <span className="git-repository-symbol" aria-hidden="true"><GitBranch size={19} /></span>
      <h3>尚未发现 Git 仓库</h3>
      <p>当前目录未启用 Git。<br />可添加已有仓库的根目录。</p>
      <button onClick={() => void refresh()} disabled={loading} aria-busy={loading}><RefreshIcon spinning={loading} />重新检测</button>
    </section> : error && (tab !== 'branches' || !snapshot) && !plan && !dirtyStage && !conflictFile ? <div className="git-error" role="alert"><ErrorContent error={error} /><div className="git-error-actions"><button onClick={() => void refresh()} disabled={loading}><RefreshIcon spinning={loading} />刷新状态</button><button onClick={() => setError(null)}>关闭</button></div></div> : null}
    {notice ? <p className="git-notice" role="status">{notice}</p> : null}
    {!autoRefresh ? <p className="git-hint">自动刷新已暂停</p> : null}
    {stale && snapshot ? <p className="git-warning">当前快照已过期，请刷新后操作。</p> : null}
    {snapshot?.operation ? <p className="git-warning">{snapshot.operation === 'merge' ? '正在合并。解决并暂存全部冲突后，可在此提交完成合并。' : `正在 ${snapshot.operation}。请处理冲突；继续/中止该流程请使用外部 Git。`}</p> : null}
    {busy ? <div className="git-progress" role="status"><span>{progress}</span><button disabled={!task || cancelRequested} onClick={stop}>{cancelRequested ? '正在停止…' : '停止'}</button></div> : null}
    {loading && readTask && !snapshot && !noRepository ? <div className="git-progress" role="status"><span>读取真实仓库状态…</span><button onClick={() => void readTask.cancel().catch(fail)}>停止读取</button></div> : null}
    {snapshot?.truncated ? <p className="git-warning">更改超过 10,000 项，仅显示部分文件。请在外部 Git 缩小范围后操作。</p> : null}
    {snapshot && tab !== 'history' ? <>
      {conflicts.length ? <section className="git-file-group"><h3>冲突<span>{conflicts.length}</span></h3>{conflicts.map(f => <button className="git-conflict-file" key={f.file.fileId} onClick={() => setConflictFile(f.file)}>! {f.file.displayPath}</button>)}</section> : null}
      {group('更改', snapshot.files.filter(unstaged), false)}{group('已暂存', stagedFiles, true)}
      <form className="git-commit" onSubmit={event => { event.preventDefault(); void commit(); }}><label htmlFor="git-commit-message">提交说明</label><textarea id="git-commit-message" rows={4} value={draft} placeholder="写下这次改动…" onChange={e => writeDraft(e.target.value)} onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (!busy && stagedFiles.length && !conflicts.length) void commit(); } }} /><p>仅提交已暂存的 {stagedFiles.length} 个文件。</p><button className="git-primary" type="submit" disabled={busy || stale || !draft.trim() || !stagedFiles.length || !!conflicts.length || snapshot.truncated}><Check size={15} aria-hidden="true" />提交{stagedFiles.length ? ` · ${stagedFiles.length} 个文件` : ''}</button></form>
    </> : null}
    {snapshot && tab === 'history' ? <section className="git-history">{history?.shallow ? <p className="git-hint">浅克隆：只显示本地已有历史。</p> : null}{history?.items.map(item => <button key={item.oid} className="git-history-item" aria-pressed={historySelection === item.oid} onClick={() => void showCompare(item.oid, undefined, item)}><strong>{item.subject}</strong><span>{item.oid.slice(0, 8)} · {item.author}</span><time dateTime={item.time}>{new Date(item.time).toLocaleString()}</time></button>)}{history && !history.items.length ? <p className="git-empty">尚无提交。</p> : null}{history?.nextCursor ? <button disabled={loading} onClick={() => void loadHistory(true)}>加载更多历史</button> : null}{loading ? <p className="git-hint">读取历史…</p> : null}</section> : null}
    <nav hidden={!snapshot} className="git-tool-links" aria-label="Git 视图"><button onClick={() => setTab(tab === 'history' ? 'changes' : 'history')} aria-pressed={tab === 'history'}>{tab === 'history' ? <ArrowLeft size={15} /> : <History size={15} />}{tab === 'history' ? '更改' : '历史'}</button><button onClick={() => setTab('branches')} aria-pressed={tab === 'branches'}><ArrowUpDown size={15} />同步</button>{tab === 'history' ? <button onClick={() => void loadHistory()} disabled={loading} aria-label="刷新提交历史"><RefreshCw size={14} /></button> : null}</nav>
    {snapshot && tab === 'branches' ? <GitModal title={pushFailed ? '推送未完成' : '分支与同步'} onClose={() => setTab('changes')} busy={busy} onStop={task ? stop : undefined} stopping={cancelRequested}><section className="git-branches">{error ? <div className="git-error" role="alert"><ErrorContent error={error} /></div> : null}{busy ? <p className="git-progress" role="status">{progress || 'Git 正在处理…'}</p> : null}
      {pushFailed ? <><h3 className="git-sync-state-title">当前状态</h3><div className="git-sync-state-row"><span>本地分支</span><span>{snapshot.head.name ?? '分离 HEAD'}{snapshot.upstream ? ` · 领先 ${snapshot.upstream.ahead ?? '?'}` : ''}</span></div><div className="git-sync-state-row"><span>远端分支</span><span>{remote}/{remoteBranch}{snapshot.upstream ? ` · 落后 ${snapshot.upstream.behind ?? '?'}` : ''}</span></div><footer className="git-toolbar"><button disabled={busy} onClick={() => setTab('changes')}>稍后处理</button><button className="git-primary" disabled={busy || stale || !remoteAvailable} onClick={() => void run({ operation: 'fetch', remote })}>获取并检查</button></footer></> : <>
      <label>查找分支<input value={branchFilter} onChange={e => setBranchFilter(e.target.value)} placeholder="分支名称" /></label>{branches?.items.filter(b => b.name.toLowerCase().includes(branchFilter.toLowerCase())).map(branch => <div className={`git-branch-row${branch.current ? ' current' : ''}`} key={branch.name}><GitBranch size={16} /><span title={branch.oid}>{branch.name}<small>{branch.remote ? '远端分支' : branch.current ? `当前分支${branch.upstream ? ` · 跟踪 ${branch.upstream}` : ''}` : '本地分支'}</small></span>{branch.current ? <Check size={16} /> : null}{!branch.remote && !branch.current ? <button disabled={busy || stale} onClick={() => void run({ operation: 'switch', branch: branch.name })}>切换</button> : null}</div>)}
      <details><summary>新建分支</summary><form onSubmit={e => { e.preventDefault(); void run({ operation: 'createBranch', name: newBranch, startOid: startPoint, switchAfter }).then(ok => { if (ok) setNewBranch(''); }); }}><label>新分支名<input value={newBranch} onChange={e => setNewBranch(e.target.value)} required /></label><label>起点<input value={startPoint} onChange={e => setStartPoint(e.target.value)} required /></label><label className="git-check"><input type="checkbox" checked={switchAfter} onChange={e => setSwitchAfter(e.target.checked)} />创建后切换</label><button disabled={busy || stale || !newBranch.trim() || snapshot.head.state === 'unborn'}>创建分支</button></form></details>
      <section className="git-sync"><h3>远端同步</h3>{snapshot.upstream ? <p className="git-hint">{snapshot.upstream.name} · 领先 {snapshot.upstream.ahead ?? '?'} / 落后 {snapshot.upstream.behind ?? '?'}</p> : <p className="git-hint">尚未设置上游。请明确选择远端与目标分支。</p>}<label>远端<select value={remote} onChange={e => { branchEdits.current.remote = true; setRemote(e.target.value); }}><option value="">选择远端</option>{remote && branches && !branches.remotes.includes(remote) ? <option value={remote}>{remote} · 已移除</option> : null}{branches?.remotes.map(r => <option key={r}>{r}</option>)}</select></label><label>目标分支<input value={remoteBranch} onChange={e => { branchEdits.current.target = true; setRemoteBranch(e.target.value); }} /></label>{branches && !branches.remotes.length ? <p className="git-hint">尚未配置远端。可用外部 Git 添加 remote 后刷新。</p> : null}<div className="git-toolbar"><button disabled={busy || stale || !remoteAvailable} onClick={() => void run({ operation: 'fetch', remote })}>获取</button><button disabled={busy || stale || !remoteAvailable || !remoteBranch} onClick={() => void run({ operation: 'pull', remote, branch: remoteBranch, strategy: 'ffOnly' })}>仅快进拉取</button><button disabled={busy || stale || !remoteAvailable || !remoteBranch || snapshot.head.state !== 'branch'} onClick={() => void run({ operation: 'push', remote, sourceRef: snapshot.head.name, targetRef: remoteBranch, setUpstream: !snapshot.upstream })}>推送 {snapshot.head.name ?? 'HEAD'}</button></div><p className="git-hint">目标：{remote || '未选择远端'} / {remoteBranch || '未选择分支'}。推送不强制覆盖历史。</p></section>
      <details><summary>比较两个引用</summary><form onSubmit={e => { e.preventDefault(); void showCompare(compareTarget, compareSource); }}><label>起点<input value={compareSource} onChange={e => setCompareSource(e.target.value)} /></label><label>终点<input value={compareTarget} onChange={e => { branchEdits.current.compareTarget = true; setCompareTarget(e.target.value); }} /></label><button disabled={loading || !compareSource || !compareTarget}>比较差异</button></form></details>
    </>} </section></GitModal> : null}
    {snapshot && selection ? <DiffViewer projectId={projectId} selection={selection} snapshot={snapshot} onToggleStage={selection.base === 'commitToParent' ? undefined : () => stagingAction.current(selection.file.fileId, selection.base)} onClose={() => setSelection(null)} onOpenFile={onOpenFile ? () => { onOpenFile(selection.file); setSelection(null); } : undefined} /> : null}
    {conflictTarget && conflictContent ? createPortal(conflictContent, conflictTarget) : conflictContent}
    {plan ? <GitModal title="放弃未暂存更改" onClose={() => setPlan(null)} busy={busy} onStop={task ? stop : undefined} stopping={cancelRequested}><p>已跟踪文件恢复到暂存区，已暂存内容保留。未跟踪文件移到废纸篓。</p>{error ? <div className="git-error" role="alert"><ErrorContent error={error} /></div> : null}{busy ? <p className="git-progress" role="status">{progress || '正在处理…'}</p> : null}<ul className="git-discard-files">{plan.files.map(f => <li key={f.fileId}><code>{f.file.displayPath}</code><span>{f.operation === 'trash' ? '未跟踪文件 · 移到废纸篓' : '未暂存更改 · 恢复到暂存区'}</span></li>)}</ul><footer className="git-toolbar"><button autoFocus data-initial-focus disabled={busy} onClick={() => setPlan(null)}>取消</button><button className="git-danger" disabled={busy} onClick={() => void run({ operation: 'discard', planId: plan.planId, planDigest: plan.digest, expectedRepoToken: plan.repoToken }).then(ok => { if (ok) setPlan(null); })}>放弃清单中的未暂存更改</button></footer></GitModal> : null}
    {dirtyStage ? <GitModal title="文件有未保存内容" onClose={() => setDirtyStage(null)}><p>{dirtyStage.file.displayPath} 的编辑器文本尚未写入磁盘。请选择暂存来源。</p>{error ? <div className="git-error" role="alert"><ErrorContent error={error} /></div> : null}<footer className="git-toolbar"><button autoFocus data-initial-focus onClick={() => setDirtyStage(null)}>取消</button><button onClick={() => { const f = dirtyStage; setDirtyStage(null); void stageFile(f, true); }}>仅暂存磁盘内容</button><button className="git-primary" onClick={() => { const f = dirtyStage; void editorStore.save(f.file.fileId, projectId).then(saved => { if (!saved || dirtyFiles(projectId).some(b => b.fileId === f.file.fileId)) return; setDirtyStage(null); void refresh().then(() => stageFile(f)); }).catch(fail); }}>保存后暂存</button></footer></GitModal> : null}
    {compare ? <GitModal title={compare.source ? '引用比较' : `提交 ${compare.target.slice(0, 9)}`} onClose={() => setCompare(null)}><p className="git-hint">{compare.source?.slice(0, 12) ?? '父提交'} → {compare.target.slice(0, 12)}</p>{compare.items.map(item => <button className="git-history-file" key={item.file.fileId} onClick={() => { openDiff({ file: item.file, base: 'commitToParent', commitOid: compare.target, parentOid: compare.source ?? undefined, originalPath: item.originalPath, commitFiles: compare.items }); setCompare(null); }}>{item.status} {item.file.displayPath}</button>)}{!compare.items.length ? <p className="git-empty">没有文件差异。</p> : null}{compare.truncated ? <p className="git-warning">列表过大，仅显示部分结果。</p> : null}</GitModal> : null}
  </div>;
}
