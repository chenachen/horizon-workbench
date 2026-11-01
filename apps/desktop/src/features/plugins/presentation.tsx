import { BookOpen, Braces, FolderTree, GitBranch, LayoutTemplate, Palette, Puzzle, Rocket, Search, Sparkles, Terminal } from 'lucide-react';
import type { ExtensionState, LayoutDefinition, PluginManifest, UiSlotId } from '../../../../../packages/plugins/src/types';

export const pluginCategories = ['全部', '阅读', '工具', 'Git', 'AI', '布局', '主题'] as const;
export type PluginCategory = typeof pluginCategories[number];

export function pluginCategory(manifest?: PluginManifest): PluginCategory {
  if (manifest?.contributes.layouts?.length) return '布局';
  if (manifest?.contributes.themes?.length) return '主题';
  if (manifest?.id === 'horizon.git') return 'Git';
  if (manifest?.id === 'horizon.agent') return 'AI';
  if (['horizon.files', 'horizon.editor', 'horizon.search', 'horizon.markdown'].includes(manifest?.id ?? '')) return '阅读';
  return '工具';
}

const glyphs = { 'horizon.files': FolderTree, 'horizon.editor': Braces, 'horizon.search': Search, 'horizon.git': GitBranch, 'horizon.terminal': Terminal, 'horizon.launch': Rocket, 'horizon.agent': Sparkles, 'horizon.markdown': BookOpen };
export function PluginGlyph({ manifest, size = 21 }: { manifest?: PluginManifest; size?: number }) {
  const Icon = glyphs[manifest?.id as keyof typeof glyphs] ?? (manifest?.contributes.layouts?.length ? LayoutTemplate : manifest?.contributes.themes?.length ? Palette : Puzzle);
  return <span className="plugin-glyph" aria-hidden="true"><Icon size={size} /></span>;
}

const triggers: Record<string, string> = {
  'horizon.files': '打开项目文件侧栏时',
  'horizon.editor': '打开代码或文本文件时',
  'horizon.search': '执行项目搜索时',
  'horizon.git': '打开 Git 面板或执行 Git 命令时',
  'horizon.terminal': '打开终端并新建会话时',
  'horizon.launch': '打开启动器并运行方案时',
  'horizon.agent': '打开 AI 助手并发起对话时',
  'horizon.markdown': '打开 Markdown 预览时',
};
export function pluginTrigger(manifest?: PluginManifest): string {
  if (!manifest) return '使用扩展提供的入口时';
  if (manifest.contributes.layouts?.length) return '选择此布局时';
  if (manifest.contributes.themes?.length) return '选择此主题时';
  if (triggers[manifest.id]) return triggers[manifest.id];
  if (manifest.activation.some(event => event.startsWith('onView:'))) return '打开扩展视图时';
  const command = manifest.contributes.commands?.find(command => manifest.activation.includes(`onCommand:${command.id}`));
  return command ? `执行「${command.title}」时` : '使用扩展提供的命令或视图时';
}

export const viewLabel: Record<UiSlotId, string> = { navigation: '项目导航', primarySidebar: '项目侧栏', editor: '编辑区域', auxiliary: '辅助侧栏', bottom: '底部面板', status: '状态栏', overlay: '浮层' };
export const navigationLabel: Record<LayoutDefinition['navigation'], string> = { rail: '独立项目栏', unified: '一体侧栏', tabs: '顶部项目标签', compact: '紧凑工具栏', drawer: '可折叠导航', expressive: '分组项目导航', expanded: '展开项目目录', dock: '底部项目栏' };

const capabilityLabels: Record<string, string> = {
  'project.read': '读取当前项目文件', 'project.write.reviewed': '写入经确认的项目更改', 'process.git': '执行 Git 操作',
  'git.read': '读取当前项目的 Git 更改', 'process.terminal': '运行项目终端', 'process.launch': '运行项目启动方案',
  'process.agent': '运行 Pi Agent', network: '访问网络服务', storage: '保存扩展私有数据',
};
export const capabilityLabel = (capability: string) => capabilityLabels[capability] ?? capability;
export const pluginScope = (state: ExtensionState) => state.projectOverride && state.projectOverride !== 'inherit' ? '项目覆盖' : '全局默认';
