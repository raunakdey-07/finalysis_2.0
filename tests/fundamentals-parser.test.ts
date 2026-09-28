import { describe, expect, it } from 'vitest';
import {
  extractAnnualEps,
  extractCompanyName,
  extractIndustry,
  extractMetric,
  extractPeriodEnd,
  extractSector,
  parseFundamentalsHtml,
  parseNumber,
} from '@/lib/fundamentals';
import { isValidFundamentals } from '@/lib/fundamentals/validate';
import {
  SCREENER_LOSSMAKING,
  SCREENER_NOT_A_COMPANY,
  SCREENER_PROFITABLE,
  SCREENER_WITH_PROSE,
} from './fixtures/screener';

describe('parseNumber', () => {
  it('reads the Indian digit grouping screener.in uses', () => {
    expect(parseNumber('1,46,040')).toBe(146040);
    expect(parseNumber('16,20,656')).toBe(1620656);
  });

  it('reads negatives, which are meaningful for several of these metrics', () => {
    expect(parseNumber('-3.26')).toBe(-3.26);
  });

  it('returns null rather than zero for an empty or unreadable value', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('   ')).toBeNull();
    expect(parseNumber('N/A')).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
    expect(parseNumber(Number.NaN)).toBeNull();
  });
});

describe('extractMetric', () => {
  it('reads each published row of a profitable company', () => {
    expect(extractMetric(SCREENER_PROFITABLE, 'Market Cap')).toBe(1620656);
    expect(extractMetric(SCREENER_PROFITABLE, 'Stock P/E')).toBe(41.3);
    expect(extractMetric(SCREENER_PROFITABLE, 'Book Value')).toBe(418);
    expect(extractMetric(SCREENER_PROFITABLE, 'ROE')).toBe(7.71);
    expect(extractMetric(SCREENER_PROFITABLE, 'ROCE')).toBe(7.78);
    expect(extractMetric(SCREENER_PROFITABLE, 'Dividend Yield')).toBe(0.5);
    expect(extractMetric(SCREENER_PROFITABLE, 'Face Value')).toBe(10);
  });

  /**
   * The regression that mattered most. screener.in renders a metric it cannot
   * express as an empty span inside the same row. An unbounded search for the
   * next number span walked into the following row, so a loss-making company's
   * book value was displayed as its P/E and its face value as its ROE.
   */
  it('returns null for a row the provider left empty, not the next row value', () => {
    expect(extractMetric(SCREENER_LOSSMAKING, 'Stock P/E')).toBeNull();
    expect(extractMetric(SCREENER_LOSSMAKING, 'ROE')).toBeNull();
  });

  it('still reads the rows either side of an empty one', () => {
    expect(extractMetric(SCREENER_LOSSMAKING, 'Book Value')).toBe(-3.26);
    expect(extractMetric(SCREENER_LOSSMAKING, 'ROCE')).toBe(-1.92);
    expect(extractMetric(SCREENER_LOSSMAKING, 'Face Value')).toBe(10);
  });

  it('returns null for a label the page does not carry at all', () => {
    expect(extractMetric(SCREENER_PROFITABLE, 'Debt to equity')).toBeNull();
    expect(extractMetric(SCREENER_PROFITABLE, 'EPS')).toBeNull();
  });

  it('does not mistake a class containing the name for the name itself', () => {
    const html = '<li><span class="name-wrapper">X</span><span class="number">5</span></li>';
    expect(extractMetric(html, 'X')).toBeNull();
  });
});

describe('extractCompanyName', () => {
  it('reads the name past the logo element nested in the heading', () => {
    expect(extractCompanyName(SCREENER_LOSSMAKING)).toBe('Vodafone Idea Ltd');
    expect(extractCompanyName(SCREENER_PROFITABLE)).toBe('Reliance Industries Ltd');
    expect(extractCompanyName(SCREENER_WITH_PROSE)).toBe('HDFC Bank Limited');
  });

  it('returns null when there is no heading', () => {
    expect(extractCompanyName('<div>no company</div>')).toBeNull();
  });
});

describe('extractSector and extractIndustry', () => {
  it('reads the sector rather than the broad sector or the industry', () => {
    expect(extractSector(SCREENER_PROFITABLE)).toBe('Oil, Gas & Consumable Fuels');
    expect(extractIndustry(SCREENER_PROFITABLE)).toBeNull();
  });

  /** Prose containing the word "Sector" used to win over the real link. */
  it('ignores prose that happens to contain the word sector', () => {
    expect(extractSector(SCREENER_WITH_PROSE)).toBe('Financial Services');
    expect(extractIndustry(SCREENER_WITH_PROSE)).toBe('Bank');
  });

  it('decodes entities in the anchor text', () => {
    expect(extractSector(SCREENER_LOSSMAKING)).toBe('Telecommunication');
    expect(extractIndustry(SCREENER_LOSSMAKING)).toBe('Telecom - Cellular & Fixed line services');
  });
});

describe('extractAnnualEps and extractPeriodEnd', () => {
  it('takes the most recent populated year', () => {
    expect(extractAnnualEps(SCREENER_LOSSMAKING)).toBe(-0.34);
    expect(extractAnnualEps(SCREENER_PROFITABLE)).toBe(9.81);
  });

  it('returns null when the table is absent', () => {
    expect(extractAnnualEps(SCREENER_WITH_PROSE)).toBeNull();
  });

  it('reports the reporting date of the latest column', () => {
    expect(extractPeriodEnd(SCREENER_PROFITABLE)).toBe('2026-03-31');
    expect(extractPeriodEnd(SCREENER_NOT_A_COMPANY)).toBeNull();
  });
});

describe('parseFundamentalsHtml', () => {
  it('produces the published figures for a loss-making company', () => {
    const parsed = parseFundamentalsHtml(SCREENER_LOSSMAKING, 'IDEA');

    expect(parsed).not.toBeNull();
    expect(parsed!.companyName).toBe('Vodafone Idea Ltd');
    expect(parsed!.peRatio).toBeNull();
    expect(parsed!.roe).toBeNull();
    expect(parsed!.bookValue).toBe(-3.26);
    expect(parsed!.roce).toBe(-1.92);
    expect(parsed!.eps).toBe(-0.34);
    expect(parsed!.sector).toBe('Telecommunication');
    expect(parsed!.periodEnd).toBe('2026-03-31');
  });

  /**
   * P/B is computed against a positive book value only. Negative equity makes
   * the ratio meaningless, so it is left absent rather than reported as
   * something that looks like a number.
   */
  it('leaves P/B absent when net worth per share is negative', () => {
    expect(parseFundamentalsHtml(SCREENER_LOSSMAKING, 'IDEA')!.pbRatio).toBeNull();
  });

  it('computes P/B against book value per share for a profitable company', () => {
    const parsed = parseFundamentalsHtml(SCREENER_PROFITABLE, 'RELIANCE')!;
    expect(parsed.pbRatio).toBeCloseTo(1198 / 418, 4);
  });

  it('returns null for a page that is not a company page', () => {
    expect(parseFundamentalsHtml(SCREENER_NOT_A_COMPANY, 'NOPE')).toBeNull();
  });

  it('never turns a missing figure into a zero', () => {
    const parsed = parseFundamentalsHtml(SCREENER_LOSSMAKING, 'IDEA')!;
    const numeric = [
      parsed.peRatio,
      parsed.pbRatio,
      parsed.dividendYield,
      parsed.eps,
      parsed.bookValue,
      parsed.faceValue,
      parsed.roe,
      parsed.roce,
    ];

    // Dividend yield of 0.00 is genuinely published; everything else absent
    // must be null rather than a placeholder number.
    expect(parsed.peRatio).toBeNull();
    expect(parsed.pbRatio).toBeNull();
    expect(parsed.roe).toBeNull();
    expect(numeric.filter((value) => value === 0)).toHaveLength(1);
  });
});

describe('isValidFundamentals', () => {
  const base = parseFundamentalsHtml(SCREENER_PROFITABLE, 'RELIANCE')!;

  it('accepts a well-formed record', () => {
    expect(isValidFundamentals(base)).toBe(true);
  });

  it('accepts negative book value, ROE, ROCE and EPS as meaningful', () => {
    expect(isValidFundamentals({ ...base, bookValue: -3.26, roe: -20, roce: -1.92, eps: -0.34 })).toBe(
      true
    );
  });

  it('rejects values that are not finite numbers', () => {
    expect(isValidFundamentals({ ...base, roe: Number.NaN })).toBe(false);
    expect(isValidFundamentals({ ...base, bookValue: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it('rejects a record with no company name', () => {
    expect(isValidFundamentals({ ...base, companyName: '' })).toBe(false);
  });

  it('rejects a malformed reporting period', () => {
    expect(isValidFundamentals({ ...base, periodEnd: '31/03/2026' })).toBe(false);
  });

  it('rejects a record with no capture time', () => {
    expect(isValidFundamentals({ ...base, fetchedAt: 'not a date' })).toBe(false);
  });
});
