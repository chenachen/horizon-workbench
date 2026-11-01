import { platform } from '../../platform';

const primaryModifier = platform === 'macos' ? 'Meta' : 'Ctrl';
export const defaultShortcuts: Record<string, string> = { 'file.open': `${primaryModifier}+P`, 'command.open': `${primaryModifier}+Shift+P`, 'file.save': `${primaryModifier}+S`, 'file.saveAll': platform === 'windows' ? 'Ctrl+Shift+S' : `${primaryModifier}+Alt+S`, 'file.close': `${primaryModifier}+W`, 'settings.open': `${primaryModifier}+,`, 'sidebar.toggle': `${primaryModifier}+B`, 'search.open': `${primaryModifier}+Shift+F`, 'agent.toggle': '', 'terminal.toggle': '', 'focus.toggle': '' };
export const shortcutLabels: Record<string, string> = { 'file.open': '快速打开文件', 'command.open': '打开命令面板', 'file.save': '保存文件', 'file.saveAll': '保存全部文件', 'file.close': '关闭当前文件', 'settings.open': '打开设置', 'sidebar.toggle': '切换文件侧栏', 'search.open': '项目文本搜索', 'agent.toggle': '切换 AI 助手', 'terminal.toggle': '切换终端', 'focus.toggle': '切换专注模式' };
const macReservedShortcuts = new Set(['Meta+Q', 'Meta+H', 'Meta+Alt+H', 'Meta+M', 'Meta+ ', 'Meta+Tab', 'Meta+Alt+Escape', 'Meta+Ctrl+Q']);
const windowsReservedShortcuts = new Set(['Alt+F4', 'Alt+Tab', 'Alt+Shift+Tab', 'Alt+Escape', 'Alt+ ', 'Ctrl+Escape', 'Ctrl+Shift+Escape', 'Ctrl+Alt+Delete', 'Ctrl+Alt+Tab', 'Ctrl+ ']);
export const shortcutModifierHint = platform === 'macos' ? '⌘、⌃ 或 ⌥' : platform === 'windows' ? 'Ctrl 或 Alt' : 'Ctrl、Alt 或 Meta';
export function isReservedShortcut(value: string) { return platform === 'macos' ? macReservedShortcuts.has(value) : platform === 'windows' && (value.startsWith('Meta+') || windowsReservedShortcuts.has(value)); }
export function shortcutDisplay(value: string) {
  const names: Record<string, string> = platform === 'macos' ? { Meta: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧', ' ': '空格' } : { Meta: platform === 'windows' ? 'Win' : 'Meta', Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift', ' ': '空格' };
  return value.split('+').map(key => names[key] ?? (platform === 'macos' || key.length === 1 ? key.toUpperCase() : key)).join(platform === 'macos' ? ' ' : ' + ');
}
export function shortcutFromEvent(event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'key'>): string | null {
  if (['Meta', 'Control', 'Alt', 'Shift', 'Dead', 'Process', 'Unidentified'].includes(event.key)) return null;
  return [event.metaKey && 'Meta', event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.key.length === 1 ? event.key.toUpperCase() : event.key].filter(Boolean).join('+');
}
