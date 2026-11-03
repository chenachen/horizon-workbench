#!/usr/bin/env python3
"""Read only AT-SPI evidence for one explicitly identified native app PID."""
import argparse
import json
from pathlib import Path
import pyatspi

parser = argparse.ArgumentParser()
parser.add_argument('--pid', type=int, required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
result = {'pid': args.pid, 'applications': [], 'nodes': []}
desktop = pyatspi.Registry.getDesktop(0)
for app in desktop:
    try:
        pid = app.get_process_id()
        result['applications'].append({'pid': pid, 'name': app.name})
        if pid != args.pid:
            continue
        pending = [(app, 0)]
        while pending and len(result['nodes']) < 1000:
            node, depth = pending.pop()
            try:
                state = node.getState()
                record = {'role': node.getRoleName(), 'name': node.name, 'depth': depth,
                          'enabled': state.contains(pyatspi.STATE_ENABLED),
                          'sensitive': state.contains(pyatspi.STATE_SENSITIVE),
                          'showing': state.contains(pyatspi.STATE_SHOWING),
                          'focused': state.contains(pyatspi.STATE_FOCUSED)}
                try:
                    text = node.queryText()
                    record['text'] = text.getText(0, min(text.characterCount, 2000))
                    record['selections'] = [list(text.getSelection(i)) for i in range(text.getNSelections())]
                except NotImplementedError:
                    pass
                result['nodes'].append(record)
                if depth < 25:
                    pending.extend((child, depth + 1) for child in node if child is not None)
            except Exception as error:
                result['nodes'].append({'depth': depth, 'readError': str(error)})
    except Exception as error:
        result['applications'].append({'readError': str(error)})
Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps(result, ensure_ascii=False))
