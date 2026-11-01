/** Fixed, host-owned Pi 1.4.0 extension. Pi owns the agent loop. */
import { createConnection } from 'node:net';
import { Type } from '@sinclair/typebox';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

const names = ['horizon_read', 'horizon_list', 'horizon_write', 'horizon_exec'];

function broker(operation: unknown, signal?: AbortSignal): Promise<string> {
  const socketPath = process.env.HORIZON_BROKER_SOCKET;
  const token = process.env.HORIZON_BROKER_TOKEN;
  if (!socketPath || !token) return Promise.reject(new Error('Horizon policy bridge unavailable'));
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    socket.setEncoding('utf8');
    let data = '', done = false;
    const finish = (error?: Error, text?: string) => {
      if (done) return;
      done = true;
      signal?.removeEventListener('abort', abort);
      socket.destroy();
      if (error) reject(error); else resolve(text ?? '');
    };
    const abort = () => finish(new Error('Tool cancelled'));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) return abort();
    socket.setTimeout(125_000, () => finish(new Error('Horizon permission expired')));
    socket.on('error', error => finish(error));
    socket.on('connect', () => socket.write(JSON.stringify({ version: 1, token, operation }) + '\n'));
    socket.on('data', chunk => {
      data += chunk.toString('utf8');
      if (data.length > 2 * 1024 * 1024) return finish(new Error('Broker response too large'));
      const end = data.indexOf('\n');
      if (end < 0) return;
      try {
        const response = JSON.parse(data.slice(0, end));
        if (response.ok !== true) finish(new Error(response.error ?? 'Horizon blocked operation'));
        else finish(undefined, response.text);
      } catch { finish(new Error('Invalid Horizon broker response')); }
    });
    socket.on('end', () => { if (!done) finish(new Error('Horizon bridge disconnected')); });
  });
}

export default function horizonPolicy(pi: ExtensionAPI) {
  pi.on('session_start', () => pi.setActiveTools(names));
  pi.on('tool_call', event => names.includes(event.toolName)
    ? undefined : { block: true, reason: 'Tool outside Horizon allowlist' });
  pi.on('user_bash', () => ({ result: { output: 'Use the authorized Horizon command tool.', exitCode: 1, cancelled: false, truncated: false } }));
  const register = (name: string, description: string, parameters: any) => pi.registerTool({
    name, label: name.replace('horizon_', ''), description, parameters,
    async execute(_id: string, params: any, signal?: AbortSignal) {
      const text = await broker({ ...params, kind: name.replace('horizon_', '') }, signal);
      return { content: [{ type: 'text' as const, text }], details: {} };
    },
  });
  register('horizon_read', 'Read a UTF-8 file inside this task copy. Paths are relative to the task root. Never reads the original project.',
    Type.Object({ path: Type.String() }));
  register('horizon_list', 'List a directory inside this task copy. Paths are relative to the task root.',
    Type.Object({ path: Type.String({ default: '.' }) }));
  register('horizon_write', 'Create or replace a UTF-8 file inside this task copy, after user approval. Does not modify the original project.',
    Type.Object({ path: Type.String(), content: Type.String() }));
  register('horizon_exec', `Request user approval to execute a program with exact arguments in this task copy. No model credentials are passed to this process. ${process.platform === 'win32' ? 'Use cmd.exe with explicit /d /s /c only when a shell is needed.' : 'Use /bin/sh with explicit -c only when a shell is needed.'} This is not an OS sandbox.`,
    Type.Object({ executable: Type.String(), argv: Type.Array(Type.String()), cwd: Type.Optional(Type.String({ default: '.' })) }));
}
