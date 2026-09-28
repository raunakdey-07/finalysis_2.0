import { describe, expect, it } from 'vitest';
import { boundedInt, guardSymbol } from '@/lib/api';
import { NextRequest } from 'next/server';
import { COVERED_SYMBOL_COUNT, isKnownSymbol } from '@/lib/symbol-resolver';
import { parseRequiredNseSymbol } from '@/lib/utils/symbol';

/**
 * An unknown ticker must be rejected from the local dataset before any
 * request reaches a third-party site, otherwise the public API can be used to
 * make the app scrape arbitrary URLs.
 */

function requestFor(symbol: string | null) {
  const query = symbol === null ? '' : `?symbol=${encodeURIComponent(symbol)}`;
  return new NextRequest(`http://localhost/api/metrics${query}`);
}

describe('symbol format', () => {
  it('accepts a bare ticker and normalises the suffix', () => {
    const parsed = parseRequiredNseSymbol('reliance');
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.symbol).toBe('RELIANCE');
  });

  it('accepts a ticker carrying the NSE suffix', () => {
    const parsed = parseRequiredNseSymbol('RELIANCE.NS');
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.symbol).toBe('RELIANCE');
  });

  it('rejects punctuation that has no place in an NSE ticker', () => {
    for (const bad of ['../../etc/passwd', 'RELIANCE; DROP', 'a b', '<script>']) {
      const parsed = parseRequiredNseSymbol(bad);
      expect(parsed.success, bad).toBe(false);
    }
  });

  it('rejects an over-long symbol', () => {
    expect(parseRequiredNseSymbol('A'.repeat(21)).success).toBe(false);
  });

  it('rejects a missing symbol', () => {
    expect(parseRequiredNseSymbol(null).success).toBe(false);
    expect(parseRequiredNseSymbol('   ').success).toBe(false);
  });
});

describe('universe membership', () => {
  it('recognises tickers in the dataset', () => {
    for (const symbol of ['RELIANCE', 'TCS', 'IDEA', 'HDFCBANK', 'ICICIBANK', 'SBIN']) {
      expect(isKnownSymbol(symbol), symbol).toBe(true);
      expect(isKnownSymbol(`${symbol}.NS`), symbol).toBe(true);
    }
  });

  it('does not recognise a ticker that is not covered', () => {
    for (const symbol of ['ZZZZNOTREAL', 'NOTASTOCK', '']) {
      expect(isKnownSymbol(symbol), symbol).toBe(false);
    }
  });

  it('reports the size of the covered universe for user-facing copy', () => {
    expect(COVERED_SYMBOL_COUNT).toBeGreaterThan(2000);
  });
});

describe('guardSymbol', () => {
  it('rejects an unknown ticker before any upstream work', () => {
    const result = guardSymbol(requestFor('ZZZZNOTREAL'), { required: true });
    expect(result.symbol).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error!.status).toBe(404);
  });

  it('names the coverage limit so the message is actionable', async () => {
    const result = guardSymbol(requestFor('ZZZZNOTREAL'), { required: true });
    const body = await result.error!.json();
    expect(body.error).toContain(String(COVERED_SYMBOL_COUNT));
    expect(body.errorCode).toBe('UNKNOWN_SYMBOL');
  });

  it('passes a covered ticker through, normalised', () => {
    const result = guardSymbol(requestFor('reliance.ns'), { required: true });
    expect(result.error).toBeNull();
    expect(result.symbol).toBe('RELIANCE');
  });

  it('treats an absent symbol as optional when the route allows it', () => {
    const result = guardSymbol(requestFor(null), { required: false });
    expect(result.symbol).toBeNull();
    expect(result.error).toBeNull();
  });
});

describe('boundedInt', () => {
  it('keeps a caller-supplied count inside its range', () => {
    expect(boundedInt('5', 10, 1, 20)).toBe(5);
    expect(boundedInt('9999', 10, 1, 20)).toBe(20);
    expect(boundedInt('-4', 10, 1, 20)).toBe(1);
    expect(boundedInt('abc', 10, 1, 20)).toBe(10);
    expect(boundedInt(null, 10, 1, 20)).toBe(10);
  });
});
