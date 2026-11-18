import 'reflect-metadata';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';

// Toda funcionalidade da API precisa estar ligada à aplicação (SPEC/2026-11-12-reativacao-backend.md).
// Os testes de integração criam os serviços direto, então um módulo esquecido no AppModule passaria
// despercebido e deixaria as rotas fora do ar. Este teste lê os módulos da pasta src e confere a ligação.

type Constructor = abstract new (...args: never[]) => unknown;

const SRC = fileURLToPath(new URL('../src', import.meta.url));

function moduleFiles(): string[] {
  return readdirSync(SRC, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => readdirSync(join(SRC, entry.name)).filter((file) => file.endsWith('.module.ts')).map((file) => join(SRC, entry.name, file)));
}

function controllerFiles(): string[] {
  const nested = readdirSync(SRC, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => readdirSync(join(SRC, entry.name)).filter((file) => file.endsWith('.controller.ts')).map((file) => join(SRC, entry.name, file)));
  const root = join(SRC, 'app.controller.ts');
  return existsSync(root) ? [root, ...nested] : nested;
}

async function exportedClasses(file: string, suffix: string): Promise<Constructor[]> {
  const loaded = await import(pathToFileURL(file).href) as Record<string, unknown>;
  return Object.entries(loaded)
    .filter(([name, value]) => name.endsWith(suffix) && typeof value === 'function')
    .map(([, value]) => value as Constructor);
}

const metadata = (key: string, target: object): Constructor[] => (Reflect.getMetadata(key, target) as Constructor[] | undefined) ?? [];

// Rotas "MÉTODO caminho" de um controller, a partir dos metadados do Nest.
function routesOf(controller: Constructor): string[] {
  const base = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '').replace(/^\/|\/$/g, '');
  const prototype = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor' && typeof prototype[name] === 'function')
    .flatMap((name) => {
      const handler = prototype[name] as object;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (method === undefined) return [];
      const path = String(Reflect.getMetadata(PATH_METADATA, handler) ?? '').replace(/^\/|\/$/g, '');
      return [`${RequestMethod[method]} /${[base, path].filter(Boolean).join('/')}`];
    });
}

describe('módulos da API ligados à aplicação', () => {
  it('encontra os módulos e os controllers da pasta src', () => {
    expect(moduleFiles().length).toBeGreaterThanOrEqual(16);
    expect(controllerFiles().length).toBeGreaterThanOrEqual(17);
  });

  it('todo módulo da pasta src está no AppModule', async () => {
    const registered = new Set(metadata('imports', AppModule));
    const missing: string[] = [];
    for (const file of moduleFiles()) {
      for (const module of await exportedClasses(file, 'Module')) if (!registered.has(module)) missing.push(module.name);
    }
    expect(missing).toEqual([]);
  });

  it('todo controller pertence a algum módulo da aplicação', async () => {
    const modules = [AppModule, ...metadata('imports', AppModule)];
    const declared = new Set(modules.flatMap((module) => metadata('controllers', module)));
    const orphans: string[] = [];
    for (const file of controllerFiles()) {
      for (const controller of await exportedClasses(file, 'Controller')) if (!declared.has(controller)) orphans.push(controller.name);
    }
    expect(orphans).toEqual([]);
  });

  it('nenhuma rota é declarada duas vezes', () => {
    const modules = [AppModule, ...metadata('imports', AppModule)];
    const routes = modules.flatMap((module) => metadata('controllers', module)).flatMap(routesOf);
    const repeated = routes.filter((route, index) => routes.indexOf(route) !== index);
    expect(routes.length).toBeGreaterThan(50);
    expect(repeated).toEqual([]);
  });

  it('as rotas principais do frontend existem', () => {
    const modules = [AppModule, ...metadata('imports', AppModule)];
    const routes = new Set(modules.flatMap((module) => metadata('controllers', module)).flatMap(routesOf));
    for (const route of [
      'GET /api/tables', 'POST /api/tables/:id/items', 'POST /api/orders/:id/close', 'GET /api/menu-items',
      'GET /api/reports/financial', 'GET /api/cash/current', 'GET /api/waiters', 'GET /api/customers',
      'GET /api/kitchen/queue', 'GET /api/reservations',
    ]) expect(routes.has(route)).toBe(true);
  });
});
