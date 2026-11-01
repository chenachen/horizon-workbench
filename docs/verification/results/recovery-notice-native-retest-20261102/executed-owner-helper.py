"""Read-only binding for the one existing A/H005 draft Restore."""
from pathlib import Path
import datetime, hashlib, json, sys, time

ROOT = Path('/Users/chenpengxiang/Desktop/Horizon')
DATA = Path('/Users/chenpengxiang/Library/Application Support/dev.horizon.desktop')
OUT = ROOT / 'docs/verification/results/recovery-notice-native-retest-20261102'
RELEASE = ROOT / 'docs/verification/results/recovery-notice-release-20261102'
MAIN = Path('/Users/chenpengxiang/Applications/Horizon.app/Contents/MacOS/horizon-desktop')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
base = json.loads((OUT / '00-existing-owned-draft-baseline.json').read_text())
installation = json.loads((RELEASE / 'installation-copy.json').read_text())
assert sha(MAIN) == installation['mainSha256']
sys.path.insert(0, str(ROOT / 'scripts/desktop'))
from mac_metrics import MacMetrics, select_processes
metrics = MacMetrics(); processes = metrics.processes()
mains = [p for p in processes.values() if p['executable'] == str(MAIN)]
assert len(mains) == 1
main = metrics.read(mains[0], time.monotonic())
selected, unassigned = select_processes(processes, {main['pid']}, {}, {}, metrics)
snapshot = {'main': main, 'mainSHA256': installation['mainSha256'],
            'owned': [{**metrics.read(processes[pid], time.monotonic()), **owner} for pid, owner in selected.items()],
            'unassignedWebKitCandidates': unassigned}
inventory = {p.name: {'bytes': p.stat().st_size, 'sha256': sha(p)} for p in sorted((DATA / 'recovery').glob('*.json'))}
source = Path(base['source']['path'])
source_row = {'path': str(source), 'bytes': source.stat().st_size, 'sha256': sha(source)}
assert source_row == base['source']
old = base['ownedCheckpoint']; old_path = Path(old['path']); old_draft = old['checkpoint']
if sys.argv[1] == 'startup':
    assert inventory == base['recoveryInventory']
    result = {'checks': {'source53BPreserved': True, 'allThreeDraftsPreserved': True}, 'recoveryInventory': inventory}
    target = OUT / '01-new-package-startup-owner.json'
elif sys.argv[1] == 'restored':
    other = {n: r for n, r in base['recoveryInventory'].items() if n != old_path.name}
    changes = [n for n, r in inventory.items() if other.get(n) != r]
    assert len(changes) == 1 and changes[0] != old_path.name, changes
    p = DATA / 'recovery' / changes[0]; draft = json.loads(p.read_text())
    checks = {'originalCheckpointResolved': old_path.name not in inventory,
              'otherTwoDraftsUnchanged': all(inventory.get(n) == r for n, r in other.items()),
              'sameProject': draft['projectId'] == old_draft['projectId'],
              'sameFile': draft['file'] == old_draft['file'],
              'same141ByteText': draft['text'] == old_draft['text'] and len(draft['text'].encode()) == 141,
              'sameSelection': draft['selection'] == old_draft['selection'],
              'source53BPreserved': source_row == base['source'],
              'newCheckpointNotLocked': p.stat().st_flags == 0}
    result = {'checks': checks, 'ownedCheckpoint': {'path': str(p), **inventory[p.name], 'flags': p.stat().st_flags, 'checkpoint': draft}, 'recoveryInventory': inventory}
    target = OUT / '02-restored-owner.json'
else:
    raise SystemExit('Use startup or restored; no mutation or signals implemented')
result.update({'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'source': source_row, **snapshot,
               'scope': 'Known owned A/H005 existing141B draft only; disk and OS read-only. Native original screenshot/AX separately prove restored dirty body and notice removal.'})
with target.open('x') as f: f.write(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'output': str(target), 'pid': main['pid'], 'start': main['start'], 'birth': main['start_abstime'], 'sha256': result['mainSHA256'], 'checks': result['checks']}, ensure_ascii=False))
assert all(result['checks'].values())
