import { describe, expect, it } from 'vitest';
import {
  describePriceFreshness,
  formatDuration,
  formatMultiple,
  formatPercent,
  formatRupees,
  formatSignedPercent,
} from '@/lib/format';

const QUOTED_AT = '2026-09-28T10:00:00.000Z'; // 15:30 IST
const FETCHED_AT = '2026-09-28T10:02:00.000Z';

describe('freshness wording', () => {
  it('names the exchange timestamp for a live quote', () => {
    const described = describePriceFreshness({
      quotedAt: QUOTED_AT,
      fetchedAt: FETCHED_AT,
      freshness: { kind: 'live', ageMs: 120_000 },
    });

    expect(described.label).toMatch(/^Accurate as of /);
    expect(described.label).toContain('IST');
    expect(described.tone).toBe('live');
  });

  /**
   * When the provider gives no quote time, the page must not borrow the fetch
   * time and present it as when the exchange recorded the price.
   */
  it('says when it fetched rather than implying a quote time', () => {
    const described = describePriceFreshness({
      quotedAt: null,
      fetchedAt: FETCHED_AT,
      freshness: { kind: 'live', ageMs: null },
    });

    expect(described.label).toMatch(/^Fetched at /);
    expect(described.label).not.toMatch(/Accurate as of/);
    expect(described.detail).toMatch(/did not report a quote time/i);
  });

  it('separates the quote time from the retrieval time for a cached quote', () => {
    const described = describePriceFreshness({
      quotedAt: QUOTED_AT,
      fetchedAt: QUOTED_AT,
      freshness: { kind: 'cached', ageMs: 4 * 60_000 },
    });

    expect(described.label).toMatch(/Accurate as of/);
    expect(described.detail).toMatch(/retrieved 4 minutes ago/);
    expect(described.tone).toBe('recent');
  });

  it('never presents a scheduled close as a live price', () => {
    const described = describePriceFreshness({
      quotedAt: '2026-09-14T10:00:00.000Z',
      fetchedAt: '2026-09-14T10:30:00.000Z',
      freshness: { kind: 'daily-close', ageMs: 14 * 24 * 60 * 60 * 1000 },
    });

    expect(described.label).toMatch(/^Last close/);
    expect(described.label).not.toMatch(/Accurate as of/);
    expect(described.detail).toMatch(/not a live price/i);
    expect(described.tone).toBe('stale');
  });

  it('labels a price served while live pricing was failing', () => {
    const described = describePriceFreshness({
      quotedAt: QUOTED_AT,
      fetchedAt: QUOTED_AT,
      freshness: { kind: 'stale-cache', ageMs: 3 * 60 * 60 * 1000 },
    });

    expect(described.label).toMatch(/Last known price/);
    expect(described.detail).toMatch(/live pricing is unavailable/i);
    expect(described.tone).toBe('stale');
  });
});

describe('number formatting', () => {
  it('groups rupees the way an Indian reader expects', () => {
    expect(formatRupees(1197.6)).toMatch(/1,197\.60/);
  });

  it('always states the unit, so an amount is never read as a bare number', () => {
    expect(formatRupees(418)).toBe('₹418.00');
    expect(formatRupees(1197.6)).toBe('₹1,197.60');
    expect(formatRupees(-3.26)).toBe('₹-3.26');
  });

  it('shows an absent figure as a dash, never as zero', () => {
    for (const format of [formatRupees, formatPercent, formatMultiple, formatSignedPercent]) {
      expect(format(null), 'null').toBe('—');
      expect(format(undefined), 'undefined').toBe('—');
      expect(format(Number.NaN), 'NaN').toBe('—');
    }
  });

  it('keeps a genuine zero visible, and never hides a unit', () => {
    expect(formatPercent(0)).toBe('0.00%');
    expect(formatRupees(0)).toBe('₹0.00');
  });

  it('always carries the unit on a ratio, so a bare number is never ambiguous', () => {
    expect(formatPercent(18.5)).toBe('18.50%');
    expect(formatPercent(0.85)).toBe('0.85%');
    expect(formatMultiple(41.3)).toBe('41.30x');
    expect(formatMultiple(41.3)).not.toContain('%');
  });

  it('signs a change explicitly', () => {
    expect(formatSignedPercent(2.5)).toBe('+2.50%');
    expect(formatSignedPercent(-2.5)).toBe('−2.50%');
    expect(formatSignedPercent(0)).toBe('0.00%');
  });

  it('renders durations in words', () => {
    expect(formatDuration(30_000)).toBe('moments');
    expect(formatDuration(5 * 60_000)).toBe('5 minutes');
    expect(formatDuration(60 * 60_000)).toBe('1 hour');
    expect(formatDuration(3 * 24 * 60 * 60 * 1000)).toBe('3 days');
  });
});
