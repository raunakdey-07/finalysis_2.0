import { NextRequest, NextResponse } from 'next/server';
import { fetchNSEQuote } from '@/lib/nse';
import { fetchFundamentals } from '@/lib/fundamentals';
import { getStockNews, getSentimentMix } from '@/lib/sentiment';
import { calculateMetrics, getRecommendation } from '@/lib/metrics';
import { rateLimit, getClientId, RATE_LIMITS } from '@/lib/rate-limit';
import { ApiResponse, NewsItem, StockFundamentals, StockMetrics, StockPrice } from '@/types';

type MetricsBundle = StockMetrics & {
  recommendation?: string;
  fundamentals?: StockFundamentals | null;
};

type OverviewPayload = {
  quote: {
    data: StockPrice | null;
    error?: string;
  };
  metrics: {
    data: MetricsBundle | null;
    error?: string;
  };
  news: {
    data: NewsItem[];
    error?: string;
  };
  blendedSentiment: Awaited<ReturnType<typeof getSentimentMix>> | null;
};

export async function GET(request: NextRequest) {
  const clientId = getClientId(request.headers);
  const rateLimitResult = rateLimit(`overview:${clientId}`, RATE_LIMITS.metrics);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: `Rate limit exceeded. Try again in ${rateLimitResult.resetIn}s.`,
        errorCode: 'RATE_LIMITED',
        timestamp: new Date(),
      },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.resetIn) } }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 6;

    if (!symbol) {
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: 'Symbol parameter is required',
        errorCode: 'VALIDATION_ERROR',
        timestamp: new Date(),
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const symbolUpper = symbol.toUpperCase().trim();
    if (!/^[A-Z0-9&\-.]+$/.test(symbolUpper)) {
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: 'Symbol format is invalid',
        errorCode: 'INVALID_SYMBOL_FORMAT',
        timestamp: new Date(),
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const normalizedSymbol = symbolUpper.replace(/\.NS$/i, '');

    const [quoteResult, fundamentalsResult, newsResult, sentimentResult] = await Promise.all([
      fetchNSEQuote(normalizedSymbol),
      fetchFundamentals(normalizedSymbol),
      getStockNews(normalizedSymbol, limit),
      getSentimentMix(normalizedSymbol),
    ]);

    let metrics: MetricsBundle | null = null;
    let metricsError: string | undefined;

    if (quoteResult.price && fundamentalsResult.fundamentals) {
      const calculated = calculateMetrics(fundamentalsResult.fundamentals, quoteResult.price);
      metrics = {
        ...calculated,
        recommendation: getRecommendation(calculated.overallScore),
        fundamentals: fundamentalsResult.fundamentals,
      };
    } else {
      metricsError = `Metrics unavailable for ${normalizedSymbol}.`;
    }

    const payload: OverviewPayload = {
      quote: {
        data: quoteResult.price,
        error: quoteResult.price ? undefined : `Stock quote unavailable for symbol: ${normalizedSymbol}`,
      },
      metrics: {
        data: metrics,
        error: metricsError,
      },
      news: {
        data: newsResult.items,
        error: newsResult.items.length === 0 ? 'No news available right now (live + fallback empty).' : undefined,
      },
      blendedSentiment: sentimentResult,
    };

    const response: ApiResponse<OverviewPayload> = {
      success: true,
      data: payload,
      timestamp: new Date(),
      provenance: {
        source: 'Overview aggregate: NSE + Screener + News blend',
        lastUpdated: new Date().toISOString(),
        cacheTTL: '10m / 60d / 8h',
        cacheHit: Boolean(
          quoteResult.provenance.cacheHit &&
            fundamentalsResult.provenance.cacheHit &&
            newsResult.provenance.cacheHit &&
            sentimentResult.provenance.cacheHit
        ),
        confidenceLevel: quoteResult.provenance.confidenceLevel,
        warnings: [
          ...(quoteResult.provenance.warnings || []),
          ...(fundamentalsResult.provenance.warnings || []),
          ...(newsResult.provenance.warnings || []),
          ...(sentimentResult.provenance.warnings || []),
        ],
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
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
