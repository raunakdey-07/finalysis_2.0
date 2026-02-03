/**
 * Symbol Resolution Layer
 * Translates human input to canonical NSE tickers
 * 
 * Deterministic, fast, no external API dependencies
 */

import symbolsIndex from '@/data/nse_symbols.json';

export interface SymbolEntry {
  symbol: string;
  name: string;
  aliases: string[];
}

/**
 * Normalize input string for matching
 * - Lowercase
 * - Strip punctuation
 * - Collapse whitespace
 * - Remove .ns/.nse suffixes
 */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/\.ns$/i, '')
    .replace(/\.nse$/i, '')
    .replace(/[^\w\s]/g, '') // Remove punctuation except alphanumeric and space
    .replace(/\s+/g, ' ')     // Collapse whitespace
    .trim();
}

/**
 * Calculate token overlap score
 * Counts how many words from the input appear in the target string
 */
function tokenOverlapScore(input: string, target: string): number {
  const inputTokens = input.split(/\s+/).filter(t => t.length > 0);
  const targetTokens = target.split(/\s+/).filter(t => t.length > 0);
  
  const matches = inputTokens.filter(token =>
    targetTokens.some(targetToken => targetToken.includes(token) || token.includes(targetToken))
  ).length;
  
  return matches / Math.max(inputTokens.length, 1);
}

export interface ResolutionResult {
  type: 'exact' | 'confident' | 'suggestions' | 'not-found';
  symbol?: string;      // For exact/confident: canonical ticker
  name?: string;        // For exact/confident: company name
  message?: string;     // Display message for user
  suggestions?: Array<{
    symbol: string;
    name: string;
  }>;
}

/**
 * Resolve human input to NSE symbol(s)
 * 
 * Matching logic in order:
 * 1. Exact alias match
 * 2. Exact name match
 * 3. Partial name match (starts with)
 * 4. Token overlap scoring
 * 5. If multiple candidates with similar scores: return top 3-5 suggestions
 * 
 * Returns:
 * - 'exact': Single confident match found
 * - 'confident': Single match but not exact
 * - 'suggestions': Multiple candidates, user must choose
 * - 'not-found': No matches
 */
export function resolveSymbol(query: string): ResolutionResult {
  if (!query || query.trim().length === 0) {
    return { type: 'not-found', message: 'Please enter a stock name or ticker' };
  }

  const normalized = normalize(query);
  const symbols = symbolsIndex as SymbolEntry[];

  // 1. Exact alias match
  for (const entry of symbols) {
    const normalizedAliases = entry.aliases.map(normalize);
    if (normalizedAliases.includes(normalized)) {
      return {
        type: 'exact',
        symbol: entry.symbol,
        name: entry.name,
        message: `Showing results for ${entry.name}`,
      };
    }
  }

  // 2. Exact name match
  for (const entry of symbols) {
    if (normalize(entry.name) === normalized) {
      return {
        type: 'exact',
        symbol: entry.symbol,
        name: entry.name,
        message: `Showing results for ${entry.name}`,
      };
    }
  }

  // 3. Partial name match (starts with)
  const partialMatches = symbols.filter(entry =>
    normalize(entry.name).startsWith(normalized)
  );

  if (partialMatches.length === 1) {
    return {
      type: 'confident',
      symbol: partialMatches[0].symbol,
      name: partialMatches[0].name,
      message: `Showing results for ${partialMatches[0].name}`,
    };
  }

  if (partialMatches.length > 1 && partialMatches.length <= 5) {
    return {
      type: 'suggestions',
      message: 'Multiple results found. Please select:',
      suggestions: partialMatches.map(e => ({ symbol: e.symbol, name: e.name })),
    };
  }

  // 4. Token overlap scoring
  const scores = symbols.map(entry => ({
    entry,
    score: Math.max(
      tokenOverlapScore(normalized, normalize(entry.name)),
      Math.max(...entry.aliases.map(alias => tokenOverlapScore(normalized, normalize(alias))))
    ),
  }));

  // Filter entries with meaningful overlap (score > 0)
  const meaningful = scores.filter(s => s.score > 0);

  if (meaningful.length === 0) {
    return {
      type: 'not-found',
      message: `No results for "${query}". Try searching by company name.`,
    };
  }

  // Sort by score descending
  meaningful.sort((a, b) => b.score - a.score);

  // If top candidate significantly better than others (2x score), return as confident
  if (meaningful.length >= 2 && meaningful[0].score >= meaningful[1].score * 1.5) {
    return {
      type: 'confident',
      symbol: meaningful[0].entry.symbol,
      name: meaningful[0].entry.name,
      message: `Showing results for ${meaningful[0].entry.name}`,
    };
  }

  // Return top 3-5 suggestions
  const topSuggestions = meaningful.slice(0, 5);
  
  if (topSuggestions.length === 1) {
    return {
      type: 'confident',
      symbol: topSuggestions[0].entry.symbol,
      name: topSuggestions[0].entry.name,
      message: `Showing results for ${topSuggestions[0].entry.name}`,
    };
  }

  return {
    type: 'suggestions',
    message: 'Multiple results found. Please select:',
    suggestions: topSuggestions.map(s => ({
      symbol: s.entry.symbol,
      name: s.entry.name,
    })),
  };
}

/**
 * Extract and validate a symbol string
 * Handles bare tickers like "ITC", "ITC.NS", "itc.ns"
 * Returns canonical symbol or null
 */
export function extractSymbol(input: string): string | null {
  if (!input || input.trim().length === 0) return null;

  const normalized = normalize(input);
  const symbols = symbolsIndex as SymbolEntry[];

  // Direct symbol match (case-insensitive)
  for (const entry of symbols) {
    const symbolNormalized = normalize(entry.symbol);
    if (symbolNormalized === normalized) {
      return entry.symbol;
    }
  }

  return null;
}
