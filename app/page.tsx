"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Funnel } from "lucide-react";
import type {
  ApiResponse,
  Provenance,
  StockFundamentals,
  StockSearchSuggestion,
} from "@/types";
import type { MetricsPayload } from "@/app/api/metrics/route";
import type { NewsPayload } from "@/app/api/news/route";
import type { ScreeningVerdict } from "@/lib/metrics";
import { AnalysisCards } from "@/components/home/analysis-cards";
import { DataNote } from "@/components/home/data-note";
import { NewsSection } from "@/components/home/news-section";
import { styleFor } from "@/components/home/score-style";
import { MethodologyDialog } from "@/components/disclaimer-modal";
import { ScoreExplanation } from "@/components/ui/metric-explanation";
import { formatRupees, formatSignedPercent } from "@/lib/format";

const DEFAULT_SYMBOL = "ITC.NS";

const QUICK_PICKS: { symbol: string; label: string }[] = [
  { symbol: "RELIANCE.NS", label: "Reliance" },
  { symbol: "TCS.NS", label: "TCS" },
  { symbol: "HDFCBANK.NS", label: "HDFC Bank" },
  { symbol: "INFY.NS", label: "Infosys" },
  { symbol: "ICICIBANK.NS", label: "ICICI Bank" },
  { symbol: "SBIN.NS", label: "State Bank" },
  { symbol: "ITC.NS", label: "ITC" },
  { symbol: "BHARTIARTL.NS", label: "Airtel" },
];

const SECTORS = [
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

const SUGGESTION_CACHE_LIMIT = 8;
const SUGGESTION_TTL_MS = 10 * 60 * 1000;
const SUGGESTION_DEBOUNCE_MS = 220;
const MIN_SUGGESTION_QUERY = 2;

type SuggestionCacheEntry = { suggestions: StockSearchSuggestion[]; timestamp: number };

/** Keyed so that the same question with different casing or spacing shares a result. */
function suggestionKey(query: string, sector: string): string {
  return `${sector.toLowerCase()}::${query.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function toApiSymbol(symbol: string): string {
  return symbol.replace(/\.NS$/i, "");
}

/**
 * Suggested next steps, derived from the figures that are actually present.
 *
 * A missing figure produces a prompt to go and check it, not a silent gap.
 */
function buildNextChecks(
  fundamentals: StockFundamentals | null,
  verdict: ScreeningVerdict | null
): string[] {
  if (!fundamentals) return [];

  const checks: string[] = [];

  if (fundamentals.bookValue !== null && fundamentals.bookValue < 0) {
    checks.push(
      "Net worth per share is negative. Look at the balance sheet and the debt schedule before reading anything into the price."
    );
  }

  if (fundamentals.peRatio === null) {
    checks.push(
      "No P/E is shown. For a company not in profit, work from cash, debt and book value instead."
    );
  } else if (fundamentals.peRatio > 40) {
    checks.push(
      `P/E is ${fundamentals.peRatio.toFixed(1)}, which is a high multiple. Check whether growth and returns justify it.`
    );
  }

  if (fundamentals.roe === null) {
    checks.push(
      "No return on equity is shown. That usually means negative or very small net worth, or that it was not reported."
    );
  }

  if (fundamentals.eps !== null && fundamentals.eps < 0) {
    checks.push(
      `The latest full year was loss-making (EPS ${fundamentals.eps.toFixed(2)}). Check whether it was a one-off or structural.`
    );
  }

  if (verdict && verdict.coverage < 0.6) {
    checks.push(
      `Only ${Math.round(verdict.coverage * 100)}% of the figures this screen uses were published. Confirm the rest in the annual report.`
    );
  }

  checks.push("Read the latest annual report and compare the same figures against two or three peers.");

  return Array.from(new Set(checks)).slice(0, 3);
}

export default function Page() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [symbolInput, setSymbolInput] = useState(DEFAULT_SYMBOL);
  const [sector, setSector] = useState<string>("All");
  const [sectorOpen, setSectorOpen] = useState(false);

  const [suggestions, setSuggestions] = useState<StockSearchSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [news, setNews] = useState<NewsPayload | null>(null);
  const [newsProvenance, setNewsProvenance] = useState<Provenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const suggestionAbort = useRef<AbortController | null>(null);
  const suggestionCache = useRef<Map<string, SuggestionCacheEntry>>(new Map());

  const load = useCallback(async (apiSymbol: string, signal: AbortSignal) => {
    const [metricsResponse, newsResponse] = await Promise.allSettled([
      fetch(`/api/metrics?symbol=${encodeURIComponent(apiSymbol)}`, { signal }),
      fetch(`/api/news?symbol=${encodeURIComponent(apiSymbol)}&limit=8`, { signal }),
    ]);

    if (metricsResponse.status === "fulfilled") {
      const body: ApiResponse<MetricsPayload> = await metricsResponse.value.json();
      if (body.success && body.data) {
        setMetrics(body.data);
      } else {
        setMetrics(null);
      }
    } else {
      setMetrics(null);
    }

    if (newsResponse.status === "fulfilled") {
      const body: ApiResponse<NewsPayload> = await newsResponse.value.json();
      if (body.success && body.data) {
        setNews(body.data);
        setNewsProvenance(body.provenance ?? null);
      } else {
        setNews(null);
        setNewsProvenance(body.provenance ?? null);
      }
    } else {
      setNews(null);
    }
  }, []);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("symbol");
    if (!fromUrl) return;

    const normalized = fromUrl.toUpperCase().trim();
    if (!/^[A-Z0-9&\-]{1,20}$/.test(normalized)) return;

    const canonical = `${normalized.replace(/\.NS$/i, "")}.NS`;
    setSymbol(canonical);
    setSymbolInput(canonical);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    const id = ++requestId.current;

    setLoading(true);
    setRetrying(false);
    setMetrics(null);
    setNews(null);
    setNewsProvenance(null);

    load(toApiSymbol(symbol), controller.signal)
      .catch(() => undefined)
      .finally(() => {
        if (id === requestId.current && !controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [symbol, attempt, load]);

  function selectSymbol(next: string) {
    const canonical = `${toApiSymbol(next).toUpperCase()}.NS`;
    setSymbol(canonical);
    setSymbolInput(canonical);
    setSearchMessage(null);
    setSuggestionsOpen(false);
    setSuggestions([]);
    setActiveSuggestion(-1);

    const url = new URL(window.location.href);
    url.searchParams.set("symbol", canonical);
    window.history.replaceState({}, "", url.toString());
  }

  const clearSuggestions = useCallback(() => {
    suggestionAbort.current?.abort();
    setSuggestions([]);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    setSuggestionsLoading(false);
  }, []);

  useEffect(() => {
    const query = symbolInput.trim();

    if (query.length < MIN_SUGGESTION_QUERY) {
      clearSuggestions();
      return;
    }

    if (toApiSymbol(query).toUpperCase() === toApiSymbol(symbol).toUpperCase()) {
      clearSuggestions();
      return;
    }

    const key = suggestionKey(query, sector);
    const cachedSuggestion = suggestionCache.current.get(key);
    if (cachedSuggestion && Date.now() - cachedSuggestion.timestamp < SUGGESTION_TTL_MS) {
      setSuggestions(cachedSuggestion.suggestions);
      setSuggestionsOpen(true);
      setActiveSuggestion(0);
      setSuggestionsLoading(false);
      return;
    }

    const controller = new AbortController();
    suggestionAbort.current = controller;

    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      setSuggestionsOpen(true);

      try {
        const params = new URLSearchParams({ q: query });
        if (sector !== "All") params.set("sector", sector);

        const response = await fetch(`/api/nse/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const body: ApiResponse<StockSearchSuggestion[]> = await response.json();

        if (controller.signal.aborted) return;

        const found = (body.data ?? []).slice(0, 5);
        suggestionCache.current.delete(key);
        suggestionCache.current.set(key, { suggestions: found, timestamp: Date.now() });
        while (suggestionCache.current.size > SUGGESTION_CACHE_LIMIT) {
          const oldest = suggestionCache.current.keys().next();
          if (oldest.done) break;
          suggestionCache.current.delete(oldest.value);
        }

        setSuggestions(found);
        setSuggestionsOpen(true);
        setActiveSuggestion(found.length > 0 ? 0 : -1);
      } catch {
        if (!controller.signal.aborted) clearSuggestions();
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, SUGGESTION_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [symbolInput, sector, symbol, clearSuggestions]);

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = symbolInput.trim();
    if (query.length === 0) return;

    clearSuggestions();
    setSearchMessage(null);

    const params = new URLSearchParams({ q: query });
    if (sector !== "All") params.set("sector", sector);

    try {
      const response = await fetch(`/api/nse/search?${params.toString()}`);
      const body: ApiResponse<StockSearchSuggestion[]> = await response.json();

      const matches = body.data ?? [];
      if (matches.length === 0) {
        setSearchMessage(body.error ?? "No stock matched that search.");
        return;
      }

      if (matches.length > 1) {
        setSearchMessage(
          `Several stocks matched: ${matches
            .slice(0, 3)
            .map((match) => match.name)
            .join(", ")}. Pick one from the list.`
        );
        setSuggestions(matches.slice(0, 5));
        setSuggestionsOpen(true);
        setActiveSuggestion(0);
        return;
      }

      selectSymbol(matches[0].symbol);
    } catch {
      setSearchMessage("Search is unavailable right now. Try again in a moment.");
    }
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      clearSuggestions();
      return;
    }
    if (suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((current) => (current < 0 ? 0 : (current + 1) % suggestions.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1
      );
    } else if (event.key === "Enter" && suggestionsOpen) {
      event.preventDefault();
      const chosen = suggestions[activeSuggestion] ?? suggestions[0];
      if (chosen) selectSymbol(chosen.symbol);
    }
  }

  const price = metrics?.quote ?? null;
  const fundamentals = metrics?.fundamentals ?? null;
  const verdict = metrics?.verdict ?? null;
  const nextChecks = useMemo(
    () => buildNextChecks(fundamentals, verdict),
    [fundamentals, verdict]
  );

  const verdictStyle = styleFor(
    verdict?.label === "insufficient-data" ? "unknown" : (verdict?.label ?? "unknown")
  );

  const warnings = [
    ...(metrics?.quoteProvenance?.warnings ?? []),
    ...(metrics?.fundamentalsProvenance?.warnings ?? []),
    ...(newsProvenance?.warnings ?? []),
  ];

  const nothingLoaded = !loading && !price && !fundamentals;
  const activeSuggestionId =
    activeSuggestion >= 0 ? `stock-suggestion-${suggestions[activeSuggestion]?.symbol}` : undefined;
  const showSuggestions = suggestionsOpen && !suggestionsLoading && suggestions.length > 0;

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>

      <div className="min-h-screen bg-stone-50 text-stone-900">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
          <header className="mb-8 border-b border-stone-200 pb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-500">
              Finalysis
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-800 sm:text-3xl">
              Read an NSE company with published numbers
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
              Prices, published company figures, and recent headlines for a fixed set of NSE
              tickers. Every number on the page says where it came from and when it was true.
            </p>
          </header>

          <section aria-labelledby="search-heading" className="mb-8">
            <h2 id="search-heading" className="mb-3 text-xs font-medium uppercase tracking-wider text-stone-500">
              Find a company
            </h2>

            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUICK_PICKS.map((pick) => (
                <li key={pick.symbol}>
                  <button
                    type="button"
                    onClick={() => selectSymbol(pick.symbol)}
                    aria-current={symbol === pick.symbol ? "true" : undefined}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition ${
                      symbol === pick.symbol
                        ? "border-stone-800 bg-white text-stone-900 ring-1 ring-stone-800"
                        : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"
                    }`}
                  >
                    {pick.label}
                  </button>
                </li>
              ))}
            </ul>

            <form onSubmit={handleSearchSubmit} className="mt-4 flex items-start gap-2">
              <div className="relative flex-1 sm:w-72">
                <label htmlFor="stock-search" className="sr-only">
                  Search by ticker or company name
                </label>
                <input
                  id="stock-search"
                  value={symbolInput}
                  onChange={(event) => {
                    clearSuggestions();
                    setSearchMessage(null);
                    setSymbolInput(event.target.value);
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) {
                      setSuggestionsOpen(true);
                      setActiveSuggestion((current) =>
                        current < 0 ? 0 : Math.min(current, suggestions.length - 1)
                      );
                    }
                  }}
                  onKeyDown={handleSearchKeyDown}
                  onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={showSuggestions}
                  aria-controls={showSuggestions ? "stock-suggestions" : undefined}
                  aria-activedescendant={showSuggestions ? activeSuggestionId : undefined}
                  className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm placeholder:text-stone-500 focus:border-stone-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-700"
                  placeholder="Ticker or company name, e.g. BAJFINANCE"
                />

                {suggestionsOpen && (suggestionsLoading || suggestions.length === 0) ? (
                  <p
                    role="status"
                    className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600 shadow-sm"
                  >
                    {suggestionsLoading ? "Searching…" : "No matches."}
                  </p>
                ) : null}

                {showSuggestions ? (
                  <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                    <ul
                      id="stock-suggestions"
                      role="listbox"
                      aria-label="Stock suggestions"
                      className="max-h-72 overflow-y-auto"
                    >
                      {suggestions.map((suggestion, index) => (
                        <li key={suggestion.symbol} role="presentation">
                          <button
                            id={`stock-suggestion-${suggestion.symbol}`}
                            type="button"
                            role="option"
                            aria-selected={index === activeSuggestion}
                            onPointerDown={(event) => {
                              if (event.pointerType !== "mouse") {
                                event.preventDefault();
                                selectSymbol(suggestion.symbol);
                              }
                            }}
                            onMouseEnter={() => setActiveSuggestion(index)}
                            onClick={() => selectSymbol(suggestion.symbol)}
                            className={`w-full border-b border-stone-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-stone-50 ${
                              index === activeSuggestion ? "bg-stone-100" : ""
                            }`}
                          >
                            <span className="block text-sm font-medium text-stone-800">
                              {suggestion.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-stone-500">
                              {suggestion.displaySymbol} · {suggestion.sector}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <details
                open={sectorOpen}
                onToggle={(event) => setSectorOpen((event.currentTarget as HTMLDetailsElement).open)}
                className="relative"
              >
                <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-600 transition hover:border-stone-500 hover:text-stone-800 focus-visible:ring-2 focus-visible:ring-stone-700 [&::-webkit-details-marker]:hidden">
                  <Funnel className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Filter search by sector</span>
                </summary>
                <div className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                  <label htmlFor="search-sector" className="block text-xs font-medium text-stone-600">
                    Sector
                  </label>
                  <select
                    id="search-sector"
                    value={sector}
                    onChange={(event) => {
                      setSector(event.target.value);
                      setSectorOpen(false);
                    }}
                    className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-700 focus:border-stone-500 focus:outline-none"
                  >
                    {SECTORS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </details>

              <button
                type="submit"
                className="rounded-lg bg-stone-800 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700 focus-visible:ring-2 focus-visible:ring-stone-700 focus-visible:ring-offset-2"
              >
                Go
              </button>
            </form>

            <div role="status" aria-live="polite" className="min-h-5">
              {searchMessage ? <p className="mt-2 text-xs text-stone-600">{searchMessage}</p> : null}
            </div>
          </section>

          <main id="main">
            <section aria-labelledby="company-heading" className="mb-8">
              <h2
                id="company-heading"
                className="wrap-break-word text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl"
              >
                {fundamentals?.companyName ?? toApiSymbol(symbol)}
              </h2>

              {loading ? (
                <p className="mt-2 text-sm text-stone-500" role="status">
                  Loading figures…
                </p>
              ) : price ? (
                <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-2xl font-light tabular-nums text-stone-700">
                    {formatRupees(price.price)}
                  </span>
                  {price.changePercent !== null ? (
                    <span
                      className={`text-sm font-medium tabular-nums ${
                        price.changePercent >= 0 ? "text-teal-800" : "text-amber-800"
                      }`}
                    >
                      {formatSignedPercent(price.changePercent)}
                    </span>
                  ) : (
                    <span className="text-sm text-stone-500">Session change not reported</span>
                  )}
                </p>
              ) : (
                <p className="mt-2 text-sm text-stone-600">
                  No price could be retrieved for {toApiSymbol(symbol)}.
                </p>
              )}

              {fundamentals?.sector || fundamentals?.industry ? (
                <p className="mt-1 text-xs text-stone-500">
                  {[fundamentals.industry, fundamentals.sector].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </section>

            <DataNote
              price={price}
              fundamentals={fundamentals}
              quoteProvenance={metrics?.quoteProvenance ?? null}
              fundamentalsProvenance={metrics?.fundamentalsProvenance ?? null}
              warnings={Array.from(new Set(warnings))}
              retrying={retrying}
              onRetry={() => {
                setRetrying(true);
                setAttempt((value) => value + 1);
              }}
            />

            <section aria-labelledby="verdict-heading" className="mb-10">
              <h2 id="verdict-heading" className="sr-only">
                Screening verdict
              </h2>

              {loading ? (
                <div className="border-l-4 border-l-stone-200 bg-white p-6 shadow-sm">
                  <p className="text-sm text-stone-500" role="status">
                    Working out the screening picture…
                  </p>
                </div>
              ) : nothingLoaded ? (
                <div className="border-l-4 border-l-amber-700 bg-white p-6 shadow-sm">
                  <p className="text-lg font-semibold text-amber-900">
                    Nothing could be loaded for {toApiSymbol(symbol)}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-stone-700">
                    Both the price source and the company-figures source failed. That is a data
                    problem, not a view about the company. The status above says which source
                    failed; try again in a moment.
                  </p>
                </div>
              ) : verdict ? (
                <div className={`border-l-4 bg-white p-6 shadow-sm ${verdictStyle.rule}`}>
                  <p className="flex items-center gap-1.5">
                    <span className={`text-xl font-semibold ${verdictStyle.text}`}>
                      {verdict.headline}
                    </span>
                    <ScoreExplanation metric="screeningVerdict" />
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-stone-700">{verdict.summary}</p>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">{verdict.basis}</p>
                  <p className="mt-3 text-xs text-stone-500">
                    A screening verdict describes what a few published numbers look like against
                    sector bands. It is not a recommendation, a target price, or a prediction.
                  </p>

                  {nextChecks.length > 0 ? (
                    <div className="mt-5 border-t border-stone-100 pt-4">
                      <h3 className="text-sm font-medium text-stone-700">What to check next</h3>
                      <ul className="mt-2 space-y-2">
                        {nextChecks.map((check) => (
                          <li key={check} className="text-sm leading-relaxed text-stone-600">
                            {check}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="border-l-4 border-l-stone-300 bg-white p-6 shadow-sm">
                  <p className="text-lg font-semibold text-stone-700">
                    No screening verdict for {toApiSymbol(symbol)}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-stone-700">
                    The price source answered but the company-figures source did not, so there is
                    nothing to screen. This says nothing about the company itself.
                  </p>
                </div>
              )}
            </section>

            <h2
              id="figures-heading"
              className="mb-5 flex items-center gap-4 text-xs font-medium uppercase tracking-widest text-stone-500"
            >
              <span className="h-px flex-1 bg-stone-200" aria-hidden="true" />
              <span>The figures</span>
              <span className="h-px flex-1 bg-stone-200" aria-hidden="true" />
            </h2>

            <section aria-labelledby="figures-heading" className="contents">
              <AnalysisCards
                fundamentals={fundamentals}
                metrics={metrics?.metrics ?? null}
                price={price}
                news={
                  news
                    ? {
                        tone: news.tone.tone,
                        articleCount: news.tone.articleCount,
                        note: news.tone.note,
                      }
                    : null
                }
                loading={loading}
              />
            </section>

            <NewsSection
              items={news?.items ?? []}
              tone={
                news
                  ? {
                      tone: news.tone.tone,
                      articleCount: news.tone.articleCount,
                      note: news.tone.note,
                    }
                  : null
              }
              provenance={newsProvenance}
              loading={loading}
            />
          </main>

          <footer className="border-t border-stone-200 pt-8">
            <p className="text-xs leading-relaxed text-stone-600">
              Prices from Yahoo Finance, company figures from Screener.in, headlines from Google
              News RSS. Data may be delayed, incomplete, or wrong. Coverage is limited to a fixed
              list of NSE tickers and to what each provider publishes.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-stone-600">
              Finalysis does not give financial advice and does not recommend buying or selling
              anything.
            </p>
            <div className="mt-3">
              <MethodologyDialog />
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
