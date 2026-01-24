"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApiResponse, NewsItem, Provenance, StockFundamentals, StockMetrics, StockPrice } from "@/types";
import DisclaimerModal from "@/components/disclaimer-modal";

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

/** Score to confident label - analyst language */
function scoreLabel(score: number): string {
  if (score >= 70) return "Strong";
  if (score >= SCORE_STRONG) return "Solid";
  if (score >= 50) return "Mixed";
  if (score >= SCORE_MODERATE) return "Cautious";
  return "Weak";
}

// ============================================================================
// SKELETON COMPONENTS - Loading placeholders
// ============================================================================

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-stone-200 ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border-t-4 border-t-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="mt-4 h-10 w-16" />
      <Skeleton className="mt-2 h-1.5 w-full" />
      <div className="mt-5 space-y-2.5 border-t border-stone-100 pt-4">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  );
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

function NewsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-4 py-3">
          <Skeleton className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Sentiment verdict */
function sentimentVerdict(label: string): keyof typeof VERDICT {
  if (label === "positive") return "strong";
  if (label === "negative") return "weak";
  return "moderate";
}

// ============================================================================
// Demo presets
// ============================================================================

type DemoTicker = {
  name: string;
  price: number;
  changePct: number;
  sentiment: "positive" | "neutral" | "negative";
  lastUpdated: string;
  cacheTTL: string;
  source: string;
  confidence: "high" | "medium" | "derived";
};

const DEMO_TICKERS: Record<string, DemoTicker> = {
  "ITC.NS": {
    name: "ITC",
    price: 423,
    changePct: -0.6,
    sentiment: "neutral",
    lastUpdated: "recent",
    cacheTTL: "10m",
    source: "NSE public endpoints",
    confidence: "high",
  },
  "TCS.NS": {
    name: "TCS",
    price: 4065,
    changePct: 0.4,
    sentiment: "positive",
    lastUpdated: "recent",
    cacheTTL: "10m",
    source: "NSE public endpoints",
    confidence: "high",
  },
  "RELIANCE.NS": {
    name: "Reliance",
    price: 1286,
    changePct: -0.3,
    sentiment: "neutral",
    lastUpdated: "recent",
    cacheTTL: "10m",
    source: "NSE public endpoints",
    confidence: "medium",
  },
  "HDFCBANK.NS": {
    name: "HDFC Bank",
    price: 1745,
    changePct: 1.2,
    sentiment: "positive",
    lastUpdated: "recent",
    cacheTTL: "10m",
    source: "NSE public endpoints",
    confidence: "high",
  },
  "INFY.NS": {
    name: "Infosys",
    price: 1892,
    changePct: -0.8,
    sentiment: "neutral",
    lastUpdated: "recent",
    cacheTTL: "10m",
    source: "NSE public endpoints",
    confidence: "high",
  },
  "BHARTIARTL.NS": {
    name: "Airtel",
    price: 1654,
    changePct: 0.9,
    sentiment: "positive",
    lastUpdated: "recent",
    cacheTTL: "10m",
    source: "NSE public endpoints",
    confidence: "high",
  },
  "HINDUNILVR.NS": {
    name: "HUL",
    price: 2380,
    changePct: -0.2,
    sentiment: "neutral",
    lastUpdated: "recent",
    cacheTTL: "10m",
    source: "NSE public endpoints",
    confidence: "high",
  },
  "ASIANPAINT.NS": {
    name: "Asian Paints",
    price: 2245,
    changePct: -1.4,
    sentiment: "negative",
    lastUpdated: "recent",
    cacheTTL: "10m",
    source: "NSE public endpoints",
    confidence: "medium",
  },
};

const SENTIMENT_WEIGHT: Record<NonNullable<NewsItem["sentiment"]>, number> = {
  positive: 1,
  neutral: 0,
  negative: -1,
};

// ============================================================================
// Utilities
// ============================================================================

/** Format a number or numeric string to 2 decimals, or return "—" */
function fmt2(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "NA" || value === "") return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return num.toFixed(2);
}

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

export default function Page() {
  const [symbol, setSymbol] = useState<string>("ITC.NS");
  const [symbolInput, setSymbolInput] = useState<string>("ITC.NS");

  const [{ price, provenance: quoteProv, error: quoteError }, setQuoteState] = useState<QuoteState>({
    price: null,
    provenance: null,
    error: null,
  });
  const [loadingQuote, setLoadingQuote] = useState<boolean>(true);

  const [{ metrics, provenance: metricsProv, error: metricsError }, setMetricsState] = useState<MetricsState>({
    metrics: null,
    provenance: null,
    error: null,
  });
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(true);

  const [{ items: news, provenance: newsProv, error: newsError }, setNewsState] = useState<NewsState>({
    items: [],
    provenance: null,
    error: null,
  });
  const [loadingNews, setLoadingNews] = useState<boolean>(true);

  // Fetch quote, metrics, and news whenever symbol changes.
  useEffect(() => {
    let cancelled = false;

    // Clean symbol for API - remove .NS suffix if present
    const apiSymbol = symbol.replace(/\.NS$/i, "");

    async function loadQuote() {
      setLoadingQuote(true);
      try {
        const res = await fetch(`/api/nse/quote?symbol=${encodeURIComponent(apiSymbol)}`);
        const json: ApiResponse<StockPrice | null> = await res.json();
        if (cancelled) return;
        setQuoteState({
          price: json.data ?? null,
          provenance: json.provenance ?? null,
          error: json.success ? json.error ?? null : json.error ?? "Unable to fetch price",
        });
      } catch (err) {
        if (cancelled) return;
        setQuoteState({ price: null, provenance: null, error: err instanceof Error ? err.message : "Unable to fetch price" });
      } finally {
        if (!cancelled) setLoadingQuote(false);
      }
    }

    async function loadMetrics() {
      setLoadingMetrics(true);
      try {
        const res = await fetch(`/api/metrics?symbol=${encodeURIComponent(apiSymbol)}`);
        const json: ApiResponse<MetricsBundle | null> = await res.json();
        if (cancelled) return;
        setMetricsState({
          metrics: json.data ?? null,
          provenance: json.provenance ?? null,
          error: json.success ? json.error ?? null : json.error ?? "Unable to fetch metrics",
        });
      } catch (err) {
        if (cancelled) return;
        setMetricsState({ metrics: null, provenance: null, error: err instanceof Error ? err.message : "Unable to fetch metrics" });
      } finally {
        if (!cancelled) setLoadingMetrics(false);
      }
    }

    async function loadNews() {
      setLoadingNews(true);
      try {
        const res = await fetch(`/api/news?symbol=${encodeURIComponent(apiSymbol)}&limit=6`);
        const json: ApiResponse<NewsItem[]> = await res.json();
        if (cancelled) return;
        setNewsState({
          items: json.data ?? [],
          provenance: json.provenance ?? null,
          error: json.success ? json.error ?? null : json.error ?? "Unable to fetch news",
        });
      } catch (err) {
        if (cancelled) return;
        setNewsState({ items: [], provenance: null, error: err instanceof Error ? err.message : "Unable to fetch news" });
      } finally {
        if (!cancelled) setLoadingNews(false);
      }
    }

    loadQuote();
    loadMetrics();
    loadNews();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const baseTicker = DEMO_TICKERS[symbol];
  const fallbackTicker: DemoTicker = {
    name: symbol,
    price: price?.price ?? 0,
    changePct: price?.changePercent ?? 0,
    sentiment: "neutral",
    lastUpdated: quoteProv?.lastUpdated ? new Date(quoteProv.lastUpdated).toLocaleString() : "recent",
    cacheTTL: quoteProv?.cacheTTL ?? "10m",
    source: quoteProv?.source ?? "NSE public endpoints",
    confidence: quoteProv?.confidenceLevel ?? "medium",
  };
  const ticker = baseTicker ?? fallbackTicker;
  const displayName = ticker.name;
  const effectivePrice = price?.price ?? ticker.price;
  const effectiveChange = price?.changePercent ?? ticker.changePct;
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

  const sentimentLabel = avgNewsSentiment > 0.15 ? "positive" : avgNewsSentiment < -0.15 ? "negative" : "neutral";

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

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!symbolInput) return;
    setSymbol(symbolInput.toUpperCase());
  }

  return (
    <>
      <DisclaimerModal />
      <div className="min-h-screen bg-stone-50 text-stone-900">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-16">
        
          {/* Masthead - confident but calm */}
          <header className="mb-10 border-b border-stone-200 pb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-400">Finalysis</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-800 sm:text-3xl">
              Simple stock research for India
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Three questions about any NSE stock: Is it a good business? Is it improving? Is the price fair?
            </p>
          </header>

          {/* Stock Selector - informative quick picks */}
          <section className="mb-10">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-stone-400">Popular stocks</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(DEMO_TICKERS).map(([key, value]) => (
              <button
                key={key}
                onClick={() => {
                  setSymbol(key);
                  setSymbolInput(key);
                }}
                className={`flex items-center justify-between rounded-lg border bg-white px-3 py-2.5 text-left transition ${
                  symbol === key 
                    ? "border-stone-800 ring-1 ring-stone-800" 
                    : "border-stone-200 hover:border-stone-400"
                }`}
              >
                <span className="text-sm font-medium text-stone-800">{value.name}</span>
                <span className={`text-xs font-medium ${value.changePct >= 0 ? "text-teal-600" : "text-amber-600"}`}>
                  {value.changePct >= 0 ? "+" : ""}{value.changePct.toFixed(1)}%
                </span>
              </button>
            ))}
          </div>
          <form onSubmit={handleSearch} className="mt-4 flex gap-2">
            <input
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              className="flex-1 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm placeholder:text-stone-400 focus:border-stone-500 focus:outline-none sm:flex-none sm:w-64"
              placeholder="Search any NSE ticker (e.g., BAJFINANCE)"
            />
            <button
              type="submit"
              className="rounded-lg bg-stone-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700"
            >
              Go
            </button>
          </form>
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
                <span className="text-2xl font-light text-stone-600">₹{effectivePrice.toLocaleString("en-IN")}</span>
                <span className={`text-sm font-medium ${effectiveChange >= 0 ? "text-teal-600" : "text-amber-600"}`}>
                  {effectiveChange >= 0 ? "+" : ""}{effectiveChange.toFixed(2)}%
                </span>
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
              <p className="mt-3 text-xs text-stone-400">
                Updated {lastUpdatedLabel} · Based on price, fundamentals, and news sentiment
              </p>
            </div>
          ) : null}
        </section>

        {/* Section Divider */}
        <div className="mb-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-stone-200" />
          <span className="text-xs font-medium uppercase tracking-widest text-stone-400">The Details</span>
          <div className="h-px flex-1 bg-stone-200" />
        </div>

        {/* Three Analysis Cards - consistent but varied by role */}
        <section className="mb-12 grid gap-6 sm:grid-cols-3">
          
          {/* Card 1: Good Business? */}
          {loadingMetrics ? (
            <CardSkeleton />
          ) : (() => {
            const score = metrics?.profitabilityScore ?? 50;
            const verdict = getVerdict(score);
            return (
              <div className={`rounded-xl border-t-4 ${VERDICT[verdict].accent.replace('border-l-', 'border-t-')} bg-white p-5 shadow-sm`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-stone-600">Good business?</p>
                  {metrics && (
                    <span className={`text-xs font-semibold ${VERDICT[verdict].text}`}>{scoreLabel(score)}</span>
                  )}
                </div>
                
                {metrics ? (
                  <>
                    <p className={`mt-4 text-4xl font-semibold ${VERDICT[verdict].text}`}>{score}</p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                      <div className={`h-1.5 rounded-full transition-all ${VERDICT[verdict].bg}`} style={{ width: `${score}%` }} />
                    </div>
                    
                    <div className="mt-5 space-y-2.5 border-t border-stone-100 pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-400">ROE</span>
                        <span className="font-medium text-stone-700">{fmt2(metrics.fundamentals?.roe)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-400">ROCE</span>
                        <span className="font-medium text-stone-700">{fmt2(metrics.fundamentals?.roce)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-400">Dividend</span>
                        <span className="font-medium text-stone-700">{fmt2(metrics.fundamentals?.dividendYield)}%</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="mt-6 text-sm text-stone-400">Data unavailable</p>
                )}
              </div>
            );
          })()}

          {/* Card 2: Getting Better? */}
          {loadingQuote && loadingNews ? (
            <CardSkeleton />
          ) : (() => {
            const verdict = sentimentVerdict(sentimentLabel);
            const momentumScore = sentimentLabel === "positive" ? 70 : sentimentLabel === "negative" ? 30 : 50;
            return (
              <div className={`rounded-xl border-t-4 ${VERDICT[verdict].accent.replace('border-l-', 'border-t-')} bg-white p-5 shadow-sm`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-stone-600">Getting better?</p>
                  <span className={`text-xs font-semibold ${VERDICT[verdict].text}`}>
                    {sentimentLabel === "positive" ? "Yes" : sentimentLabel === "negative" ? "No" : "Mixed"}
                  </span>
                </div>
                
                    <p className={`mt-4 text-4xl font-semibold ${effectiveChange >= 1 ? "text-teal-600" : effectiveChange <= -1 ? "text-amber-600" : "text-stone-600"}`}>
                      {effectiveChange >= 0 ? "+" : ""}{effectiveChange.toFixed(2)}%
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                      <div className={`h-1.5 rounded-full transition-all ${VERDICT[verdict].bg}`} style={{ width: `${momentumScore}%` }} />
                    </div>
                    
                    <div className="mt-5 space-y-2.5 border-t border-stone-100 pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-400">Today</span>
                        <span className={`font-medium ${effectiveChange >= 0 ? "text-teal-600" : "text-amber-600"}`}>
                          {effectiveChange >= 0 ? "Up" : "Down"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-400">News tone</span>
                        <span className="font-medium capitalize text-stone-700">{sentimentLabel}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-400">Articles</span>
                        <span className="font-medium text-stone-700">{news.length}</span>
                      </div>
                    </div>
              </div>
            );
          })()}

          {/* Card 3: Fair Price? */}
          {loadingMetrics ? (
            <CardSkeleton />
          ) : (() => {
            const score = metrics?.valuationScore ?? 50;
            const verdict = getVerdict(score);
            return (
              <div className={`rounded-xl border-t-4 ${VERDICT[verdict].accent.replace('border-l-', 'border-t-')} bg-white p-5 shadow-sm`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-stone-600">Fair price?</p>
                  {metrics && (
                    <span className={`text-xs font-semibold ${VERDICT[verdict].text}`}>{scoreLabel(score)}</span>
                  )}
                </div>
                
                {metrics ? (
                  <>
                    <p className={`mt-4 text-4xl font-semibold ${VERDICT[verdict].text}`}>{score}</p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                      <div className={`h-1.5 rounded-full transition-all ${VERDICT[verdict].bg}`} style={{ width: `${score}%` }} />
                    </div>
                    
                    <div className="mt-5 space-y-2.5 border-t border-stone-100 pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-400">P/E</span>
                        <span className="font-medium text-stone-700">{fmt2(metrics.fundamentals?.peRatio)}x</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-400">P/B</span>
                        <span className="font-medium text-stone-700">{fmt2(metrics.fundamentals?.pbRatio)}x</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-400">Book value</span>
                        <span className="font-medium text-stone-700">₹{fmt2(metrics.fundamentals?.bookValue)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="mt-6 text-sm text-stone-400">Data unavailable</p>
                )}
              </div>
            );
          })()}
        </section>

        {/* News as Evidence - editorial treatment */}
        <section className="mb-12">
          <div className="mb-4 flex items-center gap-4">
            <div className="h-px flex-1 bg-stone-200" />
            <span className="text-xs font-medium uppercase tracking-widest text-stone-400">What People Are Saying</span>
            <div className="h-px flex-1 bg-stone-200" />
          </div>
          
          <div className="rounded-xl bg-white p-5 shadow-sm">
            {loadingNews ? (
              <NewsSkeleton />
            ) : news.length === 0 ? (
              <p className="py-6 text-center text-sm text-stone-400">No recent coverage found for this stock.</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {news.slice(0, 5).map((item) => {
                  const itemVerdict = sentimentVerdict(item.sentiment || "neutral");
                  return (
                    <a
                      key={item.id}
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-start gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <span className={`mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full ${VERDICT[itemVerdict].bg}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-relaxed text-stone-700 group-hover:text-stone-900">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-stone-400">
                          <span className="font-medium">{item.source}</span> · {relativeTime(new Date(item.pubDate))}
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-stone-400">
            News aggregated from {newsProv?.source ?? "Google News RSS"} for sentiment analysis
          </p>
        </section>

          {/* Footer - minimal, trustworthy */}
          <footer className="border-t border-stone-200 pt-8 text-center">
            <p className="text-xs text-stone-400">
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
