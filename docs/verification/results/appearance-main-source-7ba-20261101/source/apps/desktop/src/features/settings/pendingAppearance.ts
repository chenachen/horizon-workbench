import { fieldKey, type AppearanceChange, type AppearanceSnapshot, type BackgroundAppearance, type ColorMode } from '../../../../../packages/appearance/src';

export function previewAppearanceChanges(snapshot: AppearanceSnapshot, changes: Iterable<AppearanceChange>): AppearanceSnapshot {
  const preview = structuredClone(snapshot);
  for (const change of changes) {
    if (change.operation !== 'set') continue;
    const { field, value } = change;
    if (field.kind === 'geometry') { (preview.effective.geometryByLayout[field.layoutId] ??= {})[field.key] = value as number; preview.effectiveGeometry[field.key] = value as number; }
    else if (field.kind === 'color') ((preview.effective.colorsByTheme[field.themeId] ??= {})[field.mode] ??= {})[field.token] = value as string;
    else if (field.kind === 'background') preview.effective.background = value as BackgroundAppearance;
    else if (field.kind === 'mode') preview.effective.mode = value as 'system' | ColorMode;
    else preview.effective.themeId = value as string;
  }
  return preview;
}

export function settleAppearanceChanges(snapshot: AppearanceSnapshot, pending: Map<string, AppearanceChange>, saved: AppearanceChange[]): AppearanceSnapshot {
  for (const change of saved) {
    const key = fieldKey(change.field);
    if (pending.get(key) === change) pending.delete(key);
  }
  return previewAppearanceChanges(snapshot, pending.values());
}
