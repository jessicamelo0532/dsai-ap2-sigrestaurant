'use client';

import { useEffect } from 'react';

// Registra o service worker do app offline (SPEC/2026-11-17-pwa-e-qr-das-mesas.md, RF-02).
// Só em produção: no desenvolvimento, o cache atrapalharia ver as mudanças.

type Environment = { production: boolean; navigator?: { serviceWorker?: { register: (url: string) => Promise<unknown> } } };

export function shouldRegister(environment: Environment): boolean {
  return environment.production && !!environment.navigator?.serviceWorker;
}

export function registerServiceWorker(environment: Environment): Promise<boolean> {
  if (!shouldRegister(environment)) return Promise.resolve(false);
  return environment.navigator!.serviceWorker!.register('/sw.js').then(() => true, () => false);
}

export function RegistrarOffline() {
  useEffect(() => {
    void registerServiceWorker({ production: process.env.NODE_ENV === 'production', navigator: typeof navigator === 'undefined' ? undefined : navigator });
  }, []);
  return null;
}
