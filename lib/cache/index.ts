/**
 * In-memory cache implementation for Finalysis 3.0
 * Provides efficient caching with TTL support
 */

import { CacheEntry } from '@/types';

class CacheManager {
  private cache: Map<string, CacheEntry<unknown>>;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Set a value in cache with TTL
   */
  set<T>(key: string, data: T, ttl: number = 300000): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date(),
      ttl,
    };
    this.cache.set(key, entry as CacheEntry<unknown>);
  }

  /**
   * Get a value from cache if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.getEntry<T>(key);
    return entry ? entry.data : null;
  }

  /**
   * Get full cache entry (data + metadata) if valid
   */
  getEntry<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    const now = Date.now();
    const entryTime = new Date(entry.timestamp).getTime();

    if (now - entryTime > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const value = this.get(key);
    return value !== null;
  }

  /**
   * Delete a key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      const entryTime = new Date(entry.timestamp).getTime();
      if (now - entryTime > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }
}

// Singleton instance
const cache = new CacheManager();

// Periodic cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cache.cleanup();
  }, 300000);
}

export default cache;
