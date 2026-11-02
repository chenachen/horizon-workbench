"""Prepared only. Read one owned session/source; exclusively write one phase receipt."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path

REPO = Path('/Users/chenpengxiang/Desktop/Horizon')
REGISTRY = Path('/Users/chenpengxiang/Library/Application Support/dev.horizon.desktop/registry.json')
PROJECT_ID = 'e1111892-92c6-4985-b285-f5dcbe4d11f3'
PROJECT_ROOT = Path('/private/var/folders/9j/xnw538c934b2s559tl01cc800000gn/T/horizon-resume-editor-yesw9ppu/Editor Resume QA')
FILE_ID = '1b55b505cb43887136a112502128cae6d37082c40f3048e14355e774363c58be'
SOURCE = PROJECT_ROOT / 'native-remainder/visual.md'
SOURCE_SHA = '29b9829eb04ae840847d63b0bbc4c8d247bda63dbf527910d962450a186ca4a7'
BASELINE = REPO / 'docs/verification/results/loading-states-eight-native-20261102/editor-before.json'
BASELINE_SHA = '4b48452c11bf64254b50800f15326f893a215d17d74fd7812277b3a95a698748'
FIELDS = ('activeFileId', 'tabs', 'expandedEntryIds', 'searchDraft', 'commitDraft', 'layout')
EXPECTED_SELECTION = {'anchor': 235, 'head': 229}
EXPECTED_SELECTED_TEXT = '自有夹具。\n'


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def artifact(path):
    path = path.resolve(strict=True)
    raw = path.read_bytes()
    return {'path': str(path), 'bytes': len(raw), 'sha256': digest(raw)}


def project(phase, image, ax, out_dir):
    destination = out_dir / f'{phase}.json'
    if destination.exists():
        raise SystemExit(f'Refusing to overwrite {destination}; no registry read performed')
    result = {
        'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'phase': phase, 'projectId': PROJECT_ID, 'fileId': FILE_ID,
        'root': str(PROJECT_ROOT), 'checks': {},
        'scope': 'Actual persisted owned-session projection, not AX range attributes. One registry read and one fixed 377B source read; no other session/config/recovery output, OS/GUI/API calls or appdata writes.',
    }
    try:
        result['guiEvidence'] = {'image': artifact(image), 'ax': artifact(ax)}
        baseline_raw = BASELINE.read_bytes()
        assert digest(baseline_raw) == BASELINE_SHA, 'Frozen owned baseline changed'
        baseline = json.loads(baseline_raw)
        result['baseline'] = {'path': str(BASELINE), 'sha256': BASELINE_SHA}
        assert baseline['projectId'] == PROJECT_ID and baseline['root'] == str(PROJECT_ROOT)
        before = None
        if phase == 'after-roundtrip':
            before_path = out_dir / 'before-selection.json'
            before_raw = before_path.read_bytes()
            before = json.loads(before_raw)
            assert before['phase'] == 'before-selection' and before['projectId'] == PROJECT_ID and before['fileId'] == FILE_ID
            assert before['allPassed'], 'Before-selection receipt did not pass'
            result['beforeSelectionReference'] = {'path': str(before_path), 'sha256': digest(before_raw)}

        registry = json.loads(REGISTRY.read_bytes())
        owned = next(row for row in registry['projects'] if row['id'] == PROJECT_ID)
        assert owned['rootDisplayPath'] == str(PROJECT_ROOT), 'Owned project root changed'
        session = registry['sessions'][PROJECT_ID]
        fields = {key: session.get(key) for key in FIELDS}
        result.update(registryRevision=registry.get('revision'), sessionRevision=session.get('revision'), sessionFields=fields, tabCount=len(fields['tabs']))
        tab = next(row for row in fields['tabs'] if row['fileId'] == FILE_ID)
        source_raw = SOURCE.read_bytes()
        result['source'] = {'path': str(SOURCE), 'bytes': len(source_raw), 'sha256': digest(source_raw)}
        assert len(source_raw) == 377 and digest(source_raw) == SOURCE_SHA, 'Protected Markdown source changed'
        utf16 = source_raw.decode('utf-8').encode('utf-16-le')
        selection = tab['selection']
        anchor, head = selection['anchor'], selection['head']
        assert type(anchor) is int and type(head) is int and 0 <= min(anchor, head) <= max(anchor, head) <= len(utf16) // 2, 'Invalid persisted UTF16 selection'
        selected_text = utf16[min(anchor, head) * 2:max(anchor, head) * 2].decode('utf-16-le')
        result['visualMarkdown'] = {'selection': selection, 'scrollTop': tab['scrollTop'], 'selectedText': selected_text, 'utf16Length': len(utf16) // 2, 'direction': 'forward' if anchor < head else 'backward' if anchor > head else 'caret'}
        checks = result['checks']
        checks['fixedOwnedProjectAndSource'] = True
        checks['sameOrdered12TabIDs'] = len(fields['tabs']) == 12 and [row['fileId'] for row in fields['tabs']] == [row['fileId'] for row in baseline['session']['tabs']]
        if phase in ('before-selection', 'after-roundtrip'):
            checks['actualActiveMarkdown'] = fields['activeFileId'] == FILE_ID
            checks['actualExpectedNonemptySelection'] = selection == EXPECTED_SELECTION and selected_text == EXPECTED_SELECTED_TEXT
        if before is not None:
            checks['sameActualAnchorHeadAndFullSelectedText'] = selection == before['visualMarkdown']['selection'] and selected_text == before['visualMarkdown']['selectedText']
        if phase == 'restored':
            checks['originalCaret235AndScroll61'] = selection == {'anchor': 235, 'head': 235} and tab['scrollTop'] == 61
            checks['originalSixSessionFieldsRestored'] = fields == {key: baseline['session'].get(key) for key in FIELDS}
        result['allPassed'] = all(checks.values())
    except Exception as error:
        result['error'] = str(error)
        result['allPassed'] = False
    out_dir.mkdir(parents=True, exist_ok=True)
    raw = (json.dumps(result, ensure_ascii=False, indent=2) + '\n').encode()
    with destination.open('xb') as stream:
        stream.write(raw)
    print(json.dumps({'path': str(destination), 'sha256': digest(raw), 'phase': phase, 'checks': result['checks'], 'allPassed': result['allPassed'], 'error': result.get('error')}, ensure_ascii=False))
    return 0 if result['allPassed'] else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=('before-selection', 'after-roundtrip', 'restored'))
    parser.add_argument('--gui-image', type=Path, required=True)
    parser.add_argument('--gui-ax', type=Path, required=True)
    parser.add_argument('--out-dir', type=Path, required=True)
    args = parser.parse_args()
    raise SystemExit(project(args.phase, args.gui_image, args.gui_ax, args.out_dir))
