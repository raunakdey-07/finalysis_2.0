/**
 * API Route: /api/metrics
 * Get explainable metrics for a stock
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateMetrics, getRecommendation } from '@/lib/metrics';
import { fetchNSEQuote } from '@/lib/nse';
import { fetchFundamentals } from '@/lib/fundamentals';
import { rateLimit, getClientId, RATE_LIMITS } from '@/lib/rate-limit';
import { ApiResponse, StockFundamentals, StockMetrics } from '@/types';

/**
 * Get mock fundamental data for demonstration
 * 
 * NOTE: This returns MOCK DATA for development/demo purposes only
 * In production, replace with actual data from:
 * 1. Screener.in API (unofficial but widely used)
 * 2. MoneyControl data (web scraping)
 * 3. BSE/NSE annual reports (manual/automated extraction)
 * 4. Commercial data providers
 * 
 * @param symbol - Stock symbol
 * @returns Mock fundamental data
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const clientId = getClientId(request.headers);
  const rateLimitResult = rateLimit(`metrics:${clientId}`, RATE_LIMITS.metrics);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: `Rate limit exceeded. Try again in ${rateLimitResult.resetIn}s.`, timestamp: new Date() },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.resetIn) } }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: 'Symbol parameter is required',
        timestamp: new Date(),
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const symbolUpper = symbol.toUpperCase();
    
    // Fetch current price
    const { price, provenance: priceProvenance } = await fetchNSEQuote(symbolUpper);
    const { fundamentals, provenance: fundamentalsProvenance } = await fetchFundamentals(symbolUpper);

    if (!fundamentals || !price) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: `Metrics unavailable for ${symbolUpper}.`,
        timestamp: new Date(),
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
      timestamp: new Date(),
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

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const errorResponse: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
