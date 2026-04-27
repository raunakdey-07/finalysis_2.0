/**
 * Symbol Resolution Layer
 * Translates human input to canonical NSE tickers
 * 
 * Deterministic, fast, no external API dependencies
 */

import stocksIndex from '@/data/stocks.json';

export interface SymbolEntry {
  symbol: string;
  name: string;
  aliases: string[];
  sector: string;
  industry?: string;
}

type NormalizedSymbolEntry = {
  symbol: string;
  name: string;
  sector: string;
  industry?: string;
  normalizedName: string;
  normalizedAliases: string[];
  normalizedSymbol: string;
};

type ResolvedSector =
  | 'Information Technology'
  | 'Banking & Financial Services'
  | 'FMCG & Consumer'
  | 'Pharma & Healthcare'
  | 'Auto & Mobility'
  | 'Energy & Utilities'
  | 'Metals & Mining'
  | 'Infrastructure & Industrials'
  | 'Chemicals'
  | 'Real Estate'
  | 'Telecom & Media'
  | 'Textiles & Apparel'
  | 'Agriculture'
  | 'Other';

export interface ResolveSymbolOptions {
  sector?: string;
  limit?: number;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
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

function getCandidateTokens(target: string): string[] {
  const parts = target.split(/\s+/).filter((token) => token.length > 1);
  return Array.from(new Set([target, ...parts]));
}

function typoSimilarity(query: string, target: string): number {
  if (!query || !target) return 0;

  const queryLen = query.length;
  const targetLen = target.length;
  const lenDiff = Math.abs(queryLen - targetLen);

  if (lenDiff > 2) return 0;

  const distance = levenshteinDistance(query, target);

  if (distance === 0) return 1;
  if (distance === 1) return 0.95;
  if (distance === 2 && Math.min(queryLen, targetLen) >= 6) return 0.86;

  return 0;
}

function bestTypoSimilarity(query: string, entry: NormalizedSymbolEntry): number {
  const targets = [entry.normalizedName, ...entry.normalizedAliases, entry.normalizedSymbol]
    .flatMap((target) => getCandidateTokens(target));

  let best = 0;
  for (const target of targets) {
    best = Math.max(best, typoSimilarity(query, target));
    if (best >= 0.95) break;
  }

  return best;
}

function bestEditDistance(query: string, entry: NormalizedSymbolEntry): number {
  const targets = [entry.normalizedName, ...entry.normalizedAliases, entry.normalizedSymbol]
    .flatMap((target) => getCandidateTokens(target));

  let best = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    if (!target) continue;
    if (Math.abs(query.length - target.length) > 4) continue;
    best = Math.min(best, levenshteinDistance(query, target));
  }

  return Number.isFinite(best) ? best : 999;
}

  function stringSimilarity(query: string, target: string): number {
    if (!query || !target) return 0;
    if (query === target) return 1;

    const maxLength = Math.max(query.length, target.length);
    if (maxLength === 0) return 0;

    const distance = levenshteinDistance(query, target);
    const editScore = 1 - distance / maxLength;
    const overlapScore = tokenOverlapScore(query, target);

    let containsScore = 0;
    if (target.includes(query)) {
      containsScore = target.startsWith(query) ? 0.92 : 0.84;
    }

    return clamp(Math.max(containsScore, (editScore * 0.7) + (overlapScore * 0.3)), 0, 1);
  }

  const SECTOR_ALIASES: Record<string, ResolvedSector> = {
    'information technology': 'Information Technology',
    technology: 'Information Technology',
    it: 'Information Technology',
    banking: 'Banking & Financial Services',
    financials: 'Banking & Financial Services',
    finance: 'Banking & Financial Services',
    'banking financials': 'Banking & Financial Services',
    'banking-financials': 'Banking & Financial Services',
    'banking & financial services': 'Banking & Financial Services',
    fmcg: 'FMCG & Consumer',
    consumer: 'FMCG & Consumer',
    retail: 'FMCG & Consumer',
    'fmcg consumer': 'FMCG & Consumer',
    'fmcg & consumer': 'FMCG & Consumer',
    pharma: 'Pharma & Healthcare',
    pharmaceutical: 'Pharma & Healthcare',
    healthcare: 'Pharma & Healthcare',
    'pharma healthcare': 'Pharma & Healthcare',
    'pharma & healthcare': 'Pharma & Healthcare',
    auto: 'Auto & Mobility',
    automobile: 'Auto & Mobility',
    mobility: 'Auto & Mobility',
    'auto mobility': 'Auto & Mobility',
    'auto & mobility': 'Auto & Mobility',
    energy: 'Energy & Utilities',
    utilities: 'Energy & Utilities',
    'energy utilities': 'Energy & Utilities',
    'energy & utilities': 'Energy & Utilities',
    metals: 'Metals & Mining',
    mining: 'Metals & Mining',
    'metals mining': 'Metals & Mining',
    'metals & mining': 'Metals & Mining',
    infrastructure: 'Infrastructure & Industrials',
    infra: 'Infrastructure & Industrials',
    industrials: 'Infrastructure & Industrials',
    'infrastructure industrials': 'Infrastructure & Industrials',
    'infrastructure & industrials': 'Infrastructure & Industrials',
    chemical: 'Chemicals',
    chemicals: 'Chemicals',
    realty: 'Real Estate',
    'real estate': 'Real Estate',
    telecom: 'Telecom & Media',
    media: 'Telecom & Media',
    communication: 'Telecom & Media',
    'telecom media': 'Telecom & Media',
    'telecom & media': 'Telecom & Media',
    textiles: 'Textiles & Apparel',
    textile: 'Textiles & Apparel',
    apparel: 'Textiles & Apparel',
    'textiles apparel': 'Textiles & Apparel',
    'textiles & apparel': 'Textiles & Apparel',
    agriculture: 'Agriculture',
    agri: 'Agriculture',
    other: 'Other',
  };

  function canonicalizeSectorFilter(input?: string): ResolvedSector | null {
    if (!input || input.trim().length === 0) return null;

    const normalizedSector = input.trim().toLowerCase();
    if (normalizedSector === 'all') return null;

    if (SECTOR_ALIASES[normalizedSector]) {
      return SECTOR_ALIASES[normalizedSector];
    }

    const fromTitleCase = (Object.values(SECTOR_ALIASES) as string[]).find(
      (sector) => sector.toLowerCase() === normalizedSector
    );

    return (fromTitleCase as ResolvedSector | undefined) ?? null;
  }

export interface ResolutionResult {
  type: 'exact' | 'confident' | 'suggestions' | 'not-found';
  symbol?: string;      // For exact/confident: canonical ticker
  name?: string;        // For exact/confident: company name
  sector?: string;
  industry?: string;
  message?: string;     // Display message for user
  suggestions?: Array<{
    symbol: string;
    name: string;
    sector: string;
    industry?: string;
  }>;
}

  const symbols = stocksIndex as SymbolEntry[];

const normalizedEntries: NormalizedSymbolEntry[] = symbols.map((entry) => ({
  symbol: entry.symbol,
  name: entry.name,
  sector: entry.sector,
  industry: entry.industry,
  normalizedName: normalize(entry.name),
  normalizedAliases: entry.aliases.map(normalize),
  normalizedSymbol: normalize(entry.symbol),
}));

  const entriesBySymbol = new Map(normalizedEntries.map((entry) => [entry.symbol.toUpperCase(), entry]));

  function inSector(entry: NormalizedSymbolEntry, sectorFilter: ResolvedSector | null): boolean {
    if (!sectorFilter) return true;
    return entry.sector === sectorFilter;
  }

  function scoreEntry(query: string, entry: NormalizedSymbolEntry): number {
    const nameScore = stringSimilarity(query, entry.normalizedName);

    let aliasScore = 0;
    for (const alias of entry.normalizedAliases) {
      aliasScore = Math.max(aliasScore, stringSimilarity(query, alias));
    }

    const symbolScore = stringSimilarity(query, entry.normalizedSymbol);
    const prefixBoost = entry.normalizedName.startsWith(query) ? 0.08 : 0;
    const typoScore = bestTypoSimilarity(query, entry);

    return clamp(Math.max(nameScore + prefixBoost, aliasScore * 0.95, symbolScore * 0.9, typoScore), 0, 1);
  }

  function formatSuggestions(entries: NormalizedSymbolEntry[], limit: number): ResolutionResult['suggestions'] {
    return entries.slice(0, limit).map((entry) => ({
      symbol: entry.symbol,
      name: entry.name,
      sector: entry.sector,
      industry: entry.industry,
    }));
  }

  function resolveCandidatesBySector(sector?: string): {
    candidates: NormalizedSymbolEntry[];
    sectorFilter: ResolvedSector | null;
  } {
    const sectorFilter = canonicalizeSectorFilter(sector);
    if (!sectorFilter) {
      return { candidates: normalizedEntries, sectorFilter };
    }

    return {
      candidates: normalizedEntries.filter((entry) => inSector(entry, sectorFilter)),
      sectorFilter,
    };
  }

  export function getAvailableSectors(): string[] {
    return Array.from(new Set(normalizedEntries.map((entry) => entry.sector))).sort((a, b) => a.localeCompare(b));
  }

  export function isSymbolInSector(symbol: string, sector?: string): boolean {
    const canonicalSector = canonicalizeSectorFilter(sector);
    if (!canonicalSector) return true;

    const normalizedSymbol = symbol.toUpperCase().trim();
    const withSuffix = normalizedSymbol.endsWith('.NS') ? normalizedSymbol : `${normalizedSymbol}.NS`;
    const entry = entriesBySymbol.get(withSuffix);

    return entry ? inSector(entry, canonicalSector) : false;
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
export function resolveSymbol(query: string, options: ResolveSymbolOptions = {}): ResolutionResult {
  if (!query || query.trim().length === 0) {
    return { type: 'not-found', message: 'Please enter a stock name or ticker' };
  }

  const limit = clamp(options.limit ?? 5, 1, 10);
  const normalized = normalize(query);
  const { candidates, sectorFilter } = resolveCandidatesBySector(options.sector);

  if (sectorFilter && candidates.length === 0) {
    return {
      type: 'not-found',
      message: `No stocks found in sector "${sectorFilter}".`,
    };
  }

  if (candidates.length === 0) {
    return {
      type: 'not-found',
      message: 'No stocks are currently available in the local index.',
    };
  }

  // 1. Exact alias match
  for (const entry of candidates) {
    if (entry.normalizedAliases.includes(normalized)) {
      return {
        type: 'exact',
        symbol: entry.symbol,
        name: entry.name,
        sector: entry.sector,
        industry: entry.industry,
        message: `Showing results for ${entry.name}`,
      };
    }
  }

  // 2. Exact name match
  for (const entry of candidates) {
    if (entry.normalizedName === normalized) {
      return {
        type: 'exact',
        symbol: entry.symbol,
        name: entry.name,
        sector: entry.sector,
        industry: entry.industry,
        message: `Showing results for ${entry.name}`,
      };
    }
  }

  // 3. Partial substring match
  const partialMatches = candidates
    .map((entry) => {
      const nameStartsWith = entry.normalizedName.startsWith(normalized);
      const nameContains = entry.normalizedName.includes(normalized);
      const aliasContains = entry.normalizedAliases.some((alias) => alias.includes(normalized));

      if (!nameContains && !aliasContains) {
        return null;
      }

      return {
        entry,
        score: (nameStartsWith ? 3 : 0) + (nameContains ? 2 : 0) + (aliasContains ? 1 : 0),
      };
    })
    .filter((item): item is { entry: NormalizedSymbolEntry; score: number } => item !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.name.localeCompare(b.entry.name);
    });

  if (partialMatches.length === 1) {
    return {
      type: 'confident',
      symbol: partialMatches[0].entry.symbol,
      name: partialMatches[0].entry.name,
      sector: partialMatches[0].entry.sector,
      industry: partialMatches[0].entry.industry,
      message: `Showing results for ${partialMatches[0].entry.name}`,
    };
  }

  if (partialMatches.length > 1) {
    return {
      type: 'suggestions',
      message: 'Multiple results found. Please select:',
      suggestions: formatSuggestions(partialMatches.map((item) => item.entry), limit),
    };
  }

  // 4. Token similarity and fuzzy score
  const scores = candidates.map((entry) => ({
    entry,
    score: scoreEntry(normalized, entry),
    distance: bestEditDistance(normalized, entry),
  }));

  // Filter entries with meaningful similarity
  const meaningful = scores.filter((s) => s.score >= 0.35);

  if (meaningful.length === 0) {
    return {
      type: 'not-found',
      message: `No results for "${query}". Try searching by company name.`,
    };
  }

  // Sort by score descending
  meaningful.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.distance !== b.distance) return a.distance - b.distance;
    return a.entry.name.localeCompare(b.entry.name);
  });

  // If top candidate is clearly better and sufficiently strong, return as confident
  const top = meaningful[0];
  const second = meaningful[1];

  if (
    top.score >= 0.82 &&
    (!second || top.score - second.score >= 0.12)
  ) {
    return {
      type: 'confident',
      symbol: top.entry.symbol,
      name: top.entry.name,
      sector: top.entry.sector,
      industry: top.entry.industry,
      message: `Showing results for ${top.entry.name}`,
    };
  }

  // Return top 3-5 suggestions
  const topSuggestions = meaningful.slice(0, limit);
  
  if (topSuggestions.length === 1) {
    return {
      type: 'confident',
      symbol: topSuggestions[0].entry.symbol,
      name: topSuggestions[0].entry.name,
      sector: topSuggestions[0].entry.sector,
      industry: topSuggestions[0].entry.industry,
      message: `Showing results for ${topSuggestions[0].entry.name}`,
    };
  }

  return {
    type: 'suggestions',
    message: 'Multiple results found. Please select:',
    suggestions: formatSuggestions(topSuggestions.map((s) => s.entry), limit),
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

  // Direct symbol match (case-insensitive)
  for (const entry of normalizedEntries) {
    if (entry.normalizedSymbol === normalized) {
      return entry.symbol;
    }
  }

  return null;
}
