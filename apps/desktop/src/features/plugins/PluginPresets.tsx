import { useEffect, useState } from 'react';
import { call, errorMessage } from '../../bridge';
import { PluginDialog } from './PluginDialog';
import { PluginImpact, type PluginImpactPlan } from './PluginImpact';
import { pluginRuntime } from './service';

type Profile = 'minimal' | 'review' | 'development' | 'custom';
interface PresetState { profile: Profile; selectedIds: string[]; source: string; items: { id: string; name: string; installed: boolean; enabledGlobal: boolean; requires: Record<string, string> }[] }
interface PresetPlan extends PluginImpactPlan { planId: string; digest: string; profile: Profile; selectedIds: string[]; enableIds: string[]; stopIds: string[]; missingIds: string[]; blockers: string[] }
const profiles: { id: Profile; title: string; description: string }[] = [
  { id: 'minimal', title: '极简阅读', description: '文件树、代码与搜索。' },
  { id: 'review', title: '代码审查', description: '阅读能力与 Git。首次使用的默认配置。' },
  { id: 'development', title: '项目开发', description: '阅读与 Git，加上你选择的终端、项目启动器。' },
  { id: 'custom', title: '自定义', description: '逐项选择已安装功能，必需依赖一并列入计划。' },
];
export function PluginPresets({ projectId, onClose, onApplied }: { projectId?: string; onClose(): void; onApplied(): Promise<void> }) {
  const [scope, setScope] = useState<'global' | 'project'>('global');
  const targetProject = scope === 'project' ? projectId : undefined;
  const [state, setState] = useState<PresetState | null>(null);
  const [profile, setProfile] = useState<Profile>('review');
  const [customIds, setCustomIds] = useState<string[]>([]);
  const [developmentIds, setDevelopmentIds] = useState<string[]>(['horizon.terminal', 'horizon.launch']);
  const [plan, setPlan] = useState<PresetPlan | null>(null);
  const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false; setState(null); setPlan(null); setError('');
    void call<PresetState>('extension_preset_state', { projectId: targetProject }).then(value => {
      if (cancelled) return; setState(value); setProfile(value.profile); setCustomIds(value.selectedIds);
    }).catch(cause => { if (!cancelled) setError(errorMessage(cause)); });
    return () => { cancelled = true; };
  }, [targetProject]);
  const name = (id: string) => plan?.extensionNames[id] ?? state?.items.find(item => item.id === id)?.name ?? id;
  async function prepare() {
    if (busy) return; setBusy('正在核对启停影响…'); setError('');
    try { setPlan(await call<PresetPlan>('extension_preset_prepare', { profile, scope, projectId: targetProject, selectedIds: profile === 'custom' ? customIds : profile === 'development' ? developmentIds : [] }, targetProject)); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(''); }
  }
  async function apply() {
    if (!plan || busy) return; setBusy('正在停止所列资源并应用预设…'); setError('');
    try {
      for (const id of plan.stopIds) {
        const readiness = await pluginRuntime.prepareDeactivate(id, { reason: 'disable', projectId: plan.projectId });
        if (!readiness.ready) throw new Error(`请先处理文档或任务：${readiness.blockers.join('、')}`);
      }
      const decisions = plan.dirtyDocuments.map(document => ({ resourceId: document.documentId, checkpointId: document.documentId, action: 'retainCheckpoint' }));
      await call('extension_preset_apply', { planId: plan.planId, digest: plan.digest, decisions }, targetProject);
      for (const id of plan.stopIds) await pluginRuntime.stop(id, { reason: 'disable', projectId: plan.projectId });
      await onApplied(); onClose();
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(''); }
  }
  return <PluginDialog title={plan ? '确认能力预设影响' : '能力预设'} busy={!!busy} onClose={onClose}>
    {plan ? <>
      <h3>{profiles.find(item => item.id === plan.profile)?.title} · {plan.projectId ? '当前项目' : '所有项目的全局默认'}</h3>
      <div className="plugin-preset-changes"><section><h4>新增启用 / 恢复 · {plan.enableIds.length}</h4><p>{plan.enableIds.map(name).join('、') || '没有新增能力'}</p></section><section><h4>停止能力 · {plan.stopIds.length}</h4><p>{plan.stopIds.map(name).join('、') || '没有需要停止的能力'}</p></section></div>
      <p className="plugin-muted">启用后按命令或视图激活；终端和启动方案仍需单独点击运行。{plan.projectId ? '全局停用仍优先于项目选择。' : '已有项目覆盖继续保留。'}</p>
      {plan.missingIds.length ? <div className="plugin-error" role="alert">缺少扩展：{plan.missingIds.map(name).join('、')}。请先在插件中心明确安装，再重新检查预设。</div> : null}
      {plan.blockers.length ? <div className="plugin-error" role="alert"><strong>仍需处理</strong><ul>{plan.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul></div> : null}
      <PluginImpact plan={plan} />
    </> : <>
      <p className="plugin-muted">选择工作需要的能力，再确认新增启用、停止与文档影响。布局与主题保持当前选择。</p>
      <label>应用范围 <select disabled={!!busy} value={scope} onChange={event => setScope(event.target.value as typeof scope)}><option value="global">所有项目 · 全局默认</option>{projectId ? <option value="project">当前项目覆盖</option> : null}</select></label>
      {!state ? <p role="status">{error ? '预设状态读取失败。' : '正在读取当前能力…'}</p> : <>
        <fieldset className="plugin-preset-options"><legend>选择预设</legend>{profiles.map(item => <label key={item.id}><input type="radio" name="capability-preset" value={item.id} checked={profile === item.id} onChange={() => setProfile(item.id)} /><span><strong>{item.title}</strong><small>{item.description}</small></span></label>)}</fieldset>
        {profile === 'development' ? <fieldset><legend>开发能力</legend>{[{ id: 'horizon.terminal', title: '集成终端' }, { id: 'horizon.launch', title: '项目启动器' }].map(item => <label key={item.id}><input type="checkbox" checked={developmentIds.includes(item.id)} onChange={event => setDevelopmentIds(ids => event.target.checked ? [...ids, item.id] : ids.filter(id => id !== item.id))} />{item.title}</label>)}</fieldset> : null}
        {profile === 'custom' ? <fieldset className="plugin-preset-custom"><legend>功能扩展</legend>{state.items.map(item => <label key={item.id}><input type="checkbox" disabled={!item.installed} checked={customIds.includes(item.id)} onChange={event => setCustomIds(ids => event.target.checked ? [...ids, item.id] : ids.filter(id => id !== item.id))} /><span>{item.name}<small>{!item.installed ? '尚未安装' : !item.enabledGlobal && scope === 'project' ? '全局已停用；需要先在全局范围启用' : Object.keys(item.requires).length ? `需要 ${Object.keys(item.requires).map(name).join('、')}` : item.id}</small></span></label>)}</fieldset> : null}
      </>}
    </>}
    {error ? <p className="plugin-error" role="alert">{error}</p> : null}{busy ? <p className="plugin-muted" role="status">{busy}</p> : null}
    <div className="plugin-actions"><button disabled={!!busy} onClick={() => plan ? setPlan(null) : onClose()}>{plan ? '返回选择' : '取消'}</button>{plan ? <button className="plugin-primary" disabled={!!busy || !!plan.missingIds.length || !!plan.blockers.length} onClick={() => void apply()}>保留恢复稿并应用</button> : <button className="plugin-primary" disabled={!!busy || !state} onClick={() => void prepare()}>检查启停影响</button>}</div>
  </PluginDialog>;
}
