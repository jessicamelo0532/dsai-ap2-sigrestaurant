import type { MetadataRoute } from 'next';

// Manifesto para instalar o app na tela inicial (SPEC/2026-11-17-pwa-e-qr-das-mesas.md, RF-01).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mesa Clara | Gestão do restaurante',
    short_name: 'Mesa Clara',
    description: 'Mesas, comandas, cardápio e financeiro do restaurante em um só lugar.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f7f9',
    theme_color: '#7060d6',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
