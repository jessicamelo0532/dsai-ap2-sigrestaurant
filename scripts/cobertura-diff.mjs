#!/usr/bin/env node
/**
 * Cobertura do código novo (SPEC/2026-11-17-cobertura-do-codigo-novo.md).
 *
 * Cruza as linhas adicionadas desde o último commit da AP1 com os relatórios lcov
 * do frontend e da API, e falha abaixo do mínimo (métrica "Testes" da Aula 09).
 *
 * Uso:
 *   node scripts/cobertura-diff.mjs \
 *     --base d0a6caf \
 *     --lcov apps/web/coverage/lcov.info:apps/web \
 *     --lcov apps/api/coverage/lcov.info:apps/api \
 *     --min 70
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diffCoverage, mergeLcov, parseAddedLines, parseLcov, summaryMarkdown, worstFiles } from './cobertura-diff/regras.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function options(argv) {
  const result = { base: 'd0a6caf', lcov: [], min: 70 };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    if (name === '--base') { result.base = value; index += 1; }
    else if (name === '--min') { result.min = Number(value); index += 1; }
    else if (name === '--lcov') {
      // "arquivo:pasta"; o último ":" separa, para aceitar "C:\..." no Windows.
      const split = value.lastIndexOf(':');
      result.lcov.push(split > 1 ? { file: value.slice(0, split), prefix: value.slice(split + 1) } : { file: value, prefix: '' });
      index += 1;
    }
  }
  if (!result.lcov.length) {
    result.lcov = [
      { file: 'apps/web/coverage/lcov.info', prefix: 'apps/web' },
      { file: 'apps/api/coverage/lcov.info', prefix: 'apps/api' },
    ];
  }
  return result;
}

const args = options(process.argv.slice(2));

const diff = execFileSync('git', ['diff', '-U0', '--no-color', '--no-renames', args.base, 'HEAD', '--', 'apps'], {
  cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
});
const added = parseAddedLines(diff);

const reports = [];
for (const entry of args.lcov) {
  const path = join(ROOT, entry.file);
  if (!existsSync(path)) {
    console.log(`aviso: relatório não encontrado: ${entry.file}`);
    continue;
  }
  reports.push(parseLcov(readFileSync(path, 'utf8'), entry.prefix));
}
if (!reports.length) {
  console.error('Nenhum relatório lcov legível. Rode as suítes com cobertura antes (npm run test:coverage e npm run test:api:coverage).');
  process.exit(1);
}

const readLines = (file) => {
  const path = join(ROOT, file);
  return existsSync(path) ? readFileSync(path, 'utf8').split(/\r?\n/) : [];
};

const result = diffCoverage(added, mergeLcov(...reports), readLines);
const ok = result.percent >= args.min;

console.log(`Cobertura do código novo desde ${args.base}: ${result.percent}% (${result.covered}/${result.total} linhas), mínimo ${args.min}% -> ${ok ? 'CONFORME' : 'NAO CONFORME'}`);
for (const entry of worstFiles(result)) console.log(`  ${String(entry.uncovered).padStart(5)} descobertas de ${String(entry.total).padStart(5)}  ${entry.file}`);
if (result.missing.length) {
  const shown = result.missing.slice(0, 15).join(', ');
  const rest = result.missing.length > 15 ? ` e mais ${result.missing.length - 15}` : '';
  console.log(`  sem relatório (contados como descobertos): ${shown}${rest}`);
}

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown(result, args.min, args.base));

process.exit(ok ? 0 : 1);
