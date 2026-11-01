import { describe, expect, it } from 'vitest';
import { anonymizeEditorDiagnostics, summarizeEditorDiagnostics } from './diagnostics';

describe('diagnostic export', () => {
  it('exports numeric counts and latency percentiles without file identities or content', () => {
    const result = summarizeEditorDiagnostics({ schemaVersion: 1, measurement: 'internal description', viewCount: 1, createdViews: 2, destroyedViews: 1, opens: Array.from({ length: 20 }, (_, index) => ({ id: index, projectId: 'private-project', fileId: '/private/source.ts', cache: index % 2 ? 'warm' as const : 'cold' as const, startedAt: '2026-10-31', durationMs: index + 1, languageReadyMs: 2 })) });
    expect(result.openSamples).toBe(20);
    expect(result.openMedianMs).toBe(10);
    expect(result.openP95Ms).toBe(19);
    expect(result.warmOpenSamples).toBe(10);
    expect(result.createdViews - result.destroyedViews).toBe(result.viewCount);
    expect(Object.values(result).every(value => typeof value === 'number')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private');
  });

  it('preserves individual warm timing, byte counts and highlight readiness without project or file identities', () => {
    const result = anonymizeEditorDiagnostics({ schemaVersion: 1, measurement: 'internal path /private/ignored', viewCount: 1, createdViews: 1, destroyedViews: 0, opens: [{ id: 21, projectId: 'private-project', fileId: '/private/secret.ts', cache: 'warm', startedAt: '2026-10-31T00:00:00.125Z', durationMs: 32.5, languageReadyMs: 12.5, highlightReadyMs: 40.5, language: 'ts', byteLength: '200000', editorRevision: 2, viewId: 1 }] });
    expect(result.opens).toEqual([{ id: 21, cache: 'warm', startedAtMs: Date.parse('2026-10-31T00:00:00.125Z'), durationMs: 32.5, languageReadyMs: 12.5, highlightReadyMs: 40.5, language: 'ts', byteLength: 200000, editorRevision: 2, viewId: 1 }]);
    expect(result.warmOpenSamples).toBe(1);
    expect(JSON.stringify(result)).not.toMatch(/private|secret|fileId|projectId|measurement/);
  });

  it('bounds raw samples to the most recent 200 and leaves unmeasured phases absent', () => {
    const result = anonymizeEditorDiagnostics({ schemaVersion: 1, measurement: '', viewCount: 1, createdViews: 1, destroyedViews: 0, opens: Array.from({ length: 205 }, (_, id) => ({ id, projectId: 'p', fileId: 'f', cache: 'warm', startedAt: '2026-10-31T00:00:00Z', durationMs: 0, byteLength: '0' })) });
    expect(result.opens).toHaveLength(200);
    expect(result.opens[0].id).toBe(5);
    expect(result.opens.at(-1)?.id).toBe(204);
    expect(result.opens[0]).toMatchObject({ durationMs: 0, byteLength: 0 });
    expect(result.opens[0]).not.toHaveProperty('languageReadyMs');
    expect(result.opens[0]).not.toHaveProperty('highlightReadyMs');
    expect(result.opens[0]).not.toHaveProperty('nativeMs');
    expect(result.opens[0]).not.toHaveProperty('paintMs');
  });

  it('omits malformed numeric values and arbitrary language strings instead of exporting them', () => {
    const result = anonymizeEditorDiagnostics({ schemaVersion: 1, measurement: '', viewCount: 1, createdViews: 1, destroyedViews: 0, opens: [{ id: 1, projectId: 'p', fileId: 'f', cache: 'cold', startedAt: '2026-10-31T00:00:00Z', durationMs: Infinity, languageReadyMs: -1, highlightReadyMs: NaN, language: '/private/file.ts', byteLength: '200000 with secret', editorRevision: 1.5, viewId: -1 }] });
    expect(result.opens).toEqual([{ id: 1, cache: 'cold', startedAtMs: Date.parse('2026-10-31T00:00:00Z') }]);
  });
});
