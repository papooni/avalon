import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    // Rooms are private, short-lived game sessions; keep them out of search results.
    rules: [{ userAgent: '*', allow: '/', disallow: ['/room/', '/demo', '/api/', '/ws/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
