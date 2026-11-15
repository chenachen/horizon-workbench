import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { extractRipgrepArchive } from './prepare-ripgrep.mjs';

test('Windows extraction passes special paths literally through the environment', () => {
  const archive = String.raw`C:\temp\中文 ' $archive\ripgrep.zip`;
  const directory = String.raw`C:\temp\中文 ' $destination`;
  let calls = 0;
  extractRipgrepArchive(archive, directory, true, (command, args, options) => {
    calls++;
    assert.equal(command, 'powershell.exe');
    assert.deepEqual(args.slice(0, 3), ['-NoProfile', '-NonInteractive', '-Command']);
    assert.ok(!args[3].includes(archive));
    assert.ok(!args[3].includes(directory));
    assert.equal(options.stdio, 'inherit');
    assert.deepEqual(options.env, { ...process.env, HORIZON_RG_ARCHIVE: archive, HORIZON_RG_DESTINATION: directory });
    return { status: 0 };
  });
  assert.equal(calls, 1);
});

test('extraction propagates process startup and archive failures', () => {
  const unavailable = new Error('powershell.exe unavailable');
  assert.throws(() => extractRipgrepArchive('archive.zip', 'destination', true, () => ({ error: unavailable })), error => error === unavailable);
  assert.throws(() => extractRipgrepArchive('archive.zip', 'destination', true, () => ({ status: 1 })), /Ripgrep extraction failed/);
});

test('Windows PowerShell extracts a ZIP into an existing directory and rejects corrupt ZIPs', { skip: process.platform !== 'win32' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "horizon-rg-'$-"));
  try {
    const destination = join(directory, '中文 destination');
    await mkdir(destination);
    const archive = join(directory, "中文 '$archive.zip");
    // One stored ZIP entry: fixture/rg.exe containing "ripgrep fixture\n".
    await writeFile(archive, Buffer.from('UEsDBBQAAAAAAAC9b10PMdaUEAAAABAAAAAOAAAAZml4dHVyZS9yZy5leGVyaXBncmVwIGZpeHR1cmUKUEsBAhQDFAAAAAAAAL1vXQ8x1pQQAAAAEAAAAA4AAAAAAAAAAAAAAIABAAAAAGZpeHR1cmUvcmcuZXhlUEsFBgAAAAABAAEAPAAAADwAAAAAAA==', 'base64'));
    extractRipgrepArchive(archive, destination, true);
    assert.equal(await readFile(join(destination, 'fixture/rg.exe'), 'utf8'), 'ripgrep fixture\n');
    await writeFile(archive, 'invalid ZIP');
    assert.throws(() => extractRipgrepArchive(archive, destination, true), /Ripgrep extraction failed/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
