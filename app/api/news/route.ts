/**
 * API Route: /api/news
 * Get news with sentiment analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchNews, getStockNews, getSentimentMix } from '@/lib/sentiment';
import { rateLimit, getClientId, RATE_LIMITS } from '@/lib/rate-limit';
import { ApiResponse, NewsItem } from '@/types';

export async function GET(request: NextRequest) {
  // Rate limiting
  const clientId = getClientId(request.headers);
  const rateLimitResult = rateLimit(`news:${clientId}`, RATE_LIMITS.news);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: `Rate limit exceeded. Try again in ${rateLimitResult.resetIn}s.`, errorCode: 'RATE_LIMITED', timestamp: new Date() },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.resetIn) } }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const limitParam = searchParams.get('limit');
    const type = searchParams.get('type');
    
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    if (type === 'sentiment') {
      const sentiment = await getSentimentMix(symbol?.toUpperCase());
      const response: ApiResponse<typeof sentiment> = {
        success: true,
        data: sentiment,
        message: symbol ? `Blended sentiment for ${symbol.toUpperCase()} computed.` : 'Market sentiment computed.',
        timestamp: new Date(),
        provenance: sentiment.provenance,
      };
      return NextResponse.json(response, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800',
        },
      });
    }

    const { items, provenance } = symbol
      ? await getStockNews(symbol.toUpperCase(), limit)
      : await fetchNews(limit);

    const response: ApiResponse<NewsItem[]> = {
      success: true,
      data: items,
      error: items.length === 0 ? 'No news available right now (live + fallback empty).' : undefined,
      timestamp: new Date(),
      provenance,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800',
      },
    });
  } catch (error) {
    const errorResponse: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      errorCode: 'INTERNAL_ERROR',
      timestamp: new Date(),
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
