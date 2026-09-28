import { NextRequest, NextResponse } from 'next/server';
import { failure, guardRateLimit, guardSymbol } from '@/lib/api';
import { describeOutage, logDetail } from '@/lib/errors';
import {
  calculateMetrics,
  describeVerdict,
  type ScreeningVerdict,
  type StockMetrics,
} from '@/lib/metrics';
import { fetchFundamentals } from '@/lib/fundamentals';
import { fetchNSEQuote } from '@/lib/nse';
import type { ApiResponse, Provenance, StockFundamentals, StockPrice } from '@/types';

const CACHE_CONTROL = 'public, s-maxage=120, stale-while-revalidate=300';

function mergeWarnings(...sources: (Provenance['warnings'] | undefined)[]): string[] | undefined {
  const merged = sources.flatMap((source) => source ?? []);
  return merged.length > 0 ? Array.from(new Set(merged)) : undefined;
}

/** The lower of two confidence levels, so a weak source is never hidden. */
const CONFIDENCE_RANK = { unavailable: 0, low: 1, medium: 2, high: 3 } as const;

function weakest(levels: Array<keyof typeof CONFIDENCE_RANK>): keyof typeof CONFIDENCE_RANK {
  return levels.reduce((lowest, level) =>
    CONFIDENCE_RANK[level] < CONFIDENCE_RANK[lowest] ? level : lowest
  );
}

/**
 * Everything one stock overview needs: the price with its freshness, the
 * screening scores, and enough provenance for the page to be honest about what
 * it does not know.
 */
export interface MetricsPayload {
  fundamentals: StockFundamentals | null;
  metrics: StockMetrics | null;
  verdict: ScreeningVerdict | null;
  quote: StockPrice | null;
  quoteProvenance: Provenance | null;
  fundamentalsProvenance: Provenance | null;
}

export async function GET(request: NextRequest) {
  const limited = guardRateLimit(request, 'metrics');
  if (limited) return limited;

  const { symbol, error } = guardSymbol(request, { required: true });
  if (error || !symbol) return error ?? failure(400, 'Symbol is required', 'VALIDATION_ERROR');

  try {
    const [quoteResult, fundamentalsResult] = await Promise.all([
      fetchNSEQuote(symbol),
      fetchFundamentals(symbol),
    ]);

    const fundamentals = fundamentalsResult.fundamentals;
    const metrics = fundamentals ? calculateMetrics(fundamentals) : null;
    const verdict = metrics ? describeVerdict(metrics) : null;

    const warnings = mergeWarnings(
      quoteResult.provenance.warnings,
      fundamentalsResult.provenance.warnings
    );

    if (!fundamentals && !quoteResult.price) {
      const body: ApiResponse<null> = {
        success: false,
        data: null,
        error: `Nothing could be retrieved for ${symbol}.`,
        errorCode: 'DATA_UNAVAILABLE',
        timestamp: new Date().toISOString(),
        provenance: {
          source: `${quoteResult.provenance.source} + ${fundamentalsResult.provenance.source}`,
          lastUpdated: null,
          cacheTTL: '10m / 30d',
          cacheHit: false,
          confidenceLevel: 'unavailable',
          warnings,
        },
      };
      return NextResponse.json(body, { status: 503 });
    }

    const payload: MetricsPayload = {
      fundamentals,
      metrics,
      verdict,
      quote: quoteResult.price,
      quoteProvenance: quoteResult.provenance,
      fundamentalsProvenance: fundamentalsResult.provenance,
    };

    const body: ApiResponse<MetricsPayload> = {
      success: true,
      data: payload,
      timestamp: new Date().toISOString(),
      provenance: {
        source: `${quoteResult.provenance.source} + ${fundamentalsResult.provenance.source}`,
        // The price is the fastest-moving input, so it sets the headline time.
        lastUpdated: quoteResult.provenance.lastUpdated,
        cacheTTL: '10m / 30d',
        cacheHit: quoteResult.provenance.cacheHit && fundamentalsResult.provenance.cacheHit,
        confidenceLevel: !quoteResult.price
          ? 'low'
          : !fundamentals
            ? 'low'
            : weakest([
                quoteResult.provenance.confidenceLevel,
                fundamentalsResult.provenance.confidenceLevel,
              ]),
        warnings,
      },
    };

    return NextResponse.json(body, { status: 200, headers: { 'Cache-Control': CACHE_CONTROL } });
  } catch (error) {
    console.warn(logDetail('fundamentals', error));
    return failure(500, describeOutage('fundamentals', error), 'INTERNAL_ERROR');
  }
}
