from pathlib import Path
import tempfile, json, hashlib, importlib.util

repo = Path('/Users/chenpengxiang/Desktop/Horizon')
spec = importlib.util.spec_from_file_location('fixtures', repo/'scripts/desktop/fixtures.py')
f = importlib.util.module_from_spec(spec)
spec.loader.exec_module(f)
root = Path(tempfile.mkdtemp(prefix='horizon-resume-editor-'))
qa = root/'Editor Resume QA'
(qa/'src').mkdir(parents=True)
(qa/'many').mkdir()
(qa/'cache').mkdir()
(qa/'limits').mkdir()
files = {'src/recovery.txt':b'recovery baseline\n','src/autosave.txt':b'autosave baseline\n','src/conflict.txt':b'origin: baseline\nshared: unchanged\n','src/delete-open.txt':b'keep editor text after delete\n','src/no-final-newline.txt':b'first\nlast','src/unsupported-latin1.txt':b'caf\xe9\n','src/unknown.custom':b'unknown language plain text\n','src/find.txt':b'alpha Alpha alphabet\nalpha beta alpha\n','README.md':'# 实机验收\n\n## 范围\n\n仅本轮夹具。\n'.encode(),'.hidden.txt':b'hidden fixture\n'}
for name,data in files.items(): (qa/name).write_bytes(data)
f.sized_text(qa/'src/save-race.txt', 9*1024*1024, 20261101)
for i in range(10000): (qa/'many'/f'entry-{i:05d}.txt').write_text(f'EDITOR_QA_SEARCH_NEEDLE first {i}\nEDITOR_QA_SEARCH_NEEDLE second {i}\n')
for i in range(25): (qa/'cache'/f'clean-{i:02d}.txt').write_text(f'clean cache {i}\n')
for n in [99999,100000,100001]: (qa/'limits'/f'single-line-{n}.txt').write_text('x'*n+'\n')
f.sized_text(qa/'limits/text-101MiB.txt',101*1024*1024,20261101)
(qa/'limits/binary.bin').write_bytes(bytes(range(256))*16)
(qa/'loop').symlink_to(qa,target_is_directory=True)
(qa/'broken-link').symlink_to(qa/'absent')
for name in ['Project B','Project C']:
 p=root/name;p.mkdir();(p/'same-name.txt').write_text(name+'\n')
paths = root/'Paths 100k'; f.make_paths(paths,100000,20261101)
reading=root/'reading';reading.mkdir();readmeta=f.create_reading(reading,20261031)
meta={'root':str(root),'qa':str(qa),'projectB':str(root/'Project B'),'projectC':str(root/'Project C'),'paths100k':str(paths),'reading':readmeta,'files':{name:{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in files.items()}}
(root/'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
(repo/'.work/editor-resume/fixture.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
print(json.dumps({'root':str(root),'qa':str(qa),'reading':readmeta['cases']['reading']['project_root']},ensure_ascii=False))
