import { useEffect, useState, useSyncExternalStore } from 'react';
import { RotateCcw, Check } from 'lucide-react';
import { call, errorMessage } from '../../bridge';
import type { SettingDefinition } from '../../../../../packages/plugins/src/types';
import { refreshPlugins } from './service';
import { configurationDrafts, type ConfigurationScope } from './configurationDrafts';

interface Configuration { revision: number; global: Record<string, unknown>; project: Record<string, unknown> | null; schema: SettingDefinition[] | null }
export function PluginConfiguration({ extensionId, projectId }: { extensionId: string; projectId?: string }) {
  const drafts = useSyncExternalStore(configurationDrafts.subscribe, () => configurationDrafts.get(extensionId, projectId));
  const { scope } = drafts; const draft = drafts[scope];
  const [config, setConfig] = useState<Configuration | null>(null);
  const [error, setError] = useState(''); const [saving, setSaving] = useState('');
  useEffect(() => { let cancelled = false; setConfig(null); setError(''); void call<Configuration>('extension_config_get', { extensionId }, projectId).then(value => { if (!cancelled) setConfig(value); }).catch(error => { if (!cancelled) setError(errorMessage(error)); }); return () => { cancelled = true; }; }, [extensionId, projectId]);
  async function save(key: string, value: unknown) {
    if (!config || saving) return;
    const savedDraft = draft[key];
    setSaving(key); setError('');
    try { await call('extension_config_set', { extensionId, expectedRevision: config.revision, scope, key, value }, projectId); const fresh = await call<Configuration>('extension_config_get', { extensionId }, projectId); setConfig(fresh); configurationDrafts.saved(extensionId, projectId, scope, key, savedDraft); await refreshPlugins(projectId); }
    catch (error) { setError(errorMessage(error)); } finally { setSaving(''); }
  }
  if (!config) return <p className="plugin-muted" role={error ? 'alert' : 'status'}>{error || '正在读取扩展设置…'}</p>;
  return <section className="plugin-config">
    <div className="plugin-config-scope"><label>设置范围 <select value={scope} onChange={event => configurationDrafts.setScope(extensionId, projectId, event.target.value as ConfigurationScope)}><option value="global">全局默认</option>{projectId && <option value="project">当前项目覆盖</option>}</select></label><span className="plugin-state">{scope === 'global' ? '所有项目' : '当前项目'}</span></div>
    {(Object.keys(drafts.global).length + Object.keys(drafts.project).length) > 0 && <p className="plugin-muted" role="status">有未保存的设置草稿，仅在当前窗口内保留。切换范围或返回后仍可继续编辑；点击字段右侧的保存按钮后生效。{Object.keys(draft).length > 0 && <button className="plugin-text-button" disabled={!!saving} onClick={() => configurationDrafts.discard(extensionId, projectId, scope)}>放弃此范围草稿</button>}</p>}
    {error && <p className="plugin-error" role="alert">{error}</p>}
    {!config.schema?.length && <p className="plugin-muted">此扩展未声明可配置字段。</p>}
    {config.schema?.map(field => {
      const local = scope === 'project' ? config.project?.[field.key] : config.global[field.key];
      const inherited = scope === 'project' ? config.global[field.key] : undefined;
      const value = field.key in draft ? draft[field.key] : local ?? inherited ?? field.default ?? (field.type === 'boolean' ? false : '');
      const changed = field.key in draft;
      return <div className="plugin-setting-row" key={field.key}><div><strong>{field.label}</strong><small>{changed && '未保存 · '}{local !== undefined ? scope === 'project' ? '当前项目覆盖' : '全局设置' : inherited !== undefined ? '继承全局' : '扩展默认'}</small></div>
        {field.type === 'boolean' ? <label className="plugin-switch"><input aria-label={field.label} type="checkbox" checked={value === true} onChange={event => configurationDrafts.setValue(extensionId, projectId, scope, field.key, event.target.checked)} /><span /></label> : field.type === 'select' ? <select aria-label={field.label} value={String(value)} onChange={event => configurationDrafts.setValue(extensionId, projectId, scope, field.key, event.target.value)}>{field.options?.map(option => <option key={option}>{option}</option>)}</select> : <input aria-label={field.label} value={String(value)} placeholder={field.type === 'path' ? '输入路径' : undefined} onChange={event => configurationDrafts.setValue(extensionId, projectId, scope, field.key, event.target.value)} />}
        <button aria-label={`保存 ${field.label}`} title="保存设置" disabled={!changed || !!saving} onClick={() => void save(field.key, value)}><Check size={15} /></button>
        <button aria-label={`${field.label} 恢复继承`} title="恢复继承 / 默认" disabled={local === undefined || !!saving} onClick={() => void save(field.key, null)}><RotateCcw size={14} /></button>
      </div>;
    })}
  </section>;
}
