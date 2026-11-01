export const defaultShortcuts: Record<string, string> = { 'file.open': 'Meta+P', 'command.open': 'Meta+Shift+P', 'file.save': 'Meta+S', 'file.saveAll': 'Meta+Alt+S', 'file.close': 'Meta+W', 'settings.open': 'Meta+,', 'sidebar.toggle': 'Meta+B', 'search.open': 'Meta+Shift+F', 'agent.toggle': '', 'terminal.toggle': '', 'focus.toggle': '' };
export const shortcutLabels: Record<string, string> = { 'file.open': '快速打开文件', 'command.open': '打开命令面板', 'file.save': '保存文件', 'file.saveAll': '保存全部文件', 'file.close': '关闭当前文件', 'settings.open': '打开设置', 'sidebar.toggle': '切换文件侧栏', 'search.open': '项目文本搜索', 'agent.toggle': '切换 AI 助手', 'terminal.toggle': '切换终端', 'focus.toggle': '切换专注模式' };
export function shortcutDisplay(value: string) { return value.split('+').map(key => ({ Meta: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧', ' ': '空格' })[key] ?? key.toUpperCase()).join(' '); }
export function shortcutFromEvent(event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'key'>): string | null {
  if (['Meta', 'Control', 'Alt', 'Shift', 'Dead', 'Process', 'Unidentified'].includes(event.key)) return null;
  return [event.metaKey && 'Meta', event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.key.length === 1 ? event.key.toUpperCase() : event.key].filter(Boolean).join('+');
}
