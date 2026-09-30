import { NextRequest, NextResponse } from 'next/server';
import { boundedInt, failure, guardRateLimit, guardSymbol } from '@/lib/api';
import { logDetail } from '@/lib/errors';
import { getNews, MAX_ARTICLES, type ToneReading } from '@/lib/sentiment';
import { buildResearchLinks } from '@/lib/research-links';
import { getSymbolEntry } from '@/lib/symbol-resolver';
import type { ApiResponse, NewsItem } from '@/types';

export interface NewsPayload {
  items: NewsItem[];
  /**
   * The reading, not a copy of it. This shape was hand-written, so adding a
   * field to the reading left the API still advertising the old one.
   */
  tone: ToneReading;
}

export async function GET(request: NextRequest) {
  const limited = guardRateLimit(request, 'news');
  if (limited) return limited;

  const { symbol, error } = guardSymbol(request, { required: false });
  if (error) return error;

  const limit = boundedInt(request.nextUrl.searchParams.get('limit'), MAX_ARTICLES, 1, MAX_ARTICLES);

  try {
    const entry = symbol ? getSymbolEntry(symbol) : null;
    const context = symbol
      ? {
          symbol,
          companyName: entry?.name ?? null,
          aliases: entry?.aliases ?? [],
        }
      : null;

    const result = await getNews(context);

    const retrieved = result.items;

    // Placeholder links are offered only when there is nothing real to show,
    // and they are always flagged so the page can label them as links.
    const items: NewsItem[] =
      retrieved.length === 0 && symbol
        ? buildResearchLinks(symbol, entry?.name ?? null)
            .slice(0, 4)
            .map((link) => ({
              id: `link-${link.href}`,
              title: link.label,
              link: link.href,
              pubDate: new Date().toISOString(),
              source: link.source,
              synthetic: true,
            }))
        : retrieved.slice(0, limit);

    const body: ApiResponse<NewsPayload> = {
      success: true,
      data: { items, tone: result.tone },
      timestamp: new Date().toISOString(),
      provenance: result.provenance,
    };

    return NextResponse.json(body, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.warn(logDetail('news', error));
    return failure(500, 'News coverage could not be retrieved right now.', 'INTERNAL_ERROR');
  }
}
