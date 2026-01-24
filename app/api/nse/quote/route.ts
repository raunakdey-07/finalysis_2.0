/**
 * API Route: /api/nse/quote
 * Get stock quote from NSE
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchNSEQuote } from '@/lib/nse';
import { rateLimit, getClientId, RATE_LIMITS } from '@/lib/rate-limit';
import { ApiResponse, StockPrice } from '@/types';

export async function GET(request: NextRequest) {
  // Rate limiting
  const clientId = getClientId(request.headers);
  const rateLimitResult = rateLimit(`quote:${clientId}`, RATE_LIMITS.quote);
  
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

    const { price, provenance } = await fetchNSEQuote(symbol.toUpperCase());

    const response: ApiResponse<StockPrice | null> = {
      success: true,
      data: price,
      error: price ? undefined : `Unable to fetch live quote for symbol: ${symbol}`,
      timestamp: new Date(),
      provenance,
    };

    return NextResponse.json(response, { status: price ? 200 : 200 });
  } catch (error) {
    const errorResponse: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    };
    return NextResponse.json(errorResponse, { status: 200 });
  }
}
