import type { MetadataRoute } from 'next';

import { listPublishedIds } from '@shihe/db/server';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const { poets, works } = await listPublishedIds();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/poets`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/library`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/search`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];

  return [
    ...staticRoutes,
    ...poets.map((id) => ({
      url: `${base}/poets/${id}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...works.map((id) => ({
      url: `${base}/works/${id}`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.5,
    })),
  ];
}
