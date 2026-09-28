"use client";

import type { FreshnessTone } from "@/lib/format";
import type { StockFundamentals, StockPrice, Provenance } from "@/types";
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
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-1.5">
      <dt className="text-xs text-stone-600">{label}</dt>
      <dd className={`text-xs ${tone ?? "text-stone-800"}`}>{value}</dd>
    </div>
  );
}

/**
 * Everything the reader needs to judge how much to trust the numbers above:
 * when each one was true, where it came from, and what failed.
 *
 * This is deliberately always visible rather than tucked behind a disclosure.
 * A stale price presented exactly like a live one is the failure mode this
 * component exists to prevent.
 */
export function DataNote({
  price,
  fundamentals,
  quoteProvenance,
  fundamentalsProvenance,
  warnings,
  onRetry,
  retrying,
}: {
  price: StockPrice | null;
  fundamentals: StockFundamentals | null;
  quoteProvenance: Provenance | null;
  fundamentalsProvenance: Provenance | null;
  warnings: string[];
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
  const degraded = freshness?.tone === "stale" || warnings.length > 0 || confidence !== "high";

  return (
    <section
      aria-labelledby="data-note-heading"
      className={`mb-10 border-l-4 bg-stone-100/70 px-4 py-3 ${FRESHNESS_RULE[freshness?.tone ?? "unknown"]}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="data-note-heading" className="text-xs font-semibold uppercase tracking-widest text-stone-600">
          Data status
        </h2>
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
        <Row
          label="Price"
          value={freshness ? freshness.label : "No price retrieved"}
          tone={freshness?.tone === "stale" ? "text-amber-800" : undefined}
        />
        {freshness && freshness.tone !== "live" ? (
          <Row label="Price detail" value={freshness.detail} tone="text-stone-600" />
        ) : null}

        <Row
          label="Company figures"
          value={
            figuresDate
              ? `Figures to ${figuresDate}${fetchedOn ? `, retrieved ${fetchedOn}` : ""}`
              : fetchedOn
                ? `Retrieved ${fetchedOn}, reporting date not stated`
                : "Not retrieved"
          }
        />

        <Row label="Sources" value={`${quoteProvenance?.source ?? "—"} · ${fundamentalsProvenance?.source ?? "—"}`} />

        <Row
          label="Confidence, weaker of the two sources"
          value={getConfidenceMessage(confidence)}
          tone={confidence === "high" ? undefined : "text-amber-800"}
        />

        <Row
          label="Caching"
          value={`Quote cache ${quoteProvenance?.cacheTTL ?? "—"} · figures cache ${fundamentalsProvenance?.cacheTTL ?? "—"}${
            quoteProvenance?.cacheHit ? " · served from cache" : ""
          }`}
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

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-stone-200/70 pt-3">
        <MetricExplanation metric="provenance" />
        <span className="text-xs text-stone-600">
          {degraded
            ? "At least one source below did not answer normally. Read the figures with that in mind."
            : "No source failed on this request. Figures may still come from a cache, which the timings above show."}
        </span>
      </div>
    </section>
  );
}
