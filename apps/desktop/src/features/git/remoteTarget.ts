import type { GitSnapshot } from './types';

export function resolveRemoteTarget(
  snapshot: Pick<GitSnapshot, 'head' | 'upstream'>,
  remotes: string[],
): { remote: string; branch: string } | null {
  if (snapshot.upstream) {
    const upstreamName = snapshot.upstream.name;
    const matchingRemotes = remotes.filter(name => upstreamName.startsWith(`${name}/`));
    if (matchingRemotes.length !== 1) return null;
    const remote = matchingRemotes[0];

    return { remote, branch: upstreamName.slice(remote.length + 1) };
  }

  const remote = remotes[0];
  const branch = snapshot.head.name;
  return remote && branch ? { remote, branch } : null;
}
