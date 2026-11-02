import { useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, Activity, Compass, Code2, PackageCheck, PackagePlus, PackageOpen, PanelsTopLeft, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { PluginDialog } from './PluginDialog';
import { PluginDetails } from './PluginDetails';
import { PluginCard } from './PluginCard';
import { PluginInstallDialog, PluginPackagePicker, type InstallPlan } from './PluginInstallDialog';
import { pluginCategories, pluginCategory, type PluginCategory } from './presentation';
import { PluginDeveloper } from './PluginDeveloper';
import { PluginRuntimeList } from './PluginRuntimeList';
import { PluginImpact, type PluginImpactPlan } from './PluginImpact';
import { PluginPresets } from './PluginPresets';
import { call, errorMessage, nativeAvailable, start } from '../../bridge';
import { builtinPackages } from '../../../../../packages/plugins/src/builtins';
import type { ExtensionState, StopReason } from '../../../../../packages/plugins/src/types';
import { activatePlugin, pluginRuntime, refreshPlugins, usePluginError, usePlugins } from './service';
import { getWorkerCommands, subscribeWorkerCommands } from './workerHost';
import './plugins.css';

interface StopPlan extends PluginImpactPlan { planId: string; digest: string; extensionId: string; action: StopReason; dependents: string[] }
const tabs = [{ id: 'discover', title: '发现扩展', icon: Compass }, { id: 'installed', title: '已安装', icon: PackageCheck }, { id: 'updates', title: '更新', icon: RefreshCw }, { id: 'runtime', title: '运行状态', icon: Activity }, { id: 'developer', title: '开发者', icon: Code2 }] as const;
type Tab = typeof tabs[number]['id'];
function runtimeLabel(state: ExtensionState) {
  if (state.installState === 'absent') return '未安装';
  if (!state.effectiveEnabled) return '已禁用';
  if (state.effectivePaused) return '已暂停';
  if (state.runState === 'failed') return '异常';
  if (state.runState === 'cleanupFailed') return '清理失败';
  if (state.manifest?.runtime.kind === 'declarative') return '无需进程';
  return ({ active: '运行中', activating: '启动中', sleeping: '已休眠', stopped: '待激活', pausing: '正在停止', paused: '已暂停' } as Record<string, string>)[state.runState] ?? state.runState;
}
export function PluginCenter({ projectId, onError, onClose, onAppearance }: { projectId?: string; onError?: (message: string) => void; onClose?: () => void; onAppearance?: () => void }) {
  const [scope, setScope] = useState<'global' | 'project'>(projectId ? 'project' : 'global'); const [presetsOpen, setPresetsOpen] = useState(false);
  const [scopeNotice, setScopeNotice] = useState<{ name: string; action: 'enable' | 'resume' } | null>(null);
  const listProject = scope === 'project' ? projectId : undefined; const states = usePlugins(listProject); const loadError = usePluginError(); const commands = useSyncExternalStore(subscribeWorkerCommands, getWorkerCommands);
  const [tab, setTab] = useState<Tab>('installed'); const [query, setQuery] = useState(''); const [category, setCategory] = useState<PluginCategory>('全部');
  const [picker, setPicker] = useState<'install' | 'update' | null>(null);
  const [selected, setSelected] = useState<string | null>(null); const [install, setInstall] = useState<InstallPlan | null>(null); const [grants, setGrants] = useState<string[]>([]);
  const [stop, setStop] = useState<StopPlan | null>(null); const [deleteData, setDeleteData] = useState(false); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [logs, setLogs] = useState<string | null>(null);
  const busyRef = useRef(false); const cancelInstall = useRef<(() => Promise<unknown>) | null>(null); const [phase, setPhase] = useState('');
  const run = async (label: string, fn: () => Promise<void>) => { if (busyRef.current) return; busyRef.current = true; setBusy(label); setError(''); setMessage(''); setPhase(''); try { await fn(); await refreshPlugins(listProject); if (listProject !== projectId) await refreshPlugins(projectId); } catch (cause) { const message = errorMessage(cause); setError(message); onError?.(message); } finally { busyRef.current = false; cancelInstall.current = null; setBusy(''); setPhase(''); } };
  const choosePackage = (development = false) => run('检查扩展包', async () => { const selection = await call<{ packageSelectionToken: string | null }>(development ? 'extension_dev_pick' : 'extension_pick_package'); if (!selection.packageSelectionToken) return; const plan = await call<InstallPlan>('extension_install_prepare', selection); setPicker(null); setInstall(plan); setGrants([]); });
  const beginStop = (state: ExtensionState, action: StopReason) => run('检查活动资源', async () => { const plan = await call<StopPlan>('extension_stop_prepare', { extensionId: state.id, action, scope: action === 'uninstall' ? 'global' : scope, projectId: scope === 'project' ? projectId : undefined }, projectId); setStop(plan); setDeleteData(false); });
  const applyStop = () => stop && run('停止扩展并释放资源', async () => {
    const ids = [...stop.dependents, stop.extensionId];
    for (const id of ids) { const readiness = await pluginRuntime.prepareDeactivate(id, { reason: stop.action, projectId: stop.projectId }); if (!readiness.ready) throw new Error(`请先处理文档或任务：${readiness.blockers.join('、')}`); }
    const decisions = stop.dirtyDocuments.map(doc => ({ resourceId: doc.documentId, checkpointId: doc.documentId, action: 'retainCheckpoint' }));
    const task = await start('extension_stop_apply', { planId: stop.planId, digest: stop.digest, decisions, deleteData, stopDependents: true }, undefined, projectId); await task.result;
    for (const id of ids) await pluginRuntime.stop(id, { reason: stop.action, projectId: stop.projectId });
    setStop(null); if (stop.action === 'uninstall') setSelected(null); setMessage('扩展资源已释放；恢复草稿与项目文件已保留。');
  });
  const changeScope = (value: 'global' | 'project') => { setScope(value); setScopeNotice(null); };
  const requiresGlobalScope = (state: ExtensionState, action: 'enable' | 'resume') => {
    const globallyRestricted = action === 'enable' ? !state.enabledGlobal : state.pausedGlobal;
    if (scope !== 'project' || !globallyRestricted) return false;
    setScopeNotice({ name: state.manifest?.name ?? state.id, action }); setError(''); setMessage('');
    return true;
  };
  const toggle = (state: ExtensionState) => {
    if (state.effectiveEnabled) return beginStop(state, 'disable');
    if (requiresGlobalScope(state, 'enable')) return;
    return run('启用扩展', async () => { await call('extension_enable', { extensionId: state.id, scope, projectId: scope === 'project' ? projectId : undefined, expectedRevision: state.revision, enabled: true }, projectId); });
  };
  const resume = (state: ExtensionState) => {
    if (requiresGlobalScope(state, 'resume')) return;
    return run('恢复扩展', async () => { await call('extension_resume', { extensionId: state.id, scope, projectId: scope === 'project' ? projectId : undefined, expectedRevision: state.revision }, projectId); });
  };
  const installedById = new Map(states.map(state => [state.id, state]));
  const catalogue = tab === 'discover' ? builtinPackages.map(manifest => installedById.get(manifest.id) ?? { id: manifest.id, manifest, installState: 'absent' } as ExtensionState) : states;
  const filtered = catalogue.filter(state => (tab === 'discover' || state.installState !== 'absent') && (tab !== 'discover' || category === '全部' || pluginCategory(state.manifest) === category) && `${state.manifest?.name} ${state.id} ${state.manifest?.description} ${state.manifest?.author}`.toLowerCase().includes(query.toLowerCase()));
  const installedCount = states.filter(state => state.installState === 'installed').length;
  const visibleCommands = commands.filter(command => command.projectId === projectId);
  const selectTab = (next: Tab) => { setTab(next); setSelected(null); setQuery(''); setCategory('全部'); setScopeNotice(null); };
  const openPicker = (mode: 'install' | 'update') => { setPicker(mode); setError(''); };
  const detail = states.find(state => state.id === selected);
  return <section className="plugin-center" aria-label="插件中心">
    <header className="plugin-heading"><div><span className="plugin-eyebrow">HORIZON / EXTENSIONS</span><h2>插件中心</h2><p>把工作台，搭成你需要的样子。</p></div><div className="plugin-heading-actions">{onClose ? <button onClick={onClose}><ArrowLeft size={16} />返回工作台</button> : null}{onAppearance ? <button onClick={onAppearance}><PanelsTopLeft size={16} />布局与外观</button> : null}<button disabled={!!busy || !nativeAvailable()} onClick={() => setPresetsOpen(true)}><SlidersHorizontal size={16} />能力预设</button><button className="plugin-tonal" disabled={!!busy || !nativeAvailable()} onClick={() => openPicker('install')}><PackagePlus size={16} />安装扩展包</button></div></header>
    <nav className="plugin-tabs" role="tablist" aria-label="插件中心分类">{tabs.map(item => <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => selectTab(item.id)}><item.icon size={15} />{item.title}{item.id === 'installed' ? <span>{installedCount}</span> : null}</button>)}</nav>
    {!detail && (tab === 'discover' || tab === 'installed') ? <div className="plugin-toolbar"><label className="plugin-search"><Search size={16} /><input aria-label="搜索扩展" placeholder="搜索名称、能力或作者" value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="操作范围" value={scope} onChange={event => changeScope(event.target.value as typeof scope)}><option value="global">所有项目</option>{projectId ? <option value="project">当前项目</option> : null}</select></div> : null}
    {!detail && tab === 'discover' ? <><nav className="plugin-categories" aria-label="扩展分类">{pluginCategories.map(item => <button key={item} aria-pressed={category === item} className={category === item ? 'plugin-tonal' : 'plugin-text-button'} onClick={() => setCategory(item)}>{item}</button>)}</nav><section className="plugin-discovery-banner"><div><span className="plugin-eyebrow">按需加载 / 保持轻盈</span><h3>阅读、编辑、工具，各取所需。</h3><p>安装保留扩展资源；需要某项能力时，再按需启动。</p></div><button onClick={() => selectTab('runtime')}><Activity size={15} />查看运行状态</button></section></> : null}
    {!detail && tab === 'installed' && installedCount > 0 ? <div className="plugin-section-heading"><h3>你的扩展 <span>{installedCount}</span></h3><p>已安装不等于正在运行。这里显示当前操作范围内的启用状态。</p></div> : null}
    {busy && !install && !stop && !picker ? <p className="plugin-notice" role="status">{busy}…</p> : null}
    {(error || loadError) && !install && !stop && !picker ? <p className="plugin-error" role="alert">{error || loadError}</p> : null}
    {message ? <p className="plugin-notice" role="status">{message}</p> : null}
    {scope === 'project' && scopeNotice ? <div className="plugin-notice" role="status"><p>{scopeNotice.name} 已在所有项目中{scopeNotice.action === 'enable' ? '停用' : '暂停'}，当前项目受此全局设置限制。请先切换操作范围，再明确{scopeNotice.action === 'enable' ? '启用' : '恢复'}所有项目。</p><button disabled={!!busy} onClick={() => { changeScope('global'); setMessage(`当前操作范围已切换为所有项目。请再次点击“${scopeNotice.action === 'enable' ? '启用' : '恢复'}”执行操作。`); }}>切换到所有项目</button></div> : null}
    {!nativeAvailable() ? <p className="plugin-notice">浏览器预览中不可安装或启动扩展。请在 Horizon 桌面窗口中管理本地包。</p> : null}
    {presetsOpen ? <PluginPresets projectId={projectId} onClose={() => setPresetsOpen(false)} onApplied={async () => { await refreshPlugins(listProject); if (listProject !== projectId) await refreshPlugins(projectId); setMessage('能力预设已应用；终端与启动方案按需运行。'); }} /> : null}
    {picker ? <PluginPackagePicker update={picker === 'update'} busy={!!busy} error={error} onClose={() => setPicker(null)} onChoose={() => void choosePackage()} /> : null}
    {install ? <PluginInstallDialog plan={install} grants={grants} busy={!!busy} phase={phase} error={error} cancellable={!!cancelInstall.current} onClose={() => setInstall(null)} onCancel={() => { void cancelInstall.current?.(); }} onGrant={(id, allowed) => setGrants(old => allowed ? [...old, id] : old.filter(grant => grant !== id))} onInstall={() => void run('安装扩展包', async () => {
      const task = await start('extension_install_apply', { planId: install.planId, digest: install.digest, grantIds: grants }, event => { if (event.payload.type === 'progress') setPhase(String(event.payload.phase ?? '')); });
      cancelInstall.current = task.cancel; await task.result; setInstall(null); selectTab('installed'); setMessage('安装完成。可按需要启用并打开扩展提供的入口。');
    })} /> : null}
    {stop ? <PluginDialog kind={stop.action === 'uninstall' ? 'uninstall' : 'stop'} title={`${stop.action === 'uninstall' ? '卸载' : stop.action === 'pause' ? '暂停' : stop.action === 'sleep' ? '休眠' : '停用'} ${states.find(state => state.id === stop.extensionId)?.manifest?.name ?? stop.extensionId}？`} busy={!!busy} onClose={() => setStop(null)}>
      <p>范围：{stop.projectId ? '当前项目' : '所有项目'}。保存恢复草稿，停止所属服务，移除视图、命令与订阅。</p>
      {stop.dependents.length > 0 ? <p>同时停止依赖扩展：{stop.dependents.map(id => stop.extensionNames[id] ?? id).join('、')}</p> : null}
      <PluginImpact plan={stop} />
      {stop.action === 'uninstall' ? <label><input type="checkbox" checked={!deleteData} onChange={event => setDeleteData(!event.target.checked)} />保留扩展私有设置，便于以后重新安装</label> : null}
      {busy ? <p role="status">{busy}…</p> : null}{error ? <p className="plugin-error" role="alert">{error}</p> : null}
      <div className="plugin-actions"><button disabled={!!busy} onClick={() => setStop(null)}>取消</button><button className="plugin-danger" disabled={!!busy} onClick={applyStop}>保留恢复稿并{stop.action === 'uninstall' ? '卸载' : stop.action === 'pause' ? '暂停' : stop.action === 'sleep' ? '休眠' : '停用'}</button></div>
    </PluginDialog> : null}
    {!detail && tab === 'runtime' ? <><div className="plugin-section-heading plugin-runtime-heading"><div><h3>运行状态</h3><p>查看哪个扩展在工作，按需停止或恢复。</p></div><label>操作范围 <select aria-label="运行状态操作范围" value={scope} onChange={event => changeScope(event.target.value as typeof scope)}><option value="global">所有项目</option>{projectId ? <option value="project">当前项目</option> : null}</select></label></div><PluginRuntimeList states={filtered} busy={!!busy} projectId={projectId} status={runtimeLabel} onDetails={id => { setSelected(id); setLogs(null); }} onStop={(state, action) => void beginStop(state, action)} onResume={state => void resume(state)} onActivate={state => void run('激活扩展', async () => { await activatePlugin(state.id, projectId, 'command'); })} /></> : null}
    {!detail && tab === 'updates' ? <section className="plugin-updates"><div className="plugin-section-heading"><h3>本地扩展更新</h3><p>选择新版本扩展包，查看版本与权限变化后再更新。</p></div><div className="plugin-update-local"><span className="plugin-glyph"><PackagePlus size={21} /></span><div><h4>从本地扩展包更新</h4><p>使用已下载的 .horizon-extension 文件检查更新。</p></div><button className="plugin-tonal" disabled={!!busy} onClick={() => openPicker('update')}><PackagePlus size={15} />选择更新包</button></div><div className="plugin-update-policy"><div><h4>更新方式</h4><p>更新失败时保留旧版本与配置；新增权限始终先确认。</p></div><span className="plugin-state">手动选择本地包</span></div></section> : null}
    {!detail && tab === 'developer' ? <PluginDeveloper states={states} busy={!!busy} onError={setError} chooseDirectory={() => void choosePackage(true)} reload={id => void run('检查开发目录', async () => { setInstall(await call<InstallPlan>('extension_dev_reload_prepare', { extensionId: id }, projectId)); setGrants([]); })} logs={id => { setSelected(id); setLogs('正在读取运行记录…'); void run('读取日志', async () => { const result = await call<{ items: { time: string; message: string }[] }>('extension_logs', { extensionId: id }, projectId); setLogs(result.items?.map(item => `${new Date(item.time).toLocaleTimeString()}  ${item.message}`).join('\n') || '尚无运行记录。'); }); }} /> : null}
    {!detail && (tab === 'discover' || tab === 'installed') ? <div className="plugin-grid">{filtered.map(state => <PluginCard key={state.id} state={state} status={runtimeLabel(state)} busy={!!busy} onDetails={() => { setSelected(state.id); setLogs(null); }} onToggle={() => { void toggle(state); }} onPause={() => { void beginStop(state, 'pause'); }} onResume={() => { void resume(state); }} onRestore={() => { void run('恢复默认包', async () => { await call('extension_restore', { extensionId: state.id }, projectId); }); }} />)}</div> : null}
    {!detail && filtered.length === 0 && !['updates', 'developer'].includes(tab) ? <div className="plugin-empty"><span className="plugin-glyph"><PackageOpen size={28} /></span><h3>{query || category !== '全部' ? '没有匹配的扩展' : '从需要的第一个扩展开始。'}</h3><p>{query || category !== '全部' ? '试试其他名称、能力或分类。' : '宿主管理仍可使用。恢复文件树、编辑器、Git 或布局插件，继续需要的工作。'}</p><div className="plugin-actions"><button className="plugin-primary" onClick={() => selectTab('discover')}><Compass size={15} />发现扩展</button><button disabled={!!busy || !nativeAvailable()} onClick={() => openPicker('install')}><PackagePlus size={15} />安装本地扩展包</button></div></div> : null}
    {visibleCommands.length > 0 ? <section className="plugin-command-list"><h3>扩展命令</h3>{visibleCommands.map(command => <button key={command.id} onClick={command.execute}>{command.title}</button>)}</section> : null}
    {detail && <PluginDetails key={detail.id} initialTab={logs === null ? 'overview' : 'logs'} state={detail} projectId={projectId} busy={!!busy} status={runtimeLabel(detail)} logs={logs} actionScope={scope} onBack={() => selectTab('installed')} onToggle={() => void toggle(detail)} onUninstall={() => void beginStop(detail, 'uninstall')} onInherit={() => void run('恢复继承全局', async () => { await call('extension_project_override', { extensionId: detail.id, projectId, policy: 'inherit', expectedRevision: detail.revision }, projectId); })} onLogs={() => void run('读取日志', async () => { const result = await call<{ items: { time: string; message: string }[] }>('extension_logs', { extensionId: detail.id }, projectId); setLogs(result.items?.map(item => `${new Date(item.time).toLocaleTimeString()}  ${item.message}`).join('\n') || null); })} onUpdate={() => openPicker('update')} onRollback={() => void run('回退扩展版本', async () => { await call('extension_rollback', { extensionId: detail.id, expectedRevision: detail.revision }, projectId); })} onActivate={() => void run('激活扩展', async () => { await activatePlugin(detail.id, projectId, 'command'); })} />}
  </section>;
}
