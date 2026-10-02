import { describe, expect, it } from 'vitest';
import {
  calculateBusinessQualityScore,
  calculateMetrics,
  calculateValuationScore,
  describeVerdict,
  inferSectorProfile,
  readMarketSignals,
} from '@/lib/metrics';
import type { StockFundamentals, StockPrice } from '@/types';

function fundamentals(overrides: Partial<StockFundamentals> = {}): StockFundamentals {
  return {
    symbol: 'TEST',
    companyName: 'Test Company Limited',
    peRatio: 20,
    pbRatio: 2,
    dividendYield: 1.2,
    eps: 10,
    bookValue: 100,
    faceValue: 10,
    sector: 'Information Technology',
    industry: 'Computers',
    roe: 18,
    roce: 20,
    periodEnd: '2026-03-31',
    fetchedAt: '2026-09-28T00:00:00.000Z',
    ...overrides,
  };
}

describe('inferSectorProfile', () => {
  it('routes each published sector to the right bands', () => {
    const cases: [string, string][] = [
      ['Energy', 'Energy & Utilities'],
      ['Oil, Gas & Consumable Fuels', 'Energy & Utilities'],
      ['Financial Services', 'Banking & Financials'],
      ['Private Sector Bank', 'Banking & Financials'],
      ['Public Sector Bank', 'Banking & Financials'],
      ['Information Technology', 'Technology'],
      ['Fast Moving Consumer Goods', 'Consumer & FMCG'],
      ['Pharmaceuticals', 'Pharma & Healthcare'],
      ['Industrials', 'Industrials & Capital Goods'],
      ['Mining', 'Metals & Mining'],
    ];

    for (const [sector, expected] of cases) {
      expect(inferSectorProfile(sector).profile.label, sector).toBe(expected);
      expect(inferSectorProfile(sector).recognised, sector).toBe(true);
    }
  });

  /**
   * Substring matching sent "Capital Goods" to the technology profile,
   * because "cap-it-al" contains "it".
   */
  it('does not classify capital goods as information technology', () => {
    expect(inferSectorProfile('Capital Goods').profile.key).toBe('capital');
    expect(inferSectorProfile('Capital Goods').profile.key).not.toBe('technology');
  });

  it('treats capital markets as financial rather than industrial', () => {
    expect(inferSectorProfile('Capital Markets').profile.key).toBe('banking');
  });

  it('falls back to general bands and says so when the sector is unknown', () => {
    for (const missing of [null, undefined, '', 'Something Unlisted']) {
      const result = inferSectorProfile(missing);
      expect(result.profile.key).toBe('general');
      expect(result.recognised).toBe(false);
    }
  });
});

describe('score construction', () => {
  it('scores from published figures', () => {
    const metrics = calculateMetrics(fundamentals());
    expect(metrics.valuation.score).not.toBeNull();
    expect(metrics.businessQuality.score).not.toBeNull();
    expect(metrics.overallScore).not.toBeNull();
  });

  /**
   * A neutral 50 is the reference a real reading is measured against. It is
   * not a stand-in for a missing one.
   */
  /**
   * The card prints a number and a label side by side, and the label is chosen
   * from the number's band. The two were read from different values: the label
   * from the raw total, the number after rounding. They agree today only
   * because every delta is a whole number, so a fractional one would have
   * printed 60 beside "Mixed", on a band that starts at 60.
   */
  it('never shows a label that disagrees with the number printed beside it', () => {
    const band = (score: number) =>
      score >= 60 ? 'favourable' : score >= 40 ? 'mixed' : 'cautious';

    for (const sector of ['Energy', 'Financial Services', 'Technology', 'Consumer', 'Something Unlisted']) {
      for (let pe = 1; pe <= 90; pe += 0.5) {
        for (const pb of [0.4, 1, 3, 8, 20]) {
          for (const roe of [-10, 0, 9, 15, 25]) {
            const metrics = calculateMetrics(fundamentals({ sector, peRatio: pe, pbRatio: pb, roe }));
            for (const score of [metrics.valuation, metrics.businessQuality]) {
              if (score.score === null) continue;
              expect(score.verdict, `${sector} pe=${pe} pb=${pb} roe=${roe} -> ${score.score}`).toBe(
                band(score.score)
              );
            }
          }
        }
      }
    }
  });

  it('keeps the overall verdict on the same band as the overall number', () => {
    for (let pe = 2; pe <= 80; pe += 1) {
      const metrics = calculateMetrics(fundamentals({ peRatio: pe, pbRatio: pe / 8, roe: pe }));
      const verdict = describeVerdict(metrics);
      if (metrics.overallScore === null) {
        expect(verdict.label).toBe('insufficient-data');
        continue;
      }
      const expected =
        metrics.overallScore >= 60 ? 'favourable' : metrics.overallScore >= 40 ? 'mixed' : 'cautious';
      expect(verdict.label, `overall ${metrics.overallScore}`).toBe(expected);
    }
  });

  it('produces no score at all when nothing was published', () => {
    const empty = fundamentals({
      peRatio: null,
      pbRatio: null,
      roe: null,
      roce: null,
      dividendYield: null,
    });

    const metrics = calculateMetrics(empty);
    expect(metrics.valuation.score).toBeNull();
    expect(metrics.valuation.verdict).toBeNull();
    expect(metrics.businessQuality.score).toBeNull();
    expect(metrics.overallScore).toBeNull();
  });

  it('names the figures it could not use instead of hiding them', () => {
    const partial = fundamentals({ peRatio: null, pbRatio: null, roce: null, dividendYield: null });
    const quality = calculateBusinessQualityScore(partial, inferSectorProfile('Information Technology').profile);

    expect(quality.score).not.toBeNull();
    expect(quality.considered).toBe(3);
    expect(quality.available).toBe(1);
    expect(quality.coverage).toBeCloseTo(1 / 3, 6);
    expect(quality.missing).toEqual(['ROCE', 'Dividend yield']);
  });

  it('still scores a single available input but reports the shortfall', () => {
    const oneInput = fundamentals({ pbRatio: null, roe: null, roce: null, dividendYield: null });
    const valuation = calculateValuationScore(oneInput, inferSectorProfile('Information Technology').profile);

    expect(valuation.score).not.toBeNull();
    expect(valuation.considered).toBe(2);
    expect(valuation.available).toBe(1);
    expect(valuation.missing).toEqual(['P/B']);
  });

  it('does not treat an invalid P/B as a cheap signal', () => {
    // Unreachable from the parser, which suppresses P/B for negative net worth,
    // but a negative ratio must never score as a discount if one ever arrives.
    const withNegative = calculateValuationScore(
      fundamentals({ pbRatio: -1 }),
      inferSectorProfile('Information Technology').profile
    );
    const without = calculateValuationScore(
      fundamentals({ pbRatio: null }),
      inferSectorProfile('Information Technology').profile
    );

    // Same P/E input, so the only difference is whether P/B contributed a
    // "cheap" bonus.
    expect(withNegative.score).toBe(without.score);
    expect(withNegative.highlights.join(' ')).toMatch(/not meaningful/i);
  });

  it('keeps a loss-making company out of the cheap end of the valuation score', () => {
    // A loss-maker publishes no P/E, so the score rests on P/B alone and says so.
    const loss = calculateValuationScore(
      fundamentals({ peRatio: null, pbRatio: 0.5 }),
      inferSectorProfile('Information Technology').profile
    );
    expect(loss.available).toBe(1);
    expect(loss.missing).toEqual(['P/E']);
    expect(loss.highlights.join(' ')).not.toMatch(/value-friendly/);
  });
});

describe('overall score', () => {
  it('averages only the sub-scores that exist', () => {
    const onlyValuation = calculateMetrics(
      fundamentals({ roe: null, roce: null, dividendYield: null })
    );
    expect(onlyValuation.businessQuality.score).toBeNull();
    expect(onlyValuation.overallScore).toBe(onlyValuation.valuation.score);
    expect(onlyValuation.overallCoverage).toBeCloseTo(2 / 5, 6);
  });
});

describe('describeVerdict', () => {
  it('says plainly when there is nothing to screen', () => {
    const metrics = calculateMetrics(
      fundamentals({ peRatio: null, pbRatio: null, roe: null, roce: null, dividendYield: null })
    );
    const verdict = describeVerdict(metrics);

    expect(verdict.label).toBe('insufficient-data');
    expect(verdict.summary).toMatch(/not a judgement about the company/i);
  });

  it('describes the reading without calling it a price, a setup, or a recommendation', () => {
    const verdict = describeVerdict(calculateMetrics(fundamentals()));
    const wording = `${verdict.headline} ${verdict.summary}`.toLowerCase();

    expect(verdict.label).not.toBe('insufficient-data');
    expect(verdict.headline).toBe('Screening reads favourably');
    expect(verdict.summary.length).toBeGreaterThan(0);
    for (const forbidden of ['favourable setup', 'fair price', 'buy ', 'sell ', 'recommend', 'target price']) {
      expect(wording, forbidden).not.toContain(forbidden);
    }
  });

  it('names the bands it used and the figures behind the score', () => {
    const verdict = describeVerdict(calculateMetrics(fundamentals({ sector: 'Energy' })));
    expect(verdict.basis).toContain('Energy & Utilities');
    expect(verdict.basis).toMatch(/valuation \d+\/100/);
  });

  it('flags a reading built from a thin set of figures', () => {
    const verdict = describeVerdict(
      calculateMetrics(fundamentals({ pbRatio: null, roe: null, roce: null, dividendYield: null }))
    );
    expect(verdict.summary).toMatch(/provisional/i);
  });
});

describe('readMarketSignals', () => {
  const price = (overrides: Partial<StockPrice>): StockPrice => ({
    symbol: 'TEST',
    price: 100,
    change: 1,
    changePercent: 1,
    recentChangePercent: 2,
    volume: 1000,
    previousClose: 99,
    dayOpen: 99,
    dayHigh: 101,
    dayLow: 98,
    fiftyTwoWeekHigh: 120,
    fiftyTwoWeekLow: 80,
    quotedAt: '2026-09-28T10:00:00.000Z',
    fetchedAt: '2026-09-28T10:00:05.000Z',
    exchangeTimezone: 'Asia/Kolkata',
    freshness: { kind: 'live', ageMs: 5000 },
    ...overrides,
  });

  it('reports the direction of the session', () => {
    expect(readMarketSignals(price({ changePercent: 2.5 })).dailyChangePercent).toBe(2.5);
  });

  it('reports no signal when there is no price at all', () => {
    const signals = readMarketSignals(null);
    expect(signals.hasPrice).toBe(false);
    expect(signals.dailyChangePercent).toBeNull();
    expect(signals.note).toMatch(/no price/i);
  });

  it('does not call an unreported change flat', () => {
    const signals = readMarketSignals(price({ changePercent: null }));
    expect(signals.dailyChangePercent).toBeNull();
    expect(signals.note).toMatch(/did not report a session change/i);
  });
});
