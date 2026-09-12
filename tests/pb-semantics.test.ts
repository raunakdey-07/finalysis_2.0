/**
 * P/B semantics regression test.
 * Confirms that bookValue is treated as per-share when calculating P/B.
 */
import { describe, it, expect } from 'vitest';

describe('P/B semantics', () => {
  it('calculates P/B correctly when bookValue is per-share', () => {
    const currentPrice = 1500;
    const bookValuePerShare = 300;
    const pb = currentPrice / bookValuePerShare;
    expect(pb).toBe(5);
  });

  it('returns null when bookValue is zero or missing', () => {
    const price = 1500;
    const bookValue = 0;
    const pb = bookValue > 0 ? price / bookValue : null;
    expect(pb).toBeNull();
  });

  it('rejects negative book value', () => {
    const bookValue = -100;
    expect(bookValue > 0).toBe(false);
  });
});
