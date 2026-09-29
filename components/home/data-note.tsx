"use client";

import type { FreshnessTone } from "@/lib/format";
import type { Provenance, StockFundamentals, StockPrice } from "@/types";
import { describePriceFreshness, formatExchangeDate } from "@/lib/format";
import { getConfidenceMessage } from "@/lib/education";
import { MetricExplanation } from "@/components/ui/metric-explanation";

const FRESHNESS_RULE: Record<FreshnessTone, string> = {
  live: "border-l-teal-700",
  recent: "border-l-stone-400",
  stale: "border-l-amber-700",
  unknown: "border-l-stone-300",
};

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5">
      <dt className="text-xs text-stone-600">{label}</dt>
      <dd className={`text-xs ${tone ?? "text-stone-800"}`}>{value}</dd>
    </div>
  );
}

/**
 * Everything the reader needs to judge how much to trust the numbers above:
 * when each one was true, where it came from, and what failed.
 *
 * Deliberately always visible rather than tucked behind a disclosure, and
 * deliberately narrow. A metadata block stretched across the full page width
 * puts the label and its value half a screen apart, which is the opposite of
 * scannable. The whitespace to the right of it is doing real work.
 */
export function DataNote({
  price,
  fundamentals,
  quoteProvenance,
  fundamentalsProvenance,
  warnings,
  unknownSymbol,
  onRetry,
  retrying,
}: {
  price: StockPrice | null;
  fundamentals: StockFundamentals | null;
  quoteProvenance: Provenance | null;
  fundamentalsProvenance: Provenance | null;
  warnings: string[];
  /** True when the ticker is simply not in the covered list. */
  unknownSymbol?: boolean;
  onRetry: () => void;
  retrying: boolean;
}) {
  const freshness = price
    ? describePriceFreshness({
        quotedAt: price.quotedAt,
        fetchedAt: price.fetchedAt,
        freshness: price.freshness,
      })
    : null;

  const confidence = quoteProvenance?.confidenceLevel ?? 'unavailable';
  const figuresDate = formatExchangeDate(fundamentals?.periodEnd ?? null);
  const fetchedOn = formatExchangeDate(fundamentals?.fetchedAt ?? null);
  const degraded =
    !unknownSymbol &&
    (freshness?.tone === "stale" || warnings.length > 0 || confidence !== "high");

  // When the request failed as a whole, both slots hold the same combined
  // provenance. Printing it twice read as two sources when there was one row.
  const sources = Array.from(
    new Set(
      [quoteProvenance?.source, fundamentalsProvenance?.source].filter(
        (source): source is string => Boolean(source) && source !== "—"
      )
    )
  );

  return (
    <section
      aria-labelledby="data-note-heading"
      className={`mb-10 max-w-2xl border-l-4 bg-stone-100/70 px-4 py-3 ${
        FRESHNESS_RULE[freshness?.tone ?? "unknown"]
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/*
          The "?" sits beside the heading rather than inside it. As a child it
          inherited the heading's uppercase transform and became part of the
          heading's accessible name.
        */}
        <div className="flex items-center gap-1">
          <h2
            id="data-note-heading"
            className="text-xs font-semibold uppercase tracking-widest text-stone-600"
          >
            Data status
          </h2>
          <MetricExplanation metric="provenance" />
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="rounded border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 transition hover:border-stone-500 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {retrying ? "Retrying…" : "Try again"}
        </button>
      </div>

      <dl className="mt-1 divide-y divide-stone-200/70">
        {/*
          The price detail is a continuation of the price row rather than its
          own row. An empty label left a value floating with nothing to belong
          to on its left.
        */}
        <div className="py-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <dt className="text-xs text-stone-600">Price</dt>
            <dd
              className={`text-xs ${freshness?.tone === "stale" ? "text-amber-800" : "text-stone-800"}`}
            >
              {freshness ? freshness.label : "No price retrieved"}
            </dd>
          </div>
          {freshness && freshness.tone !== "live" ? (
            <p className="pt-0.5 text-right text-xs text-stone-600">{freshness.detail}</p>
          ) : null}
        </div>

        <Row
          label="Company figures"
          value={
            unknownSymbol
              ? "Not asked for"
              : figuresDate
                ? `For the year to ${figuresDate}${fetchedOn ? `, read ${fetchedOn}` : ""}`
                : fetchedOn
                  ? `Read ${fetchedOn}, reporting date not stated`
                  : "Not retrieved"
          }
        />

        <Row label="Sources" value={sources.length > 0 ? sources.join(" · ") : "None asked for"} />

        <Row
          label="Confidence"
          value={
            unknownSymbol
              ? "No lookup was made for this ticker."
              : getConfidenceMessage(confidence)
          }
          tone={!unknownSymbol && confidence !== "high" ? "text-amber-800" : undefined}
        />

        <Row
          label="How long a figure is held"
          value={`Price ${quoteProvenance?.cacheTTL ?? "—"}, company figures ${
            fundamentalsProvenance?.cacheTTL ?? "—"
          }${quoteProvenance?.cacheHit ? ", this price came from that held copy" : ""}`}
          tone="text-stone-600"
        />
      </dl>

      {warnings.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-stone-200/70 pt-3">
          {warnings.map((warning) => (
            <li key={warning} className="text-xs leading-relaxed text-amber-900">
              <span className="font-medium">What went wrong: </span>
              {warning}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 border-t border-stone-200/70 pt-3 text-xs text-stone-600">
        {unknownSymbol
          ? "Finalysis only covers the NSE tickers in its own list, so nothing was looked up."
          : degraded
            ? "At least one source below did not answer normally. Read the figures with that in mind."
            : "No source failed on this request. Figures may still come from a held copy, which the timings above show."}
      </p>
    </section>
  );
}
