import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const blueprint = readFileSync(join(repoRoot, 'render.yaml'), 'utf8');

test('render.yaml referencia o Dockerfile da API que existe', () => {
  assert.match(blueprint, /runtime:\s*docker/);
  assert.match(blueprint, /dockerfilePath:\s*\.\/apps\/api\/Dockerfile/);
  assert.match(blueprint, /dockerContext:\s*\./);
  assert.ok(existsSync(join(repoRoot, 'apps/api/Dockerfile')));
});

test('health check do web service aponta para /api/health', () => {
  assert.match(blueprint, /healthCheckPath:\s*\/api\/health/);
});

test('DATABASE_URL vem do banco criado pelo Blueprint', () => {
  assert.match(blueprint, /key:\s*DATABASE_URL/);
  assert.match(blueprint, /fromDatabase:\s*\n\s*name:\s*mesa-clara-db/);
});

test('WEB_ORIGIN é a origem de produção da Vercel', () => {
  assert.match(blueprint, /key:\s*WEB_ORIGIN/);
  assert.match(blueprint, /value:\s*https:\/\/dsai-ap2-sigrestaurant\.vercel\.app/);
});

test('Blueprint não usa dockerCommand inline (a Render não o executa via shell)', () => {
  assert.doesNotMatch(blueprint, /dockerCommand:/);
});

test('Dockerfile da API usa o script de start no CMD', () => {
  const dockerfile = readFileSync(join(repoRoot, 'apps/api/Dockerfile'), 'utf8');
  assert.match(dockerfile, /COPY apps\/api\/docker-entrypoint\.sh apps\/api\/docker-entrypoint\.sh/);
  assert.match(dockerfile, /CMD \["sh", "apps\/api\/docker-entrypoint\.sh"\]/);
});

test('script de start aplica migrações, seed e inicia a API nesta ordem', () => {
  const script = readFileSync(join(repoRoot, 'apps/api/docker-entrypoint.sh'), 'utf8');
  const migrate = script.indexOf('prisma migrate deploy');
  const seed = script.indexOf('prisma:seed');
  const start = script.indexOf('node apps/api/dist/main.js');
  assert.match(script, /set -e/);
  assert.ok(migrate >= 0, 'migrações ausentes');
  assert.ok(seed > migrate, 'seed deve vir depois das migrações');
  assert.ok(start > seed, 'servidor deve vir depois do seed');
});

test('Blueprint não versiona credencial real', () => {
  assert.doesNotMatch(blueprint, /restaurante_local/);
  assert.doesNotMatch(blueprint, /postgresql:\/\/[^"]*:[^@"]+@/);
  assert.doesNotMatch(blueprint, /password/i);
});
