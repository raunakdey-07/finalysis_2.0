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
      { success: false, error: `Rate limit exceeded. Try again in ${rateLimitResult.resetIn}s.`, errorCode: 'RATE_LIMITED', timestamp: new Date() },
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
    const { price, provenance } = await fetchNSEQuote(normalizedSymbol);

    if (!price) {
      const notFoundResponse: ApiResponse<null> = {
        success: false,
        data: null,
        error: `Stock quote unavailable for symbol: ${normalizedSymbol}`,
        errorCode: 'STOCK_NOT_FOUND',
        timestamp: new Date(),
        provenance,
      };
      return NextResponse.json(notFoundResponse, { status: 404 });
    }

    const response: ApiResponse<StockPrice> = {
      success: true,
      data: price,
      timestamp: new Date(),
      provenance,
    };

    return NextResponse.json(response, { status: 200 });
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
