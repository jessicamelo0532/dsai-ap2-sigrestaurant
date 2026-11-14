#!/usr/bin/env node
/**
 * Publica o backlog da AP2 como issues do GitHub.
 *
 * Os corpos ficam em `docs/issues/bodies/*.md`; cada issue começa com um
 * cabeçalho `## @issue <título>` seguido de linhas de metadados
 * (`labels:`, `depende:`, `spec:`, `arquivo:`) e do corpo em Markdown.
 *
 * O script é idempotente: issues já existentes (mesmo título) são puladas.
 *
 * Uso:
 *   node scripts/publicar-issues.mjs            # cria as que faltam
 *   node scripts/publicar-issues.mjs --dry-run  # mostra o plano, não publica
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO_ROOT = new URL('..', import.meta.url).pathname;
const BODIES_DIR = join(REPO_ROOT, 'docs', 'issues', 'bodies');
const DRY_RUN = process.argv.includes('--dry-run');

const LABELS = [
  { name: 'fase-0', color: 'b60205', description: 'Bloqueador de avaliação da AP2' },
  { name: 'fase-1', color: 'd93f0b', description: 'Fundação técnica da AP2' },
  { name: 'fase-2', color: '0e8a16', description: 'Produto da AP2' },
  { name: 'entrega', color: '5319e7', description: 'Entrega da aula' },
  { name: 'produto', color: '1d76db', description: 'Funcionalidade de produto' },
  { name: 'backend', color: '0052cc', description: 'Backend NestJS/Prisma' },
  { name: 'testes', color: 'c2e0c6', description: 'Trabalho de teste' },
  { name: 'infra', color: 'b60205', description: 'CI, deploy e automação' },
  { name: 'docs', color: 'c5def5', description: 'Documentação e governança' },
  { name: 'precisa-spec', color: 'fef2c0', description: 'Exige SPEC aprovada antes do código' },
  { name: 'precisa-humano', color: 'f9d0c4', description: 'Depende de informação do responsável humano' },
  { name: 'precisa-aprovacao', color: 'f9d0c4', description: 'Depende de aprovação de dependência' },
  { name: 'git', color: 'cccccc', description: 'Histórico, autoria e commits' },
  { name: 'deploy', color: '006b75', description: 'Publicação e Vercel' },
  { name: 'dependencias', color: 'b60205', description: 'Atualização de dependência' },
];

function gh(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('gh', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    if (allowFailure) return null;
    const stderr = error.stderr ? String(error.stderr) : '';
    throw new Error(`gh ${args.join(' ')} falhou: ${stderr.trim() || error.message}`);
  }
}

function parseBodies() {
  const files = readdirSync(BODIES_DIR).filter((file) => file.endsWith('.md')).sort();
  const issues = [];
  for (const file of files) {
    const raw = readFileSync(join(BODIES_DIR, file), 'utf8');
    const blocks = raw.split(/^## @issue /m).slice(1);
    for (const block of blocks) {
      const lines = block.split('\n');
      const title = lines[0].trim();
      const meta = { labels: [], depende: '', spec: '', arquivo: '' };
      let index = 1;
      while (index < lines.length && /^(labels|depende|spec|arquivo):/.test(lines[index].trim())) {
        const [key, ...rest] = lines[index].trim().split(':');
        const value = rest.join(':').trim();
        if (key === 'labels') meta.labels = value.split(',').map((label) => label.trim()).filter(Boolean);
        else meta[key] = value;
        index += 1;
      }
      const body = lines.slice(index).join('\n').trim();
      issues.push({ title, body, ...meta, file });
    }
  }
  return issues;
}

function checkAuth() {
  const status = gh(['auth', 'status'], { allowFailure: true });
  if (status === null) {
    console.error('gh nao esta autenticado. Rode `gh auth login` e execute este script de novo.');
    process.exit(1);
  }
}

function ensureLabels() {
  for (const label of LABELS) {
    gh(['label', 'create', label.name, '--color', label.color, '--description', label.description, '--force']);
  }
  console.log(`${LABELS.length} labels verificadas.`);
}

function existingTitles() {
  const json = gh(['issue', 'list', '--state', 'all', '--limit', '500', '--json', 'title']);
  return new Set(JSON.parse(json).map((issue) => issue.title));
}

function publish(issue, created, skipped) {
  const tempDir = mkdtempSync(join(tmpdir(), 'issue-'));
  const bodyFile = join(tempDir, 'body.md');
  try {
    const body = issue.arquivo ? readFileSync(join(REPO_ROOT, issue.arquivo), 'utf8') : issue.body;
    writeFileSync(bodyFile, body);
    const args = ['issue', 'create', '--title', issue.title, '--body-file', bodyFile];
    for (const label of issue.labels) args.push('--label', label);
    const output = gh(args);
    const url = output.trim().split('\n').pop();
    created.push({ title: issue.title, url });
    console.log(`criada  ${url}`);
  } catch (error) {
    if (/issues are disabled|410|Gone/i.test(String(error.message))) {
      throw new Error(
        'O GitHub recusou a criacao: as Issues deste repositorio estao desabilitadas. ' +
          'Habilite em Settings -> General -> Features -> Issues e rode o script de novo.'
      );
    }
    throw error;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

const issues = parseBodies();
console.log(`${issues.length} issues lidas de docs/issues/bodies.`);

if (DRY_RUN) {
  for (const issue of issues) console.log(`- [${issue.labels.join(', ')}] ${issue.title}`);
  process.exit(0);
}

checkAuth();
ensureLabels();
const titles = existingTitles();
const created = [];
const skipped = [];
for (const issue of issues) {
  if (titles.has(issue.title)) {
    skipped.push(issue.title);
    console.log(`pulada  ${issue.title}`);
    continue;
  }
  publish(issue, created, skipped);
}
console.log(`\n${created.length} criadas, ${skipped.length} ja existentes.`);
