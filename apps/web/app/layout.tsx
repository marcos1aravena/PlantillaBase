import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from './i18n';

export const metadata: Metadata = { title: 'Base App', description: 'Plantilla base para proyectos' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><I18nProvider>{children}</I18nProvider></body></html>;
}
