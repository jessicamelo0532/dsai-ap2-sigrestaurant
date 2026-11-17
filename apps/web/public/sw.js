/* Service worker do Mesa Clara (SPEC/2026-11-17-pwa-e-qr-das-mesas.md, RF-02 e RNF-03).
 * Navegação: rede primeiro, cache sem rede. Arquivos estáticos: cache primeiro.
 * Nunca guarda chamadas à API nem requisições que não são GET. */
const CACHE = 'mesa-clara-v1';

function classify(request, origin) {
  if (request.method !== 'GET') return 'ignore';
  const url = new URL(request.url);
  if (url.origin !== origin) return 'ignore';
  if (url.pathname.startsWith('/api/')) return 'ignore';
  if (request.mode === 'navigate') return 'network-first';
  if (url.pathname.startsWith('/_next/static/') || /\.(?:svg|png|ico|webmanifest|css|js|woff2?)$/.test(url.pathname)) return 'cache-first';
  return 'network-first';
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    const home = request.mode === 'navigate' ? await cache.match('/') : undefined;
    if (home) return home;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/')).catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('mesa-clara-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const strategy = classify(event.request, self.location.origin);
  if (strategy === 'ignore') return;
  event.respondWith(strategy === 'cache-first' ? cacheFirst(event.request) : networkFirst(event.request));
});

// Exposto para os testes (rodam o arquivo num ambiente simulado).
self.__mesaClaraSw = { CACHE, classify, networkFirst, cacheFirst };
