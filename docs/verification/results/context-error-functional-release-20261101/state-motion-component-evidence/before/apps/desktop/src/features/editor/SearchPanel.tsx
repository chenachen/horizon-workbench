import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Command, Search, SearchX, X } from 'lucide-react';
import { call, start, type TaskHandle } from '../../bridge';
import { errorMessage, type FileRef, type SearchMatch } from '../../../../../packages/editor/src/types';
import { editorStore } from './store';
import { editorCommands } from './commands';
import { FileKindIcon } from './FileKindIcon';
type SearchState = { query: string; regex: boolean; caseSensitive: boolean; wholeWord: boolean; include: string; exclude: string; includeIgnored: boolean; matches: SearchMatch[]; status: 'idle' | 'loading' | 'cancelling' | 'ready' | 'cancelled' | 'error'; error: string; truncated: boolean; task?: TaskHandle<unknown>; generation: number; lastUsed: number; scrollTop: number; collapsed: Set<string>; focused: number };
const searches = new Map<string, SearchState>();
export async function disposeSearches(projectId?: string) { for (const [id, state] of searches) if (!projectId || id === projectId) { state.generation++; await state.task?.cancel().catch(() => {}); state.task = undefined; searches.delete(id); } }
export function SearchPanel({ projectId, projectEpoch, onOpenFile }: { projectId: string; projectEpoch: number; onOpenFile?: (fileId: string) => void }) {
  const [revision, render] = useState(0); const [, renderViewport] = useState(0); let cached = searches.get(projectId);
  if (!cached) { cached = { query: editorStore.getSnapshot().projects.get(projectId)?.searchDraft ?? '', regex: false, caseSensitive: false, wholeWord: false, include: '', exclude: '', includeIgnored: false, matches: [], status: 'idle', error: '', truncated: false, generation: 0, lastUsed: Date.now(), scrollTop: 0, collapsed: new Set(), focused: 0 }; searches.set(projectId, cached); }
  const state = cached, alive = useRef(true), results = useRef<HTMLDivElement>(null), queryInput = useRef<HTMLInputElement>(null), queryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { alive.current = true; state.lastUsed = Date.now(); const inactive = [...searches].filter(([id, value]) => id !== projectId && value.matches.length).sort((left, right) => right[1].lastUsed - left[1].lastUsed); for (const [, old] of inactive.slice(4)) { old.generation++; old.matches = []; old.status = 'idle'; if (old.task) void old.task.cancel().catch(() => {}); old.task = undefined; } if (results.current) results.current.scrollTop = state.scrollTop; return () => { alive.current = false; if (queryTimer.current) clearTimeout(queryTimer.current); state.generation++; if (state.task) void state.task.cancel().catch(() => {}); state.task = undefined; if (state.status === 'loading' || state.status === 'cancelling') state.status = 'cancelled'; }; }, [projectId, projectEpoch, state]);
  const update = () => { if (alive.current) render(n => n + 1); };
  const search = async () => {
    if (!state.query.trim()) return;
    if (state.regex) { try { new RegExp(state.query); } catch (e) { state.error = `正则表达式无效：${errorMessage(e)}`; state.status = 'error'; update(); return; } }
    const generation = ++state.generation;
    const prior = state.task; state.task = undefined; if (prior) void prior.cancel().catch(() => {});
    state.status = 'loading'; state.matches = []; state.error = ''; state.truncated = false; state.scrollTop = 0; state.focused = 0; if (results.current) results.current.scrollTop = 0; update();
    try {
      const task = await start<{ matches: number; files: number; truncated: boolean; elapsedMs: number }>('search_start', { query: state.query, regex: state.regex, caseSensitive: state.caseSensitive, wholeWord: state.wholeWord, includeGlobs: state.include.split(',').map(s => s.trim()).filter(Boolean), excludeGlobs: state.exclude.split(',').map(s => s.trim()).filter(Boolean), includeIgnored: state.includeIgnored, maxMatches: 10000 }, event => {
        if (generation !== state.generation) return;
        if (event.payload.type === 'data' && event.payload.kind === 'search.matches') { const data = event.payload.data as { items?: SearchMatch[] }; state.matches.push(...(data.items ?? [])); update(); }
      }, projectId);
      if (generation !== state.generation) { void task.cancel().catch(() => {}); return; }
      state.task = task; update(); const result = await task.result;
      if (generation === state.generation) { state.status = 'ready'; state.truncated = result.truncated; state.task = undefined; update(); }
    } catch (e) { if (generation !== state.generation) return; state.status = (e as { code?: string })?.code === 'CANCELLED' ? 'cancelled' : 'error'; state.error = state.status === 'error' ? errorMessage(e) : ''; state.task = undefined; update(); }
  };
  const { groups, visible } = useMemo(() => {
  const groups = new Map<string, SearchMatch[]>(); for (const match of state.matches) { const values = groups.get(match.file.fileId) ?? []; values.push(match); groups.set(match.file.fileId, values); }
  const visible: { file: FileRef; count?: number; match?: SearchMatch }[] = [];
  for (const [fileId, matches] of groups) { visible.push({ file: matches[0].file, count: matches.length }); if (!state.collapsed.has(fileId)) for (const match of matches) visible.push({ file: match.file, match }); }
    return { groups, visible };
  }, [state, revision]);
  const rowHeight = 28, from = Math.max(0, Math.floor(state.scrollTop / rowHeight) - 8), to = Math.min(visible.length, from + Math.ceil((results.current?.clientHeight ?? 600) / rowHeight) + 16);
  const focusResult = (index: number) => { state.focused = Math.max(0, Math.min(visible.length - 1, index)); const y = state.focused * rowHeight; if (results.current && (y < results.current.scrollTop || y > results.current.scrollTop + results.current.clientHeight - rowHeight)) results.current.scrollTop = Math.max(0, y - results.current.clientHeight / 2); state.scrollTop = results.current?.scrollTop ?? 0; update(); requestAnimationFrame(() => results.current?.querySelector<HTMLButtonElement>(`[data-result-index="${state.focused}"]`)?.focus()); };
  const openResult = (item: (typeof visible)[number]) => { if (!item.match && onOpenFile) onOpenFile(item.file.fileId); else { const range = item.match?.ranges.find(r => r.unit === 'utf16'); void editorStore.openFile(item.file.fileId, { projectId, preview: true, line: item.match?.line, column: range?.unit === 'utf16' ? range.from : 0 }); } };
  const clearRange = () => { state.include = ''; state.exclude = ''; state.includeIgnored = false; update(); queryInput.current?.focus(); void search(); };
  return <section className="project-search" aria-label="项目文本搜索"><header className="editor-panel-heading"><span>搜索</span><span className="muted">磁盘内容</span></header><form className="search-form" onSubmit={e => { e.preventDefault(); if (queryTimer.current) clearTimeout(queryTimer.current); void search(); }}><div className="search-input-wrap"><Search size={15} /><input ref={queryInput} aria-label="搜索文本" placeholder="搜索项目内容" value={state.query} onChange={e => { state.query = e.target.value; editorStore.setSearchDraft(projectId, state.query); state.generation++; if (state.task) void state.task.cancel().catch(() => {}); state.task = undefined; state.status = 'idle'; state.matches = []; if (queryTimer.current) clearTimeout(queryTimer.current); if (!(e.nativeEvent as InputEvent).isComposing) queryTimer.current = setTimeout(() => void search(), 150); update(); }} onKeyDown={e => { if (e.nativeEvent.isComposing && e.key === 'Enter') e.preventDefault(); }} /></div><div className="search-options"><label title="区分大小写"><input type="checkbox" checked={state.caseSensitive} onChange={e => { state.caseSensitive = e.target.checked; update(); }} />Aa</label><label title="全词匹配"><input type="checkbox" checked={state.wholeWord} onChange={e => { state.wholeWord = e.target.checked; update(); }} />全词</label><label title="正则表达式"><input type="checkbox" checked={state.regex} onChange={e => { state.regex = e.target.checked; update(); }} />.*</label></div><details><summary>范围{state.include || state.exclude || state.includeIgnored ? ' · 已应用' : ''}</summary><label>包含路径<input value={state.include} placeholder="src/**, *.md" onChange={e => { state.include = e.target.value; update(); }} /></label><label>排除路径<input value={state.exclude} placeholder="dist/**" onChange={e => { state.exclude = e.target.value; update(); }} /></label><label className="search-check"><input type="checkbox" checked={state.includeIgnored} onChange={e => { state.includeIgnored = e.target.checked; update(); }} />包含忽略项</label></details><div className="search-actions"><button type="submit" disabled={!state.query.trim()}>搜索</button>{state.task && <button type="button" disabled={state.status === 'cancelling'} onClick={() => { state.status = 'cancelling'; update(); void state.task?.cancel().catch(e => { state.error = errorMessage(e); update(); }); }}>{state.status === 'cancelling' ? '正在停止…' : '停止'}</button>}</div></form>
    {state.error && <p className="editor-error" role="alert">{state.error}</p>}<div className="search-summary" aria-live="polite">{state.status === 'loading' ? '正在搜索… ' : state.status === 'cancelled' ? '已取消，保留已有结果。' : state.status === 'idle' ? '输入文字，搜索当前项目。' : ''}{state.matches.length > 0 && `${state.matches.length} 处匹配 · ${groups.size} 个文件`}{state.truncated && ' · 已达到上限，请缩小范围。'}</div><div className="search-results" ref={results} role="tree" aria-label="搜索结果" onScroll={e => { state.scrollTop = e.currentTarget.scrollTop; renderViewport(n => n + 1); }}>
      <>{state.status === 'ready' && !state.matches.length && <div className="search-empty-state"><SearchX size={27} /><h3>没有找到结果</h3><p>“{state.query}”在当前范围内没有匹配。</p>{state.include || state.exclude || state.includeIgnored ? <><small>{state.include ? `包含 ${state.include}` : '全部文件'}{state.exclude ? ` · 排除 ${state.exclude}` : ''}</small><button onClick={clearRange}>清除范围限制</button></> : <p>试试修改搜索文字或匹配选项。</p>}</div>}<div style={{ height: visible.length * rowHeight, position: 'relative' }}>{visible.slice(from, to).map((item, offset) => { const index = from + offset, isGroup = !item.match, collapsed = state.collapsed.has(item.file.fileId); return <button key={`${item.file.fileId}-${item.match?.line ?? 'group'}-${index}`} role="treeitem" aria-level={isGroup ? 1 : 2} aria-expanded={isGroup ? !collapsed : undefined} aria-selected={state.focused === index} tabIndex={state.focused === index ? 0 : -1} data-result-index={index} className={isGroup ? 'search-file' : 'search-match'} style={{ position: 'absolute', top: index * rowHeight, height: rowHeight, left: 0, right: 0 }} title={item.match?.lineText ?? item.file.displayPath} onClick={() => { state.focused = index; openResult(item); }} onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === 'ArrowDown') { e.preventDefault(); focusResult(index + 1); } else if (e.key === 'ArrowUp') { e.preventDefault(); focusResult(index - 1); } else if (isGroup && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); if (e.key === 'ArrowLeft') state.collapsed.add(item.file.fileId); else state.collapsed.delete(item.file.fileId); update(); } else if (e.key === 'Home') { e.preventDefault(); focusResult(0); } else if (e.key === 'End') { e.preventDefault(); focusResult(visible.length - 1); } }}>
        {isGroup ? <><span className="search-collapse" onClick={e => { e.stopPropagation(); if (collapsed) state.collapsed.delete(item.file.fileId); else state.collapsed.add(item.file.fileId); update(); }}>{collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</span><span className="search-path">{item.file.displayPath}</span><span>{item.count}</span></> : <><span>{item.match!.line + 1}</span><code><MatchText match={item.match!} /></code></>}
      </button>; })}</div></>
    </div>
  </section>;
}
function MatchText({ match }: { match: SearchMatch }) {
  if (!match.lineText) return <>此匹配使用字节偏移，请在系统中查看文件。</>;
  const parts: React.ReactNode[] = []; let at = 0;
  for (const range of match.ranges) { if (range.unit !== 'utf16' || range.from < at) continue; parts.push(match.lineText.slice(at, range.from)); parts.push(<mark key={`${range.from}-${range.to}`}>{match.lineText.slice(range.from, range.to)}</mark>); at = range.to; }
  parts.push(match.lineText.slice(at)); return <>{parts}</>;
}
export type QuickOpenMode = 'files' | 'commands';
export type QuickOpenProps = { open: boolean; projectId: string; projectEpoch: number; initialMode?: QuickOpenMode; onClose: () => void; onCommand?: (commandId: string) => void | Promise<unknown>; commands?: { id: string; title: string; shortcut?: string; disabled?: boolean; disabledReason?: string }[] };
const defaultCommands = [{ id: 'file.save', title: '保存当前文件', shortcut: '⌘S' }, { id: 'editor.find', title: '当前文件查找 / 替换', shortcut: '⌘F' }, { id: 'editor.gotoLine', title: '跳转到行', shortcut: '⌃G' }, { id: 'app.settings', title: '打开设置', shortcut: '⌘,' }];
const quickQueries = new Map<string, { files: string; commands: string }>();
export function QuickOpen({ open, initialMode = 'files', ...props }: QuickOpenProps) {
  const wasOpen = useRef(false), focusOrigin = useRef<HTMLElement | null>(null);
  if (open && !wasOpen.current) focusOrigin.current = document.activeElement as HTMLElement;
  wasOpen.current = open;
  return open ? <QuickOpenDialog key={`${props.projectId}:${props.projectEpoch}:${initialMode}`} {...props} initialMode={initialMode} focusOrigin={focusOrigin.current} /> : null;
}
function QuickOpenDialog({ projectId, projectEpoch, initialMode, focusOrigin, onClose, onCommand, commands = defaultCommands }: Omit<QuickOpenProps, 'open'> & { initialMode: QuickOpenMode; focusOrigin: HTMLElement | null }) {
  const [query, setQuery] = useState(() => { const remembered = quickQueries.get(projectId)?.[initialMode] ?? ''; return initialMode === 'commands' ? `>${remembered}` : remembered; });
  const [items, setItems] = useState<{ file: FileRef; score: number }[]>([]), [selected, setSelected] = useState(0), [status, setStatus] = useState(''), [loading, setLoading] = useState(false), [composing, setComposing] = useState(false);
  const input = useRef<HTMLInputElement>(null), generation = useRef(0), composingRef = useRef(false), returnFocus = useRef(focusOrigin), restoreFocus = useRef(true);
  const commandMode = query.startsWith('>');
  useEffect(() => { input.current?.focus(); input.current?.select(); return () => { if (restoreFocus.current && returnFocus.current?.isConnected) returnFocus.current.focus(); }; }, []);
  useEffect(() => {
    const request = ++generation.current;
    setItems([]); setStatus(''); setSelected(0); setLoading(!commandMode && !composing);
    if (commandMode || composing) return () => { generation.current++; };
    const timer = setTimeout(() => {
      void call<{ items: { file: FileRef; score: number }[]; generation: number; truncated: boolean }>('path_query', { query, generation: request, limit: 100 }, projectId)
        .then(result => { if (request !== generation.current) return; setItems(result.items); setStatus(result.truncated ? '仅显示前 100 项，请缩小范围。' : result.items.length ? '' : '没有匹配文件。'); })
        .catch(error => { if (request === generation.current) setStatus(errorMessage(error)); })
        .finally(() => { if (request === generation.current) setLoading(false); });
    }, 100);
    return () => { clearTimeout(timer); generation.current++; };
  }, [query, commandMode, composing, projectId, projectEpoch]);
  const commandItems = commands.filter(command => command.title.toLowerCase().includes(query.slice(1).trim().toLowerCase()));
  const count = commandMode ? commandItems.length : items.length, activeIndex = Math.max(0, Math.min(count - 1, selected));
  useEffect(() => { document.getElementById(`quick-result-${activeIndex}`)?.scrollIntoView({ block: 'nearest' }); }, [activeIndex, commandMode]);
  const updateQuery = (value: string) => {
    const remembered = quickQueries.get(projectId) ?? { files: '', commands: '' };
    // A bare mode marker restores its own query; explicit pasted/edited text stays literal.
    const next = !commandMode && value === '>' ? `>${remembered.commands}` : value;
    if (next.startsWith('>')) remembered.commands = next.slice(1); else remembered.files = next;
    quickQueries.set(projectId, remembered);
    generation.current++; setItems([]); setStatus(''); setLoading(!next.startsWith('>') && !composingRef.current); setSelected(0); setQuery(next);
  };
  const runCommand = async (id: string) => {
    if (onCommand) { await onCommand(id); return; }
    if (id === 'file.save') await editorStore.saveActive();
    else if (id === 'editor.find') await editorCommands.find();
    else if (id === 'editor.gotoLine') await editorCommands.gotoLine();
    else throw new Error('此命令需要由工作台执行。');
  };
  const execute = (index = activeIndex) => {
    if (composingRef.current) return;
    const command = commandMode ? commandItems[index] : undefined, file = !commandMode && !loading ? items[index]?.file : undefined;
    if (commandMode ? !command || command.disabled : !file) return;
    restoreFocus.current = false; onClose();
    void (command ? runCommand(command.id) : editorStore.openFile(file!.fileId, { projectId, preview: false })).catch(editorStore.reportError);
  };
  return <div className="editor-modal-backdrop quick-open-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className="quick-open" role="dialog" aria-modal="true" aria-label="快速打开" onKeyDown={event => {
    if (event.nativeEvent.isComposing || composingRef.current || event.keyCode === 229) return;
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); setSelected(Math.max(0, Math.min(count - 1, activeIndex + 1))); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setSelected(Math.max(0, activeIndex - 1)); }
    else if (event.key === 'Enter') { event.preventDefault(); execute(); }
    else if (event.key === 'Tab') { event.preventDefault(); input.current?.focus(); }
  }}><div className="quick-open-input"><Search size={18} /><input ref={input} role="combobox" aria-expanded="true" aria-controls="quick-open-results" aria-activedescendant={count ? `quick-result-${activeIndex}` : undefined} value={query} onChange={event => updateQuery(event.target.value)} onCompositionStart={() => { composingRef.current = true; generation.current++; setComposing(true); setItems([]); setLoading(false); }} onCompositionEnd={event => { composingRef.current = false; setComposing(false); updateQuery(event.currentTarget.value); }} placeholder="搜索文件，输入 > 运行命令" aria-label="文件名或命令" /><button tabIndex={-1} aria-label="关闭快速打开" onClick={onClose}><X size={16} /></button></div><div className="quick-open-scope">{commandMode ? '命令' : '当前项目中的文件'}<span>{commandMode ? 'Esc 关闭' : '输入 > 执行命令'}</span></div><div className="quick-open-results" role="listbox" id="quick-open-results">
    {commandMode ? commandItems.map((command, index) => <button tabIndex={-1} role="option" aria-selected={index === activeIndex} disabled={command.disabled} id={`quick-result-${index}`} key={command.id} onMouseDown={event => event.preventDefault()} onMouseMove={() => setSelected(index)} onClick={() => execute(index)}><Command size={15} /><span className="quick-result-copy"><strong>{command.title}</strong>{command.disabled && <small>{command.disabledReason ?? '当前上下文不可用'}</small>}</span><kbd>{command.shortcut}</kbd></button>) : items.map((item, index) => <button tabIndex={-1} role="option" aria-selected={index === activeIndex} id={`quick-result-${index}`} key={item.file.fileId} onMouseDown={event => event.preventDefault()} onMouseMove={() => setSelected(index)} onClick={() => execute(index)}><FileKindIcon path={item.file.displayPath} /><span className="quick-result-copy"><strong>{item.file.displayPath.split('/').pop()}</strong><small>{item.file.displayPath}</small></span>{index === activeIndex && <span className="quick-enter">↵</span>}</button>)}
    </div><footer>{commandMode ? commandItems.length ? '↑↓ 选择 · Enter 执行 · Esc 关闭' : '没有匹配命令。' : loading ? '正在查询…' : status || '↑↓ 选择 · Enter 打开 · Esc 关闭'}</footer></div></div>;
}
