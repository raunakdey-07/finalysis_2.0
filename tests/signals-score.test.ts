/**
 * The market-position reading on the third card.
 *
 * This is the score that must NOT be read as a quality measure, and must not be
 * unfair either. Both were measured against 39 live large caps rather than
 * argued about. The original version averaged 38 against a nominal neutral of
 * 50, because its 12-month range term averaged 30 on its own and carried
 * double weight, so the number was largely that term rescaled. These tests pin
 * the properties that fix it, and the properties that must not regress.
 */
import { describe, expect, it } from 'vitest';
import { calculateSignalsScore } from '@/lib/metrics';
import type { StockPrice } from '@/types';

/**
 * A stock sitting at the practical midpoint of its 12-month range, flat on the
 * day and flat over the week. Note the price is 95, not the arithmetic midpoint
 * of 125: 30% of the range is where prices actually sit, and that is what a
 * score of 50 is calibrated against.
 */
function price(overrides: Partial<StockPrice> = {}): StockPrice {
  return {
    symbol: 'TEST',
    price: 95,
    change: 0,
    changePercent: 0,
    recentChangePercent: 0,
    volume: 1000,
    previousClose: 95,
    dayOpen: 95,
    dayHigh: 95,
    dayLow: 95,
    fiftyTwoWeekHigh: 200,
    fiftyTwoWeekLow: 50,
    quotedAt: '2026-09-28T10:00:00.000Z',
    fetchedAt: '2026-09-28T10:00:05.000Z',
    exchangeTimezone: 'Asia/Kolkata',
    freshness: { kind: 'live', ageMs: 5000 },
    ...overrides,
  };
}

/** A stock at the practical midpoint of its range, not moving at all. */
const ALL_NEUTRAL = price();

describe('calculateSignalsScore', () => {
  it('is centred: an ordinary stock that is not moving reads exactly neutral', () => {
    const reading = calculateSignalsScore(ALL_NEUTRAL, 'neutral', true);
    expect(reading.score).toBe(50);
    expect(reading.state).toBe('steady');
  });

  it('reads a stock at the top of its range higher than one at the bottom', () => {
    const top = calculateSignalsScore(price({ price: 200 }), 'neutral', true);
    const bottom = calculateSignalsScore(price({ price: 50 }), 'neutral', true);
    expect(top.score!).toBeGreaterThan(bottom.score!);
    expect(top.state).toBe('buoyant');
  });

  it('reads a stock at the bottom of its range as soft once the day agrees', () => {
    const reading = calculateSignalsScore(
      price({ price: 50, changePercent: -2, recentChangePercent: -8 }),
      'negative',
      true
    );
    expect(reading.state).toBe('soft');
  });

  it('reaches its ceiling only when every input agrees', () => {
    const reading = calculateSignalsScore(
      price({ price: 200, changePercent: 3, recentChangePercent: 8 }),
      'positive',
      true
    );
    expect(reading.score!).toBeGreaterThan(80);
    expect(reading.state).toBe('buoyant');
  });

  /**
   * The measured defect, twice. A stock resting on its 52-week low measured the
   * same as one in freefall, and when the movement terms were given enough gain
   * to reach their own extremes, one good session read as a healthy stock. The
   * property that has to hold is narrower than "must read soft": a stock on its
   * 52-week low must never read as the strongest label, however good its week.
   */
  it('does not let one good session make a stock on its 52-week low look buoyant', () => {
    const atLow = calculateSignalsScore(
      price({ price: 52, changePercent: 2, recentChangePercent: 3 }),
      'positive',
      true
    );
    expect(atLow.state).not.toBe('buoyant');

    const onItsLowAndFalling = calculateSignalsScore(
      price({ price: 52, changePercent: -2, recentChangePercent: -5 }),
      'negative',
      true
    );
    expect(onItsLowAndFalling.score!).toBeLessThan(atLow.score!);

    const quietAtLow = calculateSignalsScore(
      price({ price: 52, changePercent: 0, recentChangePercent: 0 }),
      'neutral',
      true
    );
    const freefall = calculateSignalsScore(
      price({ price: 52, changePercent: -5, recentChangePercent: -14 }),
      'negative',
      true
    );

    // The same label, even though the number separates them. A stock down 14 in a
    // week and 5 in a session genuinely is the weaker of the two, so the score
    // moving is right; what must not move is the verdict, because that is what
    // the card shows and it makes no claim about pace. The figures themselves are
    // in the popover.
    expect(freefall.state).toBe(quietAtLow.state);
    expect(freefall.score!).toBeLessThan(quietAtLow.score!);

    const wording = quietAtLow.notes.join(' ');
    expect(wording).not.toMatch(/\bfalling\b/i);
    expect(wording).not.toMatch(/\bcrashing\b/i);
  });

  it('uses behaviour vocabulary, never the screening verdict vocabulary', () => {
    for (const current of [50, 125, 200]) {
      const state = calculateSignalsScore(price({ price: current }), 'positive', true).state;
      expect(['buoyant', 'steady', 'soft']).toContain(state);
      expect(state).not.toBe('favourable');
      expect(state).not.toBe('cautious');
    }
  });

  /**
   * Raw range position averaged 30 across the sample, pinning the score near 38
   * and making an ordinary day look like a collapse. The term is compressed, and
   * the note has to say so in words a reader can check.
   */
  it('compresses the range term so a broad drawdown cannot pin the reading low', () => {
    const atLow = calculateSignalsScore(price({ price: 50 }), 'neutral', true);
    expect(atLow.notes.join(' ')).toMatch(/bottom tenth/);
    expect(atLow.notes.join(' ')).not.toMatch(/sits 0%/);
  });

  it('keeps the range term as the most informative input without letting it decide alone', () => {
    // Mid-range but strongly up on every movement input, so the reading follows
    // the movement rather than the location.
    const upButMidRange = calculateSignalsScore(
      price({ price: 125, changePercent: 4, recentChangePercent: 12 }),
      'positive',
      true
    );
    expect(upButMidRange.score!).toBeGreaterThan(60);
  });

  it('lets recent movement outvote a single session', () => {
    const recovering = calculateSignalsScore(
      price({ price: 70, changePercent: -0.2, recentChangePercent: 12 }),
      null,
      false
    );
    const falling = calculateSignalsScore(
      price({ price: 70, changePercent: -0.2, recentChangePercent: -12 }),
      null,
      false
    );
    expect(recovering.score!).toBeGreaterThan(falling.score!);
  });

  it('counts headline tone only once enough articles were retrieved', () => {
    const withTone = calculateSignalsScore(ALL_NEUTRAL, 'positive', true);
    const withoutTone = calculateSignalsScore(ALL_NEUTRAL, 'positive', false);
    expect(withTone.score!).toBeGreaterThan(withoutTone.score!);
  });

  it('does not report full coverage just because headlines are absent', () => {
    expect(calculateSignalsScore(ALL_NEUTRAL, null, false).coverage).toBeCloseTo(0.75, 6);
    expect(calculateSignalsScore(ALL_NEUTRAL, 'positive', true).coverage).toBe(1);
  });

  it('produces nothing at all when there is no price', () => {
    const reading = calculateSignalsScore(null, null, false);
    expect(reading.score).toBeNull();
    expect(reading.state).toBeNull();
    expect(reading.coverage).toBe(0);
    expect(reading.available).toBe(0);
  });

  it('reports how many of the four inputs it actually used', () => {
    expect(calculateSignalsScore(ALL_NEUTRAL, null, false).available).toBe(3);
    expect(calculateSignalsScore(ALL_NEUTRAL, 'positive', true).available).toBe(4);
  });

  it('still scores the movement when the 52-week range is missing', () => {
    const reading = calculateSignalsScore(
      price({ fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null, changePercent: 2 }),
      null,
      false
    );
    expect(reading.score).toBe(58);
    expect(reading.state).toBe('buoyant');
  });

  it('names every input that was missing rather than silently dropping it', () => {
    const reading = calculateSignalsScore(
      price({ fiftyTwoWeekHigh: null, changePercent: null, recentChangePercent: null }),
      null,
      false
    );
    expect(reading.score).toBeNull();
    const notes = reading.notes.join(' ');
    expect(notes).toMatch(/12-month range position was not available/);
    expect(notes).toMatch(/Recent movement was not available/);
    expect(notes).toMatch(/Today.s move was not available/);
  });

  it('ignores a 52-week range that is inverted or degenerate', () => {
    const inverted = calculateSignalsScore(
      price({ fiftyTwoWeekHigh: 10, fiftyTwoWeekLow: 100, changePercent: 1 }),
      null,
      false
    );
    expect(inverted.available).toBeLessThan(4);
  });

  it('explains itself without recommending anything', () => {
    const reading = calculateSignalsScore(ALL_NEUTRAL, 'positive', true);
    expect(reading.notes.length).toBeGreaterThan(0);
    expect(reading.notes.join(' ')).not.toMatch(/\b(buy|sell|recommend)\b/i);
  });
});
