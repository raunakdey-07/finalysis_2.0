"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Funnel } from "lucide-react";
import type {
  ApiResponse,
  Provenance,
  StockFundamentals,
  StockPrice,
  StockSearchSuggestion,
} from "@/types";
import type { MetricsPayload } from "@/app/api/metrics/route";
import type { NewsPayload } from "@/app/api/news/route";
import type { ScreeningVerdict, StockMetrics } from "@/lib/metrics";
import { COVERED_SYMBOL_COUNT } from "@/lib/symbol-resolver";
import { AnalysisCards } from "@/components/home/analysis-cards";
import { DataStatus } from "@/components/home/data-status";
import { NewsSection } from "@/components/home/news-section";
import { ResearchLinks } from "@/components/home/research-links";
import { SectionHeading } from "@/components/ui/section";
import { styleFor } from "@/components/home/score-style";
import { DisclaimerGate, MethodologyDialog } from "@/components/disclaimer-modal";
import { ScoreExplanation } from "@/components/ui/metric-explanation";
import { formatRupees, formatSignedPercent } from "@/lib/format";

const DEFAULT_SYMBOL = "ITC.NS";

const QUICK_PICKS: { symbol: string; label: string }[] = [
  { symbol: "RELIANCE.NS", label: "Reliance" },
  { symbol: "TCS.NS", label: "TCS" },
  { symbol: "HDFCBANK.NS", label: "HDFC Bank" },
  { symbol: "INFY.NS", label: "Infosys" },
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

const MODEL_NOTE =
  "These bands are calibrated for Indian equities, so this is a screening tool rather than a substitute for reading filings or judging management.";
/**
 * The reasoning behind the verdict, split into the three questions a reader
 * actually has: what worries me, what argues the other way, and what I still
 * need to check myself.
 *
 * Every line is derived from a published figure. A figure that is missing
 * becomes a prompt to go and find it, never a silent gap and never a
 * fabricated concern.
 */
function buildVerdictDetail(
  fundamentals: StockFundamentals | null,
  metrics: StockMetrics | null,
  verdict: ScreeningVerdict | null,
  price: StockPrice | null
): { concerns: string[]; strengths: string[]; nextChecks: string[] } {
  const concerns: string[] = [];
  const strengths: string[] = [];
  const nextChecks: string[] = [];

  if (!fundamentals || !metrics) {
    return { concerns, strengths, nextChecks };
  }

  const { valuation, businessQuality, sectorProfile } = metrics;
  const label = sectorProfile.label.toLowerCase();

  if (valuation.score !== null && valuation.score < 45) {
    concerns.push(
      `Valuation sits on the weaker side of the ${label} bands.`
    );
  }
  if (businessQuality.score !== null && businessQuality.score < 45) {
    concerns.push(`Returns on capital sit on the weaker side of the ${label} bands.`);
  }
  if (fundamentals.peRatio !== null && fundamentals.peRatio > sectorProfile.peHigh) {
    concerns.push(
      `P/E is ${fundamentals.peRatio.toFixed(1)}, well above the ${label} band of ${sectorProfile.peHigh}. Growth has to justify that.`
    );
  }
  if (fundamentals.pbRatio !== null && fundamentals.pbRatio > sectorProfile.pbHigh) {
    concerns.push(
      `P/B is ${fundamentals.pbRatio.toFixed(2)}, above the ${label} band of ${sectorProfile.pbHigh}.`
    );
  }
  if (fundamentals.bookValue !== null && fundamentals.bookValue < 0) {
    concerns.push(
      "Net worth per share is negative, so there is no book value to compare the price against."
    );
  }
  if (fundamentals.eps !== null && fundamentals.eps < 0) {
    concerns.push(
      `The latest full year was loss-making, with EPS of ${fundamentals.eps.toFixed(2)}.`
    );
  }
  if (price && price.fiftyTwoWeekLow !== null && price.price > 0) {
    if (price.price <= price.fiftyTwoWeekLow * 1.02) {
      concerns.push("The price is at or near its 52-week low.");
    }
  }

  if (valuation.score !== null && valuation.score >= 65) {
    strengths.push(`Valuation sits on the stronger side of the ${label} bands.`);
  }
  if (businessQuality.score !== null && businessQuality.score >= 65) {
    strengths.push(`Returns on capital sit on the stronger side of the ${label} bands.`);
  }
  if (fundamentals.roe !== null && fundamentals.roe >= sectorProfile.roeStrong) {
    strengths.push(
      `ROE is ${fundamentals.roe.toFixed(1)}%, strong for ${label}.`
    );
  }
  if (fundamentals.dividendYield !== null && fundamentals.dividendYield > 2) {
    strengths.push(
      `Dividend yield of ${fundamentals.dividendYield.toFixed(2)}% adds an income component.`
    );
  }
  if (
    fundamentals.peRatio !== null &&
    fundamentals.peRatio > 0 &&
    fundamentals.peRatio < sectorProfile.peLow
  ) {
    strengths.push(`P/E of ${fundamentals.peRatio.toFixed(1)} is below the ${label} band.`);
  }
  if (price && price.fiftyTwoWeekHigh !== null && price.price >= price.fiftyTwoWeekHigh * 0.98) {
    strengths.push("The price is at or near its 52-week high.");
  }

  if (fundamentals.peRatio === null) {
    nextChecks.push(
      "No P/E is shown. For a company not in profit, work from cash, debt and book value instead."
    );
  }
  if (fundamentals.roe === null) {
    nextChecks.push(
      "No return on equity is shown. That usually means negative or very small net worth, or that it was not reported."
    );
  }
  if (fundamentals.bookValue !== null && fundamentals.bookValue < 0) {
    nextChecks.push("Check the balance sheet and the debt schedule before reading anything into the price.");
  }
  if (verdict && verdict.coverage < 0.6) {
    nextChecks.push(
      `Only ${Math.round(verdict.coverage * 100)}% of the figures this screen uses were published. Confirm the rest in the annual report.`
    );
  }
  nextChecks.push("Read the latest annual report and compare the same figures against two or three peers.");

  return {
    concerns: concerns.slice(0, 3),
    strengths: strengths.slice(0, 3),
    nextChecks: Array.from(new Set(nextChecks)).slice(0, 3),
  };
}

/**
 * The URL is the single source of truth for which company is shown.
 *
 * Reading it during render rather than in an effect matters twice over. In an
 * effect, the first render always shows the default company, so every deep
 * link fires a throwaway request for it before switching, and reading
 * `window` in the initial state directly is a hydration mismatch, because the
 * server had no window to read. `useSyncExternalStore` gives the server a
 * defined snapshot and the client the real one, with React reconciling the two
 * after hydration instead of warning about them.
 */
const SYMBOL_EVENT = "finalysis:symbol";

function subscribeToLocation(callback: () => void): () => void {
  window.addEventListener("popstate", callback);
  window.addEventListener(SYMBOL_EVENT, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(SYMBOL_EVENT, callback);
  };
}

function symbolFromLocation(): string {
  const fromUrl = new URLSearchParams(window.location.search).get("symbol");
  if (!fromUrl) return DEFAULT_SYMBOL;

  // The suffix is stripped BEFORE validation. Validating the dotted form first
  // rejected every URL this app writes, so picking a company from search or a
  // shortcut updated the address bar and left the previous company on screen.
  const normalized = fromUrl.toUpperCase().trim().replace(/\.NSE?$/i, "").replace(/\.BO$/i, "");
  if (!/^[A-Z0-9&\-]{1,20}$/.test(normalized)) return DEFAULT_SYMBOL;
  return `${normalized}.NS`;
}

function useLocationSymbol(): string {
  return useSyncExternalStore(subscribeToLocation, symbolFromLocation, () => DEFAULT_SYMBOL);
}

/**
 * False during the server render, true from the first client render onwards.
 *
 * The load effect waits for this. Without the wait it fires on the first
 * client render, which still holds the server's default symbol for one commit,
 * so every deep link fetched the default company before the requested one.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
}

export default function Page() {
  const hydrated = useHydrated();
  const symbol = useLocationSymbol();
  const [symbolInput, setSymbolInput] = useState(symbol);
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
  /**
   * Kept even when the metrics call fails. The failure response carries the
   * reason each source could not answer, and that is exactly what the reader
   * needs when the page is empty.
   */
  const [metricsProvenance, setMetricsProvenance] = useState<Provenance | null>(null);
  const [metricsErrorCode, setMetricsErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const suggestionAbort = useRef<AbortController | null>(null);
  const suggestionCache = useRef<Map<string, SuggestionCacheEntry>>(new Map());
  const sectorRef = useRef<HTMLDetailsElement>(null);
  const activeOptionRef = useRef<HTMLButtonElement>(null);

  // The listbox is scrollable, so arrow-key navigation has to bring the active
  // option into view. Without this the last option sat two pixels below the
  // visible area and was selected unseen.
  useEffect(() => {
    activeOptionRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeSuggestion, suggestions]);

  /**
   * A native disclosure only closes on a second click. A popover that traps
   * the pointer and the keyboard is a bug, so Escape and an outside click both
   * dismiss it.
   */
  useEffect(() => {
    if (!sectorOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!sectorRef.current?.contains(event.target as Node)) setSectorOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSectorOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sectorOpen]);

  const load = useCallback(async (apiSymbol: string, signal: AbortSignal) => {
    const metricsUrl = `/api/metrics?symbol=${encodeURIComponent(apiSymbol)}`;
    const newsUrl = `/api/news?symbol=${encodeURIComponent(apiSymbol)}&limit=8`;

    /**
     * One automatic retry, without a control for the reader to press.
     *
     * Both upstreams sit behind a network, and a single dropped connection or
     * a cold serverless instance should not decide what the page shows. A 404
     * is an answer and is not retried; only a transport failure or a 5xx is.
     */
    const fetchOnce = async (url: string) => {
      const response = await fetch(url, { signal });
      if (response.status < 500) return response;
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (signal.aborted) return response;
      return fetch(url, { signal });
    };

    const [metricsResponse, newsResponse] = await Promise.allSettled([
      fetchOnce(metricsUrl),
      fetchOnce(newsUrl),
    ]);

    if (metricsResponse.status === "fulfilled") {
      const body: ApiResponse<MetricsPayload> = await metricsResponse.value.json();
      setMetricsProvenance(body.provenance ?? null);
      setMetricsErrorCode(body.success && body.data ? null : (body.errorCode ?? "DATA_UNAVAILABLE"));
      setMetrics(body.success && body.data ? body.data : null);
    } else {
      setMetrics(null);
      setMetricsProvenance(null);
      setMetricsErrorCode("REQUEST_FAILED");
    }

    if (newsResponse.status === "fulfilled") {
      const body: ApiResponse<NewsPayload> = await newsResponse.value.json();
      setNews(body.success && body.data ? body.data : null);
      setNewsProvenance(body.provenance ?? null);
    } else {
      setNews(null);
      setNewsProvenance(null);
    }
  }, []);

  useEffect(() => {
    // Keep the input in step with the company on screen. Without this, a deep
    // link rendered the requested company but left the default ticker in the
    // search box, which then looked up the wrong company as a suggestion.
    setSymbolInput(symbol);
  }, [symbol]);

  useEffect(() => {
    // Wait for the store to reconcile to the real URL before asking for data.
    if (!hydrated) return;

    const controller = new AbortController();
    abortRef.current = controller;
    const id = ++requestId.current;

    setLoading(true);
    setMetrics(null);
    setNews(null);
    setNewsProvenance(null);
    setMetricsProvenance(null);
    setMetricsErrorCode(null);

    load(toApiSymbol(symbol), controller.signal)
      .catch(() => undefined)
      .finally(() => {
        if (id === requestId.current && !controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [symbol, load, hydrated]);

  function selectSymbol(next: string) {
    const canonical = `${toApiSymbol(next).toUpperCase()}.NS`;
    setSymbolInput(canonical);
    setSearchMessage(null);
    setSuggestionsOpen(false);
    setSuggestions([]);
    setActiveSuggestion(-1);

    const url = new URL(window.location.href);
    url.searchParams.set("symbol", canonical);
    window.history.replaceState({}, "", url.toString());
    window.dispatchEvent(new Event(SYMBOL_EVENT));
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

        // The API explains itself: a miss, a rate limit and an unsupported
        // ticker are different problems. Discarding that message and showing a
        // flat "No matches" made a rate limit look like a missing company.
        setSearchMessage(
          found.length === 0
            ? body.errorCode === "RATE_LIMITED"
              ? "Too many searches. Wait a moment, then try again."
              : (body.error ?? `No stock in the covered list matches "${query}".`)
            : null
        );

        suggestionCache.current.delete(key);
        suggestionCache.current.set(key, { suggestions: found, timestamp: Date.now() });
        while (suggestionCache.current.size > SUGGESTION_CACHE_LIMIT) {
          const oldest = suggestionCache.current.keys().next();
          if (oldest.done) break;
          suggestionCache.current.delete(oldest.value);
        }

        setSuggestions(found);
        setSuggestionsOpen(found.length > 0);
        setActiveSuggestion(found.length > 0 ? 0 : -1);
      } catch {
        if (!controller.signal.aborted) {
          clearSuggestions();
          setSearchMessage("Search is unavailable right now. Try again in a moment.");
        }
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
    clearSuggestions();
    setSearchMessage(null);

    const query = symbolInput.trim();
    if (query.length === 0) {
      setSearchMessage("Type a ticker or company name to search.");
      return;
    }

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
  // Cheap string work over three values, so it is derived rather than memoised.
  const detail = buildVerdictDetail(fundamentals, metrics?.metrics ?? null, verdict, price);

  const verdictStyle = styleFor(
    verdict?.label === "insufficient-data" ? "unknown" : (verdict?.label ?? "unknown")
  );

  const warnings = [
    ...(metricsProvenance?.warnings ?? []),
    ...(metrics?.quoteProvenance?.warnings ?? []),
    ...(metrics?.fundamentalsProvenance?.warnings ?? []),
    ...(newsProvenance?.warnings ?? []),
  ];

  const nothingLoaded = !loading && !price && !fundamentals;
  /** A ticker the user mistyped is a different problem from a provider outage. */
  const unknownSymbol = metricsErrorCode === "UNKNOWN_SYMBOL";
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
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
              Finalysis
            </p>
            {/*
              A tagline, not the page's subject. The company below is the subject,
              so the outline starts at the wordmark and runs h1 company, h2
              section, h3 card, instead of a generic sentence sitting at h1 and
              the company name level-peering with a 12px divider label.
            */}
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
              Read an NSE company from published numbers. Prices, company figures, and recent
              headlines, where every figure says where it came from and when it was true.
            </p>
          </header>

          <section aria-labelledby="search-heading" className="mb-8">
            <SectionHeading id="search-heading" className="mb-3">
              Find a company
            </SectionHeading>

            <form onSubmit={handleSearchSubmit} className="flex items-start gap-2">
              <div className="relative flex-1">
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

                {suggestionsOpen && suggestionsLoading ? (
                  <p
                    role="status"
                    className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600 shadow-sm"
                  >
                    Searching…
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
                            ref={index === activeSuggestion ? activeOptionRef : undefined}
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
                ref={sectorRef}
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

            <div role="status" aria-live="polite" className="mt-2 min-h-5">
              {searchMessage ? <p className="text-xs text-stone-600">{searchMessage}</p> : null}
            </div>

            {/*
              Shortcuts sit under the search box, not above it. Search is the
              action; these are a convenience, and leading with them pushed the
              input itself below the fold on a phone.
            */}
            <ul className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1">
              {QUICK_PICKS.map((pick) => {
                const isCurrent = symbol === pick.symbol;
                return (
                  <li key={pick.symbol}>
                    <button
                      type="button"
                      onClick={() => selectSymbol(pick.symbol)}
                      aria-current={isCurrent ? "true" : undefined}
                      className={`rounded px-2 py-2.5 text-sm transition ${
                        isCurrent
                          ? "font-medium text-stone-900 underline underline-offset-4"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      {pick.label}
                      <span className="sr-only">
                        {isCurrent ? ", currently shown" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <main id="main">
            <section aria-labelledby="company-heading" className="mb-8">
              <h1
                id="company-heading"
                className="wrap-break-word text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl"
              >
                {fundamentals?.companyName ?? toApiSymbol(symbol)}
              </h1>

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
                        price.changePercent >= 0 ? "text-accent-ink" : "text-caution-ink"
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
                  {unknownSymbol
                    ? `${toApiSymbol(symbol)} is not one of the ${COVERED_SYMBOL_COUNT} tickers Finalysis covers.`
                    : `No price could be retrieved for ${toApiSymbol(symbol)}.`}
                </p>
              )}

              {fundamentals?.sector || fundamentals?.industry ? (
                <p className="mt-1 text-xs text-stone-500">
                  {[fundamentals.industry, fundamentals.sector].filter(Boolean).join(" · ")}
                </p>
              ) : null}

              {/*
                The freshness line sits under the price because that is the one
                thing a reader has to know before trusting the number above it.
                Everything else is behind its "?" so the page does not open with
                a block of metadata.
              */}
              {!loading ? (
                <DataStatus
                  price={price}
                  fundamentals={fundamentals}
                  quoteProvenance={metrics?.quoteProvenance ?? metricsProvenance}
                  fundamentalsProvenance={metrics?.fundamentalsProvenance ?? metricsProvenance}
                  warnings={Array.from(new Set(warnings))}
                  unknownSymbol={unknownSymbol}
                />
              ) : null}
            </section>

            <section aria-labelledby="verdict-heading" className="mb-10">
              <SectionHeading id="verdict-heading">Screening verdict</SectionHeading>

              {loading ? (
                <div className="mt-4 rounded-xl border-l-4 border-l-stone-200 bg-white p-6 shadow-sm">
                  <p className="text-sm text-stone-500" role="status">
                    Working out the screening picture…
                  </p>
                </div>
              ) : nothingLoaded ? (
                <div className="mt-4 rounded-xl border-l-4 border-l-caution bg-white p-6 shadow-sm">
                  <p className="text-lg font-semibold text-caution-ink">
                    {unknownSymbol
                      ? `${toApiSymbol(symbol)} is not a company Finalysis covers`
                      : `Nothing could be loaded for ${toApiSymbol(symbol)}`}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-stone-700">
                    {unknownSymbol
                      ? "Finalysis only covers the NSE tickers in its own list. Check the spelling, or try the ticker without a suffix."
                      : "The price source and the company-figures source did not answer. That is a data problem, not a view about the company. The status above names the source that failed."}
                  </p>
                </div>
              ) : verdict ? (
                <div className={`mt-4 rounded-xl border-l-4 bg-white p-6 shadow-sm ${verdictStyle.rule}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={`text-2xl font-semibold ${verdictStyle.text}`}>
                      {verdict.headline}
                    </span>
                    <ScoreExplanation metric="screeningVerdict" />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">{verdict.summary}</p>
                  <p className="mt-3 text-xs text-stone-500">{verdict.basis}</p>

                  <details className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                    <summary className="cursor-pointer text-sm font-medium text-stone-700">
                      Why this verdict?
                    </summary>

                    <div className="mt-3 space-y-3 text-sm text-stone-600">
                      <div>
                        <p className="mb-1 font-medium text-stone-700">Key concerns</p>
                        {detail.concerns.length > 0 ? (
                          <ul className="space-y-1">
                            {detail.concerns.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>No published figure triggered a concern.</p>
                        )}
                      </div>

                      <div>
                        <p className="mb-1 font-medium text-stone-700">What offsets the risk</p>
                        {detail.strengths.length > 0 ? (
                          <ul className="space-y-1">
                            {detail.strengths.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>No published figure argued in the company&apos;s favour.</p>
                        )}
                      </div>

                      <div>
                        <p className="mb-1 font-medium text-stone-700">Next checks</p>
                        <ul className="space-y-1">
                          {detail.nextChecks.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <p className="text-xs text-stone-500">{MODEL_NOTE}</p>
                    </div>
                  </details>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border-l-4 border-l-stone-300 bg-white p-6 shadow-sm">
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

            <SectionHeading id="figures-heading" className="mb-5">
              The figures
            </SectionHeading>

            <section aria-labelledby="figures-heading" className="contents">
              <AnalysisCards
                fundamentals={fundamentals}
                metrics={metrics?.metrics ?? null}
                price={price}
                unknownSymbol={unknownSymbol}
                news={
                  news
                    ? {
                        state: news.items.length > 0 ? ("ok" as const) : ("empty" as const),
                        tone: news.tone.tone,
                        articleCount: news.tone.articleCount,
                        toneThin: news.tone.thin,
                        directionalCount: news.tone.directionalCount,
                      }
                    : {
                        state: "unavailable" as const,
                        tone: "unknown" as const,
                        articleCount: 0,
                      }
                }
                loading={loading}
              />
            </section>

            <NewsSection
              items={news?.items ?? []}
              provenance={newsProvenance}
              loading={loading}
              state={
                loading
                  ? "loading"
                  : news
                    ? news.items.length > 0
                      ? "ok"
                      : "empty"
                    : "unavailable"
              }
              unknownSymbol={unknownSymbol}
            />

            <ResearchLinks symbol={toApiSymbol(symbol)} fundamentals={fundamentals} />
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

      {/*
        Rendered last so the dialog's own heading sits after the page heading in
        the accessibility outline, whether or not the portal has mounted yet.
      */}
      <DisclaimerGate />
    </>
  );
}
