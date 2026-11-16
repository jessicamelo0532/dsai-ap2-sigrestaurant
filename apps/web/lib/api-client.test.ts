import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api-client';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('cliente HTTP da API (SPEC/2026-11-14-frontend-em-modo-api)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('T-11: monta a URL com a base, envia JSON no corpo e devolve a resposta', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse([{ id: 1, number: 1 }]));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiRequest<{ id: number }[]>('http://localhost:4000/api', '/tables');
    expect(result).toEqual([{ id: 1, number: 1 }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:4000/api/tables');
    expect(new Headers(init?.headers).get('Content-Type')).toBeNull();

    await apiRequest('http://localhost:4000/api', '/menu-items', {
      method: 'POST',
      body: JSON.stringify({ name: 'Tacacá', price: 18.5 }),
    });
    const [, initWithBody] = fetchMock.mock.calls[1];
    expect(new Headers(initWithBody?.headers).get('Content-Type')).toBe('application/json');
  });

  it('T-12: erro do Nest vira erro com a mensagem em pt-BR', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ statusCode: 400, message: ['Informe um preço válido.'] }, 400)));

    await expect(
      apiRequest('http://localhost:4000/api', '/menu-items', { method: 'POST', body: JSON.stringify({ price: 0 }) })
    ).rejects.toThrow('Informe um preço válido.');
  });

  it('T-13: erro de rede vira mensagem de conexão recusada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed');
    }));

    await expect(apiRequest('http://localhost:4000/api', '/tables')).rejects.toThrow(
      'Não foi possível falar com o servidor. Verifique se a API está no ar.'
    );
  });

  it('T-13b: erro do servidor sem corpo usa a mensagem genérica', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));

    await expect(apiRequest('http://localhost:4000/api', '/tables')).rejects.toThrow(
      'O servidor encontrou um erro. Tente de novo em instantes.'
    );
  });
});
