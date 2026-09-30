/**
 * Process-local cache with TTL, size bounds, and single-flight loading.
 *
 * This is deliberately NOT a shared cache. On a serverless platform each
 * instance holds its own copy, so a TTL here means "this many minutes per
 * instance", not the same window globally. Callers must treat a miss as normal
 * and must never treat a hit as a guarantee of freshness beyond its own
 * timestamp.
 */

import { CacheEntry } from '@/types';

/** Roughly a few minutes of typical traffic; prevents unbounded growth per instance. */
const MAX_ENTRIES = 5_000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function unrefTimer(timer: ReturnType<typeof setInterval>): void {
  const candidate = timer as unknown as { unref?: () => void };
  if (typeof candidate === 'object' && candidate !== null && typeof candidate.unref === 'function') {
    candidate.unref();
  }
}

class CacheManager {
  private cache = new Map<string, CacheEntry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();

  set<T>(key: string, data: T, ttl: number = 300_000): void {
    this.evictIfFull();
    // Re-insert so the Map's iteration order doubles as least-recently-written order.
    this.cache.delete(key);
    this.cache.set(key, { data, timestamp: new Date(), ttl } as CacheEntry<unknown>);
  }

  get<T>(key: string): T | null {
    const entry = this.getEntry<T>(key);
    return entry ? entry.data : null;
  }

  /**
   * Returns a live entry, or null if it has expired.
   *
   * An expired entry is deliberately left in place. The stale-while-error path
   * reads it moments later, and deleting it here made that fallback
   * unreachable, leaving no usable value at all when a provider was down.
   * Expiry is enforced on read and reclaimed by the periodic cleanup.
   */
  getEntry<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    return this.isExpired(entry) ? null : entry;
  }

  /**
   * Returns an entry regardless of age, without deleting it.
   *
   * This is the stale-while-error path. An expired entry that is still present
   * is the only fallback available when a provider is down, so reading must
   * not destroy it. Age is returned with the entry so callers can label it.
   *
   * The entry survives until the periodic sweep reclaims it, which runs every
   * five minutes. A provider failure inside that window gets the fallback; one
   * landing just after a sweep does not.
   */
  getStale<T>(key: string): (CacheEntry<T> & { ageMs: number }) | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    return { ...entry, ageMs: Date.now() - new Date(entry.timestamp).getTime() };
  }

  /**
   * Run `task` at most once per key at a time. Concurrent callers share the
   * in-flight promise, so a cold cache under load triggers one upstream fetch
   * rather than one per request.
   */
  async dedupe<T>(key: string, task: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = task().finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise);
    return promise;
  }

  has(key: string): boolean {
    return this.getEntry(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  size(): number {
    return this.cache.size;
  }

  cleanup(): void {
    this.cache.forEach((entry, key) => {
      if (this.isExpired(entry)) this.cache.delete(key);
    });
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - new Date(entry.timestamp).getTime() > entry.ttl;
  }

  private evictIfFull(): void {
    if (this.cache.size < MAX_ENTRIES) return;
    // Map iterates in insertion order, so the first key is the oldest write.
    const oldest = this.cache.keys().next();
    if (!oldest.done) this.cache.delete(oldest.value);
  }
}

const cache = new CacheManager();

unrefTimer(
  setInterval(() => {
    cache.cleanup();
  }, CLEANUP_INTERVAL_MS)
);

export default cache;
