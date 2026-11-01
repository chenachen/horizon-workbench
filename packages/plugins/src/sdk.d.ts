/** Horizon isolated JavaScript SDK v1. Provided to activate(); never imported from the main UI. */
export interface Disposable { dispose(): void | Promise<void> }
export interface DeclarativeView { kind: 'tree' | 'list' | 'text'; title: string; items: { id: string; label: string; description?: string; commandId?: string }[] }
export interface GitStatusFile { path: string; fileId: string; file: { projectId: string; fileId: string; displayPath: string }; index: string; worktree: string; kind: 'ordinary' | 'rename' | 'unmerged' | 'untracked' | 'ignored' }
export interface GitStatusSnapshot { repoId: string; generation: number; repoToken: string; files: GitStatusFile[]; truncated: boolean }
export interface HorizonExtensionContext {
  project: { read(fileId: string): Promise<{ text: string }> };
  git: { status(): Promise<GitStatusSnapshot> };
  storage: { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> };
  settings: { get(key: string): Promise<unknown> };
  commands: { register(id: string, handler: (args?: unknown) => unknown | Promise<unknown>): Disposable };
  views: { register(id: string, view: DeclarativeView): Disposable };
  subscriptions: { add<T extends Disposable | (() => void | Promise<void>)>(disposable: T): T };
}
