"use client";

import type { FreshnessTone } from "@/lib/format";
import type { Provenance, StockFundamentals, StockPrice } from "@/types";
import { describePriceFreshness, formatExchangeDate } from "@/lib/format";
import { getConfidenceMessage } from "@/lib/education";
import { MetricExplanation } from "@/components/ui/metric-explanation";

const FRESHNESS_TONE_CLASS: Record<FreshnessTone, string> = {
  live: "text-stone-500",
  recent: "text-stone-500",
  stale: "text-caution-ink",
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

  // One line per fact, joined into a single sentence rather than a label and a
  // value as separate bullets. The old shape produced ten short bullets where
  // one paragraph was meant, and repeated the price timestamp the page already
  // shows directly above the trigger.
  const strip = (text: string) => text.replace(/\.\s*$/, '');

  const detailLines = [
    unknownSymbol
      ? "No lookup was made. Fin-alysis only covers the NSE tickers in its own list."
      : [
          freshness ? `Price: ${strip(freshness.detail)}` : "Price: not retrieved",
          figuresDate
            ? `company figures for the year to ${figuresDate}${fetchedOn ? `, read ${fetchedOn}` : ""}`
            : "company figures: not retrieved",
          `sources: ${sources.length > 0 ? sources.join(" and ") : "none asked for"}`,
          `confidence: ${unknownSymbol ? "no lookup was made" : strip(getConfidenceMessage(quoteProvenance?.confidenceLevel ?? "unavailable")).toLowerCase()}`,
          `held for price ${quoteProvenance?.cacheTTL ?? "—"}, company figures ${fundamentalsProvenance?.cacheTTL ?? "—"}`,
        ].join(". ") + ".",
  ];

  return (
    <div className="mt-2">
      <p className={`text-xs ${degraded ? "text-caution-ink" : FRESHNESS_TONE_CLASS[freshness?.tone ?? "unknown"]}`}>
        {unknownSymbol ? "Outside the covered list, so nothing was looked up." : (freshness?.label ?? "No price retrieved")}
        <MetricExplanation metric="provenance" lines={detailLines} heading="For this page" />
      </p>

      {warnings.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {warnings.map((warning) => (
            <li key={warning} className="text-xs leading-relaxed text-caution-ink">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
