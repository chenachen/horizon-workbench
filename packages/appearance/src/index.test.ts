import { describe, expect, it } from 'vitest';
import { applyAppearance, contrastRatio, normalizeColor, type AppearanceSnapshot } from './index';
import { builtinLayouts, builtinThemes } from '../../plugins/src/builtins';

describe('appearance', () => {
  it('normalizes only supported opaque colors', () => {
    expect(normalizeColor('#aBc')).toBe('#aabbcc');
    expect(normalizeColor('rgb(0, 128, 255)')).toBe('#0080ff');
    expect(normalizeColor('rgb(256, 0, 0)')).toBeNull();
    expect(normalizeColor('url(file:///private/image)')).toBeNull();
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
  });
  it('applies themes independently of layout and preserves preferred geometry', () => {
    const variables = new Map<string, string>();
    const root = { dataset: {}, style: { setProperty: (key: string, value: string) => variables.set(key, value), removeProperty: (key: string) => variables.delete(key), colorScheme: '' } } as unknown as HTMLElement;
    const layout = builtinLayouts[0], theme = builtinThemes[2];
    const snapshot: AppearanceSnapshot = { revision: 1, effective: { layoutId: layout.id, themeId: theme.id, mode: 'system', geometryByLayout: { [layout.id]: { sidebarWidth: 480 } }, colorsByTheme: { [theme.id]: { dark: { accent: '#123456' } } }, background: { assetId: null, region: 'editor', fit: 'cover', opacity: 0.12, overlay: 0.85, position: { x: 0.5, y: 0.5 } } }, effectiveGeometry: { sidebarWidth: 240 }, layoutSource: 'global', sources: [], notices: [] };
    applyAppearance(root, snapshot, layout, theme, true);
    expect(root.dataset.layout).toBe(layout.navigation);
    expect(root.dataset.theme).toBe('orbit');
    expect(root.dataset.mode).toBe('dark');
    expect(variables.get('--accent')).toBe('#123456');
    expect(variables.get('--sidebar-width')).toBe('240px');
    expect(snapshot.effective.geometryByLayout[layout.id].sidebarWidth).toBe(480);
    expect(root.dataset.background).toBe('none');
    expect(variables.get('--background-image')).toBe('none');
  });
});
