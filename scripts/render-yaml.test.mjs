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

test('start aplica migrações e seed antes de subir a API', () => {
  assert.match(blueprint, /dockerCommand:.*prisma migrate deploy/s);
  assert.match(blueprint, /dockerCommand:.*prisma:seed/s);
  assert.match(blueprint, /dockerCommand:.*node apps\/api\/dist\/main\.js/s);
});

test('Blueprint não versiona credencial real', () => {
  assert.doesNotMatch(blueprint, /restaurante_local/);
  assert.doesNotMatch(blueprint, /postgresql:\/\/[^"]*:[^@"]+@/);
  assert.doesNotMatch(blueprint, /password/i);
});
