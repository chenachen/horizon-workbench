import type { GrammarDefinition, LanguageDefinition, LanguageServerDefinition, LayoutDefinition, LayoutNode, PluginManifest, ThemeDefinition, TokenColorRule, UiSlotId } from './types';
const slots = new Set<UiSlotId>(['navigation', 'primarySidebar', 'editor', 'auxiliary', 'bottom', 'status', 'overlay']);
const tokens = ['background', 'surface', 'text', 'muted', 'border', 'accent', 'onAccent', 'selection', 'success', 'warning', 'error'];
const languageId = /^[a-z][a-z0-9_.+-]*$/i;
const scopeName = /^[a-z_][a-z0-9_.-]*$/i;
const fontStyles = new Set(['italic', 'bold', 'underline', 'strikethrough']);
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
  if (theme.tokenColors !== undefined) {
    if (!theme.tokenColors || typeof theme.tokenColors !== 'object' || Array.isArray(theme.tokenColors)
      || Object.keys(theme.tokenColors).some(key => key !== 'light' && key !== 'dark')) throw new Error('语法配色模式无效');
    for (const rules of [theme.tokenColors.light, theme.tokenColors.dark]) {
      if (rules === undefined) continue;
      if (!Array.isArray(rules)) throw new Error('语法配色必须为规则数组');
      for (const rule of rules) validateTokenColor(rule);
    }
  }
}
function validateTokenColor(rule: TokenColorRule): void {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)
    || Object.keys(rule).some(key => !['name', 'scope', 'settings'].includes(key))) throw new Error('语法配色规则无效');
  const scopes = typeof rule.scope === 'string' ? [rule.scope] : rule.scope;
  if (!Array.isArray(scopes) || scopes.length === 0 || scopes.some(scope => typeof scope !== 'string' || !scope.trim())) throw new Error('语法配色 scope 无效');
  if (rule.name !== undefined && typeof rule.name !== 'string') throw new Error('语法配色名称无效');
  const settings = rule.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)
    || Object.keys(settings).some(key => key !== 'foreground' && key !== 'fontStyle')) throw new Error('语法配色设置无效');
  if (settings.foreground !== undefined && !/^#[\da-f]{6}$/i.test(settings.foreground)) throw new Error('语法配色必须使用六位 HEX 颜色');
  if (settings.fontStyle !== undefined && (typeof settings.fontStyle !== 'string'
    || settings.fontStyle.trim().split(/\s+/).filter(Boolean).some(style => !fontStyles.has(style)))) throw new Error('语法字体样式无效');
}
export function validateLanguage(language: LanguageDefinition): void {
  if (!language || typeof language !== 'object' || Array.isArray(language)
    || Object.keys(language).some(key => !['id', 'aliases', 'extensions', 'filenames'].includes(key))
    || typeof language.id !== 'string' || !languageId.test(language.id)) throw new Error('语言声明无效');
  if (language.aliases !== undefined && (!Array.isArray(language.aliases)
    || language.aliases.some(alias => typeof alias !== 'string' || !alias.trim()))) throw new Error('语言名称无效');
  if (language.extensions !== undefined && (!Array.isArray(language.extensions)
    || language.extensions.some(extension => typeof extension !== 'string' || !/^\.[^/\\\0]+$/.test(extension)))) throw new Error('语言文件后缀无效');
  if (language.filenames !== undefined && (!Array.isArray(language.filenames)
    || language.filenames.some(filename => typeof filename !== 'string' || !filename || /[/\\\0]/.test(filename) || filename === '.' || filename === '..'))) throw new Error('语言文件名无效');
}
export function validateGrammar(grammar: GrammarDefinition): void {
  if (!grammar || typeof grammar !== 'object' || Array.isArray(grammar)
    || Object.keys(grammar).some(key => !['language', 'scopeName', 'path', 'injectTo'].includes(key))
    || typeof grammar.scopeName !== 'string' || !scopeName.test(grammar.scopeName)) throw new Error('语法声明无效');
  if (grammar.language !== undefined && (typeof grammar.language !== 'string' || !languageId.test(grammar.language))) throw new Error('语法语言 ID 无效');
  if (typeof grammar.path !== 'string' || /[\\:\0]/.test(grammar.path)
    || !grammar.path.endsWith('.json') || grammar.path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('语法路径必须指向插件内的 JSON 文件');
  if (grammar.injectTo !== undefined && (!Array.isArray(grammar.injectTo)
    || grammar.injectTo.some(scope => typeof scope !== 'string' || !scopeName.test(scope)))) throw new Error('注入语法 scope 无效');
}
export function validateLanguageServer(server: LanguageServerDefinition): void {
  if (!server || typeof server !== 'object' || Array.isArray(server)
    || Object.keys(server).some(key => !['id', 'languageIds', 'rootMarkers', 'command', 'args', 'initializationOptions', 'settings'].includes(key))
    || typeof server.id !== 'string' || !languageId.test(server.id)) throw new Error('语言服务器声明无效');
  if (!Array.isArray(server.languageIds) || server.languageIds.length === 0
    || server.languageIds.some(id => typeof id !== 'string' || !languageId.test(id))
    || new Set(server.languageIds).size !== server.languageIds.length) throw new Error('语言服务器 languageIds 无效或重复');
  if (server.rootMarkers !== undefined && (!Array.isArray(server.rootMarkers)
    || server.rootMarkers.some(marker => typeof marker !== 'string' || !marker || /[/\\\0]/.test(marker) || marker === '.' || marker === '..'))) throw new Error('语言服务器根目录标记必须为文件名');
  if (typeof server.command !== 'string' || !server.command.trim() || server.command.includes('\0')) throw new Error('语言服务器程序无效');
  if (server.args !== undefined && (!Array.isArray(server.args)
    || server.args.some(arg => typeof arg !== 'string' || arg.includes('\0')))) throw new Error('语言服务器参数必须为字符串数组');
  for (const value of [server.initializationOptions, server.settings]) {
    if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) throw new Error('语言服务器配置必须为对象');
  }
}
export function validateManifest(manifest: PluginManifest): void {
  if (!/^[a-z][a-z0-9.-]{2,127}$/.test(manifest.id) || manifest.apiVersion !== 1) throw new Error('扩展 ID 或 API 版本无效');
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('版本必须为 major.minor.patch');
  for (const layout of manifest.contributes.layouts ?? []) validateLayout(layout);
  for (const theme of manifest.contributes.themes ?? []) validateTheme(theme);
  const languages = manifest.contributes.languages;
  const grammars = manifest.contributes.grammars;
  const servers = manifest.contributes.languageServers;
  if (languages !== undefined && !Array.isArray(languages)
    || grammars !== undefined && !Array.isArray(grammars)
    || servers !== undefined && !Array.isArray(servers)) throw new Error('语言与语法贡献必须为数组');
  const ids = new Set<string>();
  for (const language of languages ?? []) {
    validateLanguage(language);
    if (ids.has(language.id)) throw new Error('语言 ID 重复');
    ids.add(language.id);
  }
  const scopes = new Set<string>();
  for (const grammar of grammars ?? []) {
    validateGrammar(grammar);
    if (scopes.has(grammar.scopeName)) throw new Error('语法 scope 重复');
    scopes.add(grammar.scopeName);
  }
  const serverIds = new Set<string>();
  for (const server of servers ?? []) {
    validateLanguageServer(server);
    if (serverIds.has(server.id)) throw new Error('语言服务器 ID 重复');
    serverIds.add(server.id);
  }
  if (serverIds.size && !manifest.capabilities.includes('language.server')) throw new Error('语言服务器需要 language.server 能力');
  if (serverIds.size && manifest.runtime.kind !== 'declarative') throw new Error('语言服务器必须使用 declarative 运行时');
}
