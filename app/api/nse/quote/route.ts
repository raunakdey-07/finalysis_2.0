/**
 * API Route: /api/nse/quote
 * Get stock quote from NSE
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchNSEQuote } from '@/lib/nse';
import { rateLimit, getClientId, RATE_LIMITS } from '@/lib/rate-limit';
import { parseRequiredNseSymbol } from '@/lib/utils/symbol';
import { ApiResponse, StockPrice } from '@/types';

export async function GET(request: NextRequest) {
  // Rate limiting
  const clientId = getClientId(request.headers);
  const rateLimitResult = rateLimit(`quote:${clientId}`, RATE_LIMITS.quote);
  
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

    const normalizedSymbol = parsedSymbol.symbol;
    const { price, provenance } = await fetchNSEQuote(normalizedSymbol);

    if (!price) {
      const notFoundResponse: ApiResponse<null> = {
        success: false,
        data: null,
        error: `Stock quote unavailable for symbol: ${normalizedSymbol}`,
        errorCode: 'STOCK_NOT_FOUND',
        timestamp: new Date().toISOString(),
        provenance,
      };
      return NextResponse.json(notFoundResponse, { status: 404 });
    }

    const response: ApiResponse<StockPrice> = {
      success: true,
      data: price,
      timestamp: new Date().toISOString(),
      provenance,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
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
