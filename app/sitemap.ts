import type { MetadataRoute } from 'next';

/**
 * Every stock view is the same document rendered with a query parameter, and
 * the page declares a single canonical URL. Listing per-symbol URLs would
 * therefore point search engines at duplicates, so the sitemap is the
 * canonical page only.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://finalysis.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
