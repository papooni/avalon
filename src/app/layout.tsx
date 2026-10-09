import type { Metadata, Viewport } from 'next';
import { Alegreya_Sans, Marcellus } from 'next/font/google';
import { BRAND } from '@/lib/branding';
import './globals.css';

const display = Marcellus({ subsets: ['latin'], weight: '400', variable: '--font-display', display: 'swap' });
const body = Alegreya_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: { default: BRAND.productName, template: `%s · ${BRAND.productName}` },
  description: BRAND.tagline,
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0E1626',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${display.variable} ${body.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-gilt focus:px-4 focus:py-2 focus:text-night">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
