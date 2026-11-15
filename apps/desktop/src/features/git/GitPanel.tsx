import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Check, ChevronDown, CloudUpload, Download, GitBranch, History, Plus, RefreshCw, X } from 'lucide-react';
import { call, errorMessage, start, subscribe, type TaskHandle } from '../../bridge';
import { usePluginEnabled } from '../plugins/service';
import { editorStore } from '../editor/store';
import { ConflictViewer } from './ConflictViewer';
import { DiffViewer } from './DiffViewer';
import { GitModal } from './Modal';
import type { DiffSelection, DiscardPlan, GitBranches, GitCommit, GitFile, GitSnapshot, GitStatusFile, MutationResult } from './types';
import { resolveRemoteTarget } from './remoteTarget';
import './git.css';

export type GitPanelProps = { projectId: string; sharedSnapshot?: GitSnapshot; onOpenFile?: (file: GitFile) => void; onError?: (error: unknown) => void; onOpenDiff?: (review: { projectId: string; selection: DiffSelection; snapshot: GitSnapshot; onToggleStage?: () => void; onRefreshSnapshot?: (snapshot: GitSnapshot) => void }) => void; onSnapshot?: (value: { projectId: string; snapshot: GitSnapshot }) => void; conflictTargetId?: string; conflictVisible?: boolean; onConflictVisibilityChange?: (projectId: string, visible: boolean) => void };
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
type GitWrite = { token: symbol; pending: boolean; operation: string; message?: string; base?: GitSnapshot; task: TaskHandle<unknown> | null; progress: string; cancelRequested: boolean; error?: WriteError; failedOperation?: string; notice?: string; stale?: boolean; draftCleared?: boolean };
const writes = new Map<string, GitWrite>(), writeListeners = new Set<() => void>();
const writeError = (error: unknown): WriteError => ({ message: errorMessage(error), code: typeof error === 'object' && error && 'code' in error ? String(error.code) : '' });
function publishWrite(projectId: string, value: GitWrite | null) { if (value) writes.set(projectId, value); else writes.delete(projectId); writeListeners.forEach(listener => listener()); }
function patchWrite(projectId: string, token: symbol, changes: Partial<GitWrite>) { const current = writes.get(projectId); if (current?.token === token) publishWrite(projectId, { ...current, ...changes }); }
function releaseWrite(projectId: string, token: symbol) { const current = writes.get(projectId); if (current?.token === token && !current.pending) publishWrite(projectId, null); }
function useGitWrite(projectId: string) {
  return useSyncExternalStore(useCallback(listener => { writeListeners.add(listener); return () => { writeListeners.delete(listener); }; }, []), useCallback(() => writes.get(projectId) ?? null, [projectId]));
}
function clearCommittedDraft(projectId: string, message: string | undefined) {
  if (message === undefined || sessionStorage.getItem(DRAFT + projectId) !== message) return false;
  sessionStorage.setItem(DRAFT + projectId, '');
  persistDraft(projectId, '');
  return true;
}
function settleWrite(projectId: string, token: symbol, outcome: Pick<GitWrite, 'error' | 'failedOperation' | 'notice' | 'stale'>) {
  const current = writes.get(projectId); if (current?.token !== token) return;
  const draftCleared = current.draftCleared || (!outcome.error && current.operation === 'commit' && clearCommittedDraft(projectId, current.message));
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

export function GitPanel({ projectId, sharedSnapshot, onOpenFile, onOpenDiff, onSnapshot, conflictTargetId, conflictVisible, onConflictVisibilityChange }: GitPanelProps) {
  const enabled = usePluginEnabled('horizon.git', projectId);
  const [snapshot, setSnapshot] = useState<GitSnapshot | null>(null), [stale, setStaleState] = useState(false), [loading, setLoading] = useState(false);
  const staleRef = useRef(false);
  const setStale = useCallback((value: boolean) => { staleRef.current = value; setStaleState(value); }, []);
  const [error, setError] = useState<{ message: string; code: string } | null>(null), [notice, setNotice] = useState(''), [failedOperation, setFailedOperation] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true), [autoFetch, setAutoFetch] = useState(false);
  const [filePages, setFilePages] = useState({ index: 0, disk: 0 });
  const [tab, setTab] = useState<'changes' | 'history' | 'branches'>('changes'), [draft, setDraft] = useState(() => sessionStorage.getItem(DRAFT + projectId) ?? '');
  const [readTask, setReadTask] = useState<TaskHandle<GitSnapshot> | null>(null);
  const write = useGitWrite(projectId), task = write?.pending ? write.task : null, busy = !!write?.pending, progress = write?.progress ?? '', cancelRequested = write?.cancelRequested ?? false;
  const [selection, setSelection] = useState<DiffSelection | null>(null), [conflictFile, setConflictFile] = useState<GitFile | null>(null), [plan, setPlan] = useState<DiscardPlan | null>(null), [dirtyStage, setDirtyStage] = useState<GitStatusFile[] | null>(null);
  const [commitAction, setCommitAction] = useState<'commit' | 'push'>('commit');
  const pushAfterCommit = commitAction === 'push' && snapshot?.head.state === 'branch';
  const commitMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      const menu = commitMenu.current;
      if (menu && !menu.contains(event.target as Node)) menu.open = false;
    };
    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, []);
  const [historySelection, setHistorySelection] = useState('');
  const [history, setHistory] = useState<Page | null>(null), [branches, setBranches] = useState<GitBranches | null>(null), [compare, setCompare] = useState<Compare | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false), [branchesLoading, setBranchesLoading] = useState(false), [compareLoading, setCompareLoading] = useState(false);
  const [remote, setRemote] = useState(''), [remoteBranch, setRemoteBranch] = useState(''), [newBranch, setNewBranch] = useState(''), [startPoint, setStartPoint] = useState('HEAD'), [switchAfter, setSwitchAfter] = useState(true), [branchFilter, setBranchFilter] = useState('');
  const [compareSource, setCompareSource] = useState('HEAD'), [compareTarget, setCompareTarget] = useState('');
  const conflictListener = useRef(onConflictVisibilityChange); conflictListener.current = onConflictVisibilityChange;
  useEffect(() => { conflictListener.current?.(projectId, !!conflictFile); return () => { conflictListener.current?.(projectId, false); }; }, [projectId, conflictFile?.fileId]);
  // A new conflict selection publishes its visibility before the parent can update this prop.
  useEffect(() => {
    if (conflictVisible === false) setConflictFile(null);
  }, [projectId, conflictVisible]);
  const stagingAction = useRef<(fileId: string, base: DiffSelection['base']) => Promise<boolean>>(() => Promise.resolve(false));
  const snapshotRef = useRef<GitSnapshot | null>(null);
  const snapshotListener = useRef(onSnapshot); snapshotListener.current = onSnapshot;
  const refreshing = useRef(false);
  const generation = useRef(0), statusRequest = useRef(0), branchRequest = useRef(0), busyRef = useRef(false), currentProject = useRef(projectId);
  const mounted = useRef(false), enabledRef = useRef(enabled);
  const historyRequest = useRef(0), compareRequest = useRef(0);
  const historyHead = useRef<string | null>(null), historyPending = useRef<string | null>(null);
  currentProject.current = projectId;
  enabledRef.current = enabled;
  busyRef.current = busy;
  const consumedWrite = useRef<symbol | null>(null);
  const branchEdits = useRef({ remote: false, target: false, compareTarget: false });
  const fail = useCallback((e: unknown) => { setError({ message: errorMessage(e), code: typeof e === 'object' && e && 'code' in e ? String(e.code) : '' }); }, []);
  const acceptSnapshot = useCallback((value: GitSnapshot) => {
    snapshotListener.current?.({ projectId, snapshot: value });
    if (currentProject.current !== projectId || !enabledRef.current) return;
    statusRequest.current++;
    snapshotRef.current = value;
    staleRef.current = false;
    refreshing.current = false;
    if (mounted.current) {
      setSnapshot(value);
      setStale(false);
      setReadTask(null);
      setLoading(false);
    }
  }, [projectId, setStale]);
  const refresh = useCallback(async (quiet = false) => {
  if (!enabled || writes.get(projectId)?.pending) return; const version = generation.current, request = ++statusRequest.current; refreshing.current = true; if (!quiet) setLoading(true);
    try { let value: GitSnapshot; if (quiet) value = await call<GitSnapshot>('git_status', { refresh: true }, projectId); else { const handle = await start<GitSnapshot>('git_status', { refresh: true }, undefined, projectId); if (version === generation.current) setReadTask(handle); value = await handle.result; } if (version !== generation.current || request !== statusRequest.current) return; snapshotRef.current = value; setSnapshot(value); setStale(false); if (!quiet) setError(null); snapshotListener.current?.({ projectId, snapshot: value }); }
    catch (e) { if (version === generation.current && request === statusRequest.current) { setStale(true); if (!quiet) fail(e); } }
    finally { if (version === generation.current && request === statusRequest.current) { refreshing.current = false; setReadTask(null); setLoading(false); } }
  }, [projectId, enabled, fail, setStale]);
  useEffect(() => {
    mounted.current = true;
    generation.current++;
    branchRequest.current++;
    historyRequest.current++;
    compareRequest.current++;
    historyHead.current = null;
    historyPending.current = null;
    branchEdits.current = { remote: false, target: false, compareTarget: false };
    consumedWrite.current = null;
    const pending = writes.get(projectId);
    const base = pending?.pending ? pending.base ?? null : null;
    snapshotRef.current = base;
    setSnapshot(base);
    setReadTask(null);
    setLoading(false);
    setHistoryLoading(false);
    setBranchesLoading(false);
    setCompareLoading(false);
    refreshing.current = false;
    setHistory(null);
    setBranches(null);
    setCompare(null);
    setSelection(null);
    setConflictFile(null);
    setPlan(null);
    setDirtyStage(null);
    setDraft(sessionStorage.getItem(DRAFT + projectId) ?? '');
    setError(null);
    setNotice('');
    setFailedOperation('');
    setRemote('');
    setRemoteBranch('');
    if (base) snapshotListener.current?.({ projectId, snapshot: base });
    if (enabled && !pending) void refresh();
    return () => { mounted.current = false; generation.current++; statusRequest.current++; };
  }, [projectId, enabled]);
  useEffect(() => {
    const current = snapshotRef.current;
    if (sharedSnapshot && current?.repoId === sharedSnapshot.repoId && current.repoToken !== sharedSnapshot.repoToken) acceptSnapshot(sharedSnapshot);
  }, [projectId, sharedSnapshot, snapshot?.repoToken, acceptSnapshot]);
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
  const openDiff = (selection: DiffSelection) => {
    compareRequest.current++;
    setCompareLoading(false);
    setConflictFile(null);
    if (tab === 'branches') setTab('changes');
    const current = snapshotRef.current;
    if (onOpenDiff && current) onOpenDiff({ projectId, selection, snapshot: current, onToggleStage: selection.base === 'commitToParent' ? undefined : () => currentProject.current === projectId ? stagingAction.current(selection.file.fileId, selection.base) : Promise.resolve(false), onRefreshSnapshot: acceptSnapshot });
    else setSelection(selection);
  };
  const run = async (params: Record<string, unknown>, method = 'git_mutate', pushCommitted = false): Promise<boolean> => {
    const base = snapshotRef.current;
    if (!base || writes.has(projectId) || busyRef.current || staleRef.current || !enabled) return false;
    if (['switch', 'pull'].includes(String(params.operation)) || (params.operation === 'createBranch' && params.switchAfter)) {
      const dirty = dirtyFiles(projectId); if (dirty.length) { fail(new Error(`请先保存或关闭 ${dirty.length} 个未保存文件，再切换分支或拉取。`)); return false; }
    }
    const version = generation.current, token = Symbol();
    const currentView = () => version === generation.current && currentProject.current === projectId;
    busyRef.current = true; ++statusRequest.current; ++branchRequest.current; refreshing.current = false; setReadTask(null); setLoading(false); setBranchesLoading(false);
    publishWrite(projectId, { token, pending: true, operation: String(params.operation ?? method), message: params.operation === 'commit' ? String(params.message) : undefined, base, task: null, progress: '等待 Git…', cancelRequested: false });
    setError(null); setFailedOperation(''); setNotice('');
    const execute = async <T,>(taskMethod: string, taskParams: Record<string, unknown>) => {
      if (writes.get(projectId)?.cancelRequested) throw { code: 'CANCELLED', message: '操作已取消' };
      patchWrite(projectId, token, { task: null });
      const handle = await start<T>(taskMethod, taskParams, event => {
        if (event.payload.type === 'progress') patchWrite(projectId, token, { progress: event.payload.phase ?? 'Git 正在处理…' });
      }, projectId);
      patchWrite(projectId, token, { task: handle });
      if (writes.get(projectId)?.cancelRequested) void handle.cancel().catch(() => {});
      return handle.result;
    };
    try {
      let result = await execute<MutationResult>(method, { repoId: base.repoId, expectedRepoToken: base.repoToken, ...params });
      const failures = result.perFile?.filter(f => f.state === 'failed');
      const error = failures?.length ? writeError(new Error(failures.map(f => f.error?.message ?? '部分文件操作失败').join('；'))) : undefined;
      let notice = error ? '' : result.commitOid ? `已提交 ${result.commitOid.slice(0, 9)}，尚未推送。` : '操作已完成。';
      let chooseRemote = false;
      if (!error && pushCommitted && result.commitOid) {
        const committedOid = result.commitOid;
        const committed = result.snapshot;
        const draftCleared = clearCommittedDraft(projectId, String(params.message));
        patchWrite(projectId, token, { operation: 'push', base: committed, draftCleared, progress: '正在确认推送目标…' });
        snapshotListener.current?.({ projectId, snapshot: committed });
        if (currentView()) {
          snapshotRef.current = committed;
          setSnapshot(committed);
          if (draftCleared) setDraft(value => value === params.message ? '' : value);
        }
        const available = await execute<GitBranches>('git_branches', { repoId: committed.repoId });
        if (available.repoToken !== committed.repoToken) throw { code: 'STALE_VERSION', message: '提交已保存，仓库随后发生变化。请刷新并确认推送目标。' };
        const target = resolveRemoteTarget(committed, available.remotes);
        if (target) {
          patchWrite(projectId, token, { progress: '正在推送提交…' });
          result = await execute<MutationResult>('git_mutate', { repoId: committed.repoId, expectedRepoToken: committed.repoToken, operation: 'push', remote: target.remote, sourceRef: committed.head.name, targetRef: target.branch, setUpstream: !committed.upstream });
          notice = `已提交并推送 ${committedOid.slice(0, 9)}。`;
        } else {
          chooseRemote = true;
          notice = '提交已保存在本地，请选择远端与目标分支继续推送。';
        }
      }
      if (currentView()) consumedWrite.current = token;
      settleWrite(projectId, token, { error, notice, stale: false });
      snapshotListener.current?.({ projectId, snapshot: result.snapshot });
      if (!currentView() || writes.get(projectId)?.token !== token) return false;
      snapshotRef.current = result.snapshot; setSnapshot(result.snapshot); setStale(false); ++branchRequest.current;
      if (writes.get(projectId)?.draftCleared) setDraft(value => value === params.message ? '' : value);
      if (error) setError(error); else setNotice(notice);
      if (chooseRemote) selectTab('branches');
      releaseWrite(projectId, token); busyRef.current = false; return !error;
    } catch (error) {
      const operation = writes.get(projectId)?.operation ?? String(params.operation ?? method);
      if (currentView()) consumedWrite.current = token;
      settleWrite(projectId, token, { error: writeError(error), failedOperation: operation, stale: true });
      if (!currentView() || writes.get(projectId)?.token !== token) return false;
      setFailedOperation(operation); fail(error); setStale(true); await refresh(true);
      if (currentView()) { releaseWrite(projectId, token); busyRef.current = false; } return false;
    }
  };
  useEffect(() => {
    if (!enabled || !autoFetch) return;
    const interval = window.setInterval(() => { if (busyRef.current || !snapshotRef.current) return; void call<GitBranches>('git_branches', { repoId: snapshotRef.current.repoId }, projectId).then(b => { if (b.remotes[0]) return run({ operation: 'fetch', remote: b.remotes[0] }); }).catch(fail); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [enabled, autoFetch, projectId]);
  const stageFiles = async (files: GitStatusFile[], diskOnly = false) => {
    if (!files.length) return false;
    const fileIds = files.map(item => item.file.fileId);
    if (!diskOnly && dirtyFiles(projectId).some(buffer => fileIds.includes(buffer.fileId))) {
      setDirtyStage(files);
      return false;
    }
    return run({ operation: 'stage', fileIds, allowDirtyDisk: diskOnly });
  };
  const stageFile = (file: GitStatusFile, diskOnly = false) => stageFiles([file], diskOnly);
  stagingAction.current = async (fileId, base) => { const file = snapshotRef.current?.files.find(item => item.file.fileId === fileId); if (!file || busyRef.current || staleRef.current || !enabled) return false; if (base === 'headToIndex' && staged(file)) return run({ operation: 'unstage', fileIds: [fileId] }); if (base === 'indexToWorktree' && unstaged(file)) return stageFile(file); return false; };
  const discard = async (f: GitStatusFile) => {
    if (!snapshot) return;
    if (dirtyFiles(projectId).some(b => b.fileId === f.file.fileId)) { fail(new Error('此文件有未保存内容。请先保存或关闭该文件，再放弃磁盘更改。')); onOpenFile?.(f.file); return; }
    try { const result = await call<DiscardPlan>('git_discard_plan', { repoId: snapshot.repoId, fileIds: [f.file.fileId], source: 'index' }, projectId); if (currentProject.current === projectId) setPlan(result); } catch (e) { fail(e); }
  };
  const loadHistory = async (more = false) => {
    const base = snapshotRef.current;
    if (!base) return;
    const head = `${base.repoId}:${base.head.oid ?? ''}`;
    const append = more && historyHead.current === head;
    const version = generation.current, request = ++historyRequest.current;
    historyPending.current = head;
    setHistoryLoading(true);
    try {
      const page = await call<Page>('git_history', { repoId: base.repoId, limit: 30, cursor: append ? history?.nextCursor : undefined }, projectId);
      const current = snapshotRef.current;
      if (version !== generation.current || request !== historyRequest.current || !current || `${current.repoId}:${current.head.oid ?? ''}` !== head) return;
      historyHead.current = head;
      setHistory(old => append && old ? { ...page, items: [...old.items, ...page.items] } : page);
    } catch (error) {
      if (version === generation.current && request === historyRequest.current) fail(error);
    } finally {
      if (version === generation.current && request === historyRequest.current) {
        historyPending.current = null;
        setHistoryLoading(false);
      }
    }
  };
  const loadBranches = async () => {
    const base = snapshotRef.current; if (!base || refreshing.current) return;
    const version = generation.current, request = ++branchRequest.current; setBranchesLoading(true);
    try {
      const result = await call<GitBranches>('git_branches', { repoId: base.repoId }, projectId);
      if (version !== generation.current || request !== branchRequest.current || snapshotRef.current?.repoToken !== base.repoToken) return;
      if (result.repoToken !== base.repoToken) { setStale(true); fail({ code: 'STALE_VERSION', message: '仓库已变化，请刷新后重新核对分支与同步目标。' }); return; }
      setBranches(result);
      const target = resolveRemoteTarget(base, result.remotes);
      if (!branchEdits.current.remote) setRemote(target?.remote ?? '');
      if (!branchEdits.current.target) setRemoteBranch(target?.branch ?? '');
      if (!branchEdits.current.compareTarget) setCompareTarget(base.upstream?.name ?? '');
    } catch (e) { if (version === generation.current && request === branchRequest.current) fail(e); }
    finally { if (version === generation.current && request === branchRequest.current) setBranchesLoading(false); }
  };
  useEffect(() => {
    if (!enabled || !snapshot || busy || tab !== 'history') return;
    const head = `${snapshot.repoId}:${snapshot.head.oid ?? ''}`;
    if (historyHead.current !== head && historyPending.current !== head) void loadHistory();
  }, [tab, enabled, snapshot?.repoId, snapshot?.head.oid, history, busy]);
  useEffect(() => { if (enabled && snapshot && !busy && tab === 'branches') void loadBranches(); }, [tab, enabled, snapshot, busy]);
  const showCompare = async (target: string, source?: string, commit?: GitCommit) => {
    const base = snapshotRef.current;
    if (!base) return;
    const version = generation.current, request = ++compareRequest.current;
    const currentView = () => version === generation.current && request === compareRequest.current;
    setCompareLoading(true);
    try {
      const result = await call<Compare>('git_compare', { repoId: base.repoId, target, source }, projectId);
      if (!currentView()) return;
      if (commit && result.items[0]) {
        setHistorySelection(commit.oid);
        const item = result.items[0];
        openDiff({ file: item.file, base: 'commitToParent', commitOid: result.target, parentOid: result.source ?? undefined, originalPath: item.originalPath, commit, commitFiles: result.items });
      } else {
        setTab('changes');
        setCompare({ ...result, commit });
      }
    } catch (error) { if (currentView()) fail(error); }
    finally { if (currentView()) setCompareLoading(false); }
  };
  const selectTab = (value: typeof tab) => {
    compareRequest.current++;
    setCompareLoading(false);
    setTab(value);
  };
  const runRemote = async (operation: 'fetch' | 'pull' | 'push') => {
    const base = snapshotRef.current;
    if (!base || busyRef.current || stale) return false;
    const version = generation.current;
    const currentView = () => generation.current === version && currentProject.current === projectId;
    try {
      const available = await call<GitBranches>('git_branches', { repoId: base.repoId }, projectId);
      if (!currentView() || snapshotRef.current?.repoToken !== base.repoToken) return false;
      if (available.repoToken !== base.repoToken) {
        await refresh();
        if (currentView()) setNotice('仓库状态已更新，请确认后重试。');
        return false;
      }
      const target = resolveRemoteTarget(base, available.remotes);
      if (!target) {
        selectTab('branches');
        return false;
      }
      if (operation === 'fetch') return run({ operation, remote: target.remote });
      if (operation === 'pull') return run({ operation, remote: target.remote, branch: target.branch, strategy: 'ffOnly' });
      return run({ operation, remote: target.remote, sourceRef: base.head.name, targetRef: target.branch, setUpstream: !base.upstream });
    } catch (error) { if (currentView()) fail(error); return false; }
  };
  const commit = async () => {
    if (!snapshot || !draft.trim()) return;
    await run({ operation: 'commit', message: draft, stagedFileIds: snapshot.files.filter(staged).map(file => file.file.fileId) }, 'git_mutate', pushAfterCommit);
  };
  const group = (title: string, items: GitStatusFile[], index: boolean) => {
    const key = index ? 'index' : 'disk';
    const page = Math.min(filePages[key], Math.max(0, Math.ceil(items.length / 100) - 1));
    const toggleAll = () => index
      ? void run({ operation: 'unstage', fileIds: items.map(item => item.file.fileId) })
      : void stageFiles(items);
    return <section className="git-file-group">
      <h3 title={index ? 'HEAD → 暂存区' : '暂存区 → 磁盘'}>
        <span>{title}<span className="git-group-count">{items.length}</span></span>
        {items.length ? <button className="git-group-action" disabled={busy || stale || snapshot?.truncated} onClick={toggleAll} aria-label={index ? '全部取消暂存' : '全部暂存'} title={index ? '全部取消暂存' : '全部暂存'}>{index ? '−' : <Plus size={14} />}</button> : null}
      </h3>
      {items.slice(page * 100, (page + 1) * 100).map(file => <div className="git-file-row" key={`${key}-${file.file.fileId}`}>
        <button className="git-file-name" title={file.originalPath ? `${file.originalPath} → ${file.file.displayPath}` : file.file.displayPath} onClick={() => openDiff({ file: file.file, base: index ? 'headToIndex' : 'indexToWorktree', originalPath: file.originalPath })}>
          <span className="git-file-type">{file.file.displayPath.endsWith('.ts') || file.file.displayPath.endsWith('.tsx') ? 'TS' : file.file.displayPath.endsWith('.css') ? '#' : '·'}</span>
          <span className="git-file-label">{file.file.displayPath.split('/').at(-1)}<small>{file.file.displayPath.includes('/') ? file.file.displayPath.slice(0, file.file.displayPath.lastIndexOf('/')) : ''}</small></span>
          <span className="git-status-code">{file.kind === 'untracked' ? '?' : index ? file.index : file.worktree}</span>
        </button>
        <button disabled={busy || stale || snapshot?.truncated} title={`${index ? '取消暂存' : '暂存磁盘内容'} ${file.file.displayPath}`} aria-label={`${index ? '取消暂存' : '暂存'} ${file.file.displayPath}`} onClick={() => index ? void run({ operation: 'unstage', fileIds: [file.file.fileId] }) : void stageFile(file)}>{index ? '−' : '+'}</button>
        {!index ? <button className="git-danger-text" disabled={busy || stale} title={`放弃 ${file.file.displayPath} 的未暂存更改`} aria-label={`放弃 ${file.file.displayPath} 的未暂存更改`} onClick={() => void discard(file)}>↶</button> : null}
      </div>)}
      {items.length > 100 ? <div className="git-list-pages">
        <button aria-label={`${title}上一页`} disabled={page === 0} onClick={() => setFilePages(pages => ({ ...pages, [key]: page - 1 }))}>‹</button>
        <span>{page + 1}/{Math.ceil(items.length / 100)}</span>
        <button aria-label={`${title}下一页`} disabled={(page + 1) * 100 >= items.length} onClick={() => setFilePages(pages => ({ ...pages, [key]: page + 1 }))}>›</button>
      </div> : null}
    </section>;
  };
  const stop = () => stopWrite(projectId);
  if (!enabled) return <div className="git-panel"><p className="git-empty">Git 扩展未启用。可在插件中心恢复。</p></div>;
  const pushFailed = !!error && failedOperation === 'push';
  const remoteAvailable = !!remote && branches?.repoToken === snapshot?.repoToken && !!branches?.remotes.includes(remote);
  const noRepository = !snapshot && error?.code === 'NOT_FOUND' && error.message.includes('不是 Git 仓库');
  const conflictTarget = conflictTargetId ? document.getElementById(conflictTargetId) : null;
  const conflictContent = snapshot && conflictFile ? <ConflictViewer inline={!!conflictTarget} projectId={projectId} file={conflictFile} snapshot={snapshot} busy={busy} onStop={task ? stop : undefined} stopping={cancelRequested} error={error ? errorSummary[error.code] ?? error.message : undefined} progress={progress} onClose={() => setConflictFile(null)} onOpenFile={onOpenFile ? () => { onOpenFile(conflictFile); setConflictFile(null); } : undefined} onChoose={choice => { if (dirtyFiles(projectId).some(b => b.fileId === conflictFile.fileId)) { fail(new Error('请先保存或关闭此文件的未保存内容。')); return; } void run({ fileId: conflictFile.fileId, choice }, 'git_conflict_resolve'); }} onStage={() => { const f = snapshot.files.find(f => f.file.fileId === conflictFile.fileId); if (f) void stageFile(f).then(ok => { if (ok) setConflictFile(null); }); }} /> : null;
  const conflicts = snapshot?.files.filter(file => file.kind === 'unmerged') ?? [];
  const stagedFiles = snapshot?.files.filter(staged) ?? [];
  const unstagedFiles = snapshot?.files.filter(unstaged) ?? [];
  const canCommit = !!snapshot && !busy && !stale && !!draft.trim() && !!stagedFiles.length && !conflicts.length && !snapshot.truncated;
  const branchLabel = snapshot?.head.state === 'detached' ? `HEAD · ${snapshot.head.oid?.slice(0, 8)}` : snapshot?.head.name ?? '检测仓库…';
  return <div className="git-panel" aria-label="Git 源代码管理">
    <header className="git-repository-header">
      <button className="git-branch-picker" onClick={() => selectTab('branches')} disabled={!snapshot || busy} title={snapshot?.rootDisplayPath ? `${snapshot.rootDisplayPath} · 管理分支` : '管理分支'} aria-label={`管理分支 ${branchLabel}`}>
        <GitBranch size={15} /><span>{branchLabel}</span><ChevronDown size={12} />
      </button>
      <button className="git-header-action" onClick={() => { if (loading && readTask) void readTask.cancel().catch(fail); else void refresh(); }} disabled={busy || (loading && !readTask)} aria-label={loading ? '停止刷新 Git 状态' : '刷新 Git 状态'} title={loading ? '停止刷新 Git 状态' : '刷新 Git 状态'} aria-busy={loading}><RefreshIcon spinning={loading} /></button>
    </header>
    {snapshot?.head.state === 'unborn' ? <p className="git-initial-branch">尚无提交</p> : null}
    {snapshot?.head.state === 'branch' ? <div className="git-remote-bar">
      <span className="git-upstream" title={snapshot.upstream?.name}>{snapshot.upstream?.name ?? '尚未发布'}</span>
      {snapshot.upstream ? <div className="git-remote-actions">
        <button disabled={busy || stale} onClick={() => void runRemote('fetch')} aria-label="获取远端更新" title="获取远端更新"><Download size={13} /></button>
        <button disabled={busy || stale} onClick={() => void runRemote('pull')} title="仅快进拉取跟踪分支" aria-label={`拉取 ${snapshot.upstream.behind ?? '未知数量'} 个提交`}><ArrowDown size={12} /><span>{snapshot.upstream.behind ?? '—'}</span></button>
        <button disabled={busy || stale} onClick={() => void runRemote('push')} title="推送到跟踪分支" aria-label={`推送 ${snapshot.upstream.ahead ?? '未知数量'} 个提交`}><ArrowUp size={12} /><span>{snapshot.upstream.ahead ?? '—'}</span></button>
      </div> : <button className="git-publish-action" disabled={busy || stale} onClick={() => void runRemote('push')}><CloudUpload size={13} />发布分支</button>}
    </div> : null}
    {snapshot ? <nav className="git-view-tabs" aria-label="Git 视图">
      <button aria-pressed={tab !== 'history'} onClick={() => selectTab('changes')}>更改<span>{snapshot.files.length}</span></button>
      <button aria-pressed={tab === 'history'} onClick={() => selectTab('history')}><History size={13} />历史</button>
    </nav> : null}
    {snapshot && tab !== 'history' ? <form className="git-commit" onSubmit={event => { event.preventDefault(); if (canCommit) void commit(); }}>
      <label htmlFor="git-commit-message">提交说明</label>
      <textarea id="git-commit-message" rows={2} value={draft} placeholder={`提交到 ${snapshot.head.name ?? 'HEAD'}（⌘/Ctrl + Enter）`} onChange={event => writeDraft(event.target.value)} onKeyDown={event => { if (event.nativeEvent.isComposing) return; if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); if (canCommit) void commit(); } }} />
      <div className="git-commit-actions">
        <button className="git-primary" type="submit" disabled={!canCommit}><Check size={14} />{busy && write?.operation === 'commit' ? '提交中…' : pushAfterCommit ? '提交并推送' : '提交'}{stagedFiles.length ? <span className="git-commit-count">{stagedFiles.length}</span> : null}</button>
        <details className="git-commit-menu" ref={commitMenu} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
          <summary aria-label="选择提交方式" title="选择提交方式" onClick={event => { if (busy) event.preventDefault(); }}><ChevronDown size={14} /></summary>
          <div className="git-commit-options">
            <button type="button" disabled={busy} aria-pressed={!pushAfterCommit} onClick={() => { setCommitAction('commit'); if (commitMenu.current) commitMenu.current.open = false; }}><Check size={14} />提交</button>
            <button type="button" disabled={busy || snapshot.head.state !== 'branch'} aria-pressed={pushAfterCommit} onClick={() => { setCommitAction('push'); if (commitMenu.current) commitMenu.current.open = false; }}><ArrowUp size={14} />提交并推送</button>
          </div>
        </details>
      </div>
      <span className="git-commit-scope">{stagedFiles.length ? `${stagedFiles.length} 个已暂存文件` : '选择更改旁的 + 暂存文件'}</span>
    </form> : null}
    <div className="git-panel-body">
      <div className="git-content-scroll">
        {noRepository ? <section className="git-repository-empty" aria-label="未发现 Git 仓库">
          <span className="git-repository-symbol" aria-hidden="true"><GitBranch size={19} /></span>
          <h3>尚未发现 Git 仓库</h3>
          <p>当前目录未启用 Git。<br />可添加已有仓库的根目录。</p>
          <button onClick={() => void refresh()} disabled={loading} aria-busy={loading}><RefreshIcon spinning={loading} />重新检测</button>
        </section> : null}
        {snapshot && tab !== 'history' ? <>
          {conflicts.length ? <section className="git-file-group"><h3><span>冲突<span className="git-group-count">{conflicts.length}</span></span></h3>{conflicts.map(file => <button className="git-conflict-file" key={file.file.fileId} onClick={() => setConflictFile(file.file)}>! {file.file.displayPath}</button>)}</section> : null}
          {stagedFiles.length ? group('已暂存', stagedFiles, true) : null}
          {unstagedFiles.length ? group('更改', unstagedFiles, false) : null}
          {!snapshot.files.length ? <div className="git-clean-state"><Check size={22} /><strong>工作区干净</strong><p>{snapshot.upstream?.ahead ? `${snapshot.upstream.ahead} 个提交待推送` : '所有更改均已提交'}</p></div> : null}
        </> : null}
        {snapshot && tab === 'history' ? <section className="git-history" aria-busy={historyLoading || compareLoading}>
          <div className="git-history-heading"><span>{historyLoading ? '读取历史…' : compareLoading ? '读取提交差异…' : '提交记录'}</span><button onClick={() => void loadHistory()} disabled={historyLoading} aria-label="刷新提交历史" aria-busy={historyLoading}><RefreshIcon spinning={historyLoading} /></button></div>
          {history?.shallow ? <p className="git-hint">浅克隆：只显示本地已有历史。</p> : null}
          {history?.items.map(item => <button key={item.oid} className="git-history-item" aria-pressed={historySelection === item.oid} onClick={() => void showCompare(item.oid, undefined, item)}><strong>{item.subject}</strong><span>{item.author} · {item.oid.slice(0, 7)}</span><time dateTime={item.time}>{new Date(item.time).toLocaleDateString()}</time></button>)}
          {history && !history.items.length ? <p className="git-empty">尚无提交。</p> : null}
          {history?.nextCursor ? <button className="git-load-more" disabled={historyLoading} onClick={() => void loadHistory(true)}>{historyLoading ? '读取中…' : '加载更多历史'}</button> : null}
          {!history && historyLoading ? <p className="git-empty">读取历史…</p> : null}
        </section> : null}
      </div>
      <div className="git-panel-feedback">
        {!noRepository && error && (tab !== 'branches' || !snapshot) && !plan && !dirtyStage && !conflictFile ? <div className="git-error" role="alert"><ErrorContent error={error} /><div className="git-error-actions"><button onClick={() => void refresh()} disabled={loading}><RefreshIcon spinning={loading} />刷新状态</button><button onClick={() => setError(null)}>关闭</button></div></div> : null}
        {notice ? <div className="git-notice" role="status"><span>{notice}</span><button aria-label="关闭 Git 提示" onClick={() => setNotice('')}><X size={12} /></button></div> : null}
        {!autoRefresh ? <p className="git-hint">自动刷新已暂停</p> : null}
        {stale && snapshot ? <p className="git-warning">当前快照已过期，请刷新后操作。</p> : null}
        {snapshot?.operation ? <p className="git-warning">{snapshot.operation === 'merge' ? '正在合并。解决并暂存全部冲突后，可在此提交完成合并。' : `正在 ${snapshot.operation}。请处理冲突；继续/中止该流程请使用外部 Git。`}</p> : null}
        {busy ? <div className="git-progress" role="status"><span>{progress}</span><button disabled={!task || cancelRequested} onClick={stop}>{cancelRequested ? '正在停止…' : '停止'}</button></div> : null}
        {loading && readTask && !snapshot && !noRepository ? <div className="git-progress" role="status"><span>读取真实仓库状态…</span><button onClick={() => void readTask.cancel().catch(fail)}>停止读取</button></div> : null}
        {snapshot?.truncated ? <p className="git-warning">更改超过 10,000 项，仅显示部分文件。请在外部 Git 缩小范围后操作。</p> : null}
      </div>
    </div>
    {snapshot && tab === 'branches' ? <GitModal title={pushFailed ? '推送未完成' : '分支与同步'} onClose={() => selectTab('changes')} busy={busy} onStop={task ? stop : undefined} stopping={cancelRequested}>
      <div className="git-panel-feedback">
        {error ? <div className="git-error" role="alert"><ErrorContent error={error} /></div> : null}
        {busy ? <p className="git-progress" role="status">{progress || 'Git 正在处理…'}</p> : null}
      </div>
      <section className="git-branches" aria-busy={branchesLoading || compareLoading}>
      {pushFailed ? <><h3 className="git-sync-state-title">当前状态</h3><div className="git-sync-state-row"><span>本地分支</span><span>{snapshot.head.name ?? '分离 HEAD'}{snapshot.upstream ? ` · 领先 ${snapshot.upstream.ahead ?? '?'}` : ''}</span></div><div className="git-sync-state-row"><span>远端分支</span><span>{remote}/{remoteBranch}{snapshot.upstream ? ` · 落后 ${snapshot.upstream.behind ?? '?'}` : ''}</span></div><footer className="git-toolbar"><button disabled={busy} onClick={() => setTab('changes')}>稍后处理</button><button className="git-primary" disabled={busy || stale || !remoteAvailable} onClick={() => void run({ operation: 'fetch', remote })}>获取并检查</button></footer></> : <>
      <label>查找分支<input value={branchFilter} onChange={e => setBranchFilter(e.target.value)} placeholder="分支名称" /></label>{branches?.items.filter(b => b.name.toLowerCase().includes(branchFilter.toLowerCase())).map(branch => <div className={`git-branch-row${branch.current ? ' current' : ''}`} key={branch.name}><GitBranch size={16} /><span title={branch.oid}>{branch.name}<small>{branch.remote ? '远端分支' : branch.current ? `当前分支${branch.upstream ? ` · 跟踪 ${branch.upstream}` : ''}` : '本地分支'}</small></span>{branch.current ? <Check size={16} /> : null}{!branch.remote && !branch.current ? <button disabled={busy || stale} onClick={() => void run({ operation: 'switch', branch: branch.name })}>切换</button> : null}</div>)}
      <details><summary>新建分支</summary><form onSubmit={e => { e.preventDefault(); void run({ operation: 'createBranch', name: newBranch, startOid: startPoint, switchAfter }).then(ok => { if (ok) setNewBranch(''); }); }}><label>新分支名<input value={newBranch} onChange={e => setNewBranch(e.target.value)} required /></label><label>起点<input value={startPoint} onChange={e => setStartPoint(e.target.value)} required /></label><label className="git-check"><input type="checkbox" checked={switchAfter} onChange={e => setSwitchAfter(e.target.checked)} />创建后切换</label><button disabled={busy || stale || !newBranch.trim() || snapshot.head.state === 'unborn'}>创建分支</button></form></details>
      <section className="git-sync"><h3>远端同步</h3>{snapshot.upstream ? <p className="git-hint">{snapshot.upstream.name} · 领先 {snapshot.upstream.ahead ?? '?'} / 落后 {snapshot.upstream.behind ?? '?'}</p> : <p className="git-hint">尚未设置上游。请明确选择远端与目标分支。</p>}<label>远端<select value={remote} onChange={e => { branchEdits.current.remote = true; setRemote(e.target.value); }}><option value="">选择远端</option>{remote && branches && !branches.remotes.includes(remote) ? <option value={remote}>{remote} · 已移除</option> : null}{branches?.remotes.map(r => <option key={r}>{r}</option>)}</select></label><label>目标分支<input value={remoteBranch} onChange={e => { branchEdits.current.target = true; setRemoteBranch(e.target.value); }} /></label>{branches && !branches.remotes.length ? <p className="git-hint">尚未配置远端。可用外部 Git 添加 remote 后刷新。</p> : null}<div className="git-toolbar"><button disabled={busy || stale || !remoteAvailable} onClick={() => void run({ operation: 'fetch', remote })}>获取</button><button disabled={busy || stale || !remoteAvailable || !remoteBranch} onClick={() => void run({ operation: 'pull', remote, branch: remoteBranch, strategy: 'ffOnly' })}>仅快进拉取</button><button disabled={busy || stale || !remoteAvailable || !remoteBranch || snapshot.head.state !== 'branch'} onClick={() => void run({ operation: 'push', remote, sourceRef: snapshot.head.name, targetRef: remoteBranch, setUpstream: !snapshot.upstream })}>推送 {snapshot.head.name ?? 'HEAD'}</button></div><p className="git-hint">目标：{remote || '未选择远端'} / {remoteBranch || '未选择分支'}。推送不强制覆盖历史。</p></section>
      <details><summary>比较两个引用</summary><form onSubmit={e => { e.preventDefault(); void showCompare(compareTarget, compareSource); }}><label>起点<input value={compareSource} onChange={e => setCompareSource(e.target.value)} /></label><label>终点<input value={compareTarget} onChange={e => { branchEdits.current.compareTarget = true; setCompareTarget(e.target.value); }} /></label><button disabled={compareLoading || !compareSource || !compareTarget}>{compareLoading ? '读取差异…' : '比较差异'}</button></form></details>
    </>} </section></GitModal> : null}
    {snapshot && selection ? <DiffViewer projectId={projectId} selection={selection} snapshot={snapshot} onToggleStage={selection.base === 'commitToParent' ? undefined : () => stagingAction.current(selection.file.fileId, selection.base)} onRefreshSnapshot={acceptSnapshot} onClose={() => setSelection(null)} onOpenFile={onOpenFile ? () => { onOpenFile(selection.file); setSelection(null); } : undefined} /> : null}
    {conflictTarget && conflictContent ? createPortal(conflictContent, conflictTarget) : conflictContent}
    {plan ? <GitModal title="放弃未暂存更改" onClose={() => setPlan(null)} busy={busy} onStop={task ? stop : undefined} stopping={cancelRequested}><p>已跟踪文件恢复到暂存区，已暂存内容保留。未跟踪文件移到废纸篓。</p>{error ? <div className="git-error" role="alert"><ErrorContent error={error} /></div> : null}{busy ? <p className="git-progress" role="status">{progress || '正在处理…'}</p> : null}<ul className="git-discard-files">{plan.files.map(f => <li key={f.fileId}><code>{f.file.displayPath}</code><span>{f.operation === 'trash' ? '未跟踪文件 · 移到废纸篓' : '未暂存更改 · 恢复到暂存区'}</span></li>)}</ul><footer className="git-toolbar"><button autoFocus data-initial-focus disabled={busy} onClick={() => setPlan(null)}>取消</button><button className="git-danger" disabled={busy} onClick={() => void run({ operation: 'discard', planId: plan.planId, planDigest: plan.digest, expectedRepoToken: plan.repoToken }).then(ok => { if (ok) setPlan(null); })}>放弃清单中的未暂存更改</button></footer></GitModal> : null}
    {dirtyStage ? <GitModal title="文件有未保存内容" onClose={() => setDirtyStage(null)}>
      <p>{dirtyStage.length === 1 ? dirtyStage[0].file.displayPath : `选中的 ${dirtyStage.length} 个文件中有未保存内容`}。请选择暂存来源。</p>
      {error ? <div className="git-error" role="alert"><ErrorContent error={error} /></div> : null}
      <footer className="git-toolbar">
        <button autoFocus data-initial-focus onClick={() => setDirtyStage(null)}>取消</button>
        <button onClick={() => { const files = dirtyStage; setDirtyStage(null); void stageFiles(files, true); }}>仅暂存磁盘内容</button>
        <button className="git-primary" onClick={() => {
          const files = dirtyStage;
          const fileIds = files.map(file => file.file.fileId);
          const version = generation.current;
          const currentView = () => generation.current === version && currentProject.current === projectId;
          void Promise.all(dirtyFiles(projectId).filter(buffer => fileIds.includes(buffer.fileId)).map(buffer => editorStore.save(buffer.fileId, projectId))).then(async saved => {
            if (!currentView() || saved.some(value => !value) || dirtyFiles(projectId).some(buffer => fileIds.includes(buffer.fileId))) return;
            setDirtyStage(null);
            await refresh();
            if (currentView()) await stageFiles(files);
          }).catch(error => { if (currentView()) fail(error); });
        }}>保存后暂存</button>
      </footer>
    </GitModal> : null}
    {compare ? <GitModal title={compare.source ? '引用比较' : `提交 ${compare.target.slice(0, 9)}`} onClose={() => setCompare(null)}><p className="git-hint">{compare.source?.slice(0, 12) ?? '父提交'} → {compare.target.slice(0, 12)}</p>{compare.items.map(item => <button className="git-history-file" key={item.file.fileId} onClick={() => { openDiff({ file: item.file, base: 'commitToParent', commitOid: compare.target, parentOid: compare.source ?? undefined, originalPath: item.originalPath, commitFiles: compare.items }); setCompare(null); }}>{item.status} {item.file.displayPath}</button>)}{!compare.items.length ? <p className="git-empty">没有文件差异。</p> : null}{compare.truncated ? <p className="git-warning">列表过大，仅显示部分结果。</p> : null}</GitModal> : null}
  </div>;
}
