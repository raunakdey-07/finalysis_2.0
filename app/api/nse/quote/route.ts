import { NextRequest, NextResponse } from 'next/server';
import { failure, guardRateLimit, guardSymbol } from '@/lib/api';
import { describeOutage, logDetail } from '@/lib/errors';
import { fetchNSEQuote } from '@/lib/nse';
import type { ApiResponse, StockPrice } from '@/types';

export async function GET(request: NextRequest) {
  const limited = guardRateLimit(request, 'quote');
  if (limited) return limited;

  const { symbol, error } = guardSymbol(request, { required: true });
  if (error || !symbol) return error ?? failure(400, 'Symbol is required', 'VALIDATION_ERROR');

  try {
    const { price, provenance } = await fetchNSEQuote(symbol);

    if (!price) {
      const body: ApiResponse<null> = {
        success: false,
        data: null,
        error: `No price is available for ${symbol} right now.`,
        errorCode: 'PRICE_UNAVAILABLE',
        timestamp: new Date().toISOString(),
        provenance,
      };
      return NextResponse.json(body, { status: 503 });
    }

    const body: ApiResponse<StockPrice> = {
      success: true,
      data: price,
      timestamp: new Date().toISOString(),
      provenance,
    };

    // Edge-cached briefly, but never allowed to outlive the provider's own TTL
    // by enough to matter: a quote served from the edge is still labelled with
    // the provider timestamp it carries.
    return NextResponse.json(body, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.warn(logDetail('price', error));
    return failure(500, describeOutage('price', error), 'INTERNAL_ERROR');
  }
}
