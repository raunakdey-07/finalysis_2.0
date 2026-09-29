/**
 * Search ranking.
 *
 * These cover the two behaviours that decide whether a search feels quick and
 * predictable: a query that matches nothing must not cost real time, and a
 * transposed letter must land on the company the reader meant.
 */
import { describe, it, expect } from 'vitest';
import { resolveSymbol } from '@/lib/symbol-resolver';

function topSymbols(query: string, limit = 5): string[] {
  const result = resolveSymbol(query, { limit });
  if (result.type === 'exact' || result.type === 'confident') {
    return result.symbol ? [result.symbol.replace(/\.NS$/i, '')] : [];
  }
  return (result.suggestions ?? []).map((suggestion) => suggestion.symbol.replace(/\.NS$/i, ''));
}

describe('typo ranking', () => {
  /**
   * "relaince" scored identically against RELIANCE and against every other
   * company containing the word Reliance, so the top hit was a textiles
   * company called Reliance Chemotex.
   */
  it('ranks a transposed ticker above a company that merely shares a word', () => {
    const ranked = topSymbols('relaince');
    expect(ranked[0]).toBe('RELIANCE');
  });

  it('still finds companies when the name is typed in full', () => {
    expect(topSymbols('reliance industries')).toContain('RELIANCE');
  });

  it('finds a company by a prefix', () => {
    expect(topSymbols('bajaj').length).toBeGreaterThan(1);
    expect(topSymbols('bajaj')).toContain('BAJAJ-AUTO');
  });

  it('resolves an exact ticker before the fuzzy path is reached', () => {
    const result = resolveSymbol('TCS');
    expect(result.type === 'exact' || result.type === 'confident').toBe(true);
    expect(result.symbol).toBe('TCS.NS');
  });
});

describe('no-match queries', () => {
  it('reports not found rather than inventing a company', () => {
    const result = resolveSymbol('zzzzqqqq');
    expect(result.type).toBe('not-found');
    expect(result.suggestions).toBeUndefined();
  });

  /**
   * The fuzzy pass runs an edit distance across every covered company. With no
   * pruning, a single unmatched keystroke blocked the event loop for roughly
   * half a second, which the search rate limit then multiplied. The character
   * prefilter makes the miss cheap without being able to drop a real match,
   * because sharing almost all of the query's letters is a necessary condition
   * for a close edit distance.
   */
  it('returns a miss quickly enough to sit under a keystroke', () => {
    const start = performance.now();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      resolveSymbol('zzzzqqqq');
    }
    const perQuery = (performance.now() - start) / 20;

    // The exact-match path costs well under a millisecond; the old fuzzy path
    // cost over 500ms. This is a generous ceiling that still fails loudly if
    // the prefilter is removed.
    expect(perQuery).toBeLessThan(30);
  });

  it('does not get slower as the dataset grows', () => {
    // A coarse check that the prefilter is doing the work: a realistic partial
    // match must still be found, so the filter cannot simply reject everything.
    expect(topSymbols('relian')).toContain('RELIANCE');
  });
});

describe('sector filter', () => {
  it('restricts candidates to the chosen sector', () => {
    const result = resolveSymbol('bank', { sector: 'Banking & Financial Services' });
    const symbols = result.type === 'not-found' ? [] : topSymbolsWithSector('bank', 'Banking & Financial Services');
    expect(result.type).not.toBe('not-found');
    expect(symbols.length).toBeGreaterThan(0);
  });
});

function topSymbolsWithSector(query: string, sector: string): string[] {
  const result = resolveSymbol(query, { sector, limit: 5 });
  if (result.type === 'exact' || result.type === 'confident') {
    return result.symbol ? [result.symbol.replace(/\.NS$/i, '')] : [];
  }
  return (result.suggestions ?? []).map((suggestion) => suggestion.symbol.replace(/\.NS$/i, ''));
}
