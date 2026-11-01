"""Evidence for the single owned Q2 recovery flow; only crash mode sends a signal."""
from pathlib import Path
import argparse
import datetime
import hashlib
import json
import os
import signal
import sys
import time

ROOT = Path('/Users/chenpengxiang/Desktop/Horizon')
DATA = Path('/Users/chenpengxiang/Library/Application Support/dev.horizon.desktop')
OUT = ROOT / 'docs/verification/results/q2-crash-recovery-native-20261102'
MAIN = Path('/Users/chenpengxiang/Applications/Horizon.app/Contents/MacOS/horizon-desktop')
PROJECT = 'ec6de2de-7bd7-44cb-8f5b-945b793b99db'
FIXTURE = json.loads((ROOT / '.work/q2-crash-recovery-fixture.json').read_text())
sys.path.insert(0, str(ROOT / 'scripts/desktop'))
from mac_metrics import MacMetrics, select_processes

now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()

def write(name, data):
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / name).open('x') as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': str(OUT / name), 'at': data.get('observedAt')}, ensure_ascii=False), flush=True)

def source():
    p = Path(FIXTURE['file'])
    row = {'path': str(p), 'bytes': p.stat().st_size, 'sha256': sha(p)}
    assert row['bytes'] == FIXTURE['bytes'] and row['sha256'] == FIXTURE['sha256'], row
    return row

def recovery_inventory():
    return {p.name: {'bytes': p.stat().st_size, 'sha256': sha(p)}
            for p in sorted((DATA / 'recovery').glob('*.json'))}

def owned_checkpoint(baseline):
    inventory = recovery_inventory()
    changed = [name for name, meta in inventory.items() if baseline.get(name) != meta]
    assert len(changed) == 1, {'changedNames': changed, 'reason': 'Resolve unexpected checkpoint changes before reading bodies'}
    owned = []
    for name in changed:
        p = DATA / 'recovery' / name
        data = json.loads(p.read_text())
        if (data.get('projectId') == PROJECT
                and data.get('file', {}).get('displayPath') == Path(FIXTURE['file']).name):
            owned.append({'path': str(p), **inventory[name], 'checkpoint': data})
    assert len(owned) == 1, {'changedNames': changed, 'ownedCount': len(owned)}
    row = owned[0]
    assert row['checkpoint']['text'].count(FIXTURE['marker']) == 1
    original = Path(FIXTURE['file']).read_text()
    assert row['checkpoint']['text'].startswith(original)
    assert row['checkpoint']['text'][len(original):].strip() == FIXTURE['marker']
    assert row['checkpoint']['file']['projectId'] == PROJECT
    return row, inventory

def app_snapshot(expected_pid, expected_birth, expected_sha):
    assert sha(MAIN) == expected_sha
    metrics = MacMetrics()
    processes = metrics.processes()
    assert expected_pid in processes, 'Expected main is absent'
    main = metrics.read(processes[expected_pid], time.monotonic())
    assert main['start_abstime'] == expected_birth and main['executable'] == str(MAIN), main
    selected, unassigned = select_processes(processes, {expected_pid}, {}, {}, metrics)
    return {'main': main, 'mainSHA256': expected_sha,
            'owned': [{**metrics.read(processes[pid], time.monotonic()), **owner} for pid, owner in selected.items()],
            'unassignedWebKitCandidates': unassigned}

parser = argparse.ArgumentParser()
parser.add_argument('phase', choices=['baseline', 'checkpoint', 'crash', 'restored', 'retained', 'cleared'])
parser.add_argument('--pid', type=int)
parser.add_argument('--birth', type=int)
parser.add_argument('--sha256')
parser.add_argument('--execute-single-owned-crash', action='store_true')
args = parser.parse_args()
assert not (ROOT / '.work/plugin-checkpoint-fault.json').exists()

if args.phase == 'baseline':
    registry = json.loads((DATA / 'registry.json').read_text())
    projects = registry['projects']
    rows = projects.values() if isinstance(projects, dict) else projects
    project = next(p for p in rows if p['id'] == PROJECT)
    assert Path(project['rootDisplayPath']).resolve() == Path(FIXTURE['projectRoot']).resolve()
    write('00-owner-baseline.json', {'observedAt': now(), 'source': source(), 'project': project,
          'recoveryInventory': recovery_inventory(), **app_snapshot(args.pid, args.birth, args.sha256),
          'scope': 'Owned fixture and exact app/descendant/responsibility snapshot before native edit. Feature-idle state is separately bound by GUI and plugin final evidence.'})
elif args.phase == 'checkpoint':
    baseline = json.loads((OUT / '00-owner-baseline.json').read_text())
    checkpoint, inventory = owned_checkpoint(baseline['recoveryInventory'])
    write('01-owner-checkpoint.json', {'observedAt': now(), 'source': source(), 'ownedCheckpoint': checkpoint,
          'recoveryInventory': inventory, **app_snapshot(args.pid, args.birth, args.sha256)})
elif args.phase == 'crash':
    assert args.execute_single_owned_crash, 'Explicit single controlled-crash execution flag required'
    checkpoint = json.loads((OUT / '01-owner-checkpoint.json').read_text())
    target = Path(checkpoint['ownedCheckpoint']['path'])
    assert sha(target) == checkpoint['ownedCheckpoint']['sha256'], 'Checkpoint changed; capture latest owned revision before crash'
    before = app_snapshot(args.pid, args.birth, args.sha256)
    assert (args.pid, args.birth, args.sha256) == (checkpoint['main']['pid'], checkpoint['main']['start_abstime'], checkpoint['mainSHA256'])
    write('02-owner-crash-intent.json', {'observedAt': now(), 'source': source(), 'signal': 'SIGKILL', **before})
    # Revalidate identity immediately before the only signal; never target a process name or group.
    app_snapshot(args.pid, args.birth, args.sha256)
    signal_at = now()
    os.kill(args.pid, signal.SIGKILL)
    observations = []
    metrics = MacMetrics()
    deadline = time.monotonic() + 10
    while True:
        processes = metrics.processes()
        rows = []
        for old in before['owned']:
            current = metrics.read(processes[old['pid']], time.monotonic()) if old['pid'] in processes else None
            same = current is not None and current.get('start_abstime') == old.get('start_abstime') and current['executable'] == old['executable']
            rows.append({'pid': old['pid'], 'startAbstime': old.get('start_abstime'), 'sameIdentityAlive': same, 'current': current})
        observations.append({'observedAt': now(), 'processes': rows})
        if all(not r['sameIdentityAlive'] for r in rows) or time.monotonic() >= deadline:
            break
        time.sleep(.2)
    write('03-owner-crash-result.json', {'observedAt': now(), 'signalAt': signal_at, 'signalCount': 1,
          'source': source(), 'checkpointStillSame': target.exists() and sha(target) == checkpoint['ownedCheckpoint']['sha256'],
          'observations': observations, 'allObservedOwnedGone': all(not r['sameIdentityAlive'] for r in rows)})
elif args.phase in ('restored', 'retained'):
    baseline = json.loads((OUT / '00-owner-baseline.json').read_text())
    checkpoint, inventory = owned_checkpoint(baseline['recoveryInventory'])
    write(('04' if args.phase == 'restored' else '05') + '-owner-' + args.phase + '.json',
          {'observedAt': now(), 'source': source(), 'ownedCheckpoint': checkpoint,
           'recoveryInventory': inventory, **app_snapshot(args.pid, args.birth, args.sha256)})
else:
    before = json.loads((OUT / '05-owner-retained.json').read_text())
    target = Path(before['ownedCheckpoint']['path']).name
    expected = {name: meta for name, meta in before['recoveryInventory'].items() if name != target}
    inventory = recovery_inventory()
    checks = {'onlySelectedCheckpointRemoved': inventory == expected,
              'selectedCheckpointAbsent': target not in inventory}
    write('06-owner-selected-clear.json', {'observedAt': now(), 'source': source(), 'checks': checks,
          'selectedCheckpoint': target, 'beforeRecoveryInventory': before['recoveryInventory'],
          'afterRecoveryInventory': inventory, **app_snapshot(args.pid, args.birth, args.sha256)})
    assert all(checks.values()), checks
