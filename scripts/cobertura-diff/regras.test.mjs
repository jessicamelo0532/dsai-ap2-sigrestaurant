// Testes das regras da cobertura do código novo (SPEC/2026-11-17-cobertura-do-codigo-novo.md).
// Rodam com `node --test scripts/` (sem dependência nova).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  diffCoverage, isCodeLine, isMeasured, mergeLcov, normalizeLcovPath, parseAddedLines, parseLcov, percent,
  summaryMarkdown, worstFiles,
} from './regras.mjs';

const diff = [
  'diff --git a/apps/web/lib/novo.ts b/apps/web/lib/novo.ts',
  'new file mode 100644',
  '--- /dev/null',
  '+++ b/apps/web/lib/novo.ts',
  '@@ -0,0 +1,4 @@',
  '+export const a = 1;',
  '+',
  '+export function b() {',
  '+  return a;',
  'diff --git a/apps/api/src/velho.ts b/apps/api/src/velho.ts',
  '--- a/apps/api/src/velho.ts',
  '+++ b/apps/api/src/velho.ts',
  '@@ -10,2 +10,3 @@ export class X {',
  '-  antigo();',
  '-  outro();',
  '+  novo();',
  '+  maisUm();',
  '+  terceiro();',
  '@@ -40 +41 @@',
  '-  x();',
  '+  y();',
  '@@ -50,1 +52,0 @@',
  '-  removida();',
  'diff --git a/apps/web/lib/apagado.ts b/apps/web/lib/apagado.ts',
  '--- a/apps/web/lib/apagado.ts',
  '+++ /dev/null',
  '@@ -1,2 +0,0 @@',
  '-a',
  '-b',
].join('\n');

describe('linhas adicionadas (CA-01)', () => {
  it('lê arquivo novo, trechos alterados e ignora remoções', () => {
    const added = parseAddedLines(diff);
    assert.deepEqual([...added.keys()], ['apps/web/lib/novo.ts', 'apps/api/src/velho.ts']);
    assert.deepEqual([...added.get('apps/web/lib/novo.ts')], [1, 2, 3, 4]);
    assert.deepEqual([...added.get('apps/api/src/velho.ts')], [10, 11, 12, 41]);
  });

  it('aceita fim de linha do Windows', () => {
    const added = parseAddedLines('+++ b/apps/web/x.ts\r\n@@ -0,0 +1,2 @@\r\n+a\r\n+b\r\n');
    assert.deepEqual([...added.get('apps/web/x.ts')], [1, 2]);
  });
});

describe('caminhos do lcov (CA-02)', () => {
  it('relativo com barra invertida', () => {
    assert.equal(normalizeLcovPath('app\\caixa-panel.tsx', 'apps/web'), 'apps/web/app/caixa-panel.tsx');
  });

  it('relativo com ./ e prefixo com barra final', () => {
    assert.equal(normalizeLcovPath('./src/cash/cash.service.ts', 'apps/api/'), 'apps/api/src/cash/cash.service.ts');
  });

  it('absoluto no Linux e no Windows', () => {
    assert.equal(normalizeLcovPath('/home/runner/work/r/r/apps/api/src/a.ts', 'x'), 'apps/api/src/a.ts');
    assert.equal(normalizeLcovPath('C:\\repo\\apps\\web\\lib\\a.ts', 'x'), 'apps/web/lib/a.ts');
  });

  it('lê DA, junta repetidos e vários relatórios', () => {
    const web = parseLcov('TN:\nSF:lib\\a.ts\nDA:1,0\nDA:2,3\nend_of_record\nSF:lib\\a.ts\nDA:1,2\nend_of_record\n', 'apps/web');
    assert.deepEqual([...web.get('apps/web/lib/a.ts')], [[1, 2], [2, 3]]);
    const api = parseLcov('SF:src/b.ts\nDA:5,1\nend_of_record', 'apps/api');
    const merged = mergeLcov(web, api);
    assert.deepEqual([...merged.keys()], ['apps/web/lib/a.ts', 'apps/api/src/b.ts']);
  });
});

describe('arquivos que contam (CA-03)', () => {
  const cases = [
    ['apps/web/lib/caixa.ts', true],
    ['apps/web/app/caixa-panel.tsx', true],
    ['apps/api/src/cash/cash.service.ts', true],
    ['apps/web/lib/caixa.test.ts', false],
    ['apps/web/app/caixa-panel.test.tsx', false],
    ['apps/api/test/cash.test.ts', false],
    ['apps/web/e2e/celular.mjs', false],
    ['apps/web/next-env.d.ts', false],
    ['apps/web/vitest.config.ts', false],
    ['apps/api/prisma/seed.ts', false],
    ['apps/api/src/main.ts', false],
    ['scripts/metricas.mjs', false],
    ['README.md', false],
  ];
  for (const [file, expected] of cases) {
    it(`${file} -> ${expected}`, () => assert.equal(isMeasured(file), expected));
  }
});

describe('cálculo (CA-04, CA-05)', () => {
  const added = new Map([
    ['apps/web/lib/a.ts', new Set([1, 2, 3, 4])],
    ['apps/web/lib/a.test.ts', new Set([1, 2])],
    ['apps/api/src/sem-teste.ts', new Set([1, 2, 3, 4])],
  ]);
  const lcov = new Map([['apps/web/lib/a.ts', new Map([[1, 5], [2, 0], [4, 1]])]]);
  const source = { 'apps/api/src/sem-teste.ts': ['export const x = 1;', '', '// comentário', 'export const y = 2;'] };
  const readLine = (file, line) => source[file]?.[line - 1] ?? '';

  it('conta só linhas executáveis e marca arquivo sem relatório como descoberto', () => {
    const result = diffCoverage(added, lcov, readLine);
    assert.deepEqual(result.files, [
      { file: 'apps/web/lib/a.ts', total: 3, covered: 2, uncovered: 1 },
      { file: 'apps/api/src/sem-teste.ts', total: 2, covered: 0, uncovered: 2 },
    ]);
    assert.equal(result.total, 5);
    assert.equal(result.covered, 2);
    assert.equal(result.percent, 40);
    assert.deepEqual(result.missing, ['apps/api/src/sem-teste.ts']);
  });

  it('percentual com uma casa e 100% sem linhas', () => {
    assert.equal(percent(2, 3), 66.7);
    assert.equal(percent(0, 0), 100);
  });

  it('linhas de código', () => {
    assert.equal(isCodeLine('  return x;'), true);
    assert.equal(isCodeLine('   '), false);
    assert.equal(isCodeLine(' // nota'), false);
    assert.equal(isCodeLine(' * doc'), false);
    assert.equal(isCodeLine(undefined), false);
  });

  it('piores arquivos e resumo', () => {
    const result = diffCoverage(added, lcov, readLine);
    assert.deepEqual(worstFiles(result).map((entry) => entry.file), ['apps/api/src/sem-teste.ts', 'apps/web/lib/a.ts']);
    const markdown = summaryMarkdown(result, 70, 'd0a6caf');
    assert.match(markdown, /\*\*40,0%\*\* \(2 de 5 linhas novas cobertas\)\. Mínimo: 70%\. Abaixo do mínimo\./);
    assert.match(markdown, /Sem relatório de cobertura/);
    assert.match(summaryMarkdown({ total: 0, covered: 0, percent: 100, files: [], missing: [] }, 70, 'x'), /Nenhuma linha nova/);
  });
});
