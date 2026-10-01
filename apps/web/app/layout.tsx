import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mesa Clara | Gestão do restaurante',
  description: 'Mesas, comandas, cardápio e financeiro do restaurante em um só lugar.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
