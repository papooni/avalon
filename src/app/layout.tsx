import type { Metadata, Viewport } from 'next';
import { Alegreya_Sans, Marcellus } from 'next/font/google';
import { BRAND } from '@/lib/branding';
import { SITE, SITE_URL } from '@/lib/site';
import './globals.css';

const display = Marcellus({ subsets: ['latin'], weight: '400', variable: '--font-display', display: 'swap' });
const body = Alegreya_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${BRAND.productName}: hidden loyalty game for 5 to 10 players`, template: `%s · ${BRAND.productName}` },
  description: SITE.description,
  keywords: SITE.keywords,
  applicationName: BRAND.productName,
  category: 'games',
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.svg' },
  openGraph: {
    type: 'website',
    siteName: BRAND.productName,
    title: BRAND.productName,
    description: SITE.description,
    url: '/',
    locale: SITE.locale,
  },
  twitter: { card: 'summary_large_image', title: BRAND.productName, description: SITE.description },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  formatDetection: { telephone: false },
  verification: SITE.googleVerification ? { google: SITE.googleVerification } : undefined,
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
