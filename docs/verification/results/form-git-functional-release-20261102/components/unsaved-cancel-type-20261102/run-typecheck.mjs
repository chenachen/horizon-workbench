import ts from 'typescript';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const repository = '/Users/chenpengxiang/Desktop/Horizon', directory = path.dirname(fileURLToPath(import.meta.url));
const metadata = JSON.parse(await readFile(path.join(directory, 'source-sha.json'), 'utf8'));
const target = path.join(repository, metadata.changePath), configFile = path.join(repository, 'apps/desktop/tsconfig.json');
const config = ts.readConfigFile(configFile, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configFile));
const report = { kind: 'TypeScript noEmit with in-memory helper overlay; root only helper, actual Modal/types dependencies', startedAt: new Date().toISOString(), compilerVersion: ts.version, configErrors: [...(config.error ? [config.error] : []), ...parsed.errors].map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), variants: [], passed: false };
for (const variant of ['before', 'after']) {
  const source = await readFile(path.join(directory, variant, metadata.changePath), 'utf8');
  const host = ts.createCompilerHost({ ...parsed.options, noEmit: true });
  const originalRead = host.readFile.bind(host);
  host.readFile = file => path.resolve(file) === target ? source : originalRead(file);
  const program = ts.createProgram({ rootNames: [target], options: { ...parsed.options, noEmit: true }, host });
  const diagnostics = ts.getPreEmitDiagnostics(program).map(d => { const where = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : undefined; return { code: d.code, category: ts.DiagnosticCategory[d.category], message: ts.flattenDiagnosticMessageText(d.messageText, '\n'), file: d.file?.fileName, line: where ? where.line + 1 : undefined, column: where ? where.character + 1 : undefined }; });
  report.variants.push({ variant, helperSHA256: createHash('sha256').update(source).digest('hex'), diagnostics, files: program.getSourceFiles().filter(f => !f.isDeclarationFile).map(f => f.fileName) });
}
report.passed = report.configErrors.length === 0 && report.variants[0].diagnostics.some(d => d.code === 2322) && report.variants[0].diagnostics.some(d => d.code === 7006) && report.variants[1].diagnostics.length === 0;
report.completedAt = new Date().toISOString(); report.durationMs = Date.now() - Date.parse(report.startedAt);
await writeFile(path.join(directory, 'typecheck-result.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, variants: report.variants.map(v => ({ variant: v.variant, diagnostics: v.diagnostics.map(d => d.code) })), configErrors: report.configErrors, durationMs: report.durationMs, result: path.join(directory, 'typecheck-result.json') }));
if (!report.passed) process.exitCode = 1;
