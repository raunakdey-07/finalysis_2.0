/**
 * API Route: /api/nse/search
 * Search for stocks by keyword with human-friendly symbol resolution
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchStocks } from '@/lib/nse';
import { resolveSymbol, extractSymbol } from '@/lib/symbol-resolver';
import { rateLimit, getClientId, RATE_LIMITS } from '@/lib/rate-limit';
import { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  // Rate limiting
  const clientId = getClientId(request.headers);
  const rateLimitResult = rateLimit(`search:${clientId}`, RATE_LIMITS.search);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: `Rate limit exceeded. Try again in ${rateLimitResult.resetIn}s.`, errorCode: 'RATE_LIMITED', timestamp: new Date() },
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
        errorCode: 'VALIDATION_ERROR',
        timestamp: new Date(),
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: 'Please enter at least 2 characters to search.',
        errorCode: 'QUERY_TOO_SHORT',
        timestamp: new Date(),
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Step 1: Try to extract a direct symbol (handles "ITC.NS", "ITC", etc.)
    const directSymbol = extractSymbol(normalizedQuery);
    if (directSymbol) {
      const directMatch = resolveSymbol(directSymbol);
      const response: ApiResponse<string[]> = {
        success: true,
        data: [directSymbol],
        message: directMatch.name ? `Showing results for ${directMatch.name}` : `Showing results for ${directSymbol}`,
        timestamp: new Date(),
        provenance: {
          source: 'Local symbol index (exact match)',
          lastUpdated: new Date().toISOString(),
          cacheTTL: 'static',
          confidenceLevel: 'high',
        },
      };
      return NextResponse.json(response, { status: 200 });
    }

    // Step 2: Resolve human-friendly input (e.g., "Bajaj Housing Finance")
    const resolution = resolveSymbol(normalizedQuery);

    if (resolution.type === 'exact' || resolution.type === 'confident') {
      // Single confident match
      const response: ApiResponse<string[]> = {
        success: true,
        data: resolution.symbol ? [resolution.symbol] : [],
        message: resolution.message,
        timestamp: new Date(),
        provenance: {
          source: 'Local symbol index (name/alias match)',
          lastUpdated: new Date().toISOString(),
          cacheTTL: 'static',
          confidenceLevel: resolution.type === 'exact' ? 'high' : 'high',
        },
      };
      return NextResponse.json(response, { status: 200 });
    }

    if (resolution.type === 'suggestions') {
      // Multiple candidates - return them as suggestions
      const symbols = resolution.suggestions?.map(s => s.symbol) ?? [];
      const response: ApiResponse<string[]> = {
        success: true,
        data: symbols,
        error: resolution.message,
        errorCode: 'MULTIPLE_MATCHES',
        message: resolution.message,
        timestamp: new Date(),
        provenance: {
          source: 'Local symbol index (multiple matches)',
          lastUpdated: new Date().toISOString(),
          cacheTTL: 'static',
          confidenceLevel: 'medium',
        },
      };
      return NextResponse.json(response, { status: 200 });
    }

    // Step 3: Fall back to live NSE search if local resolution found nothing
    const { symbols, provenance } = await searchStocks(normalizedQuery);

    if (symbols.length === 0) {
      const notFoundResponse: ApiResponse<string[]> = {
        success: false,
        data: [],
        error: 'No matching stocks found for this query.',
        errorCode: 'STOCK_NOT_FOUND',
        timestamp: new Date(),
        provenance,
      };
      return NextResponse.json(notFoundResponse, { status: 404 });
    }

    const response: ApiResponse<string[]> = {
      success: true,
      data: symbols,
      message: symbols.length > 0 ? `Showing results for ${symbols[0]}` : undefined,
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
