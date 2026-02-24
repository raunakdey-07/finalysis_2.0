import type { MetadataRoute } from 'next';
import symbolIndex from '@/data/nse_symbols.json';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://finalysis.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const symbolUrls: MetadataRoute.Sitemap = symbolIndex.slice(0, 150).map((entry) => ({
    url: `${siteUrl}/?symbol=${encodeURIComponent(entry.symbol)}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.6,
  }));

  return [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    ...symbolUrls,
  ];
}
