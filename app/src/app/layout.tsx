import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, JetBrains_Mono, Inter } from 'next/font/google';
import { RejestracjaSW } from '@/components/RejestracjaSW';
import './globals.css';

/* Szyld — jedyne miejsce, gdzie serif ma sens. latin-ext dla polskich znaków. */
const display = Instrument_Serif({
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

/* Mono tylko do drobnych etykiet technicznych, nie do dużych kwot. */
const mono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

/* Inter niesie całą treść i wszystkie liczby — ma porządne cyfry tabelaryczne. */
const sans = Inter({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Forteca',
  description: 'Budowanie poduszki bezpieczeństwa',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Forteca' },
};

export const viewport: Viewport = {
  themeColor: '#131110',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${display.variable} ${mono.variable} ${sans.variable}`}>
      <body>
        {children}
        <RejestracjaSW />
      </body>
    </html>
  );
}
