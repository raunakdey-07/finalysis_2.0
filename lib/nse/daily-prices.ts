import { createClient } from 'redis';
import { StockPrice } from '@/types';

export const DAILY_PRICES_KEY = 'prices:daily:v1';

/** A quote as stored, before the reader stamps how it was retrieved. */
export type StoredQuote = Omit<StockPrice, 'freshness'>;

export type DailyPricesSnapshot = {
  updatedAt: string;
  source: string;
  totalSymbols: number;
  succeeded: number;
  failed: number;
  items: Record<string, StoredQuote>;
};

/**
 * The snapshot is a rotating refresh of the covered universe, so an individual
 * symbol is only re-fetched every few weeks. The window has to admit that, and
 * every quote carries its own capture time so the page can say how old it is.
 * Nothing here is ever presented as a live price.
 */
export const MAX_SNAPSHOT_AGE_MS = 21 * 24 * 60 * 60 * 1000;

type RedisClient = ReturnType<typeof createClient>;

let redisClientPromise: Promise<RedisClient> | null = null;

export function getRedisUrl(): string | null {
  return process.env.KV_REDIS_URL || process.env.REDIS_URL || null;
}

export function isRedisConfigured(): boolean {
  return Boolean(getRedisUrl());
}

async function getRedisClient(): Promise<RedisClient> {
  if (!redisClientPromise) {
    const url = getRedisUrl();
    if (!url) {
      throw new Error('Redis is not configured. Set KV_REDIS_URL to enable the daily close snapshot.');
    }

    const client = createClient({ url });
    client.on('error', () => undefined);

    redisClientPromise = client.connect().then(() => client).catch((err) => {
      redisClientPromise = null;
      throw err;
    });
  }

  return redisClientPromise;
}

function isStoredQuote(value: unknown): value is StoredQuote {
  if (!value || typeof value !== 'object') return false;
  const quote = value as Partial<StoredQuote>;

  if (typeof quote.price !== 'number' || !Number.isFinite(quote.price) || quote.price <= 0) return false;
  if (typeof quote.fetchedAt !== 'string' || Number.isNaN(Date.parse(quote.fetchedAt))) return false;

  // Every remaining numeric field is optional in the type, so a payload that
  // puts a string where a number belongs has to be rejected rather than cast.
  const optionalNumbers = [
    'change',
    'changePercent',
    'recentChangePercent',
    'volume',
    'previousClose',
    'dayOpen',
    'dayHigh',
    'dayLow',
    'fiftyTwoWeekHigh',
    'fiftyTwoWeekLow',
  ] as const;

  for (const key of optionalNumbers) {
    const entry = quote[key];
    if (entry === null || entry === undefined) continue;
    if (typeof entry !== 'number' || !Number.isFinite(entry)) return false;
  }

  for (const key of ['quotedAt', 'exchangeTimezone'] as const) {
    const entry = quote[key];
    if (entry === null || entry === undefined) continue;
    if (typeof entry !== 'string') return false;
  }

  return true;
}

/**
 * Read the daily close snapshot. The payload is untrusted: it is whatever the
 * last cron run managed to write, so every entry is shape-checked before use
 * and anything unrecognised is treated as missing.
 */
export async function getDailyPricesSnapshot(): Promise<DailyPricesSnapshot | null> {
  if (!isRedisConfigured()) return null;

  let raw: string | null;
  try {
    const client = await getRedisClient();
    raw = await client.get(DAILY_PRICES_KEY);
  } catch {
    return null;
  }

  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const candidate = parsed as Partial<DailyPricesSnapshot>;
    if (typeof candidate.updatedAt !== 'string') return null;
    if (Number.isNaN(Date.parse(candidate.updatedAt))) return null;
    if (!candidate.items || typeof candidate.items !== 'object') return null;

    const items: Record<string, StoredQuote> = {};
    for (const [symbol, quote] of Object.entries(candidate.items)) {
      if (isStoredQuote(quote)) items[symbol] = quote;
    }

    const keys = Object.keys(items);

    return {
      updatedAt: candidate.updatedAt,
      source: typeof candidate.source === 'string' ? candidate.source : 'Daily close snapshot',
      totalSymbols: keys.length,
      succeeded: keys.length,
      failed: 0,
      items,
    };
  } catch {
    return null;
  }
}

export async function setDailyPricesSnapshot(snapshot: DailyPricesSnapshot): Promise<void> {
  if (!isRedisConfigured()) {
    throw new Error('Redis is not configured. Set KV_REDIS_URL to enable the daily close snapshot.');
  }

  const client = await getRedisClient();
  // Keep the key comfortably longer than the reader-facing window, so a missed
  // cron run does not silently delete the fallback. The reader enforces the
  // usable age per symbol regardless.
  await client.set(DAILY_PRICES_KEY, JSON.stringify(snapshot), {
    EX: Math.ceil((MAX_SNAPSHOT_AGE_MS / 1000) * 1.5),
  });
}
