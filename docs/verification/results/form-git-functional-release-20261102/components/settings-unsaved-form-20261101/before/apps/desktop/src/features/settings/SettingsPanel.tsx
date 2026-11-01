import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { call, start, errorMessage, getBridgeDiagnostics, HorizonError, nativeAvailable } from '../../bridge';
import { appearanceTarget, useAppearance, useSettings, windowGeometry, type SettingsSnapshot } from './AppearanceProvider';
import { contrastRatio, fieldKey, geometryLabels, normalizeColor, sourceLabel, tokenLabels, type AppearanceChange, type AppearanceField, type AppearancePreset, type AppearanceSnapshot, type BackgroundAppearance, type BackgroundAsset, type ColorMode, type GeometryKey, type LayoutDefinition, type ThemeDefinition, type ThemeToken } from '../../../../../packages/appearance/src';
import type { ExtensionState } from '../../../../../packages/plugins/src/types';
import type { Bootstrap, Project } from '../../workspace';
import { Palette, PanelsTopLeft, Ruler, Image, Bookmark, BookmarkPlus, Code, Folders, Sparkles, GitBranch, Keyboard, Shield, ImagePlus, Check, Info, AlertCircle, Pencil, Puzzle, Download, Trash2, X } from 'lucide-react';
import './settings.css';
import { anonymizeEditorDiagnostics } from './diagnostics';
import { backgroundObjectUrl } from './background';
import { defaultShortcuts, shortcutLabels, shortcutDisplay, shortcutFromEvent } from './shortcuts';
import { previewAppearanceChanges, settleAppearanceChanges } from './pendingAppearance';

const sections = [
  ['appearance', '主题与配色', '外观', '调整整个应用的外观，切换项目保持一致。'],
  ['layout', '布局与尺寸', '外观', '选择工作台结构，调整空间与界面密度。'],
  ['background', '背景图片', '外观', '选择本地图片，调节区域与可见度。'],
  ['presets', '外观方案', '外观', '保存布局、配色、尺寸与背景，随时换回。'],
  ['editor', '编辑器', '编辑器', '字体、缩进与保存方式，适合你的工作习惯。'],
  ['projects', '项目与资源', '项目与资源', '会话常在，后台能力按需恢复。'],
  ['ai', 'AI 连接', 'AI 连接', '管理 Pi 与模型连接。'],
  ['git', 'Git', 'Git', '沿用本机 Git 与各仓库配置。'],
  ['keys', '快捷键', '快捷键', '按操作查找，录入你熟悉的按键。'],
  ['data', '数据与隐私', '数据与隐私', '管理本机配置、缓存、聊天、恢复草稿和凭据。'],
] as const;
type Section = typeof sections[number][0];
export type SettingsSection = Section | 'sizes' | 'colors';
const appearanceSections: Section[] = ['appearance', 'layout', 'background', 'presets'];
const globalSettings = new Set(['ui.fontSize', 'ui.density', 'ui.reduceMotion', 'editor.fontSize', 'editor.fontFamily', 'git.path', 'git.diffView', 'shortcuts']);
function initialSettingsSection(section: SettingsSection): Section {
  if (section === 'sizes') return 'layout';
  if (section === 'colors') return 'appearance';
  const remembered = sessionStorage.getItem('horizon.settings.appearanceTab') as Section | null;
  return section === 'appearance' && remembered && appearanceSections.includes(remembered) ? remembered : section;
}
type DataExportCategory = 'settings' | 'diagnostics';
type DataExportPlan = { planId: string; expiresAt: string; byteCount: string; suggestedName: string; data: Record<string, unknown> };
type DataExportPreview = DataExportPlan & { category: DataExportCategory; chunks: string[] };
const sectionIcons = { appearance: Palette, layout: PanelsTopLeft, background: Image, presets: Bookmark, editor: Code, projects: Folders, ai: Sparkles, git: GitBranch, keys: Keyboard, data: Shield };
const navigationDescriptions: Record<LayoutDefinition['navigation'], string> = { rail: '项目导航与文件侧栏分列', unified: '项目与文件集中在一侧', tabs: '从顶部切换项目', compact: '缩小导航占用空间', drawer: '按需展开项目导航', expressive: '独立卡片与宽松分区', expanded: '直接浏览项目和文件', dock: '从底部切换项目' };
const projectStateLabels: Record<Project['state'], string> = { registered: '尚未打开', activating: '正在打开', active: '活动中', idle: '会话已保存', sleeping: '已休眠', unavailable: '路径不可用' };
const extensionForResource = (extensions: ExtensionState[], id: string) => extensions.find(item => item.id === id || item.manifest?.contributes.layouts?.some(layout => layout.id === id) || item.manifest?.contributes.themes?.some(theme => theme.id === id));
function Row({ label, description, source, children, onReset }: { label: string; description?: string; source?: string; children: ReactNode; onReset?: () => void }) {
  return <div className="setting-row"><div className="setting-copy"><span>{label}</span>{description ? <small>{description}</small> : null}{source ? <small className="setting-source">{source}</small> : null}</div><div className="setting-control">{children}{onReset ? <button className="custom-reset" onClick={onReset}>{source?.startsWith('项目覆盖') ? '使用全局设置' : '恢复默认'}</button> : null}</div></div>;
}
function Note({ children, error = false }: { children: ReactNode; error?: boolean }) { const Icon = error ? AlertCircle : Info; return <div className={`setting-note setting-note-with-icon${error ? ' setting-note-error' : ''}`}><Icon size={16} aria-hidden="true" /><div>{children}</div></div>; }
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) {
  return <button type="button" role="switch" className="settings-switch" aria-label={label} aria-checked={value} onClick={() => onChange(!value)}><span /></button>;
}
function MiniPreview({ layout, theme, colors }: { layout: LayoutDefinition; theme: ThemeDefinition; colors?: Partial<Record<ThemeToken, string>> }) {
  const style = colors ? Object.fromEntries(Object.entries(colors).map(([token, value]) => [`--${token === 'onAccent' ? 'on-accent' : token}`, value])) as CSSProperties : undefined;
  return <div className="custom-mini" style={style} data-mini-layout={layout.navigation} aria-label={`${layout.label}布局 · ${theme.label}主题预览`}>
    <div className="custom-mini-top"><i /><i /><i /><strong>Horizon</strong><span>{layout.label} · {theme.label}</span></div>
    <div className="custom-mini-body"><div className="custom-mini-nav"><b>H</b><b>↗</b><b>＋</b></div><div className="custom-mini-tree">工作区<br /><b>外观设置</b><br />布局<br />主题</div><div className="custom-mini-code"><span className="preview-keyword">const</span> appearance = {'{'}<br />&nbsp; theme: <span className="preview-string">&quot;{theme.label}&quot;</span>,<br />&nbsp; layout: <span className="preview-string">&quot;{layout.label}&quot;</span><br />{'}'};<span className="custom-mini-hint">即时预览</span></div></div>
  </div>;
}
function NumberControl({ label, value, min, max, step = 1, source, effective, unit = 'px', onChange, onReset }: { label: string; value: number; min: number; max: number; step?: number; source?: string; effective?: number; unit?: string; onChange(value: number): void; onReset?: () => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const invalid = text.trim() === '' || !Number.isFinite(Number(text)) || Number(text) < min || Number(text) > max;
  const change = (text: string) => { setText(text); const number = Number(text); if (text.trim() && Number.isFinite(number) && number >= min && number <= max) onChange(number); };
  return <div className="custom-range"><label>{label}<small>{source}{effective !== undefined && effective !== value ? ` · 当前 ${effective}` : ''}</small></label><input type="range" aria-label={label} style={{ '--range-progress': `${((invalid ? value : Number(text)) - min) / (max - min) * 100}%` } as CSSProperties} min={min} max={max} step={step} value={invalid ? value : Number(text)} onChange={event => change(event.target.value)} onKeyDown={event => { if (event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); change(String(Math.min(max, Math.max(min, Number(text) + (event.key === 'ArrowRight' ? 10 : -10))))); } }} /><input type="number" aria-label={`${label}数值`} aria-invalid={invalid} min={min} max={max} step={step} value={text} onChange={event => change(event.target.value)} /><span>{unit}</span>{onReset ? <button className="custom-reset" onClick={onReset}>{source?.startsWith('项目覆盖') ? '使用全局设置' : '恢复默认'}</button> : <span />}{invalid ? <small className="settings-field-error">请输入 {min}–{max} 之间的数值，仍使用上个有效值。</small> : null}</div>;
}
function ColorControl({ token, value, source, onChange, onReset }: { token: ThemeToken; value: string; source: string; onChange(value: string): void; onReset(): void }) {
  const [text, setText] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value); }, [value]);
  const normalized = normalizeColor(text);
  return <div className="custom-color"><input type="color" aria-label={`${tokenLabels[token]}色板`} value={normalizeColor(value) ?? '#000000'} onChange={event => { setText(event.target.value); onChange(event.target.value); }} /><div><label>{tokenLabels[token]}</label><input aria-label={`${tokenLabels[token]}颜色值`} className="color-text" aria-invalid={!normalized} value={text} onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; if (normalized) setText(normalized); }} onChange={event => { setText(event.target.value); const next = normalizeColor(event.target.value); if (next) onChange(next); }} /><small>{normalized ? source : '使用 HEX 或 RGB；保留上个有效值'}</small></div><button className="custom-reset" onClick={onReset}>恢复</button></div>;
}

function exportPreviewChunks(data: unknown): string[] {
  const text = JSON.stringify(data, null, 2);
  if (text === undefined) throw new Error('导出预览内容不可用');
  const chunks: string[] = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + 65_536, text.length);
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xD800 && last <= 0xDBFF) end--;
    chunks.push(text.slice(start, end)); start = end;
  }
  return chunks;
}

function DataExportDialog({ preview, busy, error, onClose, onConfirm }: { preview: DataExportPreview; busy: boolean; error: string; onClose(): void; onConfirm(): void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const [page, setPage] = useState(0);
  useEffect(() => { contentRef.current?.scrollTo({ top: 0, left: 0 }); }, [page]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current!; dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialogRef} className="modal settings-export-preview" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!busy) onClose(); }}>
    <header className="settings-export-heading"><h2 id={titleId}>导出内容预览</h2><button className="icon-button" aria-label="关闭导出预览" disabled={busy} onClick={onClose}><X size={18} /></button></header>
    <div className="settings-export-content">
      <dl className="settings-export-summary"><div><dt>内容</dt><dd>{preview.category === 'settings' ? '配置与主题' : '诊断统计'}</dd></div><div><dt>文件</dt><dd>{preview.suggestedName}</dd></div><div><dt>大小</dt><dd>{Number(preview.byteCount).toLocaleString()} 字节</dd></div></dl>
      <p className="settings-secondary">以下为已脱敏的导出快照。确认后选择保存位置，文件内容与本次预览一致。</p>
      <p className="settings-export-range" role="status">{preview.chunks.length === 1 ? '显示完整 JSON 内容' : `当前显示第 ${page + 1} / ${preview.chunks.length} 段；使用下方翻页查看其余内容。`}</p>
      <textarea ref={contentRef} className="settings-export-json" aria-label={`导出 JSON 内容${preview.chunks.length > 1 ? `，第 ${page + 1} 段` : ''}`} readOnly spellCheck={false} wrap="off" value={preview.chunks[page]} />
      {preview.chunks.length > 1 ? <nav className="settings-export-pages" aria-label="导出内容分页"><button disabled={page === 0} onClick={() => setPage(value => value - 1)}>上一段</button><span>{page + 1} / {preview.chunks.length}</span><button disabled={page === preview.chunks.length - 1} onClick={() => setPage(value => value + 1)}>下一段</button></nav> : null}
      <p className="settings-secondary">预览有效至 <time dateTime={preview.expiresAt}>{new Date(preview.expiresAt).toLocaleTimeString()}</time></p>
      {error ? <p className="settings-export-error" role="alert">{error}</p> : null}
    </div>
    <footer className="settings-export-footer"><button disabled={busy} onClick={onClose}>取消</button><button className="primary-button" disabled={busy} onClick={onConfirm}>{busy ? '正在处理…' : '确认并选择保存位置'}</button></footer>
  </dialog>;
}

export function SettingsPanel({ projectId, projectName, projects = [], onSelectProject, onError, agentSettings, projectSettings, initialSection = 'appearance', onSectionChange, onManagePlugins, onManageRecovery, onDirtyChange, onClose }: { projectId?: string; projectName?: string; projects?: Project[]; onSelectProject?: (id: string) => Promise<boolean>; onError?: (error: unknown) => void; agentSettings?: ReactNode; projectSettings?: ReactNode; initialSection?: SettingsSection; onSectionChange?: (section: SettingsSection) => void; onManagePlugins?: () => void; onManageRecovery?: () => void; onDirtyChange?: (dirty: boolean) => void; onClose?: () => void }) {
  const appearance = useAppearance();
  const [section, setSection] = useState<Section>(() => initialSettingsSection(initialSection));
  const contentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [section]);
  const [visited, setVisited] = useState(() => new Set<Section>([initialSettingsSection(initialSection)]));
  useEffect(() => { const next = initialSettingsSection(initialSection); setSection(next); setVisited(previous => new Set([...previous, next])); }, [initialSection]);
  const changeSection = (next: Section) => { if (appearanceSections.includes(next)) sessionStorage.setItem('horizon.settings.appearanceTab', next); setSection(next); setVisited(previous => new Set([...previous, next])); onSectionChange?.(next); };
  const [scope, setScope] = useState<'global' | 'project'>('global');
  const selectedProject = scope === 'project' && ['editor', 'projects', 'git'].includes(section) ? projectId : undefined;
  const loadGeneration = useRef(0);
  const [snapshot, setSnapshot] = useState<AppearanceSnapshot | null>(null);
  const snapshotRef = useRef<AppearanceSnapshot | null>(null);
  const { settings, refresh: refreshSettings } = useSettings(selectedProject);
  const settingsRef = useRef<SettingsSnapshot | null>(settings); settingsRef.current = settings;
  const [busy, setBusy] = useState('');
  const [cancelTask, setCancelTask] = useState<(() => Promise<unknown>) | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [projectSummary, setProjectSummary] = useState<Bootstrap | null>(null);
  useEffect(() => { if (layoutError && section === 'layout') contentRef.current?.scrollTo({ top: 0 }); }, [layoutError, section]);
  const [tokenMode, setTokenMode] = useState<ColorMode>('light');
  const [presets, setPresets] = useState<AppearancePreset[]>([]);
  const [editingPreset, setEditingPreset] = useState<AppearancePreset | null>(null);
  const [presetName, setPresetName] = useState('');
  const [includeBackground, setIncludeBackground] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<{ assetId: string; url: string } | null>(null);
  const [shortcutSearch, setShortcutSearch] = useState('');
  const [recording, setRecording] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ action: string; other: string; value: string } | null>(null);
  const [pendingShortcut, setPendingShortcut] = useState<{ action: string; value: string } | null>(null);
  const [gitVersion, setGitVersion] = useState('');
  const [gitIdentity, setGitIdentity] = useState<{ name: { value: string | null; source: string }; email: { value: string | null; source: string } } | null>(null);
  const [clearCategory, setClearCategory] = useState('');
  const [clearPlan, setClearPlan] = useState<{ planId: string; digest: string; items: { id: string; category: string; bytes: string }[]; blockedIds: string[]; externalUntouched: string[] } | null>(null);
  const [drafts, setDrafts] = useState<{ checkpointId: string; documentId: string; projectId: string; updatedAt: string; byteCount: string }[]>([]);
  const [selectedDrafts, setSelectedDrafts] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<{ credentialRef: string; connectionId: string; persistence: string; configured: boolean }[]>([]);
  const [selectedCredentials, setSelectedCredentials] = useState<string[]>([]);
  const [dataExportPreview, setDataExportPreview] = useState<DataExportPreview | null>(null);
  const [dataExportBusy, setDataExportBusy] = useState(false);
  const [dataExportError, setDataExportError] = useState('');
  const dataExportPlanRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const planId = dataExportPlanRef.current; dataExportPlanRef.current = null;
      if (planId) void call('data_export_discard', { planId }).catch(() => {});
    };
  }, []);
  const queuedChanges = useRef(new Map<string, AppearanceChange>());
  const pendingChanges = useRef(new Map<string, AppearanceChange>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const reportError = useCallback((error: unknown, notifyGlobal = true) => {
    if (error instanceof HorizonError && error.code === 'CANCELLED') { setError(''); setMessage('已取消'); return; }
    const references = error instanceof HorizonError && Array.isArray(error.details?.references) ? error.details.references.map(String) : [];
    setError(`${errorMessage(error)}${references.length ? `。关联配置：${references.map(id => id === 'global' ? '全局默认' : id).join('、')}` : ''}`); if (notifyGlobal) onError?.(error);
  }, [onError]);
  const presetDirty = editingPreset !== null && JSON.stringify(editingPreset) !== JSON.stringify(presets.find(preset => preset.id === editingPreset.id));
  const dirtyListener = useRef(onDirtyChange); dirtyListener.current = onDirtyChange;
  useEffect(() => { dirtyListener.current?.(!!pendingShortcut || !!conflict || presetDirty); }, [pendingShortcut, conflict, presetDirty]);
  useEffect(() => () => dirtyListener.current?.(false), []);
  useEffect(() => setGitVersion(''), [settings?.effective['git.path']]);
  const updateSnapshot = useCallback((value: AppearanceSnapshot) => { snapshotRef.current = value; setSnapshot(value); }, []);
  const reload = useCallback(async () => {
    if (!nativeAvailable()) return;
    const generation = ++loadGeneration.current;
    const [next, list] = await Promise.all([
      call<AppearanceSnapshot>('appearance_get', { target: appearanceTarget(), windowGeometry: windowGeometry() }),
      call<{ items: AppearancePreset[] }>('appearance_preset_list'),
    ]);
    if (generation !== loadGeneration.current) return;
    updateSnapshot(next); setPresets(list.items); await appearance.refresh();
  }, [updateSnapshot, appearance.refresh]);
  useEffect(() => { void reload().catch(reportError); return () => { ++loadGeneration.current; }; }, [reload, reportError]);
  useEffect(() => { if (!projectId) setScope('global'); }, [projectId]);
  useEffect(() => {
    if (section !== 'projects' || !nativeAvailable()) return;
    let active = true;
    void call<Bootstrap>('app_bootstrap', { clientVersion: '0.1.0', protocolVersion: 1 }).then(value => { if (active) setProjectSummary(value); }).catch(reportError);
    return () => { active = false; };
  }, [section, projectId, reportError]);
  useEffect(() => {
    if (section !== 'data' || !nativeAvailable()) return;
    let active = true;
    void Promise.all([
      call<{ items: typeof drafts }>('recovery_list', projectId ? { projectId } : {}),
      call<{ items: typeof credentials }>('credential_list'),
    ]).then(([recovery, keys]) => { if (active) { setDrafts(recovery.items); setCredentials(keys.items); } }).catch(reportError);
    return () => { active = false; };
  }, [section, projectId, reportError]);
  const assetId = snapshot?.effective.background.assetId;
  const backgroundPreview = previewAsset?.assetId === assetId ? previewAsset?.url : '';
  useEffect(() => {
    let active = true, url = ''; setPreviewAsset(null);
    if (assetId) void call<{ dataUrl: string }>('appearance_background_read', { previewToken: assetId, thumbnail: true }).then(result => { if (active) { url = backgroundObjectUrl(result.dataUrl); setPreviewAsset({ assetId, url }); } }).catch(reportError);
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [assetId, reportError]);
  const run = useCallback((label: string, operation: () => Promise<unknown>, handleError: (error: unknown) => void = reportError) => {
    setBusy(label); setError(''); setMessage('');
    const pending = queue.current.catch(() => {}).then(operation);
    queue.current = pending;
    void pending.catch(handleError).finally(() => { setBusy(''); setCancelTask(null); });
    return pending;
  }, [reportError]);
  const persistChanges = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const changes = [...queuedChanges.current.values()]; queuedChanges.current.clear();
    if (!changes.length) return;
    await run('正在保存外观…', async () => {
      const current = snapshotRef.current;
      if (!current) return;
      const next = await call<AppearanceSnapshot>('appearance_patch', { target: appearanceTarget(), expectedRevision: current.revision, changes });
      updateSnapshot(settleAppearanceChanges(next, pendingChanges.current, changes));
      await appearance.refresh();
      if (pendingChanges.current.size && snapshotRef.current) appearance.preview(snapshotRef.current);
      setMessage(pendingChanges.current.size ? '正在保存外观…' : '已保存');
    });
  }, [appearance.refresh, appearance.preview, run, updateSnapshot]);
  const flushRef = useRef(persistChanges); flushRef.current = persistChanges;
  useEffect(() => () => { void flushRef.current().catch(() => {}); }, []);
  const patch = (change: AppearanceChange, immediate = false) => {
    queuedChanges.current.set(fieldKey(change.field), change);
    pendingChanges.current.set(fieldKey(change.field), change);
    if (change.operation === 'set' && snapshotRef.current) {
      const preview = previewAppearanceChanges(snapshotRef.current, [change]);
      updateSnapshot(preview);
      appearance.preview(preview);
    }
    if (timer.current) clearTimeout(timer.current);
    if (immediate) void persistChanges().catch(() => {});
    else timer.current = setTimeout(() => void persistChanges().catch(() => {}), 300);
  };
  const unset = (field: AppearanceField) => patch({ field, operation: 'unset' }, true);
  const setting = (key: string, fallback: unknown) => settings?.effective[key] ?? fallback;
  const settingSource = (key: string) => globalSettings.has(key) ? '全局设置' : settings?.sources[key] === 'project' ? '项目覆盖' : settings?.sources[key] === 'global' ? '全局默认' : '应用默认';
  const writeSettings = (values: Record<string, unknown>, unsetKeys: string[] = []) => run('正在保存设置…', async () => {
    const current = settingsRef.current;
    if (!current) return;
    const targetProject = [...Object.keys(values), ...unsetKeys].some(key => globalSettings.has(key)) ? undefined : selectedProject;
    await call('settings_patch', { scope: targetProject ? 'project' : 'global', ...(targetProject ? { projectId: targetProject } : {}), expectedRevision: current.revision, set: values, unset: unsetKeys }, targetProject);
    settingsRef.current = await call<SettingsSnapshot>('settings_get', selectedProject ? { projectId: selectedProject } : {}, selectedProject);
    await refreshSettings(); window.dispatchEvent(new Event('horizon:settings-changed')); setMessage('已保存');
  });
  const enablePackage = async (id: string) => {
    const result = await call<{ items: ExtensionState[] }>('extension_list', {});
    const extension = extensionForResource(result.items, id);
    if (!extension || extension.installState !== 'installed') throw new Error(`${id} 未安装，请在插件中心恢复或安装。`);
    if (!extension.enabledGlobal) await call('extension_enable', { extensionId: extension.id, scope: 'global', expectedRevision: extension.revision, enabled: true });
    if (extension.effectivePaused) throw new Error(`${extension.manifest?.name ?? id} 已暂停，请在插件中心恢复。`);
  };
  const selectLayout = (id: string | null) => {
    let applied = false;
    return run('正在切换布局…', async () => {
    let cancelled = false;
    setLayoutError(null);
    setCancelTask(() => async () => { cancelled = true; setMessage('布局切换已取消'); });
    try {
    if (appearance.composing.current) {
      setMessage('中文输入完成后切换布局');
      await new Promise<void>(resolve => document.addEventListener('compositionend', () => resolve(), { once: true }));
    }
    if (id) await enablePackage(id);
    if (cancelled) return;
    const current = await call<AppearanceSnapshot>('appearance_get', { target: appearanceTarget(), windowGeometry: windowGeometry() });
    const plan = await call<{ planId: string; digest: string }>('appearance_layout_prepare', { target: appearanceTarget(), expectedRevision: current.revision, layoutId: id });
    if (cancelled) return;
    const result = await call<{ snapshot: AppearanceSnapshot }>('appearance_layout_apply', { planId: plan.planId, digest: plan.digest });
    updateSnapshot(result.snapshot); applied = true; await appearance.refresh(); setMessage('全局布局已切换');
    } catch (error) { if (!applied) setLayoutError(errorMessage(error)); throw error; }
    }, error => reportError(error, applied));
  };
  const selectTheme = (id: string) => run('正在切换主题…', async () => {
    await enablePackage(id);
    const current = await call<AppearanceSnapshot>('appearance_get', { target: appearanceTarget(), windowGeometry: windowGeometry() });
    const next = await call<AppearanceSnapshot>('appearance_patch', { target: appearanceTarget(), expectedRevision: current.revision, changes: [{ field: { kind: 'themeId' }, operation: 'set', value: id }] });
    updateSnapshot(next); await appearance.refresh(); setMessage('主题已切换');
  });
  const importBackground = () => run('正在导入图片…', async () => {
    const picked = await call<{ selectionToken: string | null }>('appearance_background_pick'); if (!picked.selectionToken) return;
    const task = await start<BackgroundAsset>('appearance_background_import', picked, event => { if (event.payload.type === 'progress') setBusy(`${event.payload.phase ?? '正在导入图片'}…`); });
    setCancelTask(() => task.cancel);
    const asset = await task.result;
    const current = await call<AppearanceSnapshot>('appearance_get', { target: appearanceTarget(), windowGeometry: windowGeometry() });
    const next = await call<AppearanceSnapshot>('appearance_patch', { target: appearanceTarget(), expectedRevision: current.revision, changes: [{ field: { kind: 'background' }, operation: 'set', value: { ...current.effective.background, assetId: asset.id } }] });
    updateSnapshot(next); await appearance.refresh(); setMessage(`图片已导入 · ${asset.width} × ${asset.height}`);
  });
  const applyPreset = (preset: AppearancePreset) => run('正在应用组合…', async () => {
    const current = await call<AppearanceSnapshot>('appearance_get', { target: appearanceTarget(), windowGeometry: windowGeometry() });
    const plan = await call<{ planId: string; digest: string; missingPackages: string[]; missingAssets: string[] }>('appearance_preset_prepare', { target: appearanceTarget(), expectedRevision: current.revision, presetId: preset.id });
    if (plan.missingPackages.length || plan.missingAssets.length) throw new Error(`组合尚不可用。${plan.missingPackages.length ? `请在插件中心安装或启用：${plan.missingPackages.join('、')}。` : ''}${plan.missingAssets.length ? '背景图片缺失，请重新导入包含背景的资源包。' : ''}`);
    if (appearance.composing.current) await new Promise<void>(resolve => document.addEventListener('compositionend', () => resolve(), { once: true }));
    updateSnapshot(await call<AppearanceSnapshot>('appearance_preset_apply', { planId: plan.planId, digest: plan.digest })); await appearance.refresh(); setMessage('外观方案已应用于全部项目');
  });
  const exportPreset = (preset: AppearancePreset) => run('正在导出组合…', async () => {
    const picked = await call<{ selectionToken: string | null }>('appearance_preset_pick', { purpose: 'export' }); if (!picked.selectionToken) return;
    const task = await start('appearance_preset_export', { presetId: preset.id, includeBackground, destinationSelectionToken: picked.selectionToken }); setCancelTask(() => task.cancel); await task.result; setMessage('组合已导出');
  });
  const importPreset = () => run('正在导入组合…', async () => {
    const picked = await call<{ selectionToken: string | null }>('appearance_preset_pick', { purpose: 'import' }); if (!picked.selectionToken) return;
    const result = await call<{ warnings: string[] }>('appearance_preset_import', picked); await reload(); setMessage(result.warnings.length ? result.warnings.join('；') : '组合已导入，点击“应用”后生效');
  });
  const savePreset = () => run('正在保存组合…', async () => {
    await call('appearance_preset_save', { name: presetName, values: snapshotRef.current?.effective }); setPresetName(''); await reload(); setMessage('组合已保存');
  });
  const prepareClear = (category: string) => run('正在检查本地数据…', async () => {
    setClearPlan(null);
    if (category === 'credentials') { setClearCategory(category); return; }
    const plan = await call<NonNullable<typeof clearPlan>>('data_clear_prepare', { categories: [category], ...(projectId ? { projectId } : {}), ...(category === 'recoveryDrafts' ? { itemIds: selectedDrafts } : {}) });
    setClearPlan(plan); setClearCategory(category);
  });
  const applyClear = () => run('正在清理…', async () => {
    if (clearCategory === 'credentials') {
      const results = await Promise.allSettled(selectedCredentials.map(credentialRef => call('credential_remove', { credentialRef })));
      const failed = results.filter(result => result.status === 'rejected');
      setCredentials((await call<{ items: typeof credentials }>('credential_list')).items); setSelectedCredentials([]);
      setClearCategory(''); if (failed.length) throw new Error(`${results.length - failed.length} 项已清理，${failed.length} 项清理失败。请检查系统钥匙串状态。`);
      setMessage('所选凭据已清理'); return;
    }
    if (!clearPlan) return;
    const task = await start<{ clearedIds: string[]; failed: { id: string; error: { message: string } }[]; externalUntouched: string[] }>('data_clear_apply', { planId: clearPlan.planId, digest: clearPlan.digest });
    const result = await task.result; setClearCategory(''); setClearPlan(null); setSelectedDrafts([]);
    setDrafts((await call<{ items: typeof drafts }>('recovery_list', projectId ? { projectId } : {})).items);
    if (result.failed.length) throw new Error(`已清理 ${result.clearedIds.length} 项；${result.failed.map(item => item.error.message).join('；')}`);
    setMessage(`已清理 ${result.clearedIds.length} 项。${result.externalUntouched.join('、')}保留。`);
  });
  const prepareDataExport = (category: DataExportCategory) => run('正在准备导出预览…', async () => {
    let frontendDiagnostics: Record<string, unknown> | undefined;
    if (category === 'diagnostics') {
      const [{ getEditorDiagnostics }, { getWorkerDiagnostics }, { pluginRuntime }] = await Promise.all([
        import('../../../../../packages/editor/src/metrics'),
        import('../plugins/workerHost'),
        import('../plugins/service'),
      ]);
      frontendDiagnostics = {
        editor: anonymizeEditorDiagnostics(getEditorDiagnostics()),
        runtime: { schemaVersion: 1, ...getBridgeDiagnostics(), ...getWorkerDiagnostics(), ...pluginRuntime.getDiagnostics() },
      };
    }
    const preview = await call<DataExportPlan>('data_export_preview', { categories: [category], ...(frontendDiagnostics ? { frontendDiagnostics } : {}) });
    if (!mountedRef.current) { await call('data_export_discard', { planId: preview.planId }); return; }
    dataExportPlanRef.current = preview.planId;
    setDataExportError('');
    setDataExportPreview({ ...preview, category, chunks: exportPreviewChunks(preview.data) });
  });
  const discardDataExport = async () => {
    const planId = dataExportPlanRef.current;
    if (planId) await call('data_export_discard', { planId });
    dataExportPlanRef.current = null; setDataExportPreview(null); setDataExportError('');
  };
  const closeDataExport = async () => {
    if (dataExportBusy) return;
    setDataExportBusy(true); setDataExportError('');
    try { await discardDataExport(); }
    catch (error) { setDataExportError(errorMessage(error)); }
    finally { setDataExportBusy(false); }
  };
  const confirmDataExport = async () => {
    if (!dataExportPreview || dataExportBusy) return;
    setDataExportBusy(true); setDataExportError('');
    try {
      const picked = await call<{ selectionToken: string | null }>('project_pick_directory');
      if (!picked.selectionToken) { await discardDataExport(); setMessage('导出已取消'); return; }
      const task = await start('data_export', { planId: dataExportPreview.planId, destinationSelectionToken: picked.selectionToken, name: dataExportPreview.suggestedName });
      await task.result;
      dataExportPlanRef.current = null; setDataExportPreview(null);
      setMessage(dataExportPreview.category === 'settings' ? '配置导出完成' : '诊断统计已导出');
    } catch (error) { setDataExportError(errorMessage(error)); }
    finally { setDataExportBusy(false); }
  };
  const bindShortcut = (action: string, value: string) => {
    const current = { ...defaultShortcuts, ...(setting('shortcuts', {}) as Record<string, string>) };
    const other = Object.keys(current).find(key => key !== action && current[key].toUpperCase() === value.toUpperCase());
    setRecording(null);
    if (other) setConflict({ action, other, value });
    else setPendingShortcut({ action, value });
  };
  const selectedSection = sections.find(item => item[0] === section)!;
  const recoveryVisible = section === 'layout' && layoutError !== null;
  const summaryWorkspaceId = projectSummary?.projects.find(project => project.id === projectId)?.workspaceId ?? projectSummary?.activeWorkspaceId;
  const summaryWorkspace = projectSummary?.workspaces.find(workspace => workspace.id === summaryWorkspaceId);
  const summaryProjects = summaryWorkspace?.projectIds.map(id => projectSummary?.projects.find(project => project.id === id)).filter((project): project is Project => !!project) ?? [];
  const prefs = snapshot?.effective;
  const layout = appearance.layouts.find(item => item.id === prefs?.layoutId) ?? appearance.layouts[0];
  const theme = appearance.themes.find(item => item.id === prefs?.themeId) ?? appearance.themes[0];
  const colors = { ...theme?.[tokenMode], ...prefs?.colorsByTheme[theme?.id]?.[tokenMode] };
  const ratio = colors.text && colors.surface ? contrastRatio(colors.text, colors.surface) : 0;
  const background = prefs?.background;
  const updateBackground = (values: Partial<Omit<BackgroundAppearance, 'position'>> & { position?: Partial<BackgroundAppearance['position']> }) => {
    const current = snapshotRef.current?.effective.background;
    if (current) patch({ field: { kind: 'background' }, operation: 'set', value: { ...current, ...values, position: { ...current.position, ...values.position } } });
  };
  const activeShortcutValues = { ...defaultShortcuts, ...(setting('shortcuts', {}) as Record<string, string>) };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>, action: string) => {
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Escape') { setRecording(null); return; }
    const value = shortcutFromEvent(event);
    if (!value) return;
    if (['Meta+Q', 'Meta+H', 'Meta+Alt+H', 'Meta+M', 'Meta+ ', 'Meta+Tab', 'Meta+Alt+Escape', 'Meta+Ctrl+Q'].includes(value)) { setError('这个组合由 macOS 保留，请选择其他快捷键。'); return; }
    if (!event.metaKey && !event.ctrlKey && !event.altKey && !/^F\d+$/.test(event.key)) { setError('请同时使用 ⌘、⌃ 或 ⌥，避免覆盖文本输入。'); return; }
    bindShortcut(action, value);
  };
  return <div className="settings-panel" data-section={section} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) void persistChanges().catch(() => {}); }}>
    <nav className="settings-navigation" aria-label="设置分类">{sections.filter(([id]) => (!appearanceSections.includes(id) || id === 'appearance') && (id !== 'ai' || agentSettings) && (id !== 'projects' || projectSettings)).map(([id, label]) => { const Icon = sectionIcons[id]; const selected = id === 'appearance' ? appearanceSections.includes(section) : section === id; return <button key={id} className={selected ? 'selected' : ''} aria-current={selected ? 'page' : undefined} onClick={() => { void persistChanges().catch(() => {}); changeSection(id === 'appearance' ? initialSettingsSection('appearance') : id); }}><Icon size={16} aria-hidden="true" />{id === 'appearance' ? '外观' : label}</button>; })}</nav>
    <div className="settings-content" ref={contentRef}>
      {section !== 'ai' ? <header className="settings-heading"><h2>{recoveryVisible ? '布局未能启用' : selectedSection[2]}</h2><p>{recoveryVisible ? '新的布局没有完成加载，已经保留上次可用布局。' : selectedSection[3]}</p></header> : null}
      {appearanceSections.includes(section) ? <nav className="appearance-tabs" aria-label="外观分类">{sections.filter(([id]) => appearanceSections.includes(id)).map(([id, label]) => <button key={id} aria-current={section === id ? 'page' : undefined} onClick={() => { void persistChanges().catch(() => {}); changeSection(id); }}>{label}</button>)}</nav> : null}
      {['editor', 'projects', 'git'].includes(section) ? <div className="settings-scope"><label className="settings-scope-label">设置对象<select aria-label="设置对象" value={scope === 'project' && projectId ? projectId : 'global'} disabled={!!busy} onChange={event => { const next = event.target.value; void persistChanges().then(() => run('正在切换设置对象…', async () => { if (next === 'global') { setScope('global'); return; } if (next !== projectId && (!onSelectProject || !await onSelectProject(next))) throw new Error('未能切换项目，请检查项目路径后重试。'); setScope('project'); setMessage(''); setGitIdentity(null); })).catch(() => {}); }}><option value="global">全局默认设置</option>{projects.length ? <optgroup label="项目设置">{projects.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}</optgroup> : projectId ? <option value={projectId}>{projectName ?? '当前项目'}</option> : null}</select></label><span>{scope === 'project' ? '单独设置此项目；未单独设置的选项使用全局值' : '各项目默认使用这里的设置'}</span></div> : null}
      {visited.has('ai') ? <div className="settings-external" hidden={section !== 'ai'}>{agentSettings}</div> : null}
      {error && !recoveryVisible ? <div className="settings-error" role="alert"><strong>未能完成</strong><p>{error}</p><button onClick={() => void reload().then(() => setError('')).catch(reportError)}>重新读取设置</button><button className="custom-reset" onClick={() => setError('')}>关闭</button></div> : null}
      {snapshot?.notices.map((notice, index) => <Note key={`${notice.code}:${index}`} error>{notice.message}{onManagePlugins ? <div><button className="custom-reset" onClick={onManagePlugins}>管理插件并恢复</button></div> : null}</Note>)}
      {!nativeAvailable() ? <Note>请打开 macOS 桌面应用以读取和保存本机设置。</Note> : null}
      {(!prefs || !settings) && nativeAvailable() ? <div className="settings-loading">正在读取设置…</div> : null}
      {prefs && layout && theme && settings ? <>
        {section === 'appearance' ? <>
          <MiniPreview layout={layout} theme={theme} />
          <Row label="主题包" source={sourceLabel(snapshot!, { kind: 'themeId' })} onReset={() => unset({ kind: 'themeId' })}><select aria-label="主题包" value={theme.id} onChange={event => void selectTheme(event.target.value)} disabled={!!busy}>{appearance.themes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Row>
          <Row label="明暗模式" source={sourceLabel(snapshot!, { kind: 'mode' })} onReset={() => unset({ kind: 'mode' })}><select aria-label="明暗模式" value={prefs.mode} onChange={event => patch({ field: { kind: 'mode' }, operation: 'set', value: event.target.value }, true)}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></Row>
          <Row label="减少动效" source={settingSource('ui.reduceMotion')} onReset={() => void writeSettings({}, ['ui.reduceMotion'])}><select aria-label="减少动效" value={String(setting('ui.reduceMotion', 'system'))} onChange={event => void writeSettings({ 'ui.reduceMotion': event.target.value })}><option value="system">跟随系统</option><option value="on">开启</option><option value="off">关闭</option></select></Row>
          <details className="appearance-details"><summary>自定义配色</summary>
          <Row label="编辑模式"><select aria-label="配色模式" value={tokenMode} onChange={event => setTokenMode(event.target.value as ColorMode)}><option value="light">浅色</option><option value="dark">深色</option></select></Row>
          <div className="custom-color-grid">{(Object.keys(tokenLabels) as ThemeToken[]).map(token => <ColorControl key={`${theme.id}:${tokenMode}:${token}`} token={token} value={colors[token]} source={sourceLabel(snapshot!, { kind: 'color', themeId: theme.id, mode: tokenMode, token })} onChange={value => patch({ field: { kind: 'color', themeId: theme.id, mode: tokenMode, token }, operation: 'set', value })} onReset={() => unset({ kind: 'color', themeId: theme.id, mode: tokenMode, token })} />)}</div>
          <MiniPreview layout={layout} theme={theme} colors={colors} />
          <p className={`custom-contrast${ratio < 4.5 ? ' low-contrast' : ''}`} role="status">正文 / 表面对比度 {ratio.toFixed(1)}:1 · {ratio >= 4.5 ? '适合普通文本' : '偏低，建议调整正文或表面颜色'}。背景图片请结合预览检查。</p>
          <button onClick={() => { for (const token of Object.keys(tokenLabels) as ThemeToken[]) queuedChanges.current.set(`color:${theme.id}:${tokenMode}:${token}`, { field: { kind: 'color', themeId: theme.id, mode: tokenMode, token }, operation: 'unset' }); void persistChanges().catch(() => {}); }}>恢复当前模式配色</button>
          </details>
        </> : null}
        {recoveryVisible ? <section aria-label="布局恢复"><Note error><strong>{layoutError}</strong><br />当前文件、未保存修改与任务均已保留。</Note><MiniPreview layout={layout} theme={theme} /><div className="settings-button-row"><button className="filled" onClick={() => { setLayoutError(null); setError(''); }}><PanelsTopLeft size={16} />选择可用布局</button>{onManagePlugins ? <button onClick={onManagePlugins}><Puzzle size={16} />管理插件</button> : null}</div></section> : null}
        {section === 'layout' && !recoveryVisible ? <>
          <div className="layout-choice-grid">{appearance.layouts.map(item => {
            const extension = extensionForResource(appearance.extensions, item.id);
            return <button key={item.id} className={`layout-choice${item.id === layout.id ? ' selected' : ''}`} aria-pressed={item.id === layout.id} disabled={!!busy} onClick={() => void selectLayout(item.id)}><div className="layout-thumbnail" data-nav={item.navigation}><i /><b /><span /></div><strong>{item.label}</strong><small>{navigationDescriptions[item.navigation]}</small><span className="layout-package">{item.id === layout.id ? '使用中' : extension?.effectiveEnabled ? '已安装' : '启用并使用'} · 布局插件</span></button>;
          })}</div>
          <div className="settings-button-row"><button className="custom-reset" onClick={() => void selectLayout(null)}>恢复默认布局</button>{onManagePlugins ? <button onClick={onManagePlugins}><Puzzle size={16} />管理布局插件</button> : null}</div>
          <Row label="界面字号" source={settingSource('ui.fontSize')} onReset={() => void writeSettings({}, ['ui.fontSize'])}><select aria-label="界面字号" value={Number(setting('ui.fontSize', 13))} onChange={event => void writeSettings({ 'ui.fontSize': Number(event.target.value) })}>{Array.from({ length: 10 }, (_, i) => i + 11).map(size => <option key={size} value={size}>{size} px</option>)}</select></Row>
          <Row label="界面密度" source={settingSource('ui.density')} onReset={() => void writeSettings({}, ['ui.density'])}><select aria-label="界面密度" value={String(setting('ui.density', 'theme'))} onChange={event => void writeSettings({ 'ui.density': event.target.value })}><option value="theme">跟随主题</option><option value="compact">紧凑</option><option value="comfortable">舒适</option><option value="spacious">宽松</option></select></Row>
          <details className="appearance-details"><summary>区域尺寸</summary>
          <div className="custom-section-heading">{layout.label} · 首选尺寸</div>
          {(Object.keys(geometryLabels) as GeometryKey[]).filter(key => key !== 'codeFontSize' && key !== 'uiFontSize').map(key => {
            const rule = layout.geometry[key];
            return rule ? <NumberControl key={`${layout.id}:${key}`} label={geometryLabels[key]} value={prefs.geometryByLayout[layout.id]?.[key] ?? rule.initial} min={rule.min} max={rule.max} step={rule.step} effective={snapshot?.effectiveGeometry[key]} source={sourceLabel(snapshot!, { kind: 'geometry', layoutId: layout.id, key })} onChange={value => patch({ field: { kind: 'geometry', layoutId: layout.id, key }, operation: 'set', value })} onReset={() => unset({ kind: 'geometry', layoutId: layout.id, key })} /> : null;
          })}
          <div className="settings-button-row"><button onClick={() => { for (const key of (Object.keys(layout.geometry) as GeometryKey[]).filter(key => key !== 'codeFontSize' && key !== 'uiFontSize')) queuedChanges.current.set(`geometry:${layout.id}:${key}`, { field: { kind: 'geometry', layoutId: layout.id, key }, operation: 'unset' }); void persistChanges().catch(() => {}); }}>重置本布局尺寸</button></div>
          <Note><strong>小窗口会临时收起面板</strong><br />保留首选尺寸；窗口变宽后自动恢复。顶部系统控制保持可操作。</Note>
          </details>
        </> : null}
        {section === 'background' && background ? <>
          <div className="background-upload" style={backgroundPreview ? { backgroundImage: `url("${backgroundPreview}")` } : undefined}><div><ImagePlus size={16} className="background-image-icon" aria-hidden="true" /><strong>{assetId ? '本机背景图片' : '选择一张喜欢的图片'}</strong><span>PNG / JPEG / WebP · 最大 20 MiB</span><button className="tonal" onClick={() => void importBackground()} disabled={!!busy}>{assetId ? '替换图片' : '选择图片'}</button></div></div>
          <Row label="显示区域"><select aria-label="背景显示区域" value={background.region} onChange={event => updateBackground({ region: event.target.value as BackgroundAppearance['region'] })}><option value="workbench">整个工作台</option><option value="sidebar">文件侧栏</option><option value="editor">编辑区</option></select></Row>
          <Row label="适应方式"><select aria-label="背景适应方式" value={background.fit} onChange={event => updateBackground({ fit: event.target.value as 'cover' | 'contain' })}><option value="cover">填满</option><option value="contain">完整显示</option></select></Row>
          <NumberControl label="图片可见度" value={Math.round(background.opacity * 100)} min={0} max={40} unit="%" onChange={value => updateBackground({ opacity: value / 100 })} />
          <NumberControl label="表面遮罩" value={Math.round(background.overlay * 100)} min={40} max={100} unit="%" onChange={value => updateBackground({ overlay: value / 100 })} />
          <NumberControl label="水平位置" value={Math.round(background.position.x * 100)} min={0} max={100} unit="%" onChange={value => updateBackground({ position: { x: value / 100 } })} />
          <NumberControl label="垂直位置" value={Math.round(background.position.y * 100)} min={0} max={100} unit="%" onChange={value => updateBackground({ position: { y: value / 100 } })} />
          <div className="settings-button-row"><button onClick={() => updateBackground({ assetId: null })} disabled={!assetId}>关闭背景</button><button disabled={!assetId || !!busy} onClick={() => void run('正在移除图片…', async () => {
            if (!assetId || !snapshotRef.current) return;
            const next = await call<AppearanceSnapshot>('appearance_patch', { target: appearanceTarget(), expectedRevision: snapshotRef.current.revision, changes: [{ field: { kind: 'background' }, operation: 'set', value: { ...background, assetId: null } }] });
            updateSnapshot(next); await appearance.refresh();
            await call('appearance_background_remove', { assetId, expectedRevision: 1 }); await reload(); setMessage('图片已从本机资产移除');
          })}>移除图片资产</button><button className="custom-reset" onClick={() => unset({ kind: 'background' })}>恢复默认</button></div>
          <Note><strong>文字保持清晰</strong><br />图片只作用于所选表面。对话框、权限与错误提示使用实色背景。{assetId ? '图片已复制到应用资产目录。' : '导入后会复制到应用资产目录。'}</Note>
        </> : null}
        {section === 'presets' ? <>
          <MiniPreview layout={layout} theme={theme} />
          <div className="custom-preset-save"><input aria-label="外观组合名称" placeholder="例如：晚间阅读" maxLength={48} value={presetName} onChange={event => setPresetName(event.target.value)} /><button className="filled" disabled={!presetName.trim() || !!busy} onClick={() => void savePreset()}>保存当前组合</button></div>
          <div className="custom-presets">{presets.length ? presets.map(preset => <div className="custom-preset" key={preset.id}><div><strong>{preset.name}</strong><small>{preset.packageRefs.map(ref => appearance.layouts.find(item => item.id === ref.id)?.label ?? appearance.themes.find(item => item.id === ref.id)?.label ?? ref.id).join(' · ')}{preset.assetRefs.length ? ' · 含背景' : ''}</small></div><div><button className="tonal" disabled={!!busy} onClick={() => void applyPreset(preset)}>应用</button><button disabled={!!busy} onClick={() => setEditingPreset(structuredClone(preset))}>调整</button><button disabled={!!busy} onClick={() => void exportPreset(preset)}>导出</button><button className="custom-reset" disabled={!!busy} onClick={() => void run('正在删除组合…', async () => { await call('appearance_preset_delete', { id: preset.id, expectedRevision: preset.revision }); if (editingPreset?.id === preset.id) setEditingPreset(null); await reload(); setMessage('组合已删除；已应用设置保留'); })}>删除</button></div></div>) : <div className="custom-empty"><BookmarkPlus size={18} aria-hidden="true" /><strong>从现在的搭配开始</strong><span>保存后会出现在这里，应用于整个工作台。</span></div>}</div>
          {editingPreset ? <div className="preset-edit-form">
            <Row label="组合名称"><input aria-label="修改组合名称" value={editingPreset.name} maxLength={48} onChange={event => setEditingPreset({ ...editingPreset, name: event.target.value })} /></Row>
            <Row label="布局引用"><select aria-label="组合布局引用" value={editingPreset.values.layoutId} onChange={event => setEditingPreset({ ...editingPreset, values: { ...editingPreset.values, layoutId: event.target.value } })}>{!appearance.layouts.some(layout => layout.id === editingPreset.values.layoutId) ? <option value={editingPreset.values.layoutId}>{editingPreset.values.layoutId} · 未安装</option> : null}{appearance.layouts.map(layout => <option key={layout.id} value={layout.id}>{layout.label}</option>)}</select></Row>
            <Row label="主题引用"><select aria-label="组合主题引用" value={editingPreset.values.themeId} onChange={event => setEditingPreset({ ...editingPreset, values: { ...editingPreset.values, themeId: event.target.value } })}>{!appearance.themes.some(theme => theme.id === editingPreset.values.themeId) ? <option value={editingPreset.values.themeId}>{editingPreset.values.themeId} · 未安装</option> : null}{appearance.themes.map(theme => <option key={theme.id} value={theme.id}>{theme.label}</option>)}</select></Row>
            {editingPreset.values.background.assetId ? <Row label="组合背景" description="背景缺失时可移除引用，再应用组合。"><button onClick={() => setEditingPreset({ ...editingPreset, values: { ...editingPreset.values, background: { ...editingPreset.values.background, assetId: null } } })}>移除背景引用</button></Row> : null}
            <div className="settings-button-row"><button className="filled" disabled={!editingPreset.name.trim() || !!busy} onClick={() => void run('正在更新组合…', async () => { await call('appearance_preset_save', { id: editingPreset.id, expectedRevision: editingPreset.revision, name: editingPreset.name, values: editingPreset.values }); setEditingPreset(null); await reload(); setMessage('组合引用已更新；点击应用后生效'); })}>保存组合</button><button onClick={() => setEditingPreset(null)}>取消</button></div>
          </div> : null}
          <div className="settings-button-row"><button onClick={() => void importPreset()} disabled={!!busy}>导入组合 JSON</button><label className="settings-checkbox"><input type="checkbox" checked={includeBackground} onChange={event => setIncludeBackground(event.target.checked)} />导出时包含背景</label></div>
          <Note><strong>组合引用已安装插件</strong><br />导入后先检查依赖。纯 JSON 导出不包含图片；包含背景时同时导出内容摘要。</Note>
        </> : null}
        {section === 'projects' ? <>
          <Row label="会话恢复" description="重新打开项目时恢复文件标签、阅读位置与面板。"><span className="settings-pill">自动恢复</span></Row>
          <Row label="后台项目休眠" description="有未保存内容或运行任务时保持活动。" source={settingSource(setting('resources.keepRunning', false) ? 'resources.keepRunning' : 'resources.idleMinutes')} onReset={() => void writeSettings({}, ['resources.idleMinutes', 'resources.keepRunning'])}><select aria-label="后台项目休眠" disabled={!!busy} value={setting('resources.keepRunning', false) ? 'never' : String(setting('resources.idleMinutes', 5))} onChange={event => void writeSettings(event.target.value === 'never' ? { 'resources.keepRunning': true } : { 'resources.keepRunning': false, 'resources.idleMinutes': Number(event.target.value) })}>{[...new Set([1, 5, 15, 30, 60, 120, Number(setting('resources.idleMinutes', 5))])].sort((a, b) => a - b).map(minutes => <option value={minutes} key={minutes}>{minutes} 分钟</option>)}<option value="never">从不</option></select></Row>
          <Row label="终端任务" description="切换项目不会中断已运行的命令。"><span className="settings-pill">运行任务保持活动</span></Row>
          <Row label="能力预设" source={settingSource('resources.profile')} description="组合编辑、Git、AI 与终端能力。"><span className="settings-secondary">{({ minimal: '极简', review: '代码审查', development: '开发', custom: '自定义' } as Record<string, string>)[String(setting('resources.profile', 'review'))]}</span>{onManagePlugins ? <button className="tonal" onClick={onManagePlugins}><Puzzle size={15} />管理预设</button> : null}</Row>
          {summaryWorkspace ? <section className="settings-group" aria-label="当前工作区项目"><h3 className="settings-group-label">当前工作区 · {summaryWorkspace.name}</h3>{summaryProjects.length ? summaryProjects.map(project => <Row key={project.id} label={project.displayName}><span className={`settings-pill settings-project-state state-${project.state}`}>{projectStateLabels[project.state]}</span></Row>) : <p className="settings-secondary">尚无项目</p>}</section> : null}
        </> : null}
        {section === 'editor' ? <>
          <Row label="代码字体" source={settingSource('editor.fontFamily')} onReset={() => void writeSettings({}, ['editor.fontFamily'])}><select aria-label="代码字体" value={String(setting('editor.fontFamily', 'system'))} onChange={event => void writeSettings({ 'editor.fontFamily': event.target.value })}><option value="system">系统等宽字体</option><option value="Menlo">Menlo</option><option value="JetBrains Mono">JetBrains Mono</option></select></Row>
          <Row label="代码字号" source={settingSource('editor.fontSize')} onReset={() => void writeSettings({}, ['editor.fontSize'])}><select aria-label="代码字号" value={Number(setting('editor.fontSize', 14))} onChange={event => void writeSettings({ 'editor.fontSize': Number(event.target.value) })}>{Array.from({ length: 33 }, (_, i) => i + 8).map(size => <option key={size} value={size}>{size} px</option>)}</select></Row>
          <Row label="显示行号" source={settingSource('editor.lineNumbers')} onReset={() => void writeSettings({}, ['editor.lineNumbers'])}><Toggle label="显示行号" value={Boolean(setting('editor.lineNumbers', true))} onChange={value => void writeSettings({ 'editor.lineNumbers': value })} /></Row>
          <Row label="自动换行" source={settingSource('editor.wordWrap')} onReset={() => void writeSettings({}, ['editor.wordWrap'])}><Toggle label="自动换行" value={setting('editor.wordWrap', 'off') === 'on'} onChange={value => void writeSettings({ 'editor.wordWrap': value ? 'on' : 'off' })} /></Row>
          <Row label="缩进" source={settingSource('editor.tabSize')} onReset={() => void writeSettings({}, ['editor.tabSize'])}><select aria-label="缩进" value={String(setting('editor.tabSize', 2))} onChange={event => void writeSettings({ 'editor.tabSize': Number(event.target.value) })}><option value="2">2 个空格</option><option value="4">4 个空格</option><option value="8">8 个空格</option></select></Row>
          <Row label="缩进字符" source={settingSource('editor.insertSpaces')} onReset={() => void writeSettings({}, ['editor.insertSpaces'])}><select aria-label="缩进字符" value={setting('editor.insertSpaces', true) ? 'spaces' : 'tabs'} onChange={event => void writeSettings({ 'editor.insertSpaces': event.target.value === 'spaces' })}><option value="spaces">空格</option><option value="tabs">Tab</option></select></Row>
          <Row label="自动保存" description="开启后仅保存后续编辑；组词与外部冲突期间暂停。" source={settingSource('editor.autoSave')} onReset={() => void writeSettings({}, ['editor.autoSave'])}><select aria-label="自动保存" value={String(setting('editor.autoSave', 'off'))} onChange={event => void writeSettings({ 'editor.autoSave': event.target.value })}><option value="off">关闭</option><option value="onFocusChange">失去焦点时</option><option value="afterDelay">延迟保存</option></select></Row>
          {setting('editor.autoSave', 'off') === 'afterDelay' ? <Row label="保存延迟" source={settingSource('editor.autoSaveDelay')} onReset={() => void writeSettings({}, ['editor.autoSaveDelay'])}><select aria-label="保存延迟" value={Number(setting('editor.autoSaveDelay', 1000))} onChange={event => void writeSettings({ 'editor.autoSaveDelay': Number(event.target.value) })}>{[500, 1000, 2000, 5000].map(delay => <option key={delay} value={delay}>{delay / 1000} 秒</option>)}</select></Row> : null}
          {onManagePlugins ? <Row label="语言增强" description="查看已安装扩展及其编辑器能力。"><button className="tonal" onClick={onManagePlugins}><Code size={15} />管理扩展</button></Row> : null}
          <Note>字体和字号全局共用；编辑行为可按项目覆盖。换行符保留文件原值，保存失败仍保留编辑内容。</Note>
        </> : null}
        {section === 'git' ? <>
          <Row label="Git 程序" source={settingSource('git.path')} onReset={() => void writeSettings({}, ['git.path'])}><input aria-label="Git 程序路径" defaultValue={String(setting('git.path', 'git'))} key={`${selectedProject}:git.path:${settings?.revision}`} onBlur={event => { if (event.target.value.trim() !== setting('git.path', 'git')) void writeSettings({ 'git.path': event.target.value.trim() }); }} /><button onClick={() => void call<{ path: string | null }>('settings_pick_git').then(result => { if (result.path) return writeSettings({ 'git.path': result.path }); }).catch(reportError)}>选择文件</button></Row>
          <Row label="Git 状态" description={gitVersion || '尚未检测当前设置中的 Git 程序。'}><button disabled={!!busy} onClick={() => void run('正在检测 Git…', async () => { const result = await call<{ version: string }>('git_detect', {}); setGitVersion(result.version); })}>检测 Git</button></Row>
          <Row label="自动刷新更改" source={settingSource('git.autoRefresh')} onReset={() => void writeSettings({}, ['git.autoRefresh'])}><Toggle label="自动刷新更改" value={Boolean(setting('git.autoRefresh', true))} onChange={value => void writeSettings({ 'git.autoRefresh': value })} /></Row>
          <Row label="自动 fetch" description="只获取远端引用；默认关闭。" source={settingSource('git.autoFetch')} onReset={() => void writeSettings({}, ['git.autoFetch'])}><Toggle label="自动 fetch" value={Boolean(setting('git.autoFetch', false))} onChange={value => void writeSettings({ 'git.autoFetch': value })} /></Row>
          <Row label="默认差异视图" source={settingSource('git.diffView')} onReset={() => void writeSettings({}, ['git.diffView'])}><select aria-label="默认差异视图" value={String(setting('git.diffView', 'inline'))} onChange={event => void writeSettings({ 'git.diffView': event.target.value })}><option value="inline">行内</option><option value="split">并排</option></select></Row>
          <Row label="拉取策略" description="分支分叉时保留本地状态并显示处理入口。"><span className="settings-pill">仅快进</span></Row>
          <Row label="提交者身份" description={gitIdentity ? `${gitIdentity.name.value ?? '姓名未配置'} · ${gitIdentity.email.value ?? '邮箱未配置'}\n来源：${gitIdentity.name.source} / ${gitIdentity.email.source}` : projectId ? '使用当前仓库的 user.name 与 user.email。' : '选择项目后可查看仓库身份。'}><button disabled={!projectId || !!busy} onClick={() => void run('正在读取仓库身份…', async () => { setGitIdentity(await call('git_identity', {}, projectId)); })}>查看仓库身份</button></Row>
          <Row label="远端凭据" description="通过本机 Git 的凭据流程登录。"><span className="settings-secondary">系统凭据管理</span></Row>
          <Note><strong>提交与推送分开操作</strong><br />提交成功后，由你决定是否推送。设置修改不改变正在执行的命令。</Note>
        </> : null}
        {section === 'keys' ? <>
          <p className="settings-secondary">快捷键应用于全部项目。录入后保存生效。</p>
          <input className="shortcut-search" aria-label="查找快捷键" placeholder="搜索操作或按键" value={shortcutSearch} onChange={event => setShortcutSearch(event.target.value)} />
          {Object.entries(shortcutLabels).filter(([action, label]) => `${label} ${activeShortcutValues[action]}`.toLowerCase().includes(shortcutSearch.toLowerCase())).map(([action, label]) => <div className="shortcut-row" key={action}><span>{label}<small>{settingSource('shortcuts')}</small></span><div>{recording === action ? <input autoFocus aria-label={`${label}快捷键录入`} placeholder="按下组合键，Esc 取消" onKeyDown={event => keyDown(event, action)} onBlur={() => setRecording(null)} /> : <button className="shortcut-key" onClick={() => setRecording(action)} aria-label={`修改${label}快捷键`}><Pencil size={15} aria-hidden="true" /><kbd>{activeShortcutValues[action] ? shortcutDisplay(activeShortcutValues[action]) : '未绑定'}</kbd></button>}<button className="custom-reset" onClick={() => { const overrides = { ...(setting('shortcuts', {}) as Record<string, string>) }; delete overrides[action]; void writeSettings({ shortcuts: overrides }); }}>恢复默认</button></div></div>)}
          {conflict ? <div className="settings-error" role="alert"><strong>快捷键冲突</strong><p>{shortcutDisplay(conflict.value)} 已用于「{shortcutLabels[conflict.other]}」。替换会解除原绑定。</p><div className="settings-button-row"><button onClick={() => { void writeSettings({ shortcuts: { ...(setting('shortcuts', {}) as object), [conflict.other]: '', [conflict.action]: conflict.value } }); setConflict(null); }}>替换绑定</button><button onClick={() => setConflict(null)}>取消</button></div></div> : null}
          {pendingShortcut ? <div className="setting-note"><strong>{shortcutLabels[pendingShortcut.action]}</strong><p>新快捷键：<kbd>{shortcutDisplay(pendingShortcut.value)}</kbd></p><div className="settings-button-row"><button className="filled" onClick={() => void writeSettings({ shortcuts: { ...(setting('shortcuts', {}) as object), [pendingShortcut.action]: pendingShortcut.value } }).then(() => setPendingShortcut(null)).catch(() => {})}>保存快捷键</button><button onClick={() => setPendingShortcut(null)}>取消</button></div></div> : null}
          <Note>鼠标与快捷键触发同一操作。Esc 关闭弹窗或退出专注，保留正在运行的任务。</Note>
        </> : null}
        {section === 'data' ? <>
          <Row label="AI 发送内容" description="请求前可检查所选上下文。连接使用的服务地址与模型可在 AI 设置中查看。">{agentSettings ? <button onClick={() => changeSection('ai')}><Sparkles size={15} />查看 AI 连接</button> : <span className="settings-secondary">由请求上下文决定</span>}</Row>
          <Row label="配置与主题" description="预览脱敏内容，确认后选择保存位置。导出不含密钥、文件正文或绝对路径。"><button className="tonal settings-data-action" disabled={!!busy || !!dataExportPreview} onClick={() => void prepareDataExport('settings')}><Download size={16} aria-hidden="true" />导出配置</button></Row>
          <Row label="诊断统计" description="预览版本、资源计数与编辑器延迟统计，不包含文档内容或路径。"><button disabled={!!busy || !!dataExportPreview} onClick={() => void prepareDataExport('diagnostics')}>导出诊断</button></Row>
          <Row label="缓存" description="仅清理可重建索引与预览，未解决草稿保留。"><button className="settings-data-action settings-data-outline" disabled={!!busy} onClick={() => void prepareClear('cache')}><Trash2 size={16} aria-hidden="true" />清理缓存</button></Row>
          <Row label="聊天记录" description="仅清理 Horizon 保存的聊天。外部 Agent 的自有数据保留。"><button disabled={!!busy} onClick={() => void prepareClear('agentHistory')}>清理聊天</button></Row>
          <Row label="恢复草稿" description="预览、导出未保存内容，或单独选中待清理草稿。">{onManageRecovery ? <button className="tonal" onClick={onManageRecovery}>查看恢复草稿</button> : null}<button disabled={!selectedDrafts.length || !!busy} onClick={() => void prepareClear('recoveryDrafts')}>清理所选草稿</button></Row>
          <div className="settings-data-items">{drafts.length ? drafts.map(draft => <label className="settings-checkbox" key={draft.checkpointId}><input type="checkbox" checked={selectedDrafts.includes(draft.checkpointId)} onChange={event => setSelectedDrafts(values => event.target.checked ? [...values, draft.checkpointId] : values.filter(id => id !== draft.checkpointId))} /><span>{new Date(draft.updatedAt).toLocaleString()} · {(Number(draft.byteCount) / 1024).toFixed(1)} KiB<small>{draft.documentId}</small></span></label>) : <small>没有恢复草稿</small>}</div>
          <Row label="连接凭据" description="单独选中待清理凭据；清理后需要重新配置。"><button disabled={!selectedCredentials.length || !!busy} onClick={() => void prepareClear('credentials')}>清理所选凭据</button></Row>
          <div className="settings-data-items">{credentials.length ? credentials.map(credential => <label className="settings-checkbox" key={credential.credentialRef}><input type="checkbox" disabled={!!busy} checked={selectedCredentials.includes(credential.credentialRef)} onChange={event => setSelectedCredentials(values => event.target.checked ? [...values, credential.credentialRef] : values.filter(id => id !== credential.credentialRef))} /><span>{credential.connectionId}<small>{credential.persistence === 'system' ? '系统安全存储' : '本次会话'} · {credential.configured ? '已配置' : '未配置'}</small></span></label>) : <small>没有保存的连接凭据</small>}</div>
          {clearCategory ? <div className="settings-error" role="alert"><strong>确认清理{({ cache: '缓存', agentHistory: '聊天记录', recoveryDrafts: '恢复草稿', credentials: '连接凭据' } as Record<string, string>)[clearCategory]}</strong><p>{clearCategory === 'cache' ? '将移除可重建缓存，项目文件和恢复草稿保留。' : '此操作会删除所选本地数据，无法撤销。项目源文件保留。'}</p><p>{clearCategory === 'credentials' ? selectedCredentials.length : clearPlan?.items.length ?? 0} 项待清理{clearPlan?.blockedIds.length ? `；${clearPlan.blockedIds.length} 项正在使用，保留` : ''}。</p><div className="settings-button-row"><button disabled={!!busy} onClick={() => void applyClear()}>确认清理</button><button onClick={() => { setClearCategory(''); setClearPlan(null); }}>取消</button></div></div> : null}
          <Note><strong>你的项目保留在原目录</strong><br />Horizon 在本机管理工作区和配置，不默认上传源码或采集遥测。</Note>
        </> : null}
      </> : null}
      {visited.has('projects') ? <div className="settings-external settings-project-launcher" hidden={section !== 'projects'}>{projectId ? <p className="settings-group-label">当前项目 · {projectName ?? '启动方案'}</p> : null}{projectSettings}</div> : null}
      <div className="settings-save-status" role="status" aria-live="polite">{busy || message}{busy && cancelTask ? <button className="custom-reset" onClick={() => void cancelTask().catch(reportError)}>取消</button> : null}</div>
    </div>
    <footer className="settings-footer"><span><Check size={15} aria-hidden="true" />偏好即时生效</span>{onClose ? <button disabled={!!busy} onClick={() => void persistChanges().then(onClose).catch(() => {})}>完成</button> : null}</footer>
    {dataExportPreview ? <DataExportDialog key={dataExportPreview.planId} preview={dataExportPreview} busy={dataExportBusy} error={dataExportError} onClose={() => void closeDataExport()} onConfirm={() => void confirmDataExport()} /> : null}
  </div>;
}
