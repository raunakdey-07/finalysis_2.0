/**
 * Shared request handling for the public API routes.
 *
 * Every route applies the same three gates in the same order: rate limit,
 * symbol format, then membership of the covered universe. Keeping that in one
 * place means an unknown or abusive ticker costs a map lookup, not a scrape of
 * a third-party site.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClientId, RATE_LIMITS, rateLimit } from '@/lib/rate-limit';
import { increment } from '@/lib/observability/metrics';
import '@/lib/observability/definitions';
import { COVERED_SYMBOL_COUNT, isKnownSymbol } from '@/lib/symbol-resolver';
import { parseRequiredNseSymbol } from '@/lib/utils/symbol';
import type { ApiResponse } from '@/types';

export type EndpointName = keyof typeof RATE_LIMITS;

export function failure(
  status: number,
  error: string,
  errorCode: string,
  extraHeaders?: Record<string, string>
): NextResponse<ApiResponse<null>> {
  const body: ApiResponse<null> = {
    success: false,
    data: null,
    error,
    errorCode,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, { status, headers: extraHeaders });
}

export function guardRateLimit(request: NextRequest, endpoint: EndpointName): NextResponse | null {
  const clientId = getClientId(request.headers);
  const result = rateLimit(`${endpoint}:${clientId}`, RATE_LIMITS[endpoint]);

  if (result.success) return null;

  increment('finalysis_rate_limited_total', { endpoint });

  return failure(
    429,
    `Too many requests. Try again in ${result.resetIn} seconds.`,
    'RATE_LIMITED',
    { 'Retry-After': String(result.resetIn) }
  );
}

/**
 * Validate the `symbol` query parameter and confirm it is one we cover.
 * Returns the normalised ticker, or a ready-to-return error response.
 */
export function guardSymbol(
  request: NextRequest,
  options: { required: boolean }
): { symbol: string | null; error: NextResponse | null } {
  const raw = request.nextUrl.searchParams.get('symbol');

  if (!raw && !options.required) {
    return { symbol: null, error: null };
  }

  const parsed = parseRequiredNseSymbol(raw);
  if (!parsed.success) {
    return {
      symbol: null,
      error: failure(400, parsed.error, parsed.errorCode),
    };
  }

  if (!isKnownSymbol(parsed.symbol)) {
    return {
      symbol: null,
      error: failure(
        404,
        `${parsed.symbol} is not one of the ${COVERED_SYMBOL_COUNT} NSE tickers Finalysis covers.`,
        'UNKNOWN_SYMBOL'
      ),
    };
  }

  return { symbol: parsed.symbol, error: null };
}

/** Bound a caller-supplied count so a single request cannot fan out. */
export function boundedInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw === null || raw.trim() === '') return fallback;

  // parseInt would accept "5abc" as 5, which would let a malformed value slip
  // past the bound on the strength of its leading digits.
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(max, Math.max(min, Math.floor(parsed)));
}
