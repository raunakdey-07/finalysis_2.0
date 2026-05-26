import { NextRequest, NextResponse } from 'next/server';
import { fetchNSEQuote } from '@/lib/nse';
import { fetchFundamentals } from '@/lib/fundamentals';
import { getStockNews, getSentimentMix } from '@/lib/sentiment';
import { calculateMetrics, getRecommendation } from '@/lib/metrics';
import cache from '@/lib/cache';
import { rateLimit, getClientId, RATE_LIMITS } from '@/lib/rate-limit';
import { parseRequiredNseSymbol } from '@/lib/utils/symbol';
import { ApiResponse, NewsItem, StockFundamentals, StockMetrics, StockPrice } from '@/types';

const OVERVIEW_CACHE_TTL_MS = 30_000;
const OVERVIEW_CACHE_CONTROL = 'public, max-age=30, s-maxage=60, stale-while-revalidate=300';

function parseLimit(limitParam: string | null, fallback: number, max: number): number {
  if (!limitParam) return fallback;

  const parsed = Number.parseInt(limitParam, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;

  return Math.min(parsed, max);
}


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

type OverviewCacheEntry = {
  data: OverviewPayload;
  provenance: NonNullable<ApiResponse<OverviewPayload>['provenance']>;
};

function combineConfidenceLevels(
  levels: Array<import('@/types').Provenance['confidenceLevel'] | undefined>
): import('@/types').Provenance['confidenceLevel'] {
  if (levels.some((level) => level === 'derived')) return 'derived';
  if (levels.some((level) => level === 'medium')) return 'medium';
  return 'high';
}

export async function GET(request: NextRequest) {
  const clientId = getClientId(request.headers);
  const rateLimitResult = rateLimit(`overview:${clientId}`, RATE_LIMITS.metrics);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: `Rate limit exceeded. Try again in ${rateLimitResult.resetIn}s.`,
        errorCode: 'RATE_LIMITED',
        timestamp: new Date().toISOString(),
      },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.resetIn) } }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get('limit');
    const limit = parseLimit(limitParam, 6, 30);

    const parsedSymbol = parseRequiredNseSymbol(searchParams.get('symbol'));
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
    const cacheKey = `overview:${normalizedSymbol}:${limit}`;
    const cachedOverview = cache.getEntry<OverviewCacheEntry>(cacheKey);

    if (cachedOverview) {
      const cachedData = cachedOverview.data;
      const cachedResponse: ApiResponse<OverviewPayload> = {
        success: true,
        data: cachedData.data,
        timestamp: new Date().toISOString(),
        provenance: {
          ...cachedData.provenance,
          source: `${cachedData.provenance.source} (cached)`,
          cacheHit: true,
        },
      };

      return NextResponse.json(cachedResponse, {
        status: 200,
        headers: {
          'Cache-Control': OVERVIEW_CACHE_CONTROL,
          'X-Overview-Cache': 'HIT',
        },
      });
    }

    const [quoteResult, fundamentalsResult, newsResult, sentimentResult] = await Promise.all([
      fetchNSEQuote(normalizedSymbol),
      fetchFundamentals(normalizedSymbol),
      getStockNews(normalizedSymbol, limit),
      getSentimentMix(normalizedSymbol),
    ]);

    let metrics: MetricsBundle | null = null;
    let metricsError: string | undefined;

    if (fundamentalsResult.fundamentals) {
      const calculated = calculateMetrics(fundamentalsResult.fundamentals, quoteResult.price ?? null);
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
      timestamp: new Date().toISOString(),
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
        confidenceLevel: combineConfidenceLevels([
          quoteResult.provenance.confidenceLevel,
          fundamentalsResult.provenance.confidenceLevel,
          newsResult.provenance.confidenceLevel,
          sentimentResult.provenance.confidenceLevel,
        ]),
        warnings: [
          ...(quoteResult.provenance.warnings || []),
          ...(fundamentalsResult.provenance.warnings || []),
          ...(newsResult.provenance.warnings || []),
          ...(sentimentResult.provenance.warnings || []),
        ],
      },
    };

    cache.set<OverviewCacheEntry>(
      cacheKey,
      {
        data: payload,
        provenance: response.provenance!,
      },
      OVERVIEW_CACHE_TTL_MS
    );

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': OVERVIEW_CACHE_CONTROL,
        'X-Overview-Cache': 'MISS',
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
