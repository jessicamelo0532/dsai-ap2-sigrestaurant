import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import manifest from '../app/manifest';
import { registerServiceWorker, shouldRegister } from '../app/registrar-offline';

// SPEC/2026-11-17-pwa-e-qr-das-mesas.md (T-02 e T-05): manifesto, registro e service worker.

const ORIGIN = 'https://mesa.test';
const source = readFileSync(fileURLToPath(new URL('../public/sw.js', import.meta.url)), 'utf8');

type Handler = (event: { request?: unknown; waitUntil: (p: Promise<unknown>) => void; respondWith: (p: Promise<unknown>) => void }) => void;

function fakeCaches() {
  const stores = new Map<string, Map<string, string>>();
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    const key = (request: string | { url: string }) => {
      const url = new URL(typeof request === 'string' ? request : request.url, ORIGIN);
      return url.pathname + url.search;
    };
    return {
      add: async (url: string) => { store.set(key(url), `cache:${url}`); },
      put: async (request: { url: string }, response: { body: string }) => { store.set(key(request), response.body); },
      match: async (request: string | { url: string }, options?: { ignoreSearch?: boolean }) => {
        const wanted = key(request);
        const found = store.get(wanted) ?? (options?.ignoreSearch ? store.get(wanted.split('?')[0]) : undefined);
        return found === undefined ? undefined : { body: found, ok: true, clone() { return this; } };
      },
    };
  };
  return {
    stores,
    api: { open, keys: async () => [...stores.keys()], delete: async (name: string) => stores.delete(name) },
  };
}

function loadWorker(online: boolean) {
  const handlers: Record<string, Handler> = {};
  const caches = fakeCaches();
  const fetchMock = vi.fn(async (request: { url: string }) => {
    if (!online) throw new TypeError('sem rede');
    return { ok: true, body: `rede:${new URL(request.url).pathname}`, clone() { return this; } };
  });
  const self: Record<string, unknown> = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: Handler) => { handlers[type] = handler; },
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  };
  runInNewContext(source, { self, caches: caches.api, fetch: fetchMock, URL, Promise });
  const sw = self.__mesaClaraSw as { CACHE: string; classify: (request: object, origin: string) => string };
  return { handlers, caches, fetchMock, sw, self };
}

const request = (path: string, init: { method?: string; mode?: string } = {}) => ({ url: `${ORIGIN}${path}`, method: init.method ?? 'GET', mode: init.mode ?? 'cors' });

describe('manifesto (CA-01)', () => {
  it('tem nome, início, modo standalone e ícone', () => {
    const data = manifest();
    expect(data).toMatchObject({ name: 'Mesa Clara | Gestão do restaurante', short_name: 'Mesa Clara', start_url: '/', display: 'standalone', lang: 'pt-BR' });
    expect(data.icons?.[0]).toMatchObject({ src: '/icon.svg', type: 'image/svg+xml' });
  });
});

describe('registro do service worker (RF-02)', () => {
  it('só registra em produção e com suporte', async () => {
    const register = vi.fn(async () => ({}));
    expect(shouldRegister({ production: false, navigator: { serviceWorker: { register } } })).toBe(false);
    expect(shouldRegister({ production: true, navigator: {} })).toBe(false);
    expect(await registerServiceWorker({ production: true, navigator: { serviceWorker: { register } } })).toBe(true);
    expect(register).toHaveBeenCalledWith('/sw.js');
    expect(await registerServiceWorker({ production: false })).toBe(false);
  });

  it('falha no registro não quebra o app', async () => {
    const register = vi.fn(async () => { throw new Error('bloqueado'); });
    expect(await registerServiceWorker({ production: true, navigator: { serviceWorker: { register } } })).toBe(false);
  });
});

describe('estratégia de cache (CA-05, RNF-03)', () => {
  it('classifica as requisições', () => {
    const { sw } = loadWorker(true);
    expect(sw.classify(request('/', { mode: 'navigate' }), ORIGIN)).toBe('network-first');
    expect(sw.classify(request('/_next/static/chunks/app.js'), ORIGIN)).toBe('cache-first');
    expect(sw.classify(request('/icon.svg'), ORIGIN)).toBe('cache-first');
    expect(sw.classify(request('/api/tables'), ORIGIN)).toBe('ignore');
    expect(sw.classify(request('/', { method: 'POST' }), ORIGIN)).toBe('ignore');
    expect(sw.classify({ url: 'https://outro.test/x.js', method: 'GET', mode: 'cors' }, ORIGIN)).toBe('ignore');
    expect(sw.classify(request('/?_rsc=abc'), ORIGIN)).toBe('network-first');
  });

  it('com rede, guarda a página; sem rede, serve a guardada (mesmo com ?mesa=)', async () => {
    const online = loadWorker(true);
    let response: Promise<unknown> | undefined;
    online.handlers.fetch({ request: request('/', { mode: 'navigate' }), waitUntil: () => {}, respondWith: (p) => { response = p; } });
    expect(await response).toMatchObject({ body: 'rede:/' });

    const offline = loadWorker(false);
    offline.caches.stores.set(offline.sw.CACHE, online.caches.stores.get(online.sw.CACHE)!);
    offline.handlers.fetch({ request: request('/?mesa=3', { mode: 'navigate' }), waitUntil: () => {}, respondWith: (p) => { response = p; } });
    expect(await response).toMatchObject({ body: 'rede:/' });
  });

  it('estático vem do cache sem ir à rede', async () => {
    const worker = loadWorker(true);
    const asset = request('/_next/static/a.js');
    let response: Promise<unknown> | undefined;
    worker.handlers.fetch({ request: asset, waitUntil: () => {}, respondWith: (p) => { response = p; } });
    await response;
    worker.handlers.fetch({ request: asset, waitUntil: () => {}, respondWith: (p) => { response = p; } });
    expect(await response).toMatchObject({ body: 'rede:/_next/static/a.js' });
    expect(worker.fetchMock).toHaveBeenCalledTimes(1);
  });

  it('não responde chamadas à API (o navegador segue normal)', () => {
    const worker = loadWorker(true);
    const respondWith = vi.fn();
    worker.handlers.fetch({ request: request('/api/tables'), waitUntil: () => {}, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  });

  it('sem rede e sem nada guardado, a navegação falha', async () => {
    const worker = loadWorker(false);
    let response: Promise<unknown> | undefined;
    worker.handlers.fetch({ request: request('/', { mode: 'navigate' }), waitUntil: () => {}, respondWith: (p) => { response = p; } });
    await expect(response).rejects.toThrow('sem rede');
  });

  it('instala guardando a página inicial e apaga caches antigos ao ativar', async () => {
    const worker = loadWorker(true);
    const waits: Promise<unknown>[] = [];
    worker.handlers.install({ waitUntil: (p) => waits.push(p), respondWith: () => {} });
    await Promise.all(waits);
    expect(worker.caches.stores.get(worker.sw.CACHE)?.get('/')).toBe('cache:/');
    worker.caches.stores.set('mesa-clara-v0', new Map());
    worker.handlers.activate({ waitUntil: (p) => waits.push(p), respondWith: () => {} });
    await Promise.all(waits);
    expect([...worker.caches.stores.keys()]).toEqual([worker.sw.CACHE]);
  });
});
