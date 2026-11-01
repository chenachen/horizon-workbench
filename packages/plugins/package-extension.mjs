#!/usr/bin/env node
// Dependency-free ZIP packer. The native installer independently validates every entry.
import { readdir, readFile, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
const directory = path.resolve(process.argv[2] ?? 'packages/plugins/examples/read-only-changes');
const destination = path.resolve(process.argv[3] ?? `${directory}.horizon-extension`);
const files = [];
async function visit(dir) {
  for (const name of (await readdir(dir)).sort()) {
    const absolute = path.join(dir, name); if (absolute === destination) continue;
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) throw new Error('Extension packages cannot contain symlinks');
    if (stat.isDirectory()) await visit(absolute);
    else files.push({ name: path.relative(directory, absolute).split(path.sep).join('/'), data: await readFile(absolute) });
  }
}
await visit(directory);
if (!files.some(file => file.name === 'manifest.json')) throw new Error('Missing manifest.json');
if (files.length > 256 || files.some(file => file.data.length > 4 * 1024 * 1024) || files.reduce((size, file) => size + file.data.length, 0) > 20 * 1024 * 1024) throw new Error('Package exceeds native size limits');
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => { for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0); return value >>> 0; });
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
const locals = [], central = []; let offset = 0;
for (const file of files) {
  const name = Buffer.from(file.name); const crc = crc32(file.data);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(33, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(file.data.length, 18); local.writeUInt32LE(file.data.length, 22); local.writeUInt16LE(name.length, 26);
  const header = Buffer.alloc(46); header.writeUInt32LE(0x02014b50); header.writeUInt16LE((3 << 8) | 20, 4); header.writeUInt16LE(20, 6); header.writeUInt16LE(0x800, 8); header.writeUInt16LE(33, 14); header.writeUInt32LE(crc, 16); header.writeUInt32LE(file.data.length, 20); header.writeUInt32LE(file.data.length, 24); header.writeUInt16LE(name.length, 28); header.writeUInt32LE((0o100644 << 16) >>> 0, 38); header.writeUInt32LE(offset, 42);
  locals.push(local, name, file.data); central.push(header, name); offset += local.length + name.length + file.data.length;
}
const centralDirectory = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(centralDirectory.length, 12); end.writeUInt32LE(offset, 16);
await writeFile(destination, Buffer.concat([...locals, centralDirectory, end]));
console.log(destination);
