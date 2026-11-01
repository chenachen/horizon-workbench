# Editor domain and UI

The domain model lives in `src/store.ts`; the desktop adapter and React views live in `apps/desktop/src/features/editor/`. File access is exclusively through the typed Horizon bridge. CodeMirror and language parsers load dynamically.

## Host integration

- `editorStore.setProject(projectId, projectEpoch, session)` records a project session. It does **not** open files or activate the editor.
- After `activatePlugin('horizon.editor', projectId, 'view')` succeeds, call `restoreProjectSession(projectId)`.
- `openFile(fileId, {projectId, preview, line, column})` uses 0-based line/column positions. Files, previews, selection, scroll positions and search drafts belong to their project.
- `save` / `saveActive` return `Promise<boolean>`. `false` means failure or newer input remains unsaved. A captured save never clears a newer change.
- `requestClose` and `requestCloseMany` show the save / discard / cancel flow. Batch closing pauses at each unresolved document. `cancelClose` stops the remaining batch.
- `flushDrafts(projectId?)` waits for the latest checkpoints and session writes. It must run before creating a host resource stop plan.
- After the native stop plan has released document IDs, call `hostClosedProject(projectId, 'retainCheckpoint' | 'discard')`. Retained drafts become small recovery handles; reopening compares disk versions and obtains a fresh native document ID.
- The plugin lifecycle registration performs prepare/checkpoint and post-stop view disposal. Pausing project A does not dispose project B's buffers.

`FileExplorerToolbar({projectId})` belongs in the shell's sidebar header. `FileExplorer` defaults to no duplicate header. Its optional `gitStatus` map displays an already available Git snapshot without activating Git. `EditorWorkbench` accepts `onToggleSidebar` for the tab-bar navigation control. Keep its React location and key stable when changing layout; the shell changes CSS.

`applyReviewedEdit({projectId,fileId,expectedEditorRevision,text,proposalId})` checks the editor version, creates one undoable CodeMirror transaction, persists the draft, then acknowledges the native proposal. It does not save the disk file.

## Data and resource invariants

- CodeMirror persistent text is the active document source. Metadata snapshots do not copy full text on each keystroke. Undo to the saved text uses `Text.eq` and returns to clean state.
- Clean text is bounded to 20 documents and 64 MiB, whichever comes first. Dirty text is never evicted before a durable checkpoint. Native document IDs are not reused after a host stop.
- Recovery checkpoints follow 2 seconds idle / at most 10 seconds continuous input, plus explicit project/stop/exit flushes.
- Large-file chunks replace the displayed chunk; they cannot enter the save path. UI distinguishes bytes from UTF-16 positions.
- Tree DOM and search result DOM are virtualized. Directory cache is limited to 10,000 entries. Search requests use the 10,000-match service boundary; only five projects retain result bodies.
- Markdown disables raw HTML and remote resource loading. External links require an explicit click. Markdown and JSON previews are limited to 1 MiB; JSON children render on expansion and in 200-item pages.
- Automatic save defaults off and waits for a subsequent edit after enabling. IME composition, external conflicts and pending review applications pause it.

## Verification

Run `npx vitest run packages/editor/src/store.test.ts` and `npm run desktop:check` from the repository root. The 15 domain tests cover concurrent save/input, duplicate saves, project isolation, disk conflicts, chunk safety, checkpoint failure/latency, recovery, cache eviction, reload races, IME guards, host document rebinding, dormant sessions, batch close and real CodeMirror undo-to-clean behavior.

Native GUI acceptance is tracked separately under `docs/verification/`; unit tests do not establish IME, accessibility, visual fidelity or desktop performance acceptance.

`getEditorDiagnostics()` returns a bounded local history of real open intents and view lifetimes. `horizon:editor-timing` emits updates for the same measurement ID. `durationMs` is a visible-layout/rAF proxy; `languageReadyMs` is module readiness; `highlightReadyMs` waits for the viewport syntax tree and a visible frame. All durations share the open start. This does not directly observe pixel paint.
