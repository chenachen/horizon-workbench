import { describe, expect, it } from 'vitest';
import { resolveRemoteTarget } from './remoteTarget';
import type { GitSnapshot } from './types';

const head: GitSnapshot['head'] = { state: 'branch', name: 'main' };

describe('Git remote targets', () => {
  it('uses the configured upstream remote and branch', () => {
    expect(resolveRemoteTarget({
      head,
      upstream: { name: 'origin/main', ahead: 0, behind: 0 },
    }, ['backup', 'origin'])).toEqual({ remote: 'origin', branch: 'main' });
  });

  it('preserves slashes in the upstream branch name', () => {
    expect(resolveRemoteTarget({
      head,
      upstream: { name: 'origin/feature/git-panel', ahead: 1, behind: 0 },
    }, ['origin'])).toEqual({ remote: 'origin', branch: 'feature/git-panel' });
  });

  it('requires an explicit target when remote name prefixes overlap', () => {
    const remotes = ['company', 'company/team'];
    expect(resolveRemoteTarget({
      head,
      upstream: { name: 'company/team/review/git-panel', ahead: 0, behind: 0 },
    }, remotes)).toBeNull();
    expect(remotes).toEqual(['company', 'company/team']);
  });

  it('supports an unambiguous remote name containing slashes', () => {
    expect(resolveRemoteTarget({
      head,
      upstream: { name: 'company/team/review/git-panel', ahead: 0, behind: 0 },
    }, ['company/team'])).toEqual({ remote: 'company/team', branch: 'review/git-panel' });
  });

  it('keeps an upstream target that differs from the local branch name', () => {
    expect(resolveRemoteTarget({
      head: { state: 'branch', name: 'work' },
      upstream: { name: 'origin/review', ahead: 2, behind: 1 },
    }, ['origin'])).toEqual({ remote: 'origin', branch: 'review' });
  });

  it('uses the first remote and local branch when publishing a branch', () => {
    expect(resolveRemoteTarget({
      head: { state: 'branch', name: 'feature/git-panel' },
      upstream: null,
    }, ['origin', 'backup'])).toEqual({ remote: 'origin', branch: 'feature/git-panel' });
  });

  it('requires a remote and named head for the publishing fallback', () => {
    expect(resolveRemoteTarget({ head, upstream: null }, [])).toBeNull();
    expect(resolveRemoteTarget({ head: { state: 'detached', oid: 'abc123' }, upstream: null }, ['origin'])).toBeNull();
  });

  it('returns no target when the upstream remote is unavailable', () => {
    const snapshot = { head, upstream: { name: 'origin/main', ahead: 0, behind: 0 } };
    expect(resolveRemoteTarget(snapshot, ['upstream'])).toBeNull();
    expect(resolveRemoteTarget(snapshot, [])).toBeNull();
  });
});
