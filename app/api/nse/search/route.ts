/**
 * API Route: /api/nse/search
 * Search for stocks by keyword
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchStocks } from '@/lib/nse';
import { rateLimit, getClientId, RATE_LIMITS } from '@/lib/rate-limit';
import { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  // Rate limiting
  const clientId = getClientId(request.headers);
  const rateLimitResult = rateLimit(`search:${clientId}`, RATE_LIMITS.search);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: `Rate limit exceeded. Try again in ${rateLimitResult.resetIn}s.`, timestamp: new Date() },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.resetIn) } }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query) {
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: 'Query parameter (q) is required',
        timestamp: new Date(),
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { symbols, provenance } = await searchStocks(query);

    const response: ApiResponse<string[]> = {
      success: true,
      data: symbols,
      error: symbols.length === 0 ? 'No results from live search; check back later.' : undefined,
      timestamp: new Date(),
      provenance,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const errorResponse: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    };
    return NextResponse.json(errorResponse, { status: 200 });
  }
}
