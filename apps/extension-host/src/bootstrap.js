// Returned controller stays in a Rust Persistent handle. No bridge is installed on globalThis.
(send, manifest) => {
  const stringify = JSON.stringify;
  const pending = new Map(), commands = new Map(), views = new Map(), subscriptions = new Set();
  let serial = 0, extension, closing = false;
  const emit = (event, data) => send(stringify({ event, data }));
  const request = (method, params) => {
    if (closing) return Promise.reject(Error('扩展正在停止'));
    if (pending.size >= 32) return Promise.reject(Error('扩展并发请求上限为 32'));
    const id = String(++serial);
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      try { send(stringify({ id, method, params })); }
      catch (error) { pending.delete(id); reject(error); }
    });
  };
  const sdk = Object.freeze({
    project: Object.freeze({ read: fileId => request('project.read', { fileId }) }),
    git: Object.freeze({ status: () => request('git.status', {}) }),
    storage: Object.freeze({ get: key => request('storage.get', { key }), set: (key, value) => request('storage.set', { key, value }) }),
    settings: Object.freeze({ get: key => request('settings.get', { key }) }),
    commands: Object.freeze({ register(id, handler) {
      if (closing || !manifest.contributes.commands?.some(command => command.id === id) || typeof handler !== 'function') throw Error('命令未声明或处理函数无效');
      const registration = { handler };
      commands.set(id, registration); emit('command', { id });
      return { dispose() { if (commands.get(id) === registration) { commands.delete(id); emit('commandRemove', { id }); } } };
    } }),
    views: Object.freeze({ register(id, view) {
      if (closing || !manifest.contributes.views?.some(item => item.id === id && item.renderer === 'declarative')) throw Error('视图未声明');
      if (!view || !['tree', 'list', 'text'].includes(view.kind) || typeof view.title !== 'string' || !Array.isArray(view.items) || view.items.length > 2000 || view.items.some(item => typeof item.id !== 'string' || typeof item.label !== 'string')) throw Error('声明式视图无效');
      const registration = {};
      views.set(id, registration); emit('view', { id, view });
      return { dispose() { if (views.get(id) === registration) { views.delete(id); emit('viewRemove', { id }); } } };
    } }),
    subscriptions: Object.freeze({ add(resource) { subscriptions.add(resource); return resource; } }),
  });
  return {
    async activate(namespace, evaluated) {
      await evaluated; extension = namespace;
      if (typeof extension.activate !== 'function') throw Error('扩展须导出 activate');
      await extension.activate(sdk);
      return { active: true };
    },
    async execute(id, args) {
      if (closing) throw Error('扩展正在停止');
      const registration = commands.get(id);
      if (!registration) throw Error('命令未注册');
      const result = await registration.handler(args);
      return result === undefined ? null : result;
    },
    reply(id, result) {
      const request = pending.get(id);
      if (!request) return;
      pending.delete(id);
      result.ok ? request.resolve(result.data) : request.reject(Error(result.error?.message || '能力请求失败'));
    },
    async dispose() {
      closing = true;
      for (const request of pending.values()) request.reject(Error('扩展已停止'));
      pending.clear();
      await extension?.deactivate?.();
      for (const resource of subscriptions) {
        if (typeof resource === 'function') await resource();
        else await resource?.dispose?.();
      }
      subscriptions.clear(); commands.clear(); views.clear();
      return { disposed: true };
    },
  };
}
