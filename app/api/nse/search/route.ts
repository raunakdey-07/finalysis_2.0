/**
 * API Route: /api/nse/search
 * Search for stocks by keyword with human-friendly symbol resolution
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveSymbol, extractSymbol, isSymbolInSector } from '@/lib/symbol-resolver';
import { rateLimit, getClientId, RATE_LIMITS } from '@/lib/rate-limit';
import { ApiResponse, StockSearchSuggestion } from '@/types';

const SEARCH_CACHE_CONTROL = 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400';

function toSuggestion(payload: {
  symbol: string;
  name: string;
  sector: string;
  industry?: string;
}): StockSearchSuggestion {
  return {
    symbol: payload.symbol,
    displaySymbol: payload.symbol.replace(/\.NS$/i, ''),
    name: payload.name,
    sector: payload.sector,
    industry: payload.industry,
  };
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const clientId = getClientId(request.headers);
  const rateLimitResult = rateLimit(`search:${clientId}`, RATE_LIMITS.search);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: `Rate limit exceeded. Try again in ${rateLimitResult.resetIn}s.`, errorCode: 'RATE_LIMITED', timestamp: new Date().toISOString() },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.resetIn) } }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const sector = searchParams.get('sector') ?? undefined;

    if (!query) {
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: 'Query parameter (q) is required',
        errorCode: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: 'Please enter at least 2 characters to search.',
        errorCode: 'QUERY_TOO_SHORT',
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Step 1: Try to extract a direct symbol (handles "ITC.NS", "ITC", etc.)
    const directSymbol = extractSymbol(normalizedQuery);
    if (directSymbol) {
      if (!isSymbolInSector(directSymbol, sector)) {
        const notInSectorResponse: ApiResponse<StockSearchSuggestion[]> = {
          success: false,
          data: [],
          error: `No matching stocks found in sector "${sector}" for this query.`,
          errorCode: 'STOCK_NOT_FOUND',
          timestamp: new Date().toISOString(),
          provenance: {
            source: 'Local symbol index (sector filter)',
            lastUpdated: new Date().toISOString(),
            cacheTTL: 'static',
            confidenceLevel: 'high',
          },
        };

        return NextResponse.json(notInSectorResponse, {
          status: 404,
          headers: { 'Cache-Control': SEARCH_CACHE_CONTROL },
        });
      }

      const directMatch = resolveSymbol(directSymbol);
      const name = directMatch.name ?? directSymbol.replace(/\.NS$/i, '');
      const resolvedSector = directMatch.sector ?? 'Other';
      const resolvedIndustry = directMatch.industry;

      const response: ApiResponse<StockSearchSuggestion[]> = {
        success: true,
        data: [toSuggestion({ symbol: directSymbol, name, sector: resolvedSector, industry: resolvedIndustry })],
        message: `Showing results for ${name}`,
        timestamp: new Date().toISOString(),
        provenance: {
          source: 'Local symbol index (exact match)',
          lastUpdated: new Date().toISOString(),
          cacheTTL: 'static',
          confidenceLevel: 'high',
        },
      };
      return NextResponse.json(response, {
        status: 200,
        headers: { 'Cache-Control': SEARCH_CACHE_CONTROL },
      });
    }

    // Step 2: Resolve human-friendly input (e.g., "Bajaj Housing Finance")
    const resolution = resolveSymbol(normalizedQuery, {
      sector,
      limit: 5,
    });

    if (resolution.type === 'exact' || resolution.type === 'confident') {
      // Single confident match
      const response: ApiResponse<StockSearchSuggestion[]> = {
        success: true,
        data:
          resolution.symbol && resolution.name && resolution.sector
            ? [
                toSuggestion({
                  symbol: resolution.symbol,
                  name: resolution.name,
                  sector: resolution.sector,
                  industry: resolution.industry,
                }),
              ]
            : [],
        message: resolution.message,
        timestamp: new Date().toISOString(),
        provenance: {
          source: 'Local symbol index (name/alias match + sector filter)',
          lastUpdated: new Date().toISOString(),
          cacheTTL: 'static',
          confidenceLevel: resolution.type === 'exact' ? 'high' : 'high',
        },
      };
      return NextResponse.json(response, {
        status: 200,
        headers: { 'Cache-Control': SEARCH_CACHE_CONTROL },
      });
    }

    if (resolution.type === 'suggestions') {
      // Multiple candidates - return them as suggestions
      const suggestions = resolution.suggestions?.map((s) => toSuggestion(s)) ?? [];
      const response: ApiResponse<StockSearchSuggestion[]> = {
        success: true,
        data: suggestions,
        error: resolution.message,
        errorCode: 'MULTIPLE_MATCHES',
        message: resolution.message,
        timestamp: new Date().toISOString(),
        provenance: {
          source: 'Local symbol index (multiple matches + sector filter)',
          lastUpdated: new Date().toISOString(),
          cacheTTL: 'static',
          confidenceLevel: 'medium',
        },
      };
      return NextResponse.json(response, {
        status: 200,
        headers: { 'Cache-Control': SEARCH_CACHE_CONTROL },
      });
    }

    const notFoundResponse: ApiResponse<StockSearchSuggestion[]> = {
      success: false,
      data: [],
      error: resolution.message ?? 'No matching stocks found for this query.',
      errorCode: 'STOCK_NOT_FOUND',
      timestamp: new Date().toISOString(),
      provenance: {
        source: 'Local symbol index (no external fallback)',
        lastUpdated: new Date().toISOString(),
        cacheTTL: 'static',
        confidenceLevel: 'high',
      },
    };

    return NextResponse.json(notFoundResponse, {
      status: 404,
      headers: { 'Cache-Control': SEARCH_CACHE_CONTROL },
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
