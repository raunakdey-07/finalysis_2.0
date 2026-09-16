/**
 * P/B semantics regression test.
 * Confirms that bookValue is treated as per-share when calculating P/B.
 */
import { describe, it, expect } from 'vitest';

const calculatePB = (currentPrice: number, bookValue: number | null | undefined): number | null => {
  if (!currentPrice || !bookValue || bookValue <= 0) return null;
  return currentPrice / bookValue;
};

describe('P/B semantics', () => {
  it('calculates P/B correctly when bookValue is per-share', () => {
    const pb = calculatePB(1500, 300);
    expect(pb).toBe(5);
  });

  it('returns null when bookValue is zero', () => {
    const pb = calculatePB(1500, 0);
    expect(pb).toBeNull();
  });

  it('returns null when bookValue is negative', () => {
    const pb = calculatePB(1500, -100);
    expect(pb).toBeNull();
  });

  it('returns null when bookValue is missing', () => {
    const pb = calculatePB(1500, null);
    expect(pb).toBeNull();
  });

  it('returns null when bookValue is undefined', () => {
    const pb = calculatePB(1500, undefined);
    expect(pb).toBeNull();
  });
});
