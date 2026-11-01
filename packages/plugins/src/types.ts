export type UiSlotId = 'navigation' | 'primarySidebar' | 'editor' | 'auxiliary' | 'bottom' | 'status' | 'overlay';
export type GeometryKey = 'sidebarWidth' | 'navigationWidth' | 'topbarHeight' | 'tabHeight' | 'tabMinWidth' | 'auxiliaryWidth' | 'bottomHeight' | 'statusHeight' | 'uiFontSize' | 'codeFontSize';
export interface GeometryRule { initial: number; min: number; max: number; step: number }
export type LayoutNode = { id: string; kind: 'row' | 'column'; children: LayoutNode[] } | { id: string; kind: 'slot'; slot: UiSlotId; sizing?: GeometryKey; grow?: number } | { id: string; kind: 'tabs'; slots: UiSlotId[] };
export interface LayoutDefinition {
  id: string; apiVersion: 1; label: string;
  navigation: 'rail' | 'unified' | 'tabs' | 'compact' | 'drawer' | 'expressive' | 'expanded' | 'dock';
  root: LayoutNode; requiredSlots: UiSlotId[]; geometry: Partial<Record<GeometryKey, GeometryRule>>;
  narrow: { breakpoint: number; collapse: UiSlotId[]; minimumEditorWidth: number };
}
export type ThemeToken = 'background' | 'surface' | 'text' | 'muted' | 'border' | 'accent' | 'onAccent' | 'selection' | 'success' | 'warning' | 'error';
export interface ThemeDefinition { id: string; apiVersion: 1; label: string; light: Record<ThemeToken, string>; dark: Record<ThemeToken, string>; radius: number; density: 'compact' | 'standard' | 'comfortable' | 'spacious'; rowHeight?: number }
export interface DeclarativeView { kind: 'tree' | 'list' | 'text'; title: string; items: { id: string; label: string; description?: string; commandId?: string }[] }
export interface PluginManifest {
  id: string; name: string; version: string; description: string; author: string;
  apiVersion: 1; engines: { horizon: string };
  runtime: { kind: 'declarative' | 'trusted-main' | 'quickjs'; entry?: string };
  activation: string[]; requires: Record<string, string>; optional: Record<string, string>; capabilities: string[];
  contributes: { commands?: { id: string; title: string }[]; views?: { id: string; slot: UiSlotId; renderer: 'trusted' | 'declarative' }[]; layouts?: LayoutDefinition[]; themes?: ThemeDefinition[]; settings?: SettingDefinition[] };
}
export interface SettingDefinition { key: string; label: string; type: 'boolean' | 'string' | 'select' | 'path'; default?: unknown; options?: string[] }
export interface ExtensionState {
  id: string; revision: number; installedVersion: string | null;
  installState: 'absent' | 'installing' | 'installed' | 'updating' | 'uninstalling' | 'failed';
  pausedGlobal: boolean; pausedProject: boolean; effectivePaused: boolean;
  enabledGlobal: boolean; projectOverride: 'inherit' | 'enabled' | 'disabled'; effectiveEnabled: boolean;
  runState: 'stopped' | 'activating' | 'active' | 'sleeping' | 'pausing' | 'paused' | 'failed' | 'cleanupFailed';
  activationId?: string; dependents: string[]; ownedResourceCount: number;
  uiReclaim: 'released' | 'retainedModule' | 'reloadRequired' | 'failed';
  manifest?: PluginManifest; error?: { code: string; message: string };
  source?: string; development?: boolean; previousVersion?: string;
  instances?: { projectId: string | null; activationId: string; runState: string }[];
}
export interface Disposable { dispose(): void | Promise<void> }
export type StopReason = 'pause' | 'disable' | 'uninstall' | 'shutdown' | 'sleep';
export interface LifecycleRequest { reason: StopReason; projectId?: string }
export interface ActivationContext { activationId: string; projectId?: string; signal: AbortSignal; own<T extends Disposable | (() => void | Promise<void>)>(resource: T): T }
export interface PluginLifecycle {
  activate?(context: ActivationContext): void | Disposable | (() => void | Promise<void>) | Promise<void | Disposable | (() => void | Promise<void>)>;
  prepareDeactivate?(request: LifecycleRequest): Promise<{ ready: boolean; blockers: string[] }>;
  dispose?(request: LifecycleRequest): void | Promise<void>;
}
export interface SlotContribution { id: string; extensionId: string; activationId: string; projectId?: string; slot: UiSlotId; title: string; view?: DeclarativeView }
