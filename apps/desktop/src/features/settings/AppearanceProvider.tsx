import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { call, onEvent, nativeAvailable } from '../../bridge';
import { applyAppearance, normalizeColor, type AppearanceSnapshot, type AppearanceTarget, type GeometryKey, type LayoutDefinition, type ThemeDefinition } from '../../../../../packages/appearance/src';
import { platform } from '../../platform';
import { builtinLayouts, builtinThemes } from '../../../../../packages/plugins/src/builtins';
import type { ExtensionState } from '../../../../../packages/plugins/src/types';
import { backgroundObjectUrl } from './background';

interface AppearanceContextValue {
  snapshot: AppearanceSnapshot | null;
  layouts: LayoutDefinition[];
  themes: ThemeDefinition[];
  extensions: ExtensionState[];
  refresh(): Promise<void>;
  setGeometry(key: GeometryKey, value: number): Promise<void>;
  preview(snapshot: AppearanceSnapshot): void;
  composing: React.MutableRefObject<boolean>;
}
const AppearanceContext = createContext<AppearanceContextValue | null>(null);
export const appearanceTarget = (): AppearanceTarget => ({ kind: 'global' });
export const windowGeometry = () => ({ width: window.innerWidth, height: window.innerHeight, scale: window.devicePixelRatio });
export function AppearanceProvider({ onError, children }: { onError?: (error: unknown) => void; children: ReactNode }) {
  const { settings } = useSettings();
  const [snapshot, setSnapshot] = useState<AppearanceSnapshot | null>(null);
  const [extensions, setExtensions] = useState<ExtensionState[]>([]);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const [systemReducedMotion, setSystemReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [backgroundAsset, setBackgroundAsset] = useState<{ assetId: string; url: string } | null>(null);
  const composing = useRef(false);
  const generation = useRef(0);
  const geometryQueue = useRef<Promise<void>>(Promise.resolve());
  const errorRef = useRef(onError); errorRef.current = onError;
  const refresh = useCallback(async () => {
    if (!nativeAvailable()) return;
    const current = ++generation.current;
    const [next, registry] = await Promise.all([
      call<AppearanceSnapshot>('appearance_get', { target: appearanceTarget(), windowGeometry: windowGeometry() }),
      call<{ items: ExtensionState[] }>('extension_list', {}),
    ]);
    if (current !== generation.current) return;
    setSnapshot(next); setExtensions(registry.items);
  }, []);
  const setGeometry = useCallback((key: GeometryKey, value: number) => {
    const pending = geometryQueue.current.then(async () => {
      try {
        const current = await call<AppearanceSnapshot>('appearance_get', { target: appearanceTarget(), windowGeometry: windowGeometry() });
        await call('appearance_patch', { target: appearanceTarget(), expectedRevision: current.revision, changes: [{ field: { kind: 'geometry', layoutId: current.effective.layoutId, key }, operation: 'set', value }] });
      } catch (error) {
        // Restore the authoritative geometry without replacing the write error.
        await refresh().catch(() => undefined);
        throw error;
      }
      await refresh();
    });
    geometryQueue.current = pending.catch(() => undefined);
    return pending;
  }, [refresh]);
  useEffect(() => {
    void refresh().catch(error => errorRef.current?.(error));
    let timer: ReturnType<typeof setTimeout>;
    const resized = () => { clearTimeout(timer); timer = setTimeout(() => void refresh().catch(error => errorRef.current?.(error)), 100); };
    window.addEventListener('resize', resized);
    const changed = () => void refresh().catch(error => errorRef.current?.(error));
    window.addEventListener('horizon:appearance-changed', changed);
    const listeners = nativeAvailable() ? [onEvent('appearance.changed', changed), onEvent('horizon.extension.v1', changed)] : [];
    return () => { ++generation.current; clearTimeout(timer); window.removeEventListener('resize', resized); window.removeEventListener('horizon:appearance-changed', changed); for (const listener of listeners) void listener.then(stop => stop()); };
  }, [refresh]);
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setSystemDark(query.matches);
    const motionChanged = () => setSystemReducedMotion(motionQuery.matches);
    query.addEventListener('change', changed);
    motionQuery.addEventListener('change', motionChanged);
    const start = () => { composing.current = true; };
    const end = () => { composing.current = false; };
    document.addEventListener('compositionstart', start); document.addEventListener('compositionend', end);
    return () => { query.removeEventListener('change', changed); motionQuery.removeEventListener('change', motionChanged); document.removeEventListener('compositionstart', start); document.removeEventListener('compositionend', end); };
  }, []);
  const assetId = snapshot?.effective.background.assetId;
  const backgroundUrl = backgroundAsset?.assetId === assetId ? backgroundAsset?.url : '';
  useEffect(() => {
    let active = true;
    let url = '';
    setBackgroundAsset(null);
    if (assetId) void call<{ dataUrl: string }>('appearance_background_read', { previewToken: assetId }).then(result => { if (active) { url = backgroundObjectUrl(result.dataUrl); setBackgroundAsset({ assetId, url }); } }).catch(error => errorRef.current?.(error));
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [assetId]);
  const layouts = useMemo(() => {
    const installed = extensions.flatMap(item => item.installState === 'installed' ? item.manifest?.contributes.layouts ?? [] : []);
    const items = installed.length ? installed : builtinLayouts;
    const order = new Map(builtinLayouts.map((item, index) => [item.id, index]));
    return [...items].sort((a, b) => (order.get(a.id) ?? 1000) - (order.get(b.id) ?? 1000));
  }, [extensions]);
  const themes = useMemo(() => {
    const installed = extensions.flatMap(item => item.installState === 'installed' ? item.manifest?.contributes.themes ?? [] : []);
    const items = installed.length ? installed : builtinThemes;
    const order = new Map(builtinThemes.map((item, index) => [item.id, index]));
    return [...items].sort((a, b) => (order.get(a.id) ?? 1000) - (order.get(b.id) ?? 1000));
  }, [extensions]);
  const layout = layouts.find(item => item.id === snapshot?.effective.layoutId) ?? builtinLayouts[0];
  const theme = themes.find(item => item.id === snapshot?.effective.themeId) ?? builtinThemes[0];
  const mode = snapshot?.effective.mode === 'system' ? (systemDark ? 'dark' : 'light') : snapshot?.effective.mode ?? 'light';
  const colors = { ...theme[mode], ...snapshot?.effective.colorsByTheme[theme.id]?.[mode] };
  const nativeBackground = snapshot && normalizeColor(colors.background);
  const nativeText = snapshot && normalizeColor(colors.text);
  useEffect(() => {
    if (platform !== 'windows' || !nativeAvailable() || !nativeBackground || !nativeText) return;
    void call('window_theme_sync', { background: nativeBackground, text: nativeText }).catch(error => errorRef.current?.(error));
  }, [nativeBackground, nativeText]);
  useLayoutEffect(() => {
    if (snapshot) {
      applyAppearance(document.documentElement, snapshot, layout, theme, systemDark, backgroundUrl);
      document.documentElement.style.setProperty('--ui-font-size', `${settings?.effective['ui.fontSize'] ?? 13}px`);
      document.documentElement.style.setProperty('--code-font-size', `${settings?.effective['editor.fontSize'] ?? 14}px`);
      const font = String(settings?.effective['editor.fontFamily'] ?? 'Menlo');
      document.documentElement.style.setProperty('--code-font-family', font === 'system' ? 'SFMono-Regular, Menlo, monospace' : `"${font.replace(/["\\]/g, '')}", SFMono-Regular, monospace`);
      const density = settings?.effective['ui.density'];
      if (density && density !== 'theme') {
        document.documentElement.dataset.density = String(density);
        document.documentElement.style.setProperty('--h-row', density === 'compact' ? '28px' : density === 'spacious' ? '38px' : '34px');
      }
      const reducedMotion = settings?.effective['ui.reduceMotion'] ?? 'system';
      document.documentElement.dataset.reducedMotion = String(reducedMotion === 'system' ? systemReducedMotion : reducedMotion === 'on');
    }
  }, [snapshot, layout, theme, systemDark, backgroundUrl, settings, systemReducedMotion]);
  return <AppearanceContext.Provider value={{ snapshot, layouts, themes, extensions, refresh, setGeometry, preview: setSnapshot, composing }}>{children}</AppearanceContext.Provider>;
}
export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('SettingsPanel requires AppearanceProvider');
  return value;
}

export interface SettingsSnapshot { revision: number; global: Record<string, unknown>; overrides: Record<string, unknown>; effective: Record<string, unknown>; sources: Record<string, string> }
export function useSettings(projectId?: string) {
  const [settings, setSettings] = useState<SettingsSnapshot | null>(null);
  const [loadedProject, setLoadedProject] = useState(projectId);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!nativeAvailable()) return;
    const current = ++generation.current;
    const result = await call<SettingsSnapshot>('settings_get', projectId ? { projectId } : {});
    if (current === generation.current) { setSettings(result); setLoadedProject(projectId); }
  }, [projectId]);
  useEffect(() => {
    void refresh().catch(() => {});
    const changed = () => void refresh().catch(() => {});
    window.addEventListener('horizon:settings-changed', changed);
    const listener = nativeAvailable() ? onEvent('horizon.settings.v1', changed) : null;
    return () => { ++generation.current; window.removeEventListener('horizon:settings-changed', changed); if (listener) void listener.then(stop => stop()); };
  }, [projectId, refresh]);
  return { settings: loadedProject === projectId ? settings : null, refresh };
}
