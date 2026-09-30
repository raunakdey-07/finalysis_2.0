"use client";

import type { StockMetrics } from "@/lib/metrics";
import { calculateSignalsScore, readMarketSignals } from "@/lib/metrics";
import type { StockFundamentals, StockPrice } from "@/types";
import { formatMultiple, formatPercent, formatRupees, formatSignedPercent } from "@/lib/format";
import { MetricExplanation, ScoreExplanation } from "@/components/ui/metric-explanation";
import { styleFor } from "./score-style";
import { decideFigureCards } from "./figure-card-state";
import type { EducationKey } from "@/lib/education";

function Card({
  title,
  subtitle,
  topRule,
  style,
  state,
  children,
}: {
  title: string;
  subtitle: string;
  topRule?: string;
  /** Verdict style for a screening score. */
  style?: ReturnType<typeof styleFor>;
  /** Directional style for the market-position reading. */
  state?: { label: string; text: string };
  children: React.ReactNode;
}) {
  return (
    <section className={`border-t-4 bg-white p-5 shadow-sm ${topRule ?? "border-t-stone-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-stone-600">{title}</h3>
          <p className="mt-1 text-xs text-stone-500">{subtitle}</p>
        </div>
        {style ? (
          <span className={`text-xs font-semibold ${style.text}`}>{style.label}</span>
        ) : state ? (
          <span className={`text-xs font-semibold ${state.text}`}>{state.label}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MetricRow({
  label,
  value,
  explain,
  tone,
}: {
  label: string;
  value: string;
  explain?: EducationKey;
  tone?: "up" | "down" | "flat";
}) {
  const toneClass =
    tone === "up" ? "text-accent-ink" : tone === "down" ? "text-caution-ink" : "text-stone-800";

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="flex items-center text-stone-600">
        {label}
        {explain ? <MetricExplanation metric={explain} /> : null}
      </dt>
      <dd className={`font-medium tabular-nums ${tone ? toneClass : "text-stone-800"}`}>{value}</dd>
    </div>
  );
}

/**
 * The shared body of a card that carries a 0-100 reading.
 *
 * All three cards use this, so the number, the bar, the explanation trigger
 * and the coverage line sit in the same place in each. What differs is the
 * label vocabulary and the rule colour, which is the whole point of the third
 * card: it is a position, not a verdict.
 */
function ReadingBody({
  score,
  explain,
  style,
  lines,
  note,
  missing,
}: {
  score: number | null;
  explain: EducationKey;
  style: { text: string; bar: string };
  lines: string[];
  /** Shown under the bar in place of a coverage sentence. */
  note?: string;
  missing: string[];
}) {
  if (score === null) {
    return (
      <div className="mt-4">
        <p className="text-lg font-semibold text-stone-600">Not scored</p>
        <p className="mt-1 text-xs leading-relaxed text-stone-600">
          {missing.length > 0
            ? `None of the figures this needs were published: ${missing.join(", ")}.`
            : "Nothing needed to build this was available."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className={`text-2xl font-semibold tabular-nums ${style.text}`}>{score}</span>
        <span className="text-sm font-medium text-stone-500">/100</span>
        <ScoreExplanation metric={explain} lines={lines} />
      </div>

      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-100"
        role="presentation"
        aria-hidden="true"
      >
        <div
          className={`h-1.5 rounded-full transition-all ${style.bar}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {note ? <p className="mt-2 text-xs text-stone-500">{note}</p> : null}
    </>
  );
}

/**
 * How far the news request got.
 *
 * `empty` and `unavailable` look identical if you only count articles, and the
 * difference matters: one says the provider answered and had nothing, the other
 * says the provider never answered. Collapsing them claims a retrieval that did
 * not happen.
 */
export type NewsState = 'loading' | 'unavailable' | 'empty' | 'ok';

export type NewsSummary = {
  state: Exclude<NewsState, 'loading'>;
  tone: "positive" | "negative" | "neutral" | "unknown";
  articleCount: number;
};

function RecentSignalsCard({
  price,
  news,
  loading,
  unknownSymbol,
}: {
  price: StockPrice | null;
  news: NewsSummary | null;
  loading: boolean;
  unknownSymbol: boolean;
}) {
  const signals = readMarketSignals(price);
  const change = signals.dailyChangePercent;
  const direction = change === null ? null : change > 0 ? "up" : change < 0 ? "down" : "flat";
  const newsMissing = news !== null && (news.state === "unavailable" || news.state === "empty");

  const toneReported = news?.state === "ok" && news.tone !== "unknown";
  const reading = calculateSignalsScore(
    price,
    news?.state === "ok" ? news.tone : null,
    toneReported
  );

  // Same shape as the two screening cards: the rule, the label, the score and
  // the bar all move together. The reading differs in its vocabulary, which
  // describes how price and coverage have behaved rather than passing a
  // judgement on the company, and in its construction.
  const signalStyle =
    reading.state === "buoyant"
      ? { text: "text-accent-ink", bar: "bg-accent", rule: "border-t-accent" }
      : reading.state === "soft"
        ? { text: "text-caution-ink", bar: "bg-caution", rule: "border-t-caution" }
        : { text: "text-stone-700", bar: "bg-stone-500", rule: "border-t-stone-400" };

  // Behaviour, not location. A stock resting on its 52-week low while flat and
  // a one in freefall score alike, so the label cannot claim either is falling
  // or is near its low. The popover carries where the price actually sits.
  const signalLabel =
    reading.state === "buoyant" ? "Buoyant" : reading.state === "soft" ? "Soft" : "Steady";

  return (
    <Card
      title="Recent signals"
      subtitle="Price position, news coverage and sentiment"
      topRule={signalStyle.rule}
      state={reading.state ? { label: signalLabel, text: signalStyle.text } : undefined}
    >
      {loading ? (
        <p className="mt-4 text-sm text-stone-500" role="status">
          Loading…
        </p>
      ) : (
        <>
          <ReadingBody
            score={reading.score}
            explain="recentSignals"
            style={signalStyle}
            missing={[]}
            note={`Built from ${reading.available} of 4 inputs.`}
            lines={[
              ...reading.notes,
              "This reads where the price sits and what the headlines say. It is not a measure of company quality, and a high number is not a good investment.",
            ]}
          />

          <dl className="mt-5 space-y-2.5 border-t border-stone-100 pt-4">
            <MetricRow
              label="Session"
              explain="freshness"
              value={unknownSymbol ? "Not requested" : change === null ? "Not reported" : formatSignedPercent(change)}
              tone={direction ?? "flat"}
            />
            <MetricRow
              label="News tone"
              explain="recentSignals"
              value={
                unknownSymbol
                  ? "Not requested"
                  : news === null
                    ? loading
                      ? "Looking…"
                      : "Not retrieved"
                    : news.state !== "ok"
                      ? "Not retrieved"
                      : news.tone === "unknown"
                        ? "Not enough articles"
                        : news.tone.charAt(0).toUpperCase() + news.tone.slice(1)
              }
            />
            <MetricRow
              label="Articles found"
              explain="recentSignals"
              value={news?.state === "ok" ? String(news.articleCount) : "—"}
            />
          </dl>

          {newsMissing ? (
            <p className="mt-3 text-xs leading-relaxed text-stone-600">
              {news!.state === "unavailable"
                ? "The news source did not answer, so no tone is reported. That is a retrieval failure, not a neutral reading."
                : news!.articleCount > 0
                  ? `Only ${news!.articleCount} headline${news!.articleCount === 1 ? "" : "s"} matched this company, which is too few to call a tone. That is a thin sample, not a neutral reading.`
                  : "No headlines were retrieved, so no tone is reported. That is missing data, not a neutral reading."}
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}

export function AnalysisCards({
  fundamentals,
  metrics,
  price,
  news,
  loading,
  unknownSymbol,
}: {
  fundamentals: StockFundamentals | null;
  metrics: StockMetrics | null;
  price: StockPrice | null;
  news: NewsSummary | null;
  loading: boolean;
  unknownSymbol: boolean;
}) {
  const decision = decideFigureCards({
    loading,
    fundamentalsPresent: Boolean(fundamentals),
    unknownSymbol,
    businessQuality: metrics?.businessQuality,
    valuation: metrics?.valuation,
  });

  const qualityStyle = styleFor(decision.businessQuality?.verdict ?? "unknown");
  const valuationStyle = styleFor(decision.valuation?.verdict ?? "unknown");

  /**
   * A dash, for both "still loading" and "nothing to show". The reason, when
   * there is one, is stated once above the grid by the decision above.
   */
  const quietPlaceholder = (
    <p className="mt-4 text-lg font-semibold text-stone-400" aria-hidden="true">
      —
    </p>
  );

  return (
    <div className="mb-12">
      {decision.notice ? (
        <p className="mb-4 text-sm leading-relaxed text-stone-600">{decision.notice}</p>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-3">
        <Card
          title="Business quality"
          subtitle="Returns on equity, dividend yield and capital"
          topRule={decision.businessQuality ? qualityStyle.topRule : undefined}
          style={decision.businessQuality ? qualityStyle : undefined}
        >
          {decision.businessQuality ? (
            <>
              <ReadingBody
                score={decision.businessQuality.score}
                explain="businessQuality"
                style={qualityStyle}
                missing={decision.businessQuality.missing}
                note={`Built from ${decision.businessQuality.available} of ${decision.businessQuality.considered} published figure${decision.businessQuality.considered === 1 ? "" : "s"}.`}
                lines={[
                  ...decision.businessQuality.highlights,
                  ...(decision.businessQuality.missing.length > 0
                    ? [
                        `Not published: ${decision.businessQuality.missing.join(", ")}. These contributed nothing to the score.`,
                      ]
                    : []),
                ]}
              />
              <dl className="mt-5 space-y-2.5 border-t border-stone-100 pt-4">
                <MetricRow label="ROE" explain="roe" value={formatPercent(fundamentals?.roe)} />
                <MetricRow label="ROCE" explain="roce" value={formatPercent(fundamentals?.roce)} />
                <MetricRow
                  label="Dividend"
                  explain="dividendYield"
                  value={formatPercent(fundamentals?.dividendYield)}
                />
              </dl>
            </>
          ) : (
            quietPlaceholder
          )}
        </Card>

        <Card
          title="Valuation"
          subtitle="Price against earnings and net worth"
          topRule={decision.valuation ? valuationStyle.topRule : undefined}
          style={decision.valuation ? valuationStyle : undefined}
        >
          {decision.valuation ? (
            <>
              <ReadingBody
                score={decision.valuation.score}
                explain="valuation"
                style={valuationStyle}
                missing={decision.valuation.missing}
                note={`Built from ${decision.valuation.available} of ${decision.valuation.considered} published figure${decision.valuation.considered === 1 ? "" : "s"}.`}
                lines={[
                  ...decision.valuation.highlights,
                  ...(decision.valuation.missing.length > 0
                    ? [
                        `Not published: ${decision.valuation.missing.join(", ")}. These contributed nothing to the score.`,
                        "A P/E is left blank for a company that is not profitable, and a P/B when net worth is negative, because neither ratio says anything useful in those cases.",
                      ]
                    : []),
                ]}
              />
              <dl className="mt-5 space-y-2.5 border-t border-stone-100 pt-4">
                <MetricRow
                  label="P/E"
                  explain="peRatio"
                  value={formatMultiple(fundamentals?.peRatio)}
                />
                <MetricRow
                  label="P/B"
                  explain="pbRatio"
                  value={formatMultiple(fundamentals?.pbRatio)}
                />
                <MetricRow
                  label="Book value"
                  explain="bookValue"
                  value={formatRupees(fundamentals?.bookValue)}
                />
              </dl>
            </>
          ) : (
            quietPlaceholder
          )}
        </Card>

        <RecentSignalsCard
          price={price}
          news={news}
          loading={loading}
          unknownSymbol={unknownSymbol}
        />
      </div>
    </div>
  );
}
