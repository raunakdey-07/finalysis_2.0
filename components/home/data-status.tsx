"use client";

import type { FreshnessTone } from "@/lib/format";
import type { Provenance, StockFundamentals, StockPrice } from "@/types";
import { describePriceFreshness, formatExchangeDate } from "@/lib/format";
import { MetricExplanation } from "@/components/ui/metric-explanation";

const FRESHNESS_TONE_CLASS: Record<FreshnessTone, string> = {
  live: "text-stone-500",
  recent: "text-stone-500",
  stale: "text-amber-800",
  unknown: "text-stone-500",
};

/**
 * How current the page is, and where every figure came from.
 *
 * Only two things are said out loud, because they are the two a reader needs
 * before trusting a number: when the price was recorded, and when the company
 * figures describe. Everything else, sources, cache windows, confidence and the
 * list of things that went wrong, lives behind the "?" rather than as a panel
 * of its own.
 *
 * Failures are the exception. A degraded source is stated in the open, because
 * a warning nobody reads is not a warning.
 */
export function DataStatus({
  price,
  fundamentals,
  quoteProvenance,
  fundamentalsProvenance,
  warnings,
  unknownSymbol,
}: {
  price: StockPrice | null;
  fundamentals: StockFundamentals | null;
  quoteProvenance: Provenance | null;
  fundamentalsProvenance: Provenance | null;
  warnings: string[];
  unknownSymbol: boolean;
}) {
  const freshness = price
    ? describePriceFreshness({
        quotedAt: price.quotedAt,
        fetchedAt: price.fetchedAt,
        freshness: price.freshness,
      })
    : null;

  const figuresDate = formatExchangeDate(fundamentals?.periodEnd ?? null);
  const fetchedOn = formatExchangeDate(fundamentals?.fetchedAt ?? null);
  const degraded =
    !unknownSymbol &&
    (freshness?.tone === "stale" || warnings.length > 0 || price === null);

  const sources = Array.from(
    new Set(
      [quoteProvenance?.source, fundamentalsProvenance?.source].filter(
        (source): source is string => Boolean(source) && source !== "—"
      )
    )
  );

  const detailLines = [
    "Price",
    unknownSymbol
      ? "Not asked for. Finalysis only covers the NSE tickers in its own list."
      : freshness
        ? `${freshness.label}. ${freshness.detail}`
        : "No price was retrieved.",
    "",
    "Company figures",
    unknownSymbol
      ? "Not asked for."
      : figuresDate
        ? `For the year to ${figuresDate}${fetchedOn ? `, read ${fetchedOn}` : ""}.`
        : fetchedOn
          ? `Read ${fetchedOn}, reporting date not stated.`
          : "Not retrieved.",
    "",
    "Where it came from",
    sources.length > 0 ? sources.join(" · ") : "None asked for.",
    "",
    "How long a figure is held",
    `Price ${quoteProvenance?.cacheTTL ?? "—"}, company figures ${
      fundamentalsProvenance?.cacheTTL ?? "—"
    }${quoteProvenance?.cacheHit ? ". This price came from that held copy" : ""}.`,
  ].filter((line) => line !== "");

  return (
    <div className="mt-2">
      <p className={`text-xs ${degraded ? "text-amber-800" : FRESHNESS_TONE_CLASS[freshness?.tone ?? "unknown"]}`}>
        {unknownSymbol
          ? "Outside the covered list, so nothing was looked up."
          : `${freshness ? freshness.label : "No price retrieved"}${
              figuresDate ? ` · figures to ${figuresDate}` : ""
            }`}
        <MetricExplanation metric="provenance" lines={detailLines} />
      </p>

      {warnings.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {warnings.map((warning) => (
            <li key={warning} className="text-xs leading-relaxed text-amber-800">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
