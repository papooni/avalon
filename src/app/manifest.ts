import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/branding';
import { SITE } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.productName,
    short_name: BRAND.productName,
    description: SITE.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#0E1626',
    theme_color: '#0E1626',
    categories: ['games', 'entertainment'],
    icons: [
      { src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
  };
}
