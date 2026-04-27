/**
 * API Route: /api/metrics
 * Get explainable metrics for a stock
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateMetrics, getRecommendation } from '@/lib/metrics';
import { fetchNSEQuote } from '@/lib/nse';
import { fetchFundamentals } from '@/lib/fundamentals';
import { rateLimit, getClientId, RATE_LIMITS } from '@/lib/rate-limit';
import { parseRequiredNseSymbol } from '@/lib/utils/symbol';
import { ApiResponse, StockFundamentals, StockMetrics } from '@/types';

export async function GET(request: NextRequest) {
  // Rate limiting
  const clientId = getClientId(request.headers);
  const rateLimitResult = rateLimit(`metrics:${clientId}`, RATE_LIMITS.metrics);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: `Rate limit exceeded. Try again in ${rateLimitResult.resetIn}s.`, errorCode: 'RATE_LIMITED', timestamp: new Date().toISOString() },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.resetIn) } }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
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

    const symbolUpper = parsedSymbol.symbol;
    
    // Fetch current price
    const { price, provenance: priceProvenance } = await fetchNSEQuote(symbolUpper);
    const { fundamentals, provenance: fundamentalsProvenance } = await fetchFundamentals(symbolUpper);

    if (!fundamentals || !price) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: `Metrics unavailable for ${symbolUpper}.`,
        errorCode: 'METRICS_UNAVAILABLE',
        timestamp: new Date().toISOString(),
        provenance: {
          source: `${priceProvenance.source} + ${fundamentalsProvenance.source}`,
          lastUpdated: priceProvenance.lastUpdated,
          cacheTTL: `${priceProvenance.cacheTTL} / ${fundamentalsProvenance.cacheTTL}`,
          cacheHit: priceProvenance.cacheHit || fundamentalsProvenance.cacheHit,
          confidenceLevel: priceProvenance.confidenceLevel,
          warnings: [
            ...(priceProvenance.warnings || []),
            ...(fundamentalsProvenance.warnings || []),
          ],
        },
      };
      return NextResponse.json(response, { status: 404 });
    }

    const metrics = calculateMetrics(fundamentals, price);
    const recommendation = getRecommendation(metrics.overallScore);

    const response: ApiResponse<StockMetrics & { recommendation: string; fundamentals: StockFundamentals }> = {
      success: true,
      data: {
        ...metrics,
        recommendation,
        fundamentals,
      },
      timestamp: new Date().toISOString(),
      provenance: {
        source: `${priceProvenance.source} + ${fundamentalsProvenance.source}`,
        lastUpdated: priceProvenance.lastUpdated,
        cacheTTL: `${priceProvenance.cacheTTL} / ${fundamentalsProvenance.cacheTTL}`,
        cacheHit: priceProvenance.cacheHit || fundamentalsProvenance.cacheHit,
        confidenceLevel: priceProvenance.confidenceLevel,
        warnings: [
          ...(priceProvenance.warnings || []),
          ...(fundamentalsProvenance.warnings || []),
        ],
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
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
