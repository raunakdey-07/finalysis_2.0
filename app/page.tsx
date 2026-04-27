"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Funnel } from "lucide-react";
import type {
  ApiResponse,
  NewsItem,
  Provenance,
  StockFundamentals,
  StockMetrics,
  StockPrice,
  StockSearchSuggestion,
} from "@/types";

const DisclaimerModal = dynamic(() => import("@/components/disclaimer-modal"), {
  ssr: false,
  loading: () => null,
});

const NewsSection = dynamic(() => import("@/components/home/news-section"), {
  ssr: false,
  loading: () => (
    <section className="mb-12">
      <div className="mb-4 flex items-center gap-4">
        <div className="h-px flex-1 bg-stone-200" />
        <span className="text-xs font-medium uppercase tracking-widest text-stone-500">What People Are Saying</span>
        <div className="h-px flex-1 bg-stone-200" />
      </div>
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-4 py-3">
              <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full bg-stone-200" />
              <div className="min-w-0 flex-1">
                <div className="h-4 w-full animate-pulse rounded bg-stone-200" />
                <div className="mt-2 h-3 w-32 animate-pulse rounded bg-stone-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  ),
});

const AnalysisCards = dynamic(() => import("@/components/home/analysis-cards"), {
  ssr: false,
  loading: () => (
    <section className="mb-12 grid gap-6 sm:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border-t-4 border-t-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
            <div className="h-4 w-12 animate-pulse rounded bg-stone-200" />
          </div>
          <div className="mt-4 h-10 w-16 animate-pulse rounded bg-stone-200" />
          <div className="mt-2 h-1.5 w-full animate-pulse rounded bg-stone-200" />
          <div className="mt-5 space-y-2.5 border-t border-stone-100 pt-4">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex justify-between">
                <div className="h-4 w-16 animate-pulse rounded bg-stone-200" />
                <div className="h-4 w-12 animate-pulse rounded bg-stone-200" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  ),
});

// ============================================================================
// DESIGN SYSTEM - Muted, earthy semantic colors
// ============================================================================

/** Conviction colors - not traffic lights, but confidence indicators */
const VERDICT = {
  strong: {
    text: "text-teal-700",
    bg: "bg-teal-500",
    border: "border-teal-200",
    accent: "border-l-teal-500",
  },
  moderate: {
    text: "text-slate-600",
    bg: "bg-slate-400",
    border: "border-slate-200",
    accent: "border-l-slate-400",
  },
  weak: {
    text: "text-amber-700",
    bg: "bg-amber-400",
    border: "border-amber-200",
    accent: "border-l-amber-400",
  },
} as const;

/** Score thresholds */
const SCORE_STRONG = 60;
const SCORE_MODERATE = 40;

/** Get verdict level from score */
function getVerdict(score: number): keyof typeof VERDICT {
  if (score >= SCORE_STRONG) return "strong";
  if (score >= SCORE_MODERATE) return "moderate";
  return "weak";
}

// ============================================================================
// SKELETON COMPONENTS - Loading placeholders
// ============================================================================

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-stone-200 ${className}`} />;
}

function VerdictSkeleton() {
  return (
    <div className="rounded-xl border-l-4 border-l-stone-200 bg-white p-6 shadow-sm">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-1 h-4 w-3/4" />
      <Skeleton className="mt-3 h-3 w-56" />
    </div>
  );
}

// ============================================================================
// Demo presets
// ============================================================================

type DemoTicker = {
  name: string;
};

const DEMO_TICKERS: Record<string, DemoTicker> = {
  "ITC.NS": {
    name: "ITC",
  },
  "TCS.NS": {
    name: "TCS",
  },
  "RELIANCE.NS": {
    name: "Reliance",
  },
  "HDFCBANK.NS": {
    name: "HDFC Bank",
  },
  "INFY.NS": {
    name: "Infosys",
  },
  "BHARTIARTL.NS": {
    name: "Airtel",
  },
  "HINDUNILVR.NS": {
    name: "HUL",
  },
  "ASIANPAINT.NS": {
    name: "Asian Paints",
  },
};

const SEARCH_SECTORS = [
  "All",
  "Information Technology",
  "Banking & Financial Services",
  "FMCG & Consumer",
  "Pharma & Healthcare",
  "Auto & Mobility",
  "Energy & Utilities",
  "Metals & Mining",
  "Infrastructure & Industrials",
  "Chemicals",
  "Real Estate",
  "Telecom & Media",
  "Textiles & Apparel",
  "Agriculture",
] as const;

const SEARCH_SUGGESTION_CACHE_LIMIT = 8;
const SEARCH_SUGGESTION_CACHE_TTL_MS = 10 * 60 * 1000;

const SENTIMENT_WEIGHT: Record<NonNullable<NewsItem["sentiment"]>, number> = {
  positive: 1,
  neutral: 0,
  negative: -1,
};

// ============================================================================
// Utilities
// ============================================================================

/** Format date as relative time */
function relativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function buildSearchParams(query: string, sector: string): URLSearchParams {
  const params = new URLSearchParams({ q: query });
  if (sector !== "All") {
    params.set("sector", sector);
  }
  return params;
}

function buildSearchCacheKey(query: string, sector: string): string {
  return `${sector.toLowerCase()}::${query.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function getCachedSearchSuggestions(
  cache: Map<string, SearchSuggestionCacheEntry>,
  key: string
): StockSearchSuggestion[] | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > SEARCH_SUGGESTION_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.suggestions;
}

function setCachedSearchSuggestions(
  cache: Map<string, SearchSuggestionCacheEntry>,
  key: string,
  suggestions: StockSearchSuggestion[]
): void {
  cache.delete(key);
  cache.set(key, {
    suggestions: suggestions.slice(0, 5),
    timestamp: Date.now(),
  });

  while (cache.size > SEARCH_SUGGESTION_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== "string") break;
    cache.delete(oldestKey);
  }
}

// ============================================================================
// Types
// ============================================================================

type MetricsBundle = StockMetrics & {
  recommendation?: string;
  fundamentals?: StockFundamentals | null;
};

type QuoteState = {
  price: StockPrice | null;
  provenance: Provenance | null;
  error: string | null;
};

type MetricsState = {
  metrics: MetricsBundle | null;
  provenance: Provenance | null;
  error: string | null;
};

type NewsState = {
  items: NewsItem[];
  provenance: Provenance | null;
  error: string | null;
};

type BlendedSentimentState = {
  market: { sentiment: string; score: number; newsCount: number };
  sector: { name: string; key: string; sentiment: string; score: number; newsCount: number } | null;
  company: { symbol: string; sentiment: string; score: number; newsCount: number } | null;
};

type SearchSuggestionCacheEntry = {
  suggestions: StockSearchSuggestion[];
  timestamp: number;
};

export default function Page() {
  const [symbol, setSymbol] = useState<string>("ITC.NS");
  const [symbolInput, setSymbolInput] = useState<string>("ITC.NS");
  const [searchSector, setSearchSector] = useState<string>("All");
  const [isSectorFilterOpen, setIsSectorFilterOpen] = useState<boolean>(false);
  const [searchSuggestions, setSearchSuggestions] = useState<StockSearchSuggestion[]>([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState<boolean>(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(-1);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const searchSuggestionRequestId = useRef(0);
  const searchSuggestionCache = useRef<Map<string, SearchSuggestionCacheEntry>>(new Map());

  const [{ price, provenance: quoteProv, error: quoteError }, setQuoteState] = useState<QuoteState>({
    price: null,
    provenance: null,
    error: null,
  });
  const [loadingQuote, setLoadingQuote] = useState<boolean>(true);

  const [{ metrics }, setMetricsState] = useState<MetricsState>({
    metrics: null,
    provenance: null,
    error: null,
  });
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(true);

  const [{ items: news, provenance: newsProv }, setNewsState] = useState<NewsState>({
    items: [],
    provenance: null,
    error: null,
  });
  const [loadingNews, setLoadingNews] = useState<boolean>(true);
  const [blendedSentiment, setBlendedSentiment] = useState<BlendedSentimentState | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const urlSymbol = url.searchParams.get("symbol");
    if (!urlSymbol) return;

    const normalized = urlSymbol.toUpperCase().trim().replace(/\.NS$/i, "") + ".NS";
    if (!/^[A-Z0-9&\-.]+\.NS$/.test(normalized)) return;

    setSymbol(normalized);
    setSymbolInput(normalized);
  }, []);

  // Fetch quote, metrics, news, and sentiment in a single request whenever symbol changes.
  useEffect(() => {
    let cancelled = false;

    // Clean symbol for API - remove .NS suffix if present
    const apiSymbol = symbol.replace(/\.NS$/i, "");

    async function loadOverview() {
      setLoadingQuote(true);
      setLoadingMetrics(true);
      setLoadingNews(true);

      try {
        const res = await fetch(`/api/overview?symbol=${encodeURIComponent(apiSymbol)}&limit=6`);
        const json: ApiResponse<{
          quote: { data: StockPrice | null; error?: string };
          metrics: { data: MetricsBundle | null; error?: string };
          news: { data: NewsItem[]; error?: string };
          blendedSentiment: BlendedSentimentState | null;
        }> = await res.json();

        if (cancelled) return;

        if (!json.success || !json.data) {
          setQuoteState({ price: null, provenance: json.provenance ?? null, error: json.error ?? "Unable to fetch price" });
          setMetricsState({ metrics: null, provenance: json.provenance ?? null, error: json.error ?? "Unable to fetch metrics" });
          setNewsState({ items: [], provenance: json.provenance ?? null, error: json.error ?? "Unable to fetch news" });
          setBlendedSentiment(null);
          return;
        }

        setQuoteState({
          price: json.data.quote.data ?? null,
          provenance: json.provenance ?? null,
          error: json.data.quote.error ?? null,
        });

        setMetricsState({
          metrics: json.data.metrics.data ?? null,
          provenance: json.provenance ?? null,
          error: json.data.metrics.error ?? null,
        });

        setNewsState({
          items: json.data.news.data ?? [],
          provenance: json.provenance ?? null,
          error: json.data.news.error ?? null,
        });

        setBlendedSentiment(json.data.blendedSentiment ?? null);
      } catch (err) {
        if (cancelled) return;
        const fallbackError = err instanceof Error ? err.message : "Unable to fetch overview";
        setQuoteState({ price: null, provenance: null, error: fallbackError });
        setMetricsState({ metrics: null, provenance: null, error: fallbackError });
        setNewsState({ items: [], provenance: null, error: fallbackError });
        setBlendedSentiment(null);
      } finally {
        if (!cancelled) {
          setLoadingQuote(false);
          setLoadingMetrics(false);
          setLoadingNews(false);
        }
      }
    }

    loadOverview();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const baseTicker = DEMO_TICKERS[symbol];
  const fallbackTicker: DemoTicker = {
    name: symbol,
  };
  const ticker = baseTicker ?? fallbackTicker;
  const displayName = ticker.name;
  const hasLiveQuote = !!price;
  const effectivePrice = hasLiveQuote ? price.price : null;
  const effectiveChange = hasLiveQuote ? price.daily_change_percent : null;
  const stockDataUnavailable = !loadingQuote && (!hasLiveQuote || !!quoteError);
  const lastUpdatedLabel = quoteProv?.lastUpdated
    ? relativeTime(new Date(quoteProv.lastUpdated))
    : "recently";

  const avgNewsSentiment = useMemo(() => {
    if (!news || news.length === 0) return 0;
    const total = news.reduce((acc, item) => {
      if (typeof item.sentimentScore === "number") return acc + item.sentimentScore;
      if (item.sentiment) return acc + SENTIMENT_WEIGHT[item.sentiment];
      return acc;
    }, 0);
    return total / news.length;
  }, [news]);

  const effectiveSentimentScore = useMemo(() => {
    if (!blendedSentiment) return avgNewsSentiment;

    const market = blendedSentiment.market?.score ?? 0;
    const sector = blendedSentiment.sector?.score ?? 0;
    const company = blendedSentiment.company?.score ?? avgNewsSentiment;

    return (company * 0.5) + (sector * 0.3) + (market * 0.2);
  }, [blendedSentiment, avgNewsSentiment]);

  const sentimentLabel = effectiveSentimentScore > 0.15 ? "positive" : effectiveSentimentScore < -0.15 ? "negative" : "neutral";

  // Compute overall conviction for hero summary
  const overallScore = useMemo(() => {
    if (!metrics) return 50;
    const avg = (metrics.profitabilityScore + metrics.valuationScore) / 2;
    // Adjust for sentiment
    if (sentimentLabel === "positive") return Math.min(100, avg + 5);
    if (sentimentLabel === "negative") return Math.max(0, avg - 5);
    return avg;
  }, [metrics, sentimentLabel]);

  const overallVerdict = getVerdict(overallScore);
  const activeSuggestion = activeSuggestionIndex >= 0 ? searchSuggestions[activeSuggestionIndex] ?? null : null;
  const activeSuggestionId = activeSuggestion ? `search-suggestion-${activeSuggestion.symbol}` : undefined;

  const verdictBreakdown = useMemo(() => {
    const concerns: string[] = [];
    const strengths: string[] = [];
    const nextSteps: string[] = [];

    if (!metrics) {
      return { concerns, strengths, nextSteps, modelNote: "" };
    }

    const fundamentals = metrics.fundamentals;

    if (metrics.valuationScore <= 40) {
      concerns.push("Valuation score is weak, indicating a demanding entry price versus current fundamentals.");
      nextSteps.push("Compare valuation with 2-3 direct sector peers before taking a call.");
    } else if (metrics.valuationScore >= 65) {
      strengths.push("Valuation score is supportive, with pricing closer to our fair-value bands.");
    }

    if (metrics.profitabilityScore <= 40) {
      concerns.push("Business quality score is weak (returns/leverage profile needs closer scrutiny).");
      nextSteps.push("Review the last 3 annual reports for debt trend, ROE quality, and cash-flow consistency.");
    } else if (metrics.profitabilityScore >= 65) {
      strengths.push("Business quality score is strong with healthier profitability signals.");
    }

    if (metrics.growthScore <= 40) {
      concerns.push("Growth score is soft, suggesting limited earnings momentum from available data.");
      nextSteps.push("Check recent quarterly results to confirm whether slowdown is temporary or structural.");
    } else if (metrics.growthScore >= 65) {
      strengths.push("Growth score is constructive based on earnings and sector context.");
    }

    if (sentimentLabel === "negative") {
      concerns.push("Recent sentiment trend is negative, which can pressure near-term conviction.");
      nextSteps.push("Read the top negative headlines and verify if the issue is one-off or business-model related.");
    } else if (sentimentLabel === "positive") {
      strengths.push("Recent sentiment trend is positive and supports near-term momentum.");
    }

    if (fundamentals?.debtToEquity !== null && fundamentals?.debtToEquity !== undefined) {
      if (fundamentals.debtToEquity > 1.5) {
        concerns.push("Debt-to-equity is above 1.5, implying elevated leverage risk.");
        nextSteps.push("Track interest coverage and refinancing risk before considering fresh allocation.");
      } else if (fundamentals.debtToEquity < 0.5) {
        strengths.push("Debt-to-equity is below 0.5, indicating a conservative balance sheet.");
      }
    }

    if (fundamentals?.peRatio !== null && fundamentals?.peRatio !== undefined) {
      if (fundamentals.peRatio > 55) {
        concerns.push("P/E is above 55, so future growth expectations are already priced in aggressively.");
        nextSteps.push("Use staggered buying (SIP-style entries) instead of lump-sum when valuation is stretched.");
      } else if (fundamentals.peRatio < 20) {
        strengths.push("P/E is below 20, offering a more conservative valuation anchor.");
      }
    }

    if (concerns.length === 0 && strengths.length === 0) {
      strengths.push("Signals are mixed but not extreme; the model does not detect a dominant red flag.");
    }

    return {
      concerns,
      strengths,
      nextSteps: Array.from(new Set(nextSteps)),
      modelNote: "Heuristics are calibrated for Indian equities with sector-aware ranges, but this remains a screening tool (not a substitute for reading filings and understanding management quality).",
    };
  }, [metrics, sentimentLabel]);

  function openSearchSuggestions(nextSuggestions: StockSearchSuggestion[]) {
    setSearchSuggestions(nextSuggestions);
    setShowSearchSuggestions(nextSuggestions.length > 0);
    setActiveSuggestionIndex(nextSuggestions.length > 0 ? 0 : -1);
  }

  function closeSearchSuggestions() {
    searchSuggestionRequestId.current += 1;
    setShowSearchSuggestions(false);
    setActiveSuggestionIndex(-1);
    setLoadingSuggestions(false);
  }

  function clearSearchSuggestions() {
    searchSuggestionRequestId.current += 1;
    setSearchSuggestions([]);
    setShowSearchSuggestions(false);
    setActiveSuggestionIndex(-1);
    setLoadingSuggestions(false);
  }

  function applyResolvedSymbol(resolved: StockSearchSuggestion) {
    setSymbol(resolved.symbol);
    setSymbolInput(resolved.symbol);
    setSearchMessage(`Showing results for ${resolved.name}`);
    clearSearchSuggestions();

    const url = new URL(window.location.href);
    url.searchParams.set("symbol", resolved.symbol);
    window.history.replaceState({}, "", url.toString());
  }

  useEffect(() => {
    let cancelled = false;
    const query = symbolInput.trim();

    if (query.length < 3) {
      clearSearchSuggestions();
      return;
    }

    const normalizedCurrent = symbol.replace(/\.NS$/i, "").toUpperCase();
    const normalizedQuery = query.replace(/\.NS$/i, "").toUpperCase();
    if (normalizedCurrent === normalizedQuery) {
      clearSearchSuggestions();
      return;
    }

    const cacheKey = buildSearchCacheKey(query, searchSector);
    const cachedSuggestions = getCachedSearchSuggestions(searchSuggestionCache.current, cacheKey);
    if (cachedSuggestions) {
      openSearchSuggestions(cachedSuggestions);
      setLoadingSuggestions(false);
      return;
    }

    const requestId = ++searchSuggestionRequestId.current;
    const timeoutId = window.setTimeout(async () => {
      if (cancelled || requestId !== searchSuggestionRequestId.current) return;
      setLoadingSuggestions(true);

      try {
        const response = await fetch(`/api/nse/search?${buildSearchParams(query, searchSector).toString()}`);
        const json: ApiResponse<StockSearchSuggestion[]> = await response.json();

        if (cancelled || requestId !== searchSuggestionRequestId.current) return;

        const suggestions = (json.data ?? []).slice(0, 5);
        setCachedSearchSuggestions(searchSuggestionCache.current, cacheKey, suggestions);
        openSearchSuggestions(suggestions);
      } catch {
        if (cancelled || requestId !== searchSuggestionRequestId.current) return;
        clearSearchSuggestions();
      } finally {
        if (!cancelled && requestId === searchSuggestionRequestId.current) {
          setLoadingSuggestions(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [symbolInput, searchSector, symbol]);

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!symbolInput.trim()) return;

    setSearchMessage(null);
    closeSearchSuggestions();

    try {
      const query = symbolInput.trim();
      const cacheKey = buildSearchCacheKey(query, searchSector);
      const res = await fetch(`/api/nse/search?${buildSearchParams(query, searchSector).toString()}`);
      const json: ApiResponse<StockSearchSuggestion[]> = await res.json();

      const candidates = json.data ?? [];
      if (!json.success || candidates.length === 0) {
        if (json.errorCode === "QUERY_TOO_SHORT") {
          setSearchMessage("Please type at least 2 characters.");
        } else if (json.errorCode === "RATE_LIMITED") {
          setSearchMessage("Too many searches. Please wait and try again.");
        } else {
          setSearchMessage(json.error ?? "Stock not found. Try company name or ticker.");
        }
        return;
      }

      if (candidates.length > 1) {
        const topMatches = candidates
          .slice(0, 3)
          .map((candidate) => `${candidate.name} (${candidate.displaySymbol})`)
          .join(", ");
        setCachedSearchSuggestions(searchSuggestionCache.current, cacheKey, candidates.slice(0, 5));
        openSearchSuggestions(candidates.slice(0, 5));
        setLoadingSuggestions(false);
        setSearchMessage(
          searchSector === "All"
            ? `Multiple matches found (${topMatches}). Please refine your search.`
            : `Multiple matches found in ${searchSector} (${topMatches}). Please refine your search.`
        );
        return;
      }

      const resolved = candidates[0];
      applyResolvedSymbol(resolved);
    } catch {
      setSearchMessage("Search unavailable right now. Please try again.");
    }
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearchSuggestions();
      return;
    }

    if (searchSuggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setShowSearchSuggestions(true);
      setActiveSuggestionIndex((current) => (current < 0 ? 0 : (current + 1) % searchSuggestions.length));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setShowSearchSuggestions(true);
      setActiveSuggestionIndex((current) => (current <= 0 ? searchSuggestions.length - 1 : current - 1));
      return;
    }

    if (event.key === "Enter" && showSearchSuggestions) {
      event.preventDefault();
      const selectedSuggestion = searchSuggestions[activeSuggestionIndex] ?? searchSuggestions[0];
      if (selectedSuggestion) {
        applyResolvedSymbol(selectedSuggestion);
      }
    }
  }

  return (
    <>
      <DisclaimerModal />
      <div className="min-h-screen bg-stone-50 text-stone-900">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-16">
        
          {/* Masthead - confident but calm */}
          <header className="mb-10 border-b border-stone-200 pb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-500">Finalysis</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-800 sm:text-3xl">
              Simple stock research for India
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Three questions about any NSE stock: Is it a good business? Is it improving? Is the price fair?
            </p>
          </header>

          {/* Stock Selector - informative quick picks */}
          <section className="mb-10">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-stone-500">Popular stocks</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(DEMO_TICKERS).map(([key, value]) => {
              // Show live data only when selected and loaded
              const isSelected = symbol === key;
              const showLiveData = isSelected && !loadingQuote && price;
              
              return (
                <button
                  key={key}
                  onClick={() => {
                    setSymbol(key);
                    setSymbolInput(key);
                    setSearchMessage(null);
                    clearSearchSuggestions();

                    const url = new URL(window.location.href);
                    url.searchParams.set("symbol", key);
                    window.history.replaceState({}, "", url.toString());
                  }}
                  className={`flex items-center justify-between rounded-lg border bg-white px-3 py-2.5 text-left transition ${
                    isSelected 
                      ? "border-stone-800 ring-1 ring-stone-800" 
                      : "border-stone-200 hover:border-stone-400"
                  }`}
                >
                  <span className="text-sm font-medium text-stone-800">{value.name}</span>
                  {showLiveData ? (
                    <span className={`text-xs font-medium ${(price?.daily_change_percent ?? 0) >= 0 ? "text-teal-600" : "text-amber-600"}`}>
                      {(price?.daily_change_percent ?? 0) >= 0 ? "+" : ""}{(price?.daily_change_percent ?? 0).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-stone-400">—</span>
                  )}
                </button>
              );
            })}
          </div>
          <form onSubmit={handleSearch} className="mt-4 flex items-start gap-2">
            <div className="relative flex-1 sm:flex-none sm:w-64">
              <input
                value={symbolInput}
                onChange={(e) => {
                  setSymbolInput(e.target.value);
                }}
                onFocus={() => {
                  if (searchSuggestions.length > 0) {
                    setShowSearchSuggestions(true);
                    setActiveSuggestionIndex((current) => (current < 0 ? 0 : Math.min(current, searchSuggestions.length - 1)));
                  }
                }}
                onKeyDown={handleSearchKeyDown}
                onBlur={() => {
                  window.setTimeout(() => closeSearchSuggestions(), 120);
                }}
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showSearchSuggestions && searchSuggestions.length > 0}
                aria-controls="search-suggestions-listbox"
                aria-activedescendant={activeSuggestionId}
                className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm placeholder:text-stone-500 focus:border-stone-500 focus:outline-none"
                placeholder="Search any NSE ticker (e.g., BAJFINANCE)"
              />
              {showSearchSuggestions ? (
                <div id="search-suggestions-listbox" role="listbox" className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                  {loadingSuggestions ? (
                    <p className="px-3 py-2 text-xs text-stone-500">Finding matches...</p>
                  ) : searchSuggestions.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-stone-500">No matches found.</p>
                  ) : (
                    <ul className="max-h-72 overflow-y-auto">
                      {searchSuggestions.map((suggestion, index) => {
                        const isActive = index === activeSuggestionIndex;

                        return (
                        <li key={`${suggestion.symbol}-${suggestion.sector}`}>
                          <button
                            id={`search-suggestion-${suggestion.symbol}`}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onPointerDown={(event) => {
                              if (event.pointerType !== 'mouse') {
                                event.preventDefault();
                                applyResolvedSymbol(suggestion);
                              }
                            }}
                            onMouseEnter={() => setActiveSuggestionIndex(index)}
                            onClick={() => applyResolvedSymbol(suggestion)}
                            className={`w-full border-b border-stone-100 px-3 py-2 text-left last:border-b-0 hover:bg-stone-50 ${
                              isActive ? 'bg-stone-100' : ''
                            }`}
                          >
                            <p className="text-sm font-medium text-stone-800">{suggestion.name}</p>
                            <p className="text-xs text-stone-500">
                              {suggestion.displaySymbol} · {suggestion.sector}
                              {suggestion.industry ? ` · ${suggestion.industry}` : ""}
                            </p>
                          </button>
                        </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
            <details
              open={isSectorFilterOpen}
              onToggle={(event) => setIsSectorFilterOpen((event.currentTarget as HTMLDetailsElement).open)}
              className="relative"
            >
              <summary className="flex h-[42px] w-10 list-none items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-600 transition hover:border-stone-500 hover:text-stone-800 [&::-webkit-details-marker]:hidden">
                <Funnel className="h-4 w-4" />
                <span className="sr-only">Filter search by sector</span>
              </summary>
              <div className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                <label htmlFor="search-sector" className="mt-2 block text-xs font-medium text-stone-600">
                  Sector Filter
                </label>
                <select
                  id="search-sector"
                  value={searchSector}
                  onChange={(e) => {
                    setSearchSector(e.target.value);
                    setIsSectorFilterOpen(false);
                  }}
                  className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-700 focus:border-stone-500 focus:outline-none"
                >
                  {SEARCH_SECTORS.map((sector) => (
                    <option key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
                </select>
              </div>
            </details>
            <button
              type="submit"
              className="rounded-lg bg-stone-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700"
            >
              Go
            </button>
          </form>
          {searchMessage ? <p className="mt-2 text-xs text-stone-500">{searchMessage}</p> : null}
        </section>

        {/* Hero Summary - The Opinion */}
        <section className="mb-12">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
            <h2 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
              {displayName}
            </h2>
            {loadingQuote ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="flex items-baseline gap-2">
                {stockDataUnavailable || effectivePrice === null || effectiveChange === null ? (
                  <span className="text-sm font-medium text-stone-500">Data unavailable</span>
                ) : (
                  <>
                    <span className="text-2xl font-light text-stone-600">₹{effectivePrice.toLocaleString("en-IN")}</span>
                    <span className={`text-sm font-medium ${effectiveChange >= 0 ? "text-teal-600" : "text-amber-600"}`}>
                      {effectiveChange >= 0 ? "+" : ""}{effectiveChange.toFixed(2)}%
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* The Verdict - dominant, confident */}
          {loadingMetrics ? (
            <VerdictSkeleton />
          ) : metrics ? (
            <div className={`mt-6 rounded-xl border-l-4 ${VERDICT[overallVerdict].accent} bg-white p-6 shadow-sm`}>
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-semibold ${VERDICT[overallVerdict].text}`}>
                  {overallScore >= 65 ? "Worth investigating" : overallScore >= 45 ? "Proceed with caution" : "Red flags present"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">
                {overallScore >= 65 
                  ? `${displayName} shows solid fundamentals and reasonable valuation. The numbers suggest this could be a quality business at a fair price.`
                  : overallScore >= 45 
                  ? `${displayName} has mixed signals. Some metrics look okay, but others warrant closer examination before committing capital.`
                  : `${displayName} raises concerns on multiple fronts. The current valuation or business quality may not justify the risk.`
                }
              </p>
              <p className="mt-3 text-xs text-stone-500">
                Updated {lastUpdatedLabel} · Based on price, fundamentals, and news sentiment
              </p>
              <details className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-stone-700">
                  Why this verdict?
                </summary>
                <div className="mt-3 space-y-3 text-sm text-stone-600">
                  <div>
                    <p className="mb-1 font-medium text-stone-700">Key concerns</p>
                    {verdictBreakdown.concerns.length > 0 ? (
                      <ul className="space-y-1">
                        {verdictBreakdown.concerns.slice(0, 3).map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No material red flags triggered by current inputs.</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 font-medium text-stone-700">What offsets the risk</p>
                    {verdictBreakdown.strengths.length > 0 ? (
                      <ul className="space-y-1">
                        {verdictBreakdown.strengths.slice(0, 3).map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No major offsetting strengths detected.</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 font-medium text-stone-700">Beginner next checks</p>
                    {verdictBreakdown.nextSteps.length > 0 ? (
                      <ul className="space-y-1">
                        {verdictBreakdown.nextSteps.slice(0, 3).map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Start with annual report, investor presentation, and peer comparison before investing.</p>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">{verdictBreakdown.modelNote}</p>
                </div>
              </details>
            </div>
          ) : null}
        </section>

        {/* Section Divider */}
        <div className="mb-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-stone-200" />
          <span className="text-xs font-medium uppercase tracking-widest text-stone-500">The Details</span>
          <div className="h-px flex-1 bg-stone-200" />
        </div>

        <AnalysisCards
          loadingMetrics={loadingMetrics}
          loadingQuote={loadingQuote}
          loadingNews={loadingNews}
          metrics={metrics}
          sentimentLabel={sentimentLabel}
          stockDataUnavailable={stockDataUnavailable}
          effectiveChange={effectiveChange}
          newsCount={news.length}
        />

        <NewsSection loadingNews={loadingNews} news={news} newsProv={newsProv} />

          {/* Footer - minimal, trustworthy */}
          <footer className="border-t border-stone-200 pt-8 text-center">
            <p className="text-xs text-stone-500">
              Data from NSE, Screener.in, and Google News · Cached for reliability
            </p>
            <p className="mt-2 text-xs font-medium text-stone-500">
              This is not financial advice. Always do your own research.
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
