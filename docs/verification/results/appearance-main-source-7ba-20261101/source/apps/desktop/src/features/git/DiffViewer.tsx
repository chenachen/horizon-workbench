import { useEffect, useMemo, useRef, useState } from 'react';
import { Columns2, FileCode2, List, Minus, Plus, X } from 'lucide-react';
import { call, errorMessage, start, subscribe, type TaskHandle } from '../../bridge';
import { usePluginEnabled } from '../plugins/service';
import { useSettings } from '../settings/AppearanceProvider';
import { GitModal } from './Modal';
import type { DiffSelection, GitDiff, GitSnapshot } from './types';

const SOURCE: Record<string, [string, string]> = { indexToWorktree: ['暂存区', '磁盘文件'], headToIndex: ['HEAD', '暂存区'], commitToParent: ['父提交', '所选提交'] };
const LINES = 600;
type PatchPage = { patch: string; nextCursor: string | null; oldLine?: number; newLine?: number; startsMidLine?: boolean };
function DiffRows({ patch, split, offset, oldStart = 0, newStart = 0 }: { patch: string; split: boolean; offset: number; oldStart?: number; newStart?: number }) {
  const rows = useMemo(() => {
    let oldLine = oldStart, newLine = newStart;
    return patch.split('\n').map((text, key) => {
      const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
      if (header) { oldLine = Number(header[1]); newLine = Number(header[2]); }
      const metadata = text.startsWith('---') || text.startsWith('+++') || text.startsWith('diff ') || text.startsWith('index ') || /^(?:new file|deleted file|old|new) mode /.test(text) || !!header;
      const add = !metadata && text.startsWith('+'), del = !metadata && text.startsWith('-');
      const context = !metadata && text.startsWith(' ');
      return { key, text, add, del, old: (del || context) ? oldLine++ : undefined, next: (add || context) ? newLine++ : undefined, metadata, hunk: !!header };
    }).slice(offset, offset + LINES).filter(row => !row.metadata || row.hunk);
  }, [patch, offset, oldStart, newStart]);
  return <div className={split ? 'git-diff-lines split' : 'git-diff-lines'} role="region" tabIndex={0} aria-label="只读差异，减号为删除，加号为新增">
    {rows.map(row => row.hunk ? <div key={row.key} className="git-diff-hunk"><code>{row.text}</code></div> : <div key={row.key} className={`git-diff-line ${row.add ? 'added' : row.del ? 'removed' : row.metadata ? 'metadata' : ''}`}>
      {split ? <><span className="git-old-number" aria-hidden="true">{row.del ? '−' : ''}{row.old}</span><code className="git-old-content">{row.add ? '' : (row.old !== undefined ? row.text.slice(1) : row.text) || ' '}</code><span className="git-new-number" aria-hidden="true">{row.add ? '+' : ''}{row.next}</span><code className="git-new-content">{row.del ? '' : (row.next !== undefined ? row.text.slice(1) : row.text) || ' '}</code></> : <><span className="git-line-number" aria-hidden="true">{row.add ? '+' : row.del ? '−' : ''}{row.del ? row.old : row.next}</span><code>{(row.old !== undefined || row.next !== undefined ? row.text.slice(1) : row.text) || ' '}</code></>}
    </div>)}
  </div>;
}

export type DiffSelectionProps = { projectId: string; selection: DiffSelection; snapshot: GitSnapshot; onClose(): void; onToggleStage?: () => void; onOpenFile?: (file: DiffSelection['file']) => void };
export function DiffViewer(props: DiffSelectionProps) { return <GitModal title={props.selection.file.displayPath} wide onClose={props.onClose}><GitDiffSurface {...props} /></GitModal>; }
export function GitDiffSurface({ projectId, selection: requestedSelection, snapshot, onClose, onOpenFile, onToggleStage }: DiffSelectionProps) {
  const enabled = usePluginEnabled('horizon.git', projectId);
  const [historyFile, setHistoryFile] = useState<{ commitOid?: string; item: NonNullable<DiffSelection['commitFiles']>[number] } | null>(null);
  const selection = historyFile && historyFile.commitOid === requestedSelection.commitOid && requestedSelection.commitFiles?.some(item => item.file.fileId === historyFile.item.file.fileId) ? { ...requestedSelection, ...historyFile.item } : requestedSelection;
  const [diff, setDiff] = useState<GitDiff | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [contextNotice, setContextNotice] = useState('');
  const [stale, setStale] = useState(false), [staging, setStaging] = useState(false);
  const [pages, setPages] = useState<PatchPage[]>([]), [pageIndex, setPageIndex] = useState(0), [linePage, setLinePage] = useState(0);
  const { settings, refresh: refreshSettings } = useSettings();
  const [split, setSplit] = useState(false);
  useEffect(() => { if (settings) setSplit(settings.effective['git.diffView'] !== 'inline'); }, [settings?.effective['git.diffView']]);
  const toggleMode = async () => {
    const previous = split, next = !split; setSplit(next);
    try {
      const current = await call<{ revision: number }>('settings_get', {});
      await call('settings_patch', { scope: 'global', expectedRevision: current.revision, set: { 'git.diffView': next ? 'split' : 'inline' }, unset: [] });
      await refreshSettings(); window.dispatchEvent(new Event('horizon:settings-changed'));
    } catch (cause) { setSplit(previous); setError(errorMessage(cause)); }
  };
  const host = useRef<HTMLDivElement>(null), [width, setWidth] = useState(0);
  useEffect(() => { if (!host.current) return; const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width)); observer.observe(host.current); return () => observer.disconnect(); }, []);
  const request = useRef(0);
  const readTask = useRef<TaskHandle<GitDiff> | null>(null);
  const [activeReadId, setActiveReadId] = useState('');
  const load = (fresh = false) => {
    const version = ++request.current; setLoading(true); setError('');
    void (fresh ? call<GitSnapshot>('git_status', { refresh: true }, projectId) : Promise.resolve(snapshot)).then(current => start<GitDiff>('git_diff', { repoId: current.repoId, fileId: selection.file.fileId, base: selection.base, commitOid: selection.commitOid, parentOid: selection.parentOid, originalPath: selection.originalPath, expectedRepoToken: selection.base === 'commitToParent' ? undefined : current.repoToken }, undefined, projectId))
      .then(handle => { if (version !== request.current) void handle.cancel(); else { readTask.current = handle; setActiveReadId(handle.taskId); } return handle.result; })
      .then(value => { if (version !== request.current) return; setDiff(value); setStale(false); setPages([{ ...value, patch: value.patch ?? '' }]); setPageIndex(0); setLinePage(0); })
      .catch(e => { if (version === request.current) setError(errorMessage(e)); }).finally(() => { if (version === request.current) { readTask.current = null; setActiveReadId(''); setLoading(false); } });
  };
  useEffect(() => { if (enabled) load(); else { setDiff(null); setPages([]); setLoading(false); } return () => { request.current++; void readTask.current?.cancel(); readTask.current = null; }; }, [projectId, enabled, selection.file.fileId, selection.base, selection.commitOid, selection.parentOid, selection.originalPath, snapshot.repoToken]);
  useEffect(() => { if (!enabled || selection.base === 'commitToParent') return; let active = true; let close: (() => Promise<unknown>) | undefined; void subscribe(['horizon.git.v1'], () => { if (active) setStale(true); }, projectId).then(subscription => { if (active) close = subscription.close; else void subscription.close(); }).catch(() => {}); return () => { active = false; void close?.(); }; }, [projectId, enabled, selection.base]);
  const page = pages[pageIndex];
  const lines = useMemo(() => (page?.patch ?? '').split('\n'), [page?.patch]);
  const total = Math.max(1, Math.ceil(lines.length / LINES));
  const loadNext = async () => {
    if (linePage + 1 < total) { setLinePage(v => v + 1); return; }
    if (pageIndex + 1 < pages.length) { setPageIndex(v => v + 1); setLinePage(0); return; }
    if (!diff || !page?.nextCursor) return;
    setLoading(true); setError(''); const version = request.current;
    try { const next = await call<PatchPage>('git_diff_page', { diffId: diff.diffId, cursor: page.nextCursor }, projectId); if (version !== request.current) return; setPages(p => [...p.slice(-3), next]); setPageIndex(Math.min(pages.length, 3)); setLinePage(0); }
    catch (e) { if (version === request.current) setError(errorMessage(e)); } finally { if (version === request.current) setLoading(false); }
  };
  const changes = useMemo(() => pages.reduce((count, item) => { for (const line of item.patch.split('\n')) { if (line.startsWith('+') && !line.startsWith('+++')) count.added++; else if (line.startsWith('-') && !line.startsWith('---')) count.removed++; } return count; }, { added: 0, removed: 0 }), [pages]);
  const selectedStatus = snapshot.files.find(item => item.file.fileId === selection.file.fileId);
  const deleted = selection.base === 'commitToParent' ? requestedSelection.commitFiles?.find(item => item.file.fileId === selection.file.fileId)?.status === 'D' : selectedStatus?.worktree === 'D' || (selection.base === 'headToIndex' && selectedStatus?.index === 'D');
  const canToggleStage = !!selectedStatus && selectedStatus.kind !== 'unmerged' && !snapshot.truncated && (selection.base === 'headToIndex' ? !['.', ' ', '?'].includes(selectedStatus.index) : !['.', ' '].includes(selectedStatus.worktree));
  const toggleStage = async () => { setStaging(true); try { await onToggleStage?.(); } catch (e) { setError(errorMessage(e)); } finally { setStaging(false); } };
  const labels = selection.parentOid ? ['比较起点', '比较终点'] : SOURCE[selection.base];
  const effectiveSplit = split && width >= 800;
  const addContext = async () => { if (!diff) return; try { const agent = await import('../agent/store'); agent.queueAgentContext(projectId, { key: diff.diffId, label: `${selection.file.displayPath} · ${labels[0]} → ${labels[1]}`, source: 'gitDiff', fileId: selection.file.fileId, diffId: diff.diffId, expectedRepoToken: diff.repoToken, byteLength: Number(diff.byteLength) }); setContextNotice('已加入 AI 待发送上下文。'); } catch (e) { setError(errorMessage(e)); } };
  return <div className="git-diff-surface" ref={host}>
    <div className="git-review-tabs"><div className="git-review-tab" aria-current="page"><FileCode2 size={14} /><span>{selection.file.displayPath.split('/').at(-1)}</span><button aria-label="关闭差异" onClick={onClose}><X size={12} /></button></div></div>
    {selection.commit ? <section className="git-commit-detail"><h2>{selection.commit.subject}</h2><p>{selection.commit.author} · {selection.commit.oid.slice(0, 9)} · {new Date(selection.commit.time).toLocaleString()}</p><div className="git-commit-files" aria-label="提交中的文件">{selection.commitFiles?.map(item => <button key={item.file.fileId} title={item.file.displayPath} aria-pressed={item.file.fileId === selection.file.fileId} onClick={() => setHistoryFile({ commitOid: selection.commitOid, item })}>{item.status} {item.file.displayPath}</button>)}</div></section> : null}
    <header className="git-diff-header"><span className="git-diff-filename">{selection.file.displayPath}</span><span className="git-diff-baseline">{selection.base === 'headToIndex' ? '已暂存更改' : selection.base === 'indexToWorktree' ? '未暂存更改' : '提交差异'}</span>{diff && !diff.binary ? <span className="git-diff-counts" title={diff.nextCursor || diff.truncated ? '当前已加载片段中的改动行数' : '改动行数'}><span>+{changes.added}</span><span>−{changes.removed}</span></span> : null}<span className="git-spacer" /><button title={split && !effectiveSplit ? '首选并排；当前宽度使用行内显示' : '切换差异显示方式'} aria-label="切换行内或并排差异" aria-pressed={split} onClick={toggleMode}>{effectiveSplit ? <Columns2 size={16} /> : <List size={16} />}</button>{onToggleStage && selection.base !== 'commitToParent' ? <button disabled={!enabled || !canToggleStage || stale || loading || staging} onClick={() => void toggleStage()}>{selection.base === 'headToIndex' ? <Minus size={15} /> : <Plus size={15} />}{selection.base === 'headToIndex' ? '取消暂存' : '暂存文件'}</button> : null}{onOpenFile && !deleted ? <button onClick={() => onOpenFile(selection.file)}>打开文件</button> : null}</header>
    {effectiveSplit ? <div className="git-diff-source-labels split"><span>{labels[0]} · 基准版本</span><span>{labels[1]} · 当前版本</span></div> : null}
    {error ? <div className="git-error" role="alert">{error}<button onClick={() => load(true)}>重新读取</button></div> : null}
    {stale ? <div className="git-warning" role="status">仓库已变化，这份差异已过期。<button onClick={() => load(true)}>刷新差异</button></div> : null}
    {contextNotice ? <p className="git-notice" role="status">{contextNotice}</p> : null}
    {loading && activeReadId ? <div className="git-progress"><span>读取差异…</span><button onClick={() => void readTask.current?.cancel()}>停止读取</button></div> : null}
    {page?.startsMidLine ? <p className="git-hint">本页从超长行中部续读。</p> : null}
    {diff?.binary ? <div className="git-empty git-diff-empty">二进制文件发生变化。请用适合的应用查看文件。</div> : page?.patch ? <DiffRows patch={page.patch} offset={linePage * LINES} oldStart={page.oldLine} newStart={page.newLine} split={effectiveSplit} /> : <div className="git-empty git-diff-empty">{!enabled ? 'Git 扩展已停用。' : loading ? '读取差异…' : diff ? '此基线没有差异。' : '未能读取差异'}</div>}
    {diff?.truncated ? <p className="git-warning">差异超过 16 MiB，只显示有界预览。完整差异请在外部 Git 查看。</p> : null}
    <footer className="git-toolbar git-diff-pagination"><span className="git-hint">只读差异 · 未保存编辑不在此处</span><button disabled={!diff || diff.binary || diff.truncated} onClick={() => void addContext()}>加入 AI 上下文</button><span className="git-spacer" /><button disabled={loading || (pageIndex === 0 && linePage === 0)} onClick={() => { if (linePage > 0) setLinePage(v => v - 1); else { setPageIndex(v => v - 1); setLinePage(0); } }}>上一页</button><span>{pageIndex + 1} · {linePage + 1}/{total}</span><button disabled={loading || !(linePage + 1 < total || pageIndex + 1 < pages.length || page?.nextCursor)} onClick={() => void loadNext()}>{loading ? '读取中…' : '下一页'}</button></footer>
  </div>;
}
