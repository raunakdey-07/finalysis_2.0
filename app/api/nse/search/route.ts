import { NextRequest, NextResponse } from 'next/server';
import { guardRateLimit } from '@/lib/api';
import { extractSymbol, isSymbolInSector, resolveSymbol } from '@/lib/symbol-resolver';
import type { ApiResponse, StockSearchSuggestion } from '@/types';

const MIN_QUERY_LENGTH = 2;
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

function respond(body: ApiResponse<StockSearchSuggestion[]>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': SEARCH_CACHE_CONTROL } });
}

function provenanceFor(message: string, level: 'high' | 'medium') {
  return {
    source: message,
    lastUpdated: null,
    cacheTTL: 'static',
    cacheHit: false,
    confidenceLevel: level,
  } as const;
}

/**
 * Search runs entirely against the checked-in ticker dataset, so it works with
 * no network at all. A miss is a normal 200 answer with an empty list and an
 * explanation, not a 404.
 */
export async function GET(request: NextRequest) {
  const limited = guardRateLimit(request, 'search');
  if (limited) return limited;

  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const sector = request.nextUrl.searchParams.get('sector') ?? undefined;

  if (query.length < MIN_QUERY_LENGTH) {
    return respond(
      {
        success: false,
        data: [],
        error: `Enter at least ${MIN_QUERY_LENGTH} characters to search.`,
        errorCode: 'QUERY_TOO_SHORT',
        timestamp: new Date().toISOString(),
      },
      400
    );
  }

  const directSymbol = extractSymbol(query);

  if (directSymbol) {
    if (!isSymbolInSector(directSymbol, sector)) {
      return respond({
        success: true,
        data: [],
        error: `${directSymbol.replace(/\.NS$/i, '')} is not in the sector you picked.`,
        errorCode: 'SECTOR_FILTERED',
        message: 'Filtered out by sector',
        timestamp: new Date().toISOString(),
        provenance: provenanceFor('Local ticker dataset (sector filtered)', 'high'),
      });
    }

    const resolved = resolveSymbol(directSymbol);
    const name = resolved.name ?? directSymbol.replace(/\.NS$/i, '');

    return respond({
      success: true,
      data: [
        toSuggestion({
          symbol: directSymbol,
          name,
          sector: resolved.sector ?? 'Other',
          industry: resolved.industry,
        }),
      ],
      message: `Showing ${name}`,
      timestamp: new Date().toISOString(),
      provenance: provenanceFor('Local ticker dataset (exact ticker)', 'high'),
    });
  }

  const resolution = resolveSymbol(query, { sector, limit: 5 });

  if (resolution.type === 'exact' || resolution.type === 'confident') {
    const suggestion =
      resolution.symbol && resolution.name && resolution.sector
        ? toSuggestion({
            symbol: resolution.symbol,
            name: resolution.name,
            sector: resolution.sector,
            industry: resolution.industry,
          })
        : null;

    return respond({
      success: true,
      data: suggestion ? [suggestion] : [],
      message: resolution.message,
      timestamp: new Date().toISOString(),
      provenance: provenanceFor('Local ticker dataset (name or alias match)', 'high'),
    });
  }

  if (resolution.type === 'suggestions') {
    return respond({
      success: true,
      data: (resolution.suggestions ?? []).map(toSuggestion),
      error: resolution.message,
      errorCode: 'MULTIPLE_MATCHES',
      message: resolution.message,
      timestamp: new Date().toISOString(),
      provenance: provenanceFor('Local ticker dataset (several matches)', 'medium'),
    });
  }

  return respond({
    success: true,
    data: [],
    error:
      resolution.message ??
      `No covered NSE ticker matches "${query}". Fin-alysis only lists the companies in its own dataset.`,
    errorCode: 'NOT_IN_DATASET',
    timestamp: new Date().toISOString(),
    provenance: provenanceFor('Local ticker dataset (no match)', 'high'),
  });
}
