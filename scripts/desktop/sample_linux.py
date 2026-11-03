#!/usr/bin/env python3
"""Linux /proc RSS and CPU sampler. Not macOS physical footprint or whole-app acceptance."""
import argparse
import json
import os
from pathlib import Path
import platform
import statistics
import time


def process(pid):
    try:
        raw = Path(f'/proc/{pid}/stat').read_text()
        fields = raw[raw.rfind(')') + 2:].split()
        return {'pid': pid, 'ppid': int(fields[1]), 'start_ticks': int(fields[19]),
                'cpu_ticks': int(fields[11]) + int(fields[12]),
                'rss_bytes': int(fields[21]) * os.sysconf('SC_PAGE_SIZE')}
    except (OSError, ValueError, IndexError):
        return None


def sample(roots, previous, elapsed):
    processes = {int(p.name): v for p in Path('/proc').iterdir()
                 if p.name.isdigit() and (v := process(int(p.name)))}
    owned = {pid for pid, start in roots.items() if pid in processes and processes[pid]['start_ticks'] == start}
    while True:
        added = {pid for pid, v in processes.items() if v['ppid'] in owned} - owned
        if not added:
            break
        owned |= added
    rows = []
    for pid in sorted(owned):
        row = processes[pid]
        old = previous.get(pid)
        row['cpu_percent_one_core'] = (100 * (row['cpu_ticks'] - old['cpu_ticks']) / os.sysconf('SC_CLK_TCK') / elapsed
            if old and old['start_ticks'] == row['start_ticks'] and elapsed > 0 else None)
        rows.append(row)
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pid', action='append', type=int, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--scenario', required=True)
    parser.add_argument('--build', required=True)
    parser.add_argument('--build-id', required=True)
    parser.add_argument('--members')
    parser.add_argument('--phase-file', type=Path)
    parser.add_argument('--activity-log')
    parser.add_argument('--duration', type=float, default=75)
    parser.add_argument('--interval', type=float, default=1)
    args = parser.parse_args()
    if args.duration < 0 or args.interval <= 0:
        parser.error('Invalid duration/interval')
    roots = {}
    for pid in args.pid:
        row = process(pid)
        if row is None:
            parser.error(f'Root process missing: {pid}')
        roots[pid] = row['start_ticks']
    args.output.mkdir(parents=True, exist_ok=False)
    metadata = {'platform': platform.platform(), 'scenario': args.scenario, 'build': args.build,
                'build_id': args.build_id, 'root_pids': args.pid,
                'accounting': '/proc RSS and CPU ticks for explicit root processes and current descendants; PID start-time verified',
                'limits': ['RSS is not private memory or macOS physical footprint.',
                           'This measures the standalone official Pi runtime, not Horizon/WebView or model inference.',
                           'Short-lived or reparented children may be missed; not complete process-leak acceptance.']}
    (args.output / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
    start = last = time.monotonic()
    previous = {}
    samples = []
    with (args.output / 'samples.jsonl').open('w') as out:
        while True:
            now = time.monotonic()
            rows = sample(roots, previous, now - last)
            if not rows:
                raise RuntimeError('All attributed root processes exited during measurement')
            row = {'elapsed_seconds': now - start, 'processes': rows,
                   'rss_sum_bytes': sum(p['rss_bytes'] for p in rows),
                   'phase': args.phase_file.read_text().strip() if args.phase_file and args.phase_file.exists() else None}
            out.write(json.dumps(row) + '\n'); out.flush(); samples.append(row)
            previous = {p['pid']: p for p in rows}; last = now
            if now - start >= args.duration:
                break
            time.sleep(min(args.interval, args.duration - (now - start)))
    summary = {'sample_count': len(samples), 'observed_seconds': samples[-1]['elapsed_seconds'],
               'rss_sum_bytes': {'min': min(s['rss_sum_bytes'] for s in samples),
                                 'max': max(s['rss_sum_bytes'] for s in samples),
                                 'mean': statistics.mean(s['rss_sum_bytes'] for s in samples)},
               'status': 'measured; no performance acceptance threshold or real-model claim'}
    (args.output / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary))


if __name__ == '__main__':
    main()
