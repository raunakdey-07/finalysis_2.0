import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import { fetchNSEQuote } from '@/lib/nse';
import { setDailyPricesSnapshot } from '@/lib/nse/daily-prices';
import { StockPrice } from '@/types';

type StockEntry = { symbol: string };

type QuoteResult = {
  symbol: string;
  price: StockPrice | null;
};

export const runtime = 'nodejs';
export const maxDuration = 300;

const DEFAULT_CONCURRENCY = 6;

function normalizeSymbol(raw: string): string {
  return raw.toUpperCase().trim().replace(/\.NS$/i, '');
}

function parseNumberParam(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function loadSymbols(): Promise<string[]> {
  const filePath = path.join(process.cwd(), 'data', 'stocks.json');
  const raw = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as StockEntry[];

  const symbols = new Set<string>();
  for (const entry of parsed) {
    if (!entry.symbol) continue;
    symbols.add(normalizeSymbol(entry.symbol));
  }

  return Array.from(symbols);
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: limit }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function GET(request: NextRequest) {
  const start = Date.now();

  try {
    const cronSecret = process.env.CRON_SECRET;
    const vercelCron = request.headers.get('x-vercel-cron') === '1';
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (!vercelCron && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    const searchParams = request.nextUrl.searchParams;
    const limitParam = parseNumberParam(searchParams.get('limit'));
    const envLimit = parseNumberParam(process.env.PRICE_SNAPSHOT_LIMIT ?? null);
    const requestedLimit = limitParam ?? envLimit;

    const concurrencyParam = parseNumberParam(searchParams.get('concurrency'));
    const envConcurrency = parseNumberParam(process.env.PRICE_SNAPSHOT_CONCURRENCY ?? null);
    const concurrency = concurrencyParam ?? envConcurrency ?? DEFAULT_CONCURRENCY;

    const symbols = await loadSymbols();
    const targetSymbols = requestedLimit ? symbols.slice(0, requestedLimit) : symbols;

    const results = await runWithConcurrency(targetSymbols, concurrency, async (symbol) => {
      const { price } = await fetchNSEQuote(symbol, { allowSnapshot: false });
      return { symbol, price } as QuoteResult;
    });

    const items: Record<string, StockPrice> = {};
    const failures: string[] = [];

    for (const result of results) {
      if (result.price) {
        const price = result.price;
        items[result.symbol] = {
          symbol: price.symbol,
          price: price.price,
          change: price.change,
          changePercent: price.changePercent,
          daily_change_percent: price.daily_change_percent,
          volume: price.volume,
          previousClose: price.previousClose,
          timestamp: price.timestamp,
        };
      } else {
        failures.push(result.symbol);
      }
    }

    const snapshot = {
      updatedAt: new Date().toISOString(),
      source: 'NSE close snapshot',
      totalSymbols: targetSymbols.length,
      succeeded: Object.keys(items).length,
      failed: failures.length,
      items,
    };

    const snapshotSizeBytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');

    await setDailyPricesSnapshot(snapshot);

    return NextResponse.json({
      success: true,
      updatedAt: snapshot.updatedAt,
      totalSymbols: snapshot.totalSymbols,
      succeeded: snapshot.succeeded,
      failed: snapshot.failed,
      snapshotSizeBytes,
      durationMs: Date.now() - start,
      failuresSample: failures.slice(0, 20),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Snapshot update failed',
        durationMs: Date.now() - start,
      },
      { status: 500 }
    );
  }
}
