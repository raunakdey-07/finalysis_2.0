"use client";

import type { MetricScore, StockMetrics } from "@/lib/metrics";
import { readMarketSignals } from "@/lib/metrics";
import type { StockFundamentals, StockPrice } from "@/types";
import { formatMultiple, formatPercent, formatRupees, formatSignedPercent } from "@/lib/format";
import { MetricExplanation, ScoreExplanation } from "@/components/ui/metric-explanation";
import { styleFor } from "./score-style";
import type { EducationKey } from "@/lib/education";

function Card({
  title,
  subtitle,
  topRule,
  style,
  children,
}: {
  title: string;
  subtitle: string;
  topRule?: string;
  /** The style token for this card, used for the top rule and the corner label. */
  style?: ReturnType<typeof styleFor>;
  children: React.ReactNode;
}) {
  return (
    <section className={`border-t-4 bg-white p-5 shadow-sm ${topRule ?? "border-t-stone-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-stone-600">{title}</h3>
          <p className="mt-1 text-xs text-stone-500">{subtitle}</p>
        </div>
        {style ? (
          <span className={`text-xs font-semibold ${style.text}`}>{style.label}</span>
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
 * A score is only rendered when the provider gave us something to score from.
 *
 * The per-company reasons the score moved live behind the "?" rather than in
 * the card. Printing them as a second list restated the metric rows in prose,
 * which made the card tall without adding anything the reader could not get by
 * asking.
 */
function ScoreBody({
  score,
  explain,
  style,
}: {
  score: MetricScore;
  explain: EducationKey;
  style: ReturnType<typeof styleFor>;
}) {

  if (score.score === null) {
    return (
      <div className="mt-4">
        <p className="text-lg font-semibold text-stone-600">Not scored</p>
        <p className="mt-1 text-xs leading-relaxed text-stone-600">
          None of the figures this score needs were published
          {score.missing.length > 0 ? `: ${score.missing.join(", ")}` : ""}. There is nothing to
          compare against sector bands.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 flex items-baseline gap-1">
        <span className={`text-4xl font-semibold tabular-nums ${style.text}`}>{score.score}</span>
        <span className="text-base font-medium text-stone-500">/100</span>
        <ScoreExplanation
          metric={explain}
          lines={[
            ...score.highlights,
            ...(score.missing.length > 0
              ? [`Not published: ${score.missing.join(", ")}. These contributed nothing to the score.`]
              : []),
          ]}
        />
      </div>

      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-100"
        role="presentation"
        aria-hidden="true"
      >
        <div
          className={`h-1.5 rounded-full transition-all ${style.bar}`}
          style={{ width: `${score.score}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-stone-500">
        Built from {score.available} of {score.considered} published figure
        {score.considered === 1 ? "" : "s"}.
        {score.missing.some((label) => label === "P/E" || label === "P/B")
          ? " A P/E is left blank for a company that is not profitable, and a P/B when net worth is negative, because neither ratio says anything useful in those cases."
          : ""}
      </p>
    </>
  );
}

export type NewsSummary = {
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

  return (
    <Card title="Recent signals" subtitle="Price today, and news coverage" topRule="border-t-accent">
      {loading ? (
        <p className="mt-4 text-sm text-stone-500" role="status">
          Loading…
        </p>
      ) : (
        <>
          {/* No score bar here on purpose: a session move is a reading, not a judgement. */}
          <p className="mt-4 text-sm leading-relaxed text-stone-700">
            {unknownSymbol
              ? "No price was requested, because this ticker is outside the covered list."
              : signals.note}
          </p>

          <dl className="mt-4 space-y-2.5 border-t border-stone-100 pt-4">
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
                    ? "Not checked"
                    : news.articleCount === 0
                      ? "Not retrieved"
                      : news.tone === "unknown"
                        ? "Not enough articles"
                        : news.tone.charAt(0).toUpperCase() + news.tone.slice(1)
              }
            />
            <MetricRow label="Articles found" value={news ? String(news.articleCount) : "—"} />
          </dl>

          {news && news.tone === "unknown" ? (
            <p className="mt-3 text-xs leading-relaxed text-stone-600">
              {news.articleCount > 0
                ? `Only ${news.articleCount} headline${news.articleCount === 1 ? "" : "s"} matched this company, which is too few to call a tone. That is a thin sample, not a neutral reading.`
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
  const businessQuality = metrics?.businessQuality;
  const valuation = metrics?.valuation;
  const qualityStyle = styleFor(businessQuality?.verdict ?? "unknown");
  const valuationStyle = styleFor(valuation?.verdict ?? "unknown");

  /**
   * One notice for the two score cards.
   *
   * Both used to render the identical sentence, which told a reader the same
   * thing twice. Stated once above the grid it also explains the quiet
   * placeholders inside the cards.
   */
  const sharedNotice = !loading && !fundamentals
    ? unknownSymbol
      ? "This ticker is outside the covered list, so no company figures were looked up."
      : "Company figures were not retrieved, so neither score could be produced."
    : null;

  /**
   * A dash, for both "still loading" and "nothing to show".
   *
   * The cards used to print a failure sentence while the request was still in
   * flight, which asserted a failure before anything had failed, and then
   * printed the same sentence a second time once the failure was real. The
   * reason is stated once, above the grid.
   */
  const quietPlaceholder = (
    <p className="mt-4 text-lg font-semibold text-stone-400" aria-hidden="true">
      —
    </p>
  );

  return (
    <div className="mb-12">
      {sharedNotice ? (
        <p className="mb-4 text-sm leading-relaxed text-stone-600">{sharedNotice}</p>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-3">
        <Card
          title="Business quality"
          subtitle="Returns on capital"
          topRule={businessQuality ? qualityStyle.topRule : undefined}
          style={businessQuality ? qualityStyle : undefined}
        >
          {loading || !businessQuality ? (
            quietPlaceholder
          ) : (
            <>
              <ScoreBody score={businessQuality} explain="businessQuality" style={qualityStyle} />
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
          )}
        </Card>

        <Card
          title="Valuation"
          subtitle="Price against earnings and net worth"
          topRule={valuation ? valuationStyle.topRule : undefined}
          style={valuation ? valuationStyle : undefined}
        >
          {loading || !valuation ? (
            quietPlaceholder
          ) : (
            <>
              <ScoreBody score={valuation} explain="valuation" style={valuationStyle} />
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
