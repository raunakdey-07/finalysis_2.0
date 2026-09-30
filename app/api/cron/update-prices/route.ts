import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { boundedInt, failure } from '@/lib/api';
import {
  getDailyPricesSnapshot,
  isRedisConfigured,
  setDailyPricesSnapshot,
  StoredQuote,
} from '@/lib/nse/daily-prices';
import { fetchNSEQuote } from '@/lib/nse';
import { COVERED_SYMBOLS } from '@/lib/symbol-resolver';
import type { StockPrice } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * A full sweep of the covered universe does not fit in one serverless
 * invocation, and attempting it just produces a truncated snapshot that looks
 * like it succeeded. The job instead walks a slice sized to complete
 * comfortably, advances through the universe on a daily cycle, and merges each
 * slice into the stored snapshot.
 */
const DEFAULT_BATCH_SIZE = 300;
const MAX_BATCH_SIZE = 600;
const DEFAULT_CONCURRENCY = 8;
const MAX_CONCURRENCY = 12;

/** Constant-time bearer check; length is compared first to keep timing flat. */
function isAuthorised(request: NextRequest, secret: string): boolean {
  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);

  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/**
 * Which slice this run covers. Derived from the calendar day so successive runs
 * walk forward with no stored state and the schedule stays a single cron entry.
 */
function sliceOffset(batchSize: number): number {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return (dayIndex * batchSize) % COVERED_SYMBOLS.length;
}

/** The snapshot stores the quote itself; freshness is stamped when it is read. */
function withoutFreshness(price: StockPrice): StoredQuote {
  return {
    symbol: price.symbol,
    price: price.price,
    change: price.change,
    changePercent: price.changePercent,
    volume: price.volume,
    previousClose: price.previousClose,
    recentChangePercent: price.recentChangePercent,
    dayOpen: price.dayOpen,
    dayHigh: price.dayHigh,
    dayLow: price.dayLow,
    fiftyTwoWeekHigh: price.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: price.fiftyTwoWeekLow,
    quotedAt: price.quotedAt,
    fetchedAt: price.fetchedAt,
    exchangeTimezone: price.exchangeTimezone,
  };
}

async function runBatch(symbols: string[], concurrency: number): Promise<StoredQuote[]> {
  const captured: StoredQuote[] = [];
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, symbols.length) }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= symbols.length) return;

      const symbol = symbols[index];
      try {
        const { price } = await fetchNSEQuote(symbol, { allowFallbacks: false });
        if (price) captured.push(withoutFreshness(price));
      } catch (error) {
        console.warn(
          `[cron] ${symbol}:`,
          error instanceof Error ? error.message : 'unknown error'
        );
      }
    }
  });

  await Promise.all(runners);
  return captured;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // Fail closed. An unset secret must never mean "open to the internet".
  if (!secret) {
    return failure(
      503,
      'The price snapshot job is disabled because CRON_SECRET is not configured.',
      'CRON_NOT_CONFIGURED'
    );
  }

  if (!isAuthorised(request, secret)) {
    return failure(401, 'Unauthorized', 'UNAUTHORIZED');
  }

  if (!isRedisConfigured()) {
    return failure(
      503,
      'The price snapshot job needs Redis. Set KV_REDIS_URL to enable it.',
      'REDIS_NOT_CONFIGURED'
    );
  }

  try {
    const params = request.nextUrl.searchParams;
    const batchSize = boundedInt(params.get('limit'), DEFAULT_BATCH_SIZE, 1, MAX_BATCH_SIZE);
    const concurrency = boundedInt(
      params.get('concurrency'),
      DEFAULT_CONCURRENCY,
      1,
      MAX_CONCURRENCY
    );

    const offset = sliceOffset(batchSize);
    const batch: string[] = [];
    for (let index = 0; index < batchSize; index += 1) {
      batch.push(COVERED_SYMBOLS[(offset + index) % COVERED_SYMBOLS.length]);
    }

    const captured = await runBatch(batch, concurrency);
    const updatedAt = new Date().toISOString();

    const existing = await getDailyPricesSnapshot().catch(() => null);
    const items: Record<string, StoredQuote> = { ...(existing?.items ?? {}) };
    for (const quote of captured) {
      items[quote.symbol.replace(/\.NS$/i, '').toUpperCase()] = quote;
    }

    // Merge rather than overwrite, so one partial slice never erases the rest.
    await setDailyPricesSnapshot({
      updatedAt,
      source: 'Yahoo Finance close snapshot',
      totalSymbols: Object.keys(items).length,
      succeeded: captured.length,
      failed: batch.length - captured.length,
      items,
    });

    return NextResponse.json({
      success: true,
      updatedAt,
      covered: COVERED_SYMBOLS.length,
      offset,
      requested: batch.length,
      captured: captured.length,
      storedTotal: Object.keys(items).length,
    });
  } catch (error) {
    console.warn('[cron] snapshot failed:', error instanceof Error ? error.message : 'unknown');
    return failure(500, 'The price snapshot job could not complete.', 'SNAPSHOT_FAILED');
  }
}
