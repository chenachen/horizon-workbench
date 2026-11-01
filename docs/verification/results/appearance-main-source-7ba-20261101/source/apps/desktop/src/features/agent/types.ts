export type Profile = 'chat' | 'task';
export interface AgentConnection {
  connectionId: string; adapterId: string; revision: number; authState: 'configured' | 'verified' | 'needsAuthentication'; authOwner: 'horizon' | 'runtime' | 'external';
  runtime: { source: 'managed' | 'userInstalled'; executablePath?: string; version?: string };
  provider: { id: string; api: string; model: string; endpoint: string; credentialRef?: string; label?: string; contextWindow?: number };
}
export interface AgentSession { sessionId: string; projectId: string; connectionId: string; profile: Profile; state: string; instanceId: string | null; instanceEpoch: number; resumeAvailable: boolean; reviewId: string | null }
export interface Message { messageId: string; role: 'user' | 'assistant'; text: string; state: string; contentRef?: { sessionId: string; messageId: string }; truncated?: boolean }
export interface Attachment { key: string; label: string; source: 'disk' | 'buffer' | 'gitDiff'; diffId?: string; expectedRepoToken?: string; fileId: string; documentId?: string; editorRevision?: number; expectedDiskRevision?: unknown; text?: string; range?: { fromUtf16: number; toUtf16: number }; byteLength: number }
export interface PermissionRequest { interactionId: string; sessionId: string; runId: string; kind: string; title: string; message?: string; permission: { operationDigest: string; expiresAt: number; operation: { kind: 'exec' | 'write'; executable?: string; argv?: string[]; cwd?: string; files?: { file: { displayPath: string }; bytes: string }[] } } }
export interface ReviewFile { file: { projectId: string; fileId: string; displayPath: string }; relativePath: string; baselineHash: string | null; afterHash: string | null; expectedDiskRevision: unknown; expectedEditorRevision?: number; kind: string; canApply: boolean; applied: boolean; reason?: string }
export interface Review { reviewId: string; origin: 'taskCopy'; baseline: string; files: ReviewFile[] }
export interface RunResult { sessionId: string; state: string; text: string; reviewId?: string; disposition: string; runId: string }
