import { Check, PackagePlus, ShieldCheck } from 'lucide-react';
import type { PluginManifest } from '../../../../../packages/plugins/src/types';
import { PluginDialog } from './PluginDialog';
import { PluginGlyph, capabilityLabel } from './presentation';

interface Permission { id: string; capability: string; description: string }
export interface InstallPlan { planId: string; digest: string; manifest: PluginManifest; source: string; permissions: Permission[]; downloadBytes: string; previousVersion?: string; newPermissions?: string[]; development?: boolean }

export function PluginPackagePicker({ update, busy, error, onClose, onChoose }: { update: boolean; busy: boolean; error: string; onClose(): void; onChoose(): void }) {
  return <PluginDialog title={update ? '选择扩展更新包' : '安装扩展包'} busy={busy} onClose={onClose}>
    <div className="plugin-package-picker"><PackagePlus size={28} /><strong>选择 .horizon-extension 扩展包</strong><span>从已下载的本地文件中选择，随后检查兼容性与权限。</span><button className="plugin-tonal" disabled={busy} onClick={onChoose}>选择文件</button></div>
    {busy ? <p className="plugin-muted" role="status">正在检查扩展包…</p> : null}
    {error ? <p className="plugin-error" role="alert">{error}</p> : null}
    <div className="plugin-actions"><button disabled={busy} onClick={onClose}>取消</button></div>
  </PluginDialog>;
}

export function PluginInstallDialog({ plan, grants, busy, phase, error, cancellable, onGrant, onClose, onCancel, onInstall }: {
  plan: InstallPlan; grants: string[]; busy: boolean; phase: string; error: string; cancellable: boolean;
  onGrant(id: string, allowed: boolean): void; onClose(): void; onCancel(): void; onInstall(): void;
}) {
  const hasNewPermissions = !!plan.previousVersion && !!plan.newPermissions?.length;
  const title = busy ? `正在安装 ${plan.manifest.name}` : hasNewPermissions ? '更新需要新的权限' : plan.previousVersion ? '检查扩展更新' : '确认扩展权限';
  return <PluginDialog title={title} busy={busy} onClose={onClose}>
    <div className="plugin-package-info"><PluginGlyph manifest={plan.manifest} /><div><strong>{plan.manifest.name}</strong><small>{plan.previousVersion ? `v${plan.previousVersion} → ` : ''}v{plan.manifest.version} · {plan.manifest.author}</small></div><span className="plugin-state active">兼容</span></div>
    {busy ? <div className="plugin-install-progress" role="status"><p><Check size={16} />扩展包与兼容性已检查</p><p><Check size={16} />所需权限已确认</p><p className="plugin-install-current"><PackagePlus size={16} />{phase || '准备安装扩展文件'}</p><progress aria-label="扩展安装进度" /></div> : <>
      <dl className="plugin-package-meta"><dt>来源</dt><dd>{plan.source}</dd><dt>兼容版本</dt><dd>Horizon {plan.manifest.engines.horizon}</dd><dt>包大小</dt><dd>{Number(plan.downloadBytes).toLocaleString()} 字节</dd></dl>
      <fieldset className="plugin-install-permissions"><legend>所需权限</legend>{plan.permissions.length ? plan.permissions.map(permission => {
        const added = !!plan.previousVersion && !!plan.newPermissions?.includes(permission.capability);
        return <label key={permission.id} className={added ? 'plugin-permission-new' : ''}><input type="checkbox" checked={grants.includes(permission.id)} onChange={event => onGrant(permission.id, event.target.checked)} /><ShieldCheck size={17} /><span>{capabilityLabel(permission.capability)}<small>{permission.capability}</small></span><span className={`plugin-state ${added ? 'plugin-state-new' : ''}`}>{added ? '新增' : '必需'}</span></label>;
      }) : <p className="plugin-muted">此扩展无需额外权限。</p>}</fieldset>
      <p className="plugin-muted">授权适用于此扩展，文件与 Git 调用限定在当前项目。{plan.previousVersion ? '更新保留现有配置与启用状态。' : '安装完成后，可选择启用范围。'}</p>
    </>}
    {error ? <p className="plugin-error" role="alert">{error}</p> : null}
    <div className="plugin-actions"><button autoFocus disabled={busy && !cancellable} onClick={busy ? onCancel : onClose}>{busy ? '取消安装' : plan.previousVersion ? '暂不更新' : '取消'}</button><button className="plugin-primary" disabled={busy || grants.length !== plan.permissions.length} onClick={onInstall}>{plan.previousVersion ? '允许并更新' : '授权并安装'}</button></div>
  </PluginDialog>;
}
