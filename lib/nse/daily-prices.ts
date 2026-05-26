import { createClient } from 'redis';
import { StockPrice } from '@/types';

export const DAILY_PRICES_KEY = 'prices:daily:v1';

export type DailyPricesSnapshot = {
  updatedAt: string;
  source: string;
  totalSymbols: number;
  succeeded: number;
  failed: number;
  items: Record<string, StockPrice>;
};

type RedisClient = ReturnType<typeof createClient>;

let redisClientPromise: Promise<RedisClient> | null = null;

function getRedisUrl(): string | null {
  return process.env.KV_REDIS_URL || process.env.REDIS_URL || null;
}

function isRedisConfigured(): boolean {
  return Boolean(getRedisUrl());
}

async function getRedisClient(): Promise<RedisClient> {
  if (!redisClientPromise) {
    const url = getRedisUrl();
    if (!url) {
      throw new Error('Redis URL is not configured');
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

export async function getDailyPricesSnapshot(): Promise<DailyPricesSnapshot | null> {
  if (!isRedisConfigured()) return null;

  try {
    const client = await getRedisClient();
    const raw = await client.get(DAILY_PRICES_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DailyPricesSnapshot;
  } catch {
    return null;
  }
}

export async function setDailyPricesSnapshot(snapshot: DailyPricesSnapshot): Promise<void> {
  if (!isRedisConfigured()) {
    throw new Error('Redis is not configured');
  }

  const client = await getRedisClient();
  await client.set(DAILY_PRICES_KEY, JSON.stringify(snapshot));
}
