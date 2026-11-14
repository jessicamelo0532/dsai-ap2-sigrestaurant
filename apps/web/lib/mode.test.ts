import { afterEach, describe, expect, it, vi } from 'vitest';

const BASE_URL = 'http://localhost:4000/api';

async function loadStore(url?: string) {
  vi.resetModules();
  if (url === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = url;
  return import('./store');
}

describe('modo de operação (SPEC/2026-11-14-frontend-em-modo-api)', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_URL;
    vi.unstubAllGlobals();
  });

  it('T-14: sem URL da API o modo é local', async () => {
    const store = await loadStore();
    expect(store.getMode()).toBe('local');
  });

  it('T-15: com URL da API o modo é API', async () => {
    const store = await loadStore(BASE_URL);
    expect(store.getMode()).toBe('api');
  });

  it('T-15b: a troca manual de modo avisa quem assinou a mudança', async () => {
    const store = await loadStore(BASE_URL);
    const listener = vi.fn();
    const unsubscribe = store.subscribeMode(listener);

    store.setMode('local');
    expect(store.getMode()).toBe('local');
    expect(listener).toHaveBeenCalledTimes(1);

    store.setMode('local');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.setMode('api');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('T-16: falha da API não troca o modo sozinho', async () => {
    const store = await loadStore(BASE_URL);
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed');
    }));

    await expect(store.storeRequest('/tables')).rejects.toThrow(
      'Não foi possível falar com o servidor. Verifique se a API está no ar.'
    );
    expect(store.getMode()).toBe('api');
  });

  it('T-16b: a verificação de saúde informa se a API responde', async () => {
    const store = await loadStore(BASE_URL);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })));
    expect(await store.checkApi()).toBe(true);

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed');
    }));
    expect(await store.checkApi()).toBe(false);
  });

  it('T-16c: sem URL da API a verificação de saúde é falsa', async () => {
    const store = await loadStore();
    expect(await store.checkApi()).toBe(false);
  });
});
