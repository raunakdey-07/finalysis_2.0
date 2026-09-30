/**
 * The market-position reading on the third card, and the provider throttle.
 *
 * This is the score that must NOT be read as a quality measure. A company at
 * its 52-week low scores low here and can be an excellent business, so the
 * tests pin the inputs and the weighting, and pin that the label vocabulary is
 * directional rather than a verdict.
 */
import { describe, expect, it } from 'vitest';
import { calculateSignalsScore } from '@/lib/metrics';
import type { StockPrice } from '@/types';

function price(overrides: Partial<StockPrice> = {}): StockPrice {
  return {
    symbol: 'TEST',
    price: 100,
    change: 0,
    changePercent: 0,
    volume: 1000,
    previousClose: 100,
    dayOpen: 100,
    dayHigh: 100,
    dayLow: 100,
    fiftyTwoWeekHigh: 200,
    fiftyTwoWeekLow: 50,
    quotedAt: '2026-09-28T10:00:00.000Z',
    fetchedAt: '2026-09-28T10:00:05.000Z',
    exchangeTimezone: 'Asia/Kolkata',
    freshness: { kind: 'live', ageMs: 5000 },
    ...overrides,
  };
}

describe('calculateSignalsScore', () => {
  it('reads a price at the top of its 12-month range as a high number', () => {
    // Range position saturates at 100 but the session is flat, so the weighted
    // result is below 100. The range is the dominant term, not the only one.
    const reading = calculateSignalsScore(price({ price: 200 }), null, false);
    expect(reading.score).toBe(83);
    expect(reading.state).toBe('rising');
  });

  it('reaches the top of the scale only when the range and the day agree', () => {
    const reading = calculateSignalsScore(price({ price: 200, changePercent: 5 }), null, false);
    expect(reading.score).toBe(100);
  });

  it('reads a price at the bottom of its 12-month range as a low number', () => {
    const reading = calculateSignalsScore(price({ price: 50 }), null, false);
    expect(reading.score).toBe(17);
    expect(reading.state).toBe('falling');
  });

  it('reads a price mid-range as mixed', () => {
    const reading = calculateSignalsScore(price({ price: 125 }), null, false);
    expect(reading.state).toBe('mixed');
  });

  it('uses directional labels, never the screening verdict vocabulary', () => {
    const high = calculateSignalsScore(price({ price: 200 }), 'positive', true);
    const low = calculateSignalsScore(price({ price: 50 }), 'negative', true);

    expect(high.state).toBe('rising');
    expect(low.state).toBe('falling');
    for (const state of [high.state, low.state]) {
      expect(['rising', 'mixed', 'falling']).toContain(state);
      expect(state).not.toBe('favourable');
      expect(state).not.toBe('cautious');
    }
  });

  it('weights the 12-month range above the single day', () => {
    // Near the top of the range, but down hard today. The range should win.
    const downToday = calculateSignalsScore(price({ price: 190, changePercent: -5 }), null, false);
    const flatToday = calculateSignalsScore(price({ price: 190, changePercent: 0 }), null, false);
    expect(downToday.score!).toBeLessThan(flatToday.score!);
    expect(downToday.score!).toBeGreaterThan(50);
  });

  it('counts headline tone only once enough articles were retrieved', () => {
    const withTone = calculateSignalsScore(price({ price: 125 }), 'positive', true);
    const withoutTone = calculateSignalsScore(price({ price: 125 }), 'positive', false);
    expect(withTone.score!).toBeGreaterThan(withoutTone.score!);
  });

  it('does not report full coverage just because headlines are absent', () => {
    const noHeadlines = calculateSignalsScore(price(), null, false);
    expect(noHeadlines.coverage).toBeCloseTo(2 / 3, 6);
  });

  it('produces nothing at all when there is no price', () => {
    const reading = calculateSignalsScore(null, null, false);
    expect(reading.score).toBeNull();
    expect(reading.state).toBeNull();
    expect(reading.coverage).toBe(0);
  });

  it('scores on the day alone when the 52-week range is missing', () => {
    const reading = calculateSignalsScore(
      price({ fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null, changePercent: 2 }),
      null,
      false
    );
    expect(reading.score).toBe(70);
    expect(reading.state).toBe('rising');
  });

  it('names every input that was missing rather than silently dropping it', () => {
    const reading = calculateSignalsScore(
      price({ fiftyTwoWeekHigh: null, changePercent: null }),
      null,
      false
    );
    expect(reading.score).toBeNull();
    expect(reading.notes.join(' ')).toMatch(/12-month range position was not available/);
    expect(reading.notes.join(' ')).toMatch(/Today.s move was not available/);
  });

  it('ignores a 52-week range that is inverted or degenerate', () => {
    const inverted = calculateSignalsScore(
      price({ fiftyTwoWeekHigh: 10, fiftyTwoWeekLow: 100, changePercent: 1 }),
      null,
      false
    );
    expect(inverted.coverage).toBeLessThan(1);
  });

  it('explains itself in a way that says it is not a quality measure', () => {
    const reading = calculateSignalsScore(price(), 'positive', true);
    expect(reading.notes.length).toBeGreaterThan(0);
    expect(reading.notes.join(' ')).not.toMatch(/buy|sell|recommend/i);
  });
});
