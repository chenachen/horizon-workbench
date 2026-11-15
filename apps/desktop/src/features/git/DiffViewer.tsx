import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Columns2, FileCode2, FoldVertical, List, Minus, Plus, UnfoldVertical, X } from 'lucide-react';
import { call, errorMessage, start, subscribe, type TaskHandle } from '../../bridge';
import { usePluginEnabled } from '../plugins/service';
import { useSettings } from '../settings/AppearanceProvider';
import { GitModal } from './Modal';
import { FullFileDiff, type FullFileDiffHandle } from './FullFileDiff';
import { parseDiff } from './diffModel';
import type { DiffSelection, GitDiff, GitSnapshot } from './types';

const SOURCE: Record<string, [string, string]> = { indexToWorktree: ['暂存区', '磁盘文件'], headToIndex: ['HEAD', '暂存区'], commitToParent: ['父提交', '所选提交'] };
type PatchPage = { patch: string; nextCursor: string | null };

export type DiffSelectionProps = { projectId: string; selection: DiffSelection; snapshot: GitSnapshot; onClose(): void; onToggleStage?: () => void; onRefreshSnapshot?: (snapshot: GitSnapshot) => void; onOpenFile?: (file: DiffSelection['file']) => void };
export function DiffViewer(props: DiffSelectionProps) { return <GitModal title={props.selection.file.displayPath} wide onClose={props.onClose}><GitDiffSurface {...props} /></GitModal>; }
type DiffViewState = {
  key: string;
  diff: GitDiff | null;
  patch: string;
  loading: boolean;
  error: string;
  stale: boolean;
  contextNotice: string;
};
const EMPTY_VIEW: DiffViewState = {
  key: '', diff: null, patch: '',
  loading: true, error: '', stale: false, contextNotice: '',
};

export function GitDiffSurface({ projectId, selection: requestedSelection, snapshot, onClose, onOpenFile, onToggleStage, onRefreshSnapshot }: DiffSelectionProps) {
  const enabled = usePluginEnabled('horizon.git', projectId);
  const requestedKey = JSON.stringify([projectId, snapshot.repoId, requestedSelection.file.fileId, requestedSelection.base, requestedSelection.commitOid, requestedSelection.parentOid, requestedSelection.originalPath]);
  const [historyFile, setHistoryFile] = useState<{ key: string; fileId: string } | null>(null);
  const historyItem = historyFile?.key === requestedKey ? requestedSelection.commitFiles?.find(item => item.file.fileId === historyFile.fileId) : undefined;
  const selection = historyItem ? { ...requestedSelection, ...historyItem } : requestedSelection;
  const selectionKey = JSON.stringify([projectId, snapshot.repoId, selection.file.fileId, selection.base, selection.commitOid, selection.parentOid, selection.originalPath]);
  const [view, setView] = useState<DiffViewState>(EMPTY_VIEW);
  const current = view.key === selectionKey ? view : EMPTY_VIEW;
  const { diff, patch, loading, error, stale, contextNotice } = current;
  const model = useMemo(() => parseDiff(patch), [patch]);
  const fullFile = useRef<FullFileDiffHandle>(null);
  const [hideUnchanged, setHideUnchanged] = useState(false);
  const [navigation, setNavigation] = useState({ key: '', index: 0 });
  const activeChange = navigation.key === selectionKey ? Math.min(navigation.index, Math.max(0, model.changes - 1)) : 0;
  const navigate = (direction: number) => {
    if (!model.changes) return;
    const index = (activeChange + direction + model.changes) % model.changes;
    setNavigation({ key: selectionKey, index });
    fullFile.current?.revealChange(index);
  };
  const [staging, setStaging] = useState(false);
  const { settings, refresh: refreshSettings } = useSettings();
  const [split, setSplit] = useState(() => settings?.effective['git.diffView'] !== 'inline');
  const [savingMode, setSavingMode] = useState(false);
  const savingModeRef = useRef(false);
  useEffect(() => { if (settings) setSplit(settings.effective['git.diffView'] !== 'inline'); }, [settings?.effective['git.diffView']]);
  const updateView = (changes: Partial<DiffViewState>) => setView(value => value.key === selectionKey ? { ...value, ...changes } : value);
  const toggleMode = async () => {
    if (savingModeRef.current) return;
    savingModeRef.current = true;
    setSavingMode(true);
    const previous = split, next = !split;
    setSplit(next);
    try {
      const current = await call<{ revision: number }>('settings_get', {});
      await call('settings_patch', { scope: 'global', expectedRevision: current.revision, set: { 'git.diffView': next ? 'split' : 'inline' }, unset: [] });
      await refreshSettings();
      window.dispatchEvent(new Event('horizon:settings-changed'));
    } catch (cause) { setSplit(previous); updateView({ error: errorMessage(cause) }); }
    finally { savingModeRef.current = false; setSavingMode(false); }
  };
  const host = useRef<HTMLDivElement>(null), [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!host.current) return;
    setWidth(host.current.getBoundingClientRect().width);
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const request = useRef(0);
  const readTask = useRef<TaskHandle<GitDiff> | null>(null);
  const contextTask = useRef<TaskHandle<GitDiff> | null>(null);
  const [addingContext, setAddingContext] = useState(false);
  const load = async (fresh = false) => {
    const version = ++request.current;
    void contextTask.current?.cancel().catch(() => {});
    contextTask.current = null;
    setAddingContext(false);
    void readTask.current?.cancel().catch(() => {});
    readTask.current = null;
    setView(value => {
      const retained = value.key === selectionKey ? value : EMPTY_VIEW;
      const changed = selection.base !== 'commitToParent' && !!retained.diff && (fresh || retained.diff.repoToken !== snapshot.repoToken);
      return { ...retained, key: selectionKey, loading: true, error: '', contextNotice: '', stale: retained.stale || changed };
    });
    try {
      const repository = fresh ? await call<GitSnapshot>('git_status', { refresh: true }, projectId) : snapshot;
      if (version !== request.current) return;
      const handle = await start<GitDiff>('git_diff', { repoId: repository.repoId, fileId: selection.file.fileId, base: selection.base, fullContext: true, commitOid: selection.commitOid, parentOid: selection.parentOid, originalPath: selection.originalPath, expectedRepoToken: selection.base === 'commitToParent' ? undefined : repository.repoToken }, undefined, projectId);
      if (version !== request.current) { void handle.cancel().catch(() => {}); return; }
      readTask.current = handle;
      const value = await handle.result;
      if (version !== request.current) return;
      const chunks = [value.patch ?? ''];
      let cursor = value.nextCursor;
      while (cursor) {
        const page = await call<PatchPage>('git_diff_page', { diffId: value.diffId, cursor }, projectId);
        if (version !== request.current) return;
        chunks.push(page.patch);
        cursor = page.nextCursor;
      }
      setView({ ...EMPTY_VIEW, key: selectionKey, diff: value, patch: chunks.join(''), loading: false });
      if (fresh) onRefreshSnapshot?.(repository);
    } catch (cause) {
      if (version === request.current) updateView({ error: errorMessage(cause) });
    } finally {
      if (version === request.current) {
        readTask.current = null;
        updateView({ loading: false });
      }
    }
  };
  const repoToken = selection.base === 'commitToParent' ? undefined : snapshot.repoToken;
  useEffect(() => {
    if (enabled) {
      const loaded = view.key === selectionKey && !view.loading && !view.stale && view.diff?.repoToken === snapshot.repoToken;
      if (!loaded) void load();
    }
    else setView({ ...EMPTY_VIEW, key: selectionKey, loading: false });
    return () => { request.current++; void readTask.current?.cancel().catch(() => {}); readTask.current = null; void contextTask.current?.cancel().catch(() => {}); contextTask.current = null; };
  }, [enabled, selectionKey, repoToken]);
  useEffect(() => {
    if (!enabled || selection.base === 'commitToParent') return;
    let active = true;
    let close: (() => Promise<unknown>) | undefined;
    void subscribe(['horizon.git.v1'], () => { if (active) updateView({ stale: true }); }, projectId)
      .then(subscription => { if (active) close = subscription.close; else void subscription.close(); }).catch(() => {});
    return () => { active = false; void close?.(); };
  }, [enabled, selectionKey]);
  const stopRead = () => {
    request.current++;
    void readTask.current?.cancel().catch(() => {});
    readTask.current = null;
    updateView({ loading: false, error: '读取已停止。' });
  };
  const changes = { added: diff?.added ?? model.added, removed: diff?.removed ?? model.removed };
  const selectedStatus = snapshot.files.find(item => item.file.fileId === selection.file.fileId);
  const deleted = selection.base === 'commitToParent' ? requestedSelection.commitFiles?.find(item => item.file.fileId === selection.file.fileId)?.status === 'D' : selectedStatus?.worktree === 'D' || (selection.base === 'headToIndex' && selectedStatus?.index === 'D');
  const canToggleStage = !!selectedStatus && selectedStatus.kind !== 'unmerged' && !snapshot.truncated && (selection.base === 'headToIndex' ? !['.', ' ', '?'].includes(selectedStatus.index) : !['.', ' '].includes(selectedStatus.worktree));
  const toggleStage = async () => {
    setStaging(true);
    try { await onToggleStage?.(); }
    catch (cause) { updateView({ error: errorMessage(cause) }); }
    finally { setStaging(false); }
  };
  const labels = selection.parentOid ? ['比较起点', '比较终点'] : SOURCE[selection.base];
  const effectiveSplit = split && width >= 800;
  const addContext = async () => {
    if (!diff || loading || stale || addingContext) return;
    const version = request.current;
    setAddingContext(true);
    try {
      const handle = await start<GitDiff>('git_diff', { repoId: snapshot.repoId, fileId: selection.file.fileId, base: selection.base, fullContext: false, commitOid: selection.commitOid, parentOid: selection.parentOid, originalPath: selection.originalPath, expectedRepoToken: selection.base === 'commitToParent' ? undefined : diff.repoToken }, undefined, projectId);
      if (version !== request.current) { void handle.cancel().catch(() => {}); return; }
      contextTask.current = handle;
      const contextDiff = await handle.result;
      if (version !== request.current) return;
      const agent = await import('../agent/store');
      if (version !== request.current) return;
      agent.queueAgentContext(projectId, { key: diff.diffId, label: `${selection.file.displayPath} · ${labels[0]} → ${labels[1]}`, source: 'gitDiff', fileId: selection.file.fileId, diffId: contextDiff.diffId, expectedRepoToken: contextDiff.repoToken, byteLength: Number(contextDiff.byteLength) });
      updateView({ contextNotice: '已加入 AI 待发送上下文。' });
    } catch (cause) { if (version === request.current) updateView({ error: errorMessage(cause) }); }
    finally { if (version === request.current) { contextTask.current = null; setAddingContext(false); } }
  };
  return <div className="git-diff-surface" ref={host}>
    <div className="git-review-tabs"><div className="git-review-tab" aria-current="page"><FileCode2 size={14} /><span>{selection.file.displayPath.split('/').at(-1)}</span><button aria-label="关闭差异" onClick={onClose}><X size={12} /></button></div></div>
    {selection.commit ? <section className="git-commit-detail"><h2>{selection.commit.subject}</h2><p>{selection.commit.author} · {selection.commit.oid.slice(0, 9)} · {new Date(selection.commit.time).toLocaleString()}</p><div className="git-commit-files" aria-label="提交中的文件">{selection.commitFiles?.map(item => <button key={item.file.fileId} title={item.file.displayPath} aria-pressed={item.file.fileId === selection.file.fileId} onClick={() => setHistoryFile({ key: requestedKey, fileId: item.file.fileId })}>{item.status} {item.file.displayPath}</button>)}</div></section> : null}
    <header className="git-diff-header">
      <span className="git-diff-filename" title={selection.file.displayPath}>{selection.file.displayPath}</span>
      <span className="git-diff-baseline">{selection.base === 'headToIndex' ? '已暂存更改' : selection.base === 'indexToWorktree' ? '未暂存更改' : '提交差异'}</span>
      <span className="git-diff-counts" style={{ visibility: diff && !diff.binary ? 'visible' : 'hidden' }} title={diff?.truncated ? '已加载内容中的改动行数' : '改动行数'}><span>+{changes.added}</span><span>−{changes.removed}</span></span>
      <span className="git-spacer" />
      <button aria-label={hideUnchanged ? '展开全部未更改区域' : '折叠未更改区域'} title={hideUnchanged ? '展开全部未更改区域' : '折叠未更改区域'} aria-pressed={hideUnchanged} disabled={!model.changes} onClick={() => { fullFile.current?.resetExpanded(); setHideUnchanged(value => !value); }}>{hideUnchanged ? <UnfoldVertical size={16} /> : <FoldVertical size={16} />}</button>
      <button title={split && !effectiveSplit ? '首选并排；当前宽度使用行内显示' : '切换差异显示方式'} aria-label="切换行内或并排差异" aria-pressed={split} disabled={savingMode} aria-busy={savingMode} onClick={toggleMode}>{effectiveSplit ? <Columns2 size={16} /> : <List size={16} />}</button>
      {onToggleStage && selection.base !== 'commitToParent' ? <button className="git-stage-action" aria-label={selection.base === 'headToIndex' ? '取消暂存' : '暂存文件'} title={selection.base === 'headToIndex' ? '取消暂存' : '暂存文件'} disabled={!enabled || !canToggleStage || stale || loading || staging} onClick={() => void toggleStage()}>{selection.base === 'headToIndex' ? <Minus size={15} /> : <Plus size={15} />}<span>{selection.base === 'headToIndex' ? '取消暂存' : '暂存文件'}</span></button> : null}
      {onOpenFile && !deleted ? <button className="git-open-file" aria-label="打开文件" title="打开文件" onClick={() => onOpenFile(selection.file)}><FileCode2 size={14} /><span>打开文件</span></button> : null}
    </header>
    {effectiveSplit ? <div className="git-diff-source-labels split"><span>{labels[0]} · 基准版本</span><span>{labels[1]} · 当前版本</span></div> : null}
    <div className="git-diff-viewport" aria-busy={loading}>
      {diff?.binary ? <div className="git-empty git-diff-empty">二进制文件发生变化。请用适合的应用查看文件。</div> : model.lines.length ? <FullFileDiff ref={fullFile} key={selectionKey} fileKey={selectionKey} lines={model.lines} split={effectiveSplit} hideUnchanged={hideUnchanged} /> : <div className="git-empty git-diff-empty">{!enabled ? 'Git 扩展已停用。' : loading ? '' : diff ? '文件为空。' : '未能读取差异'}</div>}
      {loading ? <div className="git-diff-loading" role="status"><span>读取完整文件…</span><button onClick={stopRead}>停止读取</button></div> : null}
      <div className="git-diff-feedback">
        {error ? <div className="git-error" role="alert">{error}<button onClick={() => void load(true)}>重新读取</button></div> : null}
        {stale ? <div className="git-warning" role="status">仓库已变化，这份差异已过期。<button onClick={() => void load(true)}>刷新差异</button></div> : null}
        {contextNotice ? <p className="git-notice" role="status">{contextNotice}</p> : null}
        {diff?.truncated ? <p className="git-warning">差异超过 16 MiB，只显示有界预览。完整差异请在外部 Git 查看。</p> : null}
      </div>
    </div>
    <footer className="git-toolbar git-diff-pagination">
      <span className="git-hint" title="完整文件行数">旧 {model.oldLines} 行 · 新 {model.newLines} 行</span>
      <button className="git-context-action" aria-label="加入 AI 上下文" title="加入 AI 上下文" disabled={!diff || loading || stale || diff.binary || diff.truncated || addingContext} aria-busy={addingContext} onClick={() => void addContext()}><Plus size={14} /><span>加入 AI 上下文</span></button>
      <span className="git-spacer" />
      <button aria-label="上一处变更" disabled={loading || !model.changes} onClick={() => navigate(-1)}><ChevronUp size={14} />上一处</button>
      <span className="git-diff-change-number">{model.changes ? activeChange + 1 : 0} / {model.changes}</span>
      <button aria-label="下一处变更" disabled={loading || !model.changes} onClick={() => navigate(1)}><ChevronDown size={14} />下一处</button>
    </footer>
  </div>;
}
