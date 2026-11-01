import type { getEditorDiagnostics } from '../../../../../packages/editor/src/metrics';

type AnonymousEditorOpen = {
  id: number;
  cache: 'cold' | 'warm';
  startedAtMs: number;
  durationMs?: number;
  languageReadyMs?: number;
  highlightReadyMs?: number;
  language?: string;
  byteLength?: number;
  editorRevision?: number;
  viewId?: number;
};
const diagnosticLanguages = new Set(['plain', 'ts', 'tsx', 'js', 'mjs', 'cjs', 'jsx', 'json', 'jsonc', 'md', 'mdx', 'markdown', 'css', 'html', 'htm', 'svg', 'xml', 'py', 'rs', 'sql']);
const finiteMetric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const integerMetric = (value: unknown): value is number => finiteMetric(value) && Number.isInteger(value);

export function summarizeEditorDiagnostics(diagnostics: ReturnType<typeof getEditorDiagnostics>) {
  const durations = (cache?: 'cold' | 'warm') => diagnostics.opens
    .filter(item => !cache || item.cache === cache)
    .map(item => item.durationMs)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  const percentile = (values: number[], p: number) => values.length ? values[Math.max(0, Math.ceil(values.length * p) - 1)] : 0;
  const all = durations(), cold = durations('cold'), warm = durations('warm');
  const language = diagnostics.opens.map(item => item.languageReadyMs).filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  return {
    schemaVersion: diagnostics.schemaVersion,
    viewCount: diagnostics.viewCount,
    createdViews: diagnostics.createdViews,
    destroyedViews: diagnostics.destroyedViews,
    openSamples: all.length,
    coldOpenSamples: cold.length,
    warmOpenSamples: warm.length,
    openMedianMs: percentile(all, 0.5),
    openP95Ms: percentile(all, 0.95),
    coldOpenMedianMs: percentile(cold, 0.5),
    coldOpenP95Ms: percentile(cold, 0.95),
    warmOpenMedianMs: percentile(warm, 0.5),
    warmOpenP95Ms: percentile(warm, 0.95),
    languageReadyP95Ms: percentile(language, 0.95),
  };
}

/** Explicit projection keeps per-open evidence without exporting project/file identities. */
export function anonymizeEditorDiagnostics(diagnostics: ReturnType<typeof getEditorDiagnostics>) {
  const opens: AnonymousEditorOpen[] = [];
  for (const source of diagnostics.opens.slice(-200)) {
    const startedAtMs = Date.parse(source.startedAt);
    if (!integerMetric(source.id) || !integerMetric(startedAtMs) || (source.cache !== 'cold' && source.cache !== 'warm')) continue;
    const item: AnonymousEditorOpen = { id: source.id, cache: source.cache, startedAtMs };
    for (const key of ['durationMs', 'languageReadyMs', 'highlightReadyMs'] as const) if (finiteMetric(source[key])) item[key] = source[key];
    for (const key of ['editorRevision', 'viewId'] as const) if (integerMetric(source[key])) item[key] = source[key];
    if (source.language && diagnosticLanguages.has(source.language)) item.language = source.language;
    if (typeof source.byteLength === 'string' && /^\d+$/.test(source.byteLength)) {
      const bytes = Number(source.byteLength);
      if (integerMetric(bytes)) item.byteLength = bytes;
    }
    opens.push(item);
  }
  return { ...summarizeEditorDiagnostics(diagnostics), opens };
}
