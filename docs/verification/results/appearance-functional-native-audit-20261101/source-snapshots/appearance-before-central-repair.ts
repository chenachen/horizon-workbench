import type { GeometryKey, LayoutDefinition, ThemeDefinition, ThemeToken } from '../../plugins/src/types';
import { builtinThemeSurfaces } from './palettes';

export type { GeometryKey, LayoutDefinition, ThemeDefinition, ThemeToken };
export type AppearanceTarget = { kind: 'global' } | { kind: 'project'; projectId: string };
export type ColorMode = 'light' | 'dark';
export interface BackgroundAppearance {
  assetId: string | null;
  region: 'workbench' | 'sidebar' | 'editor';
  fit: 'cover' | 'contain';
  position: { x: number; y: number };
  opacity: number;
  overlay: number;
}
export interface AppearancePreferences {
  layoutId: string;
  themeId: string;
  mode: 'system' | ColorMode;
  geometryByLayout: Record<string, Partial<Record<GeometryKey, number>>>;
  colorsByTheme: Record<string, { light?: Partial<Record<ThemeToken, string>>; dark?: Partial<Record<ThemeToken, string>> }>;
  background: BackgroundAppearance;
}
export type AppearanceField = { kind: 'mode' | 'themeId' | 'background' }
  | { kind: 'geometry'; layoutId: string; key: GeometryKey }
  | { kind: 'color'; themeId: string; mode: ColorMode; token: ThemeToken };
export type AppearanceChange = { field: AppearanceField; operation: 'unset' } | { field: AppearanceField; operation: 'set'; value: string | number | BackgroundAppearance };
export interface AppearanceSnapshot {
  revision: number;
  effective: AppearancePreferences;
  sources: { field: AppearanceField; source: 'default' | 'global' | 'project' }[];
  layoutSource: 'default' | 'global' | 'project';
  effectiveGeometry: Partial<Record<GeometryKey, number>>;
  notices: { code: string; message: string }[];
}
export interface AppearancePreset {
  id: string; revision: number; name: string; values: AppearancePreferences;
  packageRefs: { id: string; apiVersion: 1 }[]; assetRefs: string[];
}
export interface BackgroundAsset {
  id: string; revision: number; contentHash: string; mediaType: string;
  width: number; height: number; bytes: string; previewToken: string;
}
export const geometryLabels: Record<GeometryKey, string> = {
  sidebarWidth: '文件侧栏', navigationWidth: '项目导航', topbarHeight: '顶部区域',
  tabHeight: '文件标签高度', tabMinWidth: '文件标签最小宽', auxiliaryWidth: '辅助面板',
  bottomHeight: '底部面板', statusHeight: '状态栏', uiFontSize: '界面字号', codeFontSize: '代码字号',
};
export const tokenLabels: Record<ThemeToken, string> = {
  accent: '强调色', onAccent: '强调色文字', background: '工作台底色', surface: '内容表面',
  text: '正文', muted: '次要文字', border: '分隔线', selection: '选中背景',
  success: '成功', warning: '警告', error: '错误',
};
export const geometryVariables: Record<GeometryKey, string> = {
  sidebarWidth: '--sidebar-width', navigationWidth: '--navigation-width', topbarHeight: '--topbar-height',
  tabHeight: '--tab-height', tabMinWidth: '--tab-min-width', auxiliaryWidth: '--auxiliary-width',
  bottomHeight: '--bottom-height', statusHeight: '--status-height', uiFontSize: '--ui-font-size', codeFontSize: '--code-font-size',
};
export function normalizeColor(input: string): string | null {
  const value = input.trim();
  if (/^#[a-f\d]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[a-f\d]{3}$/i.test(value)) return `#${[...value.slice(1)].map(c => c + c).join('').toLowerCase()}`;
  const rgb = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (!rgb || rgb.slice(1).some(n => Number(n) > 255)) return null;
  return `#${rgb.slice(1).map(n => Number(n).toString(16).padStart(2, '0')).join('')}`;
}
export function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const value = normalizeColor(color);
    if (!value) return 0;
    const [r, g, b] = [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function fieldKey(field: AppearanceField): string {
  if (field.kind === 'geometry') return `geometry:${field.layoutId}:${field.key}`;
  if (field.kind === 'color') return `color:${field.themeId}:${field.mode}:${field.token}`;
  return field.kind;
}
export function sourceLabel(snapshot: AppearanceSnapshot, field: AppearanceField): string {
  const source = snapshot.sources.find(item => fieldKey(item.field) === fieldKey(field))?.source;
  return source === 'project' ? '项目覆盖' : source === 'global' ? '全局默认' : '插件默认';
}
export function applyAppearance(root: HTMLElement, snapshot: AppearanceSnapshot, layout: LayoutDefinition, theme: ThemeDefinition, systemDark: boolean, backgroundUrl?: string): void {
  const prefs = snapshot.effective;
  const mode = prefs.mode === 'system' ? (systemDark ? 'dark' : 'light') : prefs.mode;
  root.dataset.layout = layout.navigation;
  root.dataset.theme = theme.id.replace(/^horizon\.theme\./, '');
  root.dataset.mode = mode;
  root.dataset.density = theme.density;
  root.style.setProperty('--h-row', theme.density === 'compact' ? '28px' : theme.density === 'spacious' ? '38px' : '34px');
  root.dataset.background = prefs.background.assetId && backgroundUrl ? prefs.background.region : 'none';
  root.style.colorScheme = mode;
  const colors = { ...theme[mode], ...prefs.colorsByTheme[theme.id]?.[mode] };
  for (const [token, value] of Object.entries(colors)) root.style.setProperty(`--${token === 'onAccent' ? 'on-accent' : token}`, value);
  const surfaces = builtinThemeSurfaces[theme.id]?.[mode];
  const overrides = prefs.colorsByTheme[theme.id]?.[mode] ?? {};
  const exactSurface = (variable: string, value: string | undefined, affected: ThemeToken[]) => {
    if (value && !affected.some(token => overrides[token] !== undefined)) root.style.setProperty(variable, value);
    else root.style.removeProperty(variable);
  };
  exactSurface('--h-low', surfaces?.low, ['background', 'surface']);
  exactSurface('--h-high', surfaces?.high, ['background', 'border']);
  exactSurface('--h-on-tonal', surfaces?.onSelection, ['text', 'selection']);
  exactSurface('--h-green-bg', surfaces?.successSurface, ['success', 'surface']);
  exactSurface('--h-red-bg', surfaces?.errorSurface, ['error', 'surface']);
  root.style.setProperty('--radius', `${theme.radius}px`);
  for (const [key, variable] of Object.entries(geometryVariables)) {
    const value = snapshot.effectiveGeometry[key as GeometryKey] ?? prefs.geometryByLayout[layout.id]?.[key as GeometryKey] ?? layout.geometry[key as GeometryKey]?.initial;
    if (value !== undefined) root.style.setProperty(variable, `${value}px`);
    else root.style.removeProperty(variable);
  }
  root.style.setProperty('--background-image', backgroundUrl ? `url("${backgroundUrl}")` : 'none');
  root.style.setProperty('--background-opacity', String(prefs.background.opacity));
  root.style.setProperty('--background-overlay', String(prefs.background.overlay));
  root.style.setProperty('--background-fit', prefs.background.fit);
  root.style.setProperty('--background-position', `${prefs.background.position.x * 100}% ${prefs.background.position.y * 100}%`);
}
