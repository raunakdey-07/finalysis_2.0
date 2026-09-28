import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import cache from '@/lib/cache';

describe('cache expiry and stale reads', () => {
  beforeEach(() => {
    cache.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a live entry from get and getEntry', () => {
    cache.set('k', { value: 1 }, 60_000);
    expect(cache.get('k')).toEqual({ value: 1 });
    expect(cache.getEntry('k')).not.toBeNull();
  });

  /**
   * The stale-while-error fallback reads the cache a second time after a
   * provider failure. getEntry deletes anything expired, so that second read
   * could never return anything and the fallback was unreachable.
   */
  it('keeps an expired entry available to a stale read', () => {
    vi.useFakeTimers();
    cache.set('k', { value: 'old' }, 1000);

    vi.advanceTimersByTime(5000);

    expect(cache.getEntry('k')).toBeNull();
    expect(cache.get('k')).toBeNull();

    const stale = cache.getStale<{ value: string }>('k');
    expect(stale).not.toBeNull();
    expect(stale!.data).toEqual({ value: 'old' });
    expect(stale!.ageMs).toBeGreaterThanOrEqual(5000);
  });

  it('does not let a stale read refresh the entry', () => {
    vi.useFakeTimers();
    cache.set('k', 'old', 1000);
    vi.advanceTimersByTime(5000);

    cache.getStale('k');
    expect(cache.getEntry('k')).toBeNull();

    // Only the periodic sweep reclaims it.
    cache.cleanup();
    expect(cache.getStale('k')).toBeNull();
  });

  it('reclaims expired entries on the periodic sweep', () => {
    vi.useFakeTimers();
    cache.set('fresh', 1, 60_000);
    cache.set('old', 1, 1000);
    vi.advanceTimersByTime(5000);

    expect(cache.getStale('old')).not.toBeNull();

    cache.cleanup();
    expect(cache.getEntry('old')).toBeNull();
    expect(cache.getEntry('fresh')).not.toBeNull();
  });
});

describe('single-flight loading', () => {
  beforeEach(() => {
    cache.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the task once for concurrent callers of the same key', async () => {
    const task = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'value';
    });

    const results = await Promise.all([
      cache.dedupe('same', task),
      cache.dedupe('same', task),
      cache.dedupe('same', task),
    ]);

    expect(task).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['value', 'value', 'value']);
  });

  it('allows a later call once the first has settled', async () => {
    const task = vi.fn(async () => 'value');

    await cache.dedupe('key', task);
    await cache.dedupe('key', task);

    expect(task).toHaveBeenCalledTimes(2);
  });

  it('releases the key when the task fails, so the next call can retry', async () => {
    const failing = vi.fn(async () => {
      throw new Error('upstream down');
    });

    await expect(cache.dedupe('key', failing)).rejects.toThrow('upstream down');
    await expect(cache.dedupe('key', failing)).rejects.toThrow('upstream down');

    expect(failing).toHaveBeenCalledTimes(2);
  });
});

describe('size bounds', () => {
  beforeEach(() => {
    cache.clear();
    vi.useRealTimers();
  });

  it('evicts the oldest write rather than growing without limit', () => {
    for (let index = 0; index < 5100; index += 1) {
      cache.set(`key-${index}`, index, 60_000);
    }

    expect(cache.size()).toBeLessThanOrEqual(5000);
    expect(cache.has('key-5099')).toBe(true);
    expect(cache.has('key-0')).toBe(false);
  });
});
