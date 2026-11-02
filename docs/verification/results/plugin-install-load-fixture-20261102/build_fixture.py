"""Build one deterministic, explicitly labelled owned static-resource fixture.

This only writes this .work directory. It does not call Horizon or touch appdata.
"""
from pathlib import Path, PurePosixPath
from datetime import datetime, timezone
import hashlib
import json
import platform
import stat
import zipfile
import zlib

HERE = Path(__file__).resolve().parent
BASE = Path('/private/var/folders/9j/xnw538c934b2s559tl01cc800000gn/T/horizon-plugin-resume-20261101-xlaufons/read-only-base.horizon-extension')
BASE_SHA = '659399c70faabfe14eb98658434d1134d85c4ad66af623f86ab6faff18530c6e'
ARCHIVE = HERE / 'read-only-install-load-16m.horizon-extension'
RESOURCE_COUNT = 128
RESOURCE_BYTES = 128 * 1024
COMPRESSION_LEVEL = 6
SEED = b'Horizon owned static install-load fixture v1'
QA = 'local.resume-read-only-changes'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def payload(index):
    return hashlib.shake_256(SEED + b'|' + index.to_bytes(4, 'big')).digest(RESOURCE_BYTES)


def info(name):
    item = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    item.create_system = 3
    item.external_attr = (stat.S_IFREG | 0o644) << 16
    item.compress_type = zipfile.ZIP_DEFLATED
    item.extra = b''
    item.comment = b''
    return item


assert not ARCHIVE.exists(), 'Refuse to overwrite or generate a second trial archive'
assert not (HERE / 'manifest.json').exists(), 'Fixture already frozen'
base_bytes = BASE.read_bytes()
assert len(base_bytes) == 2663 and sha(base_bytes) == BASE_SHA
with zipfile.ZipFile(BASE) as source:
    assert source.namelist() == ['manifest.json', 'index.js']
    original = {name: source.read(name) for name in source.namelist()}
manifest = json.loads(original['manifest.json'])
assert manifest['id'] == QA and manifest['version'] == '0.1.0'
assert manifest['runtime'] == {'kind': 'quickjs', 'entry': 'index.js'}
assert manifest['capabilities'] == ['git.read', 'storage']
assert sha(original['manifest.json']) == 'adc8fe8f2de4ba9a853cf281c92ebf157eaec1b6de5e6f151d5b05b71b9f30d4'
assert sha(original['index.js']) == '5cd84b6a8cab0810e0f6464688f52f9e36d37ef141d0a1ee26384b8fd72c66ea'

members = []
with ARCHIVE.open('xb') as destination:
    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED,
                         compresslevel=COMPRESSION_LEVEL) as archive:
        archive.comment = b'Horizon QA static install-load: 16MiB resources; original manifest and worker unchanged'
        for name, data in original.items():
            archive.writestr(info(name), data, compress_type=zipfile.ZIP_DEFLATED,
                             compresslevel=COMPRESSION_LEVEL)
            members.append({'name': name, 'bytes': len(data), 'sha256': sha(data),
                            'role': 'unchanged-original-manifest' if name == 'manifest.json' else 'unchanged-original-worker'})
        for index in range(RESOURCE_COUNT):
            name = f'qa-static-install-load-16m/resource-{index:03d}.bin'
            data = payload(index)
            archive.writestr(info(name), data, compress_type=zipfile.ZIP_DEFLATED,
                             compresslevel=COMPRESSION_LEVEL)
            members.append({'name': name, 'bytes': len(data), 'sha256': sha(data),
                            'role': 'unreferenced-non-executable-owned-static-test-resource'})

# Read the one generated package to record its actual contents and sizes.
# No Horizon/native loader invocation, installation, or product test occurs.
with zipfile.ZipFile(ARCHIVE) as archive:
    assert archive.namelist() == [row['name'] for row in members]
    for row, entry in zip(members, archive.infolist()):
        assert len(archive.read(entry)) == row['bytes']
        assert sha(archive.read(entry)) == row['sha256']
        row.update(compressedBytes=entry.compress_size, crc32=f'{entry.CRC:08x}',
                   compressionMethod=entry.compress_type, unixMode=oct(entry.external_attr >> 16))
    assert archive.read('manifest.json') == original['manifest.json']
    assert archive.read('index.js') == original['index.js']

archive_bytes = ARCHIVE.read_bytes()
total = sum(row['bytes'] for row in members)
assert RESOURCE_COUNT * RESOURCE_BYTES == 16 * 1024 * 1024
assert total == 16 * 1024 * 1024 + 2447
assert len(members) == 130 and len({row['name'].lower() for row in members}) == 130
assert all(not PurePosixPath(row['name']).is_absolute() and '..' not in PurePosixPath(row['name']).parts for row in members)
assert len(archive_bytes) < 28 * 1024 * 1024 and total < 20 * 1024 * 1024
assert max(row['bytes'] for row in members) < 4 * 1024 * 1024
assert sha(BASE.read_bytes()) == BASE_SHA

native_source = Path('/Users/chenpengxiang/Desktop/Horizon/apps/desktop/src-tauri/src/extensions.rs')
record = {
    'kind': 'owned-static-install-load-fixture',
    'preparedAt': datetime.now(timezone.utc).isoformat(),
    'archive': {'path': str(ARCHIVE), 'bytes': len(archive_bytes), 'sha256': sha(archive_bytes)},
    'sourceBase': {'path': str(BASE), 'bytes': len(base_bytes), 'sha256': BASE_SHA,
                   'readAfterBuildSHA256': sha(BASE.read_bytes()), 'originalArchiveUnchanged': True},
    'extension': manifest,
    'originalTwoMembersUncompressedBytesUnchanged': True,
    'executableLogicOrPermissionsChanged': False,
    'inputCondition': {'label': '16MiB owned static test resources / same original executable logic',
                       'resourceFiles': RESOURCE_COUNT, 'resourceBytesEach': RESOURCE_BYTES,
                       'resourceTotalBytes': RESOURCE_COUNT * RESOURCE_BYTES,
                       'allUnpackedBytesIncludingOriginalTwo': total, 'allMembers': len(members),
                       'notOriginal2663BInput': True, 'notComparableSmallPackagePerformanceCondition': True},
    'compression': {'method': 'ZIP_DEFLATED', 'zipMethod': 8, 'level': COMPRESSION_LEVEL,
                    'python': platform.python_version(), 'zlibCompileVersion': zlib.ZLIB_VERSION,
                    'zlibRuntimeVersion': zlib.ZLIB_RUNTIME_VERSION},
    'determinism': {'resourceAlgorithm': 'SHAKE-256(seed | 4-byte big-endian resource index)',
                    'seedUTF8': SEED.decode(), 'timestamps': '1980-01-01T00:00:00',
                    'memberOrder': 'original manifest.json,index.js then resource-000..127',
                    'mode': 'regular0644', 'archiveReproductionBoundary': 'Same recorded Python/zlib compressor; fixed inputs/metadata and resource hashes. Only one archive generated, no repeated trial.'},
    'nativeLimitSource': {'path': str(native_source), 'sha256': sha(native_source.read_bytes()),
                          'function': 'package_files', 'lines': '999–1058',
                          'archiveMaxBytes': 28 * 1024 * 1024, 'entryMaxCount': 256,
                          'memberMaxBytes': 4 * 1024 * 1024, 'allUnpackedMaxBytes': 20 * 1024 * 1024},
    'staticPackageReadback': {'memberHashesMatch': True, 'regularRelativePathsOnly': True,
                              'noCaseFoldCollision': True, 'allSupportedSizeLimitsSatisfied': True},
    'members': members,
    'execution': {'nativeLoaderInvoked': False, 'HorizonInstallation': False, 'ownerExecuted': False,
                  'GUIOrAppdataMutation': False, 'testsOrBuild': False},
}
(HERE / 'manifest.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
(HERE / 'archive.sha256').write_text(f'{sha(archive_bytes)}  {ARCHIVE.name}\n')
print(json.dumps({'archive': record['archive'], 'unpackedBytes': total, 'members': len(members),
                  'staticResourcesBytes': RESOURCE_COUNT * RESOURCE_BYTES,
                  'manifest': str(HERE / 'manifest.json'), 'baseUnchanged': True,
                  'compression': record['compression'], 'noProductExecution': True}, ensure_ascii=False))
