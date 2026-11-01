let view;
export async function activate(context) {
  const refresh = async () => {
    const snapshot = await context.git.status();
    const includeUntracked = await context.settings.get('includeUntracked');
    const changes = snapshot.files.filter(change => includeUntracked || change.kind !== 'untracked');
    view?.dispose();
    view = context.views.register('local.read-only-changes.list', {
      kind: 'list', title: `Git 更改 · ${changes.length}`,
      items: changes.map((change, index) => ({
        id: String(change.file?.fileId ?? change.fileId ?? change.path ?? index),
        label: String(change.path ?? change.file?.displayPath ?? '文件'),
        description: `${change.index}${change.worktree}`,
      })),
    });
    await context.storage.set('lastRefresh', new Date().toISOString());
  };
  context.subscriptions.add(context.commands.register('local.read-only-changes.refresh', refresh));
  await refresh();
}
export function deactivate() { view?.dispose(); }
