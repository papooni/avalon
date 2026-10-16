import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/rules`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/create`, lastModified, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE_URL}/join`, lastModified, changeFrequency: 'yearly', priority: 0.5 },
  ];
}
