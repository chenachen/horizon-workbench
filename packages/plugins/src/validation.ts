import type { LayoutDefinition, LayoutNode, PluginManifest, ThemeDefinition, UiSlotId } from './types';
const slots = new Set<UiSlotId>(['navigation', 'primarySidebar', 'editor', 'auxiliary', 'bottom', 'status', 'overlay']);
const tokens = ['background', 'surface', 'text', 'muted', 'border', 'accent', 'onAccent', 'selection', 'success', 'warning', 'error'];
export function validateLayout(layout: LayoutDefinition): void {
  const ids = new Set<string>(); const seenSlots: string[] = []; let count = 0;
  function walk(node: LayoutNode, depth: number) {
    if (++count > 64 || depth > 8 || ids.has(node.id)) throw new Error('布局节点重复、过深或过多');
    ids.add(node.id);
    if (node.kind === 'slot') {
      if (!slots.has(node.slot) || node.slot === 'overlay') throw new Error('布局不能控制宿主恢复层');
      if (node.sizing && !layout.geometry[node.sizing]) throw new Error('布局引用了未声明的尺寸');
      seenSlots.push(node.slot);
    } else if (node.kind === 'tabs') seenSlots.push(...node.slots);
    else if (node.kind === 'row' || node.kind === 'column') node.children.forEach(child => walk(child, depth + 1));
    else throw new Error('未知布局节点');
  }
  walk(layout.root, 1);
  if (seenSlots.filter(x => x === 'editor').length !== 1 || new Set(seenSlots).size !== seenSlots.length) throw new Error('布局必须有且仅有一个编辑区，各插槽不得重复');
  if (seenSlots.some(slot => !slots.has(slot as UiSlotId) || slot === 'overlay')) throw new Error('布局插槽无效');
  if (layout.requiredSlots.some(slot => !seenSlots.includes(slot))) throw new Error('缺少必需插槽');
  for (const rule of Object.values(layout.geometry)) if (!rule || !Number.isFinite(rule.initial) || rule.min > rule.initial || rule.initial > rule.max || rule.step <= 0) throw new Error('尺寸范围无效');
}
export function validateTheme(theme: ThemeDefinition): void {
  if (!['compact', 'standard', 'comfortable', 'spacious'].includes(theme.density)
    || theme.density === 'standard' && theme.rowHeight === undefined
    || theme.rowHeight !== undefined && (!Number.isFinite(theme.rowHeight) || theme.rowHeight < 24)) throw new Error('主题密度或行高无效');
  for (const mode of [theme.light, theme.dark]) {
    if (Object.keys(mode).length !== tokens.length) throw new Error('主题令牌不完整');
    for (const key of tokens) if (!/^#[\da-f]{6}$/i.test(mode[key as keyof typeof mode])) throw new Error('主题必须使用六位 HEX 颜色');
  }
}
export function validateManifest(manifest: PluginManifest): void {
  if (!/^[a-z][a-z0-9.-]{2,127}$/.test(manifest.id) || manifest.apiVersion !== 1) throw new Error('扩展 ID 或 API 版本无效');
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('版本必须为 major.minor.patch');
  for (const layout of manifest.contributes.layouts ?? []) validateLayout(layout);
  for (const theme of manifest.contributes.themes ?? []) validateTheme(theme);
}
