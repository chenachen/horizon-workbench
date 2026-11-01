import { describe, expect, it } from 'vitest';
import type { AppearanceChange, AppearanceSnapshot } from '../../../../../packages/appearance/src';
import { previewAppearanceChanges, settleAppearanceChanges } from './pendingAppearance';

const initial = (): AppearanceSnapshot => ({
  revision: 1, layoutSource: 'default', effectiveGeometry: {}, sources: [], notices: [],
  effective: { layoutId: 'horizon.layout.mist', themeId: 'horizon.theme.mist', mode: 'system', geometryByLayout: {}, colorsByTheme: {}, background: { assetId: 'test-image', region: 'workbench', fit: 'cover', opacity: 0.12, overlay: 0.85, position: { x: 0.5, y: 0.5 } } },
});

describe('appearance saves while editing', () => {
  it('keeps newer background edits when an earlier save acknowledges the same field', () => {
    const base = initial();
    const first: AppearanceChange = { field: { kind: 'background' }, operation: 'set', value: { ...base.effective.background, region: 'editor' } };
    const firstPreview = previewAppearanceChanges(base, [first]);
    const later: AppearanceChange = { field: { kind: 'background' }, operation: 'set', value: { ...firstPreview.effective.background, fit: 'contain', opacity: 0.4 } };
    const pending = new Map([['background', later]]);
    const firstAck = { ...firstPreview, revision: 2 };
    const latest = settleAppearanceChanges(firstAck, pending, [first]);
    expect(latest.revision).toBe(2);
    expect(latest.effective.background).toMatchObject({ region: 'editor', fit: 'contain', opacity: 0.4 });
    expect(pending.size).toBe(1);
    expect(firstAck.effective.background.opacity).toBe(0.12);
    settleAppearanceChanges({ ...latest, revision: 3 }, pending, [later]);
    expect(pending.size).toBe(0);
  });

  it('retains another field edited during a save, then clears it on its own acknowledgement', () => {
    const size: AppearanceChange = { field: { kind: 'geometry', layoutId: 'horizon.layout.mist', key: 'sidebarWidth' }, operation: 'set', value: 280 };
    const mode: AppearanceChange = { field: { kind: 'mode' }, operation: 'set', value: 'dark' };
    const pending = new Map([['geometry:horizon.layout.mist:sidebarWidth', size], ['mode', mode]]);
    const saved = previewAppearanceChanges(initial(), [size]);
    const afterSize = settleAppearanceChanges({ ...saved, revision: 2 }, pending, [size]);
    expect(afterSize.effective.mode).toBe('dark');
    expect(afterSize.effectiveGeometry.sidebarWidth).toBe(280);
    expect([...pending.keys()]).toEqual(['mode']);
    settleAppearanceChanges({ ...afterSize, revision: 3 }, pending, [mode]);
    expect(pending.size).toBe(0);
  });
});
