/**
 * API Route: /api/news
 * Get news with sentiment analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchNews, fetchNewsPreview, getStockNews, getStockNewsLive, getStockNewsPreview, getSentimentMix } from '@/lib/sentiment';
import { rateLimit, getClientId, RATE_LIMITS } from '@/lib/rate-limit';
import { parseOptionalNseSymbol } from '@/lib/utils/symbol';
import { ApiResponse, NewsItem } from '@/types';

function parseLimit(limitParam: string | null, fallback: number, max: number): number {
  if (!limitParam) return fallback;
  const parsed = Number.parseInt(limitParam, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const clientId = getClientId(request.headers);
  const rateLimitResult = rateLimit(`news:${clientId}`, RATE_LIMITS.news);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: `Rate limit exceeded. Try again in ${rateLimitResult.resetIn}s.`, errorCode: 'RATE_LIMITED', timestamp: new Date().toISOString() },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.resetIn) } }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const limitParam = searchParams.get('limit');
    const type = searchParams.get('type');
    const mode = searchParams.get('mode');
    const isFastMode = mode === 'fast';

    const limit = parseLimit(limitParam, 20, 50);
    const parsedSymbol = parseOptionalNseSymbol(symbol);

    if (!parsedSymbol.success) {
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: parsedSymbol.error,
        errorCode: parsedSymbol.errorCode,
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const normalizedSymbol = parsedSymbol.symbol;

    if (type === 'sentiment') {
      const sentiment = await getSentimentMix(normalizedSymbol ?? undefined);
      const response: ApiResponse<typeof sentiment> = {
        success: true,
        data: sentiment,
        message: normalizedSymbol ? `Blended sentiment for ${normalizedSymbol} computed.` : 'Market sentiment computed.',
        timestamp: new Date().toISOString(),
        provenance: sentiment.provenance,
      };
      return NextResponse.json(response, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800',
        },
      });
    }

    let itemsResult = normalizedSymbol
      ? isFastMode
        ? await getStockNewsPreview(normalizedSymbol, limit)
        : mode === 'live'
          ? await getStockNewsLive(normalizedSymbol, limit)
          : await getStockNews(normalizedSymbol, limit)
      : isFastMode
        ? await fetchNewsPreview(limit)
        : await fetchNews(limit);

    if (normalizedSymbol && mode === 'live' && itemsResult.items.length === 0) {
      const fallbackResult = await getStockNews(normalizedSymbol, limit);
      if (fallbackResult.items.length > 0) {
        itemsResult = fallbackResult;
      }
    }

    const { items, provenance } = itemsResult;

    const response: ApiResponse<NewsItem[]> = {
      success: true,
      data: items,
      error: items.length === 0 ? 'No news available right now (live + fallback empty).' : undefined,
      timestamp: new Date().toISOString(),
      provenance,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': isFastMode
          ? 'public, s-maxage=30, stale-while-revalidate=300'
          : 'public, s-maxage=300, stale-while-revalidate=1800',
      },
    });
  } catch (error) {
    const errorResponse: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      errorCode: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
