/** Cliente HTTP da API do Mesa Clara. Mesmo contrato do adaptador local. */

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function joinUrl(baseUrl: string, path: string) {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function messageFromPayload(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback;
  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  if (Array.isArray(message)) {
    const texts = message.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    if (texts.length) return texts[0];
  }
  return fallback;
}

export async function apiRequest<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (typeof init?.body === 'string') headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(joinUrl(baseUrl, path), { ...init, headers });
  } catch {
    throw new ApiError('Não foi possível falar com o servidor. Verifique se a API está no ar.', 0);
  }

  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const fallback = response.status >= 500
      ? 'O servidor encontrou um erro. Tente de novo em instantes.'
      : 'Não foi possível concluir a operação.';
    throw new ApiError(messageFromPayload(payload, fallback), response.status);
  }

  return payload as T;
}
