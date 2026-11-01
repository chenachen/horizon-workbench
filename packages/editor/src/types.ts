export type DiskRevision = { token: string; contentHash: string; byteLength: string; modifiedAt: string };
export type FileRef = { projectId: string; fileId: string; displayPath: string };
export type Selection = { anchor: number; head: number };
export type DirectoryEntry = { entryId: string; file: FileRef; name: string; kind: 'file' | 'directory' | 'symlink' | 'other'; nativeNameLossless: boolean; ignored: boolean };
export type DirectoryPage = { directoryRevision: number; entries: DirectoryEntry[]; nextCursor: string | null; truncated: boolean };
export type DocumentMeta = { documentId: string; file: FileRef; editorRevision: number; baseDiskRevision: DiskRevision; encoding: 'utf8' | 'utf8bom' | 'utf16le' | 'utf16be'; eol: 'lf' | 'crlf' | 'mixed'; state: 'clean' | 'dirty' | 'saving' | 'conflict' | 'missing'; readOnly: boolean };
export type OpenDocument =
  | { mode: 'editor'; meta: DocumentMeta; text: string; simplified: boolean }
  | { mode: 'chunked'; file: FileRef; revision: DiskRevision; cursor: string }
  | { mode: 'unsupported'; file: FileRef; reason: 'binary' | 'encoding' };
export type SaveResult = { savedEditorRevision: number; diskRevision: DiskRevision; recoveryCheckpointId: string | null };
export type ProjectSession = { schemaVersion: 1; revision: number; tabs: { fileId: string; pinned: boolean; selection: Selection; scrollTop: number }[]; activeFileId: string | null; expandedEntryIds: string[]; searchDraft: string; commitDraft?: string; layout?: unknown };
export type SearchMatch = { file: FileRef; line: number; lineText?: string; ranges: ({ unit: 'utf16'; from: number; to: number } | { unit: 'byte'; from: string; to: string })[]; diskRevision?: DiskRevision };
export type RecoveryItem = { checkpointId: string; documentId: string; projectId: string; file?: FileRef; editorRevision: number; updatedAt: string; byteCount: string };
export type RecoveryDraft = RecoveryItem & { fileId?: string; baseDiskRevision: DiskRevision; text: string; selection: Selection; encoding: DocumentMeta['encoding']; eol: DocumentMeta['eol'] };
export type EditorTransport = { call<T>(method: string, params?: Record<string, unknown>, projectId?: string): Promise<T> };
export type EditorPreferences = { autoSave?: 'off' | 'afterDelay' | 'onFocusChange'; autoSaveDelay?: number; wordWrap?: 'on' | 'off'; tabSize?: number; insertSpaces?: boolean; lineNumbers?: boolean; fontSize?: number; fontFamily?: string };
export type FileAccessError = { code: string; message: string };
export type FileRelocationPlan = {
  planId: string; digest: string; expiresAt: string; source: FileRef; hasBuffer: boolean; dirty: boolean;
  candidate: { displayPath: string; fileId?: string; mode: OpenDocument['mode']; diskRevision: DiskRevision; encoding?: string; eol?: string; readOnly: boolean; simplified: boolean; canKeepBuffer: boolean; text?: string; previewTruncated: boolean; reason?: string };
};
export type FileRelocationResult = { previousFileId: string; choice: 'useSelected' | 'keepBuffer'; file: FileRef; opened: OpenDocument };
export type EditorBuffer = {
  key: string; projectId: string; fileId: string; path: string; mode: OpenDocument['mode'] | 'unavailable';
  meta?: DocumentMeta; revision?: DiskRevision; simplified: boolean; reason?: string;
  dirty: boolean; saving: boolean; conflict: boolean; preview: boolean; loading: boolean; error?: string; accessError?: FileAccessError;
  version: number; savedVersion: number; contentVersion: number; selection: Selection; scrollTop: number;
  getText: () => string; cursor?: string | null; byteStart?: string; byteEnd?: string;
  contentIdentity?: unknown; savedContentIdentity?: unknown; contentEquals?: (left: unknown, right: unknown) => boolean;
  checkpointVersion: number; checkpointId?: string; checkpointError?: string; lastUsed: number; evicted?: boolean; recoveryPending?: boolean; composing?: boolean; proposalPending?: boolean; reveal?: { line: number; column: number; nonce: number };
};
export type EditorProject = { id: string; epoch: number; tabs: string[]; activeFileId: string | null; expanded: Set<string>; searchDraft: string; restored: boolean };
export type EditorSnapshot = { revision: number; activeProjectId: string | null; projects: ReadonlyMap<string, EditorProject>; buffers: ReadonlyMap<string, EditorBuffer>; pendingClose: { projectId: string; fileId: string } | null; error: string | null };
export const bufferKey = (projectId: string, fileId: string) => `${projectId}\u0000${fileId}`;
export function errorMessage(error: unknown): string { return error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error); }
