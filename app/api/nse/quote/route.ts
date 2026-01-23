/**
 * API Route: /api/nse/quote
 * Get stock quote from NSE
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchNSEQuote } from '@/lib/nse';
import { ApiResponse, StockPrice } from '@/types';

export async function GET(request: NextRequest) {
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

    const quote = await fetchNSEQuote(symbol.toUpperCase());

    if (!quote) {
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: `Unable to fetch quote for symbol: ${symbol}`,
        timestamp: new Date(),
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const response: ApiResponse<StockPrice> = {
      success: true,
      data: quote,
      timestamp: new Date(),
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorResponse: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
