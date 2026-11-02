import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathName } from '../src/pathName.ts';
import { projectAfterRemoval } from '../src/workspace.ts';

for (const [path, expected] of [
  [String.raw`D:\project\amzup-micro-app`, 'amzup-micro-app'],
  ['D:\\project\\amzup-micro-app\\', 'amzup-micro-app'],
  [String.raw`\\?\D:\project\amzup-micro-app-5`, 'amzup-micro-app-5'],
  [String.raw`\\server\share\本地项目`, '本地项目'],
  ['/Users/dev/project/', 'project'],
  ['D:/project/amzup-micro-app', 'amzup-micro-app'],
  ['D:\\', 'D:'],
]) {
  test(`folder label: ${path}`, () => assert.equal(pathName(path), expected));
}

const project = (id, state = 'idle') => ({ id, state });
test('removing the current project selects the next project', () => {
  assert.equal(projectAfterRemoval([project('a'), project('b'), project('c')], 'b')?.id, 'c');
});
test('removing the last project selects the nearest previous project', () => {
  assert.equal(projectAfterRemoval([project('a'), project('b'), project('c')], 'c')?.id, 'b');
});
test('inaccessible projects are skipped in both directions', () => {
  assert.equal(projectAfterRemoval([project('a'), project('b'), project('c', 'unavailable')], 'b')?.id, 'a');
  assert.equal(projectAfterRemoval([project('a'), project('b', 'unavailable'), project('c')], 'a')?.id, 'c');
});
test('an empty workspace or an unknown project has no replacement', () => {
  assert.equal(projectAfterRemoval([project('a')], 'a'), undefined);
  assert.equal(projectAfterRemoval([project('a')], 'missing'), undefined);
});
