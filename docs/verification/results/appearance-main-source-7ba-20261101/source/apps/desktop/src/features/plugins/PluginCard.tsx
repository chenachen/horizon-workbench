import { Zap } from 'lucide-react';
import type { ExtensionState } from '../../../../../packages/plugins/src/types';
import { PluginGlyph, pluginCategory, pluginScope, pluginTrigger } from './presentation';

export function PluginCard({ state, status, busy, onDetails, onToggle, onPause, onResume, onRestore }: {
  state: ExtensionState; status: string; busy: boolean;
  onDetails(): void; onToggle(): void; onPause(): void; onResume(): void; onRestore(): void;
}) {
  const installed = state.installState !== 'absent';
  const active = state.effectiveEnabled && !state.effectivePaused && state.runState === 'active' && state.manifest?.runtime.kind !== 'declarative';
  return <article className="plugin-card">
    <div className="plugin-card-top"><PluginGlyph manifest={state.manifest} /><div><h3>{state.manifest?.name ?? state.id}</h3><small>{state.manifest?.author ?? '本地扩展'} · {pluginCategory(state.manifest)}</small></div><span className={`plugin-state ${active ? 'active' : state.effectivePaused ? 'paused' : ''}`}>{status}</span></div>
    <p>{state.manifest?.description}</p>
    <div className="plugin-trigger"><Zap size={12} />{pluginTrigger(state.manifest)}</div>
    {state.error ? <p className="plugin-error">{state.error.message}</p> : null}
    <div className="plugin-card-foot"><small>v{state.installedVersion ?? state.manifest?.version}{installed ? ` · ${pluginScope(state)}` : ''}</small><div className="plugin-card-actions">
      {installed ? <><button onClick={onDetails}>详情</button><button className={state.effectiveEnabled ? 'plugin-text-button' : 'plugin-tonal'} disabled={busy} onClick={onToggle}>{state.effectiveEnabled ? '停用' : '启用'}</button>{state.effectiveEnabled ? <button className="plugin-text-button" disabled={busy} onClick={state.effectivePaused ? onResume : onPause}>{state.effectivePaused ? '恢复' : '暂停'}</button> : null}</> : <button className="plugin-primary" disabled={busy} onClick={onRestore}>恢复安装</button>}
    </div></div>
  </article>;
}
