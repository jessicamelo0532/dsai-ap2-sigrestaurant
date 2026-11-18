import { vi } from 'vitest';

export type Route = (init?: RequestInit, path?: string) => { body?: unknown; status?: number };

export const reply = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  text: async () => (body === undefined || body === null ? (body === null ? 'null' : '') : JSON.stringify(body)),
}) as unknown as Response;

export function stubApi(routes: Record<string, Route>) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace('http://api.test/api', '');
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const base = path.split('?')[0];
    const key = /^\/goals\/\d{4}-\d{2}\/progress$/.test(base) ? `${method} /goals/:m/progress`
      : /^\/goals\/\d{4}-\d{2}$/.test(base) ? `${method} /goals/:m` : `${method} ${base}`;
    const handler = routes[key] ?? routes[`${method} ${path}`];
    if (!handler) return reply({ message: `sem rota ${method} ${path}` }, 404);
    const answer = handler(init, path);
    return reply(answer.body, answer.status);
  }));
  return calls;
}
