"use client";

import type { StockFundamentals, StockMetrics } from "@/types";
import { MetricExplanation, ScoreExplanation } from "@/components/ui/metric-explanation";

const VERDICT = {
  strong: {
    text: "text-teal-700",
    bg: "bg-teal-500",
    accent: "border-l-teal-500",
  },
  moderate: {
    text: "text-slate-600",
    bg: "bg-slate-400",
    accent: "border-l-slate-400",
  },
  weak: {
    text: "text-amber-700",
    bg: "bg-amber-400",
    accent: "border-l-amber-400",
  },
} as const;

const SCORE_STRONG = 60;
const SCORE_MODERATE = 40;

function getVerdict(score: number): keyof typeof VERDICT {
  if (score >= SCORE_STRONG) return "strong";
  if (score >= SCORE_MODERATE) return "moderate";
  return "weak";
}

function scoreLabel(score: number): string {
  if (score >= 70) return "Strong";
  if (score >= SCORE_STRONG) return "Solid";
  if (score >= 50) return "Mixed";
  if (score >= SCORE_MODERATE) return "Cautious";
  return "Weak";
}

function sentimentVerdict(label: string): keyof typeof VERDICT {
  if (label === "positive") return "strong";
  if (label === "negative") return "weak";
  return "moderate";
}

function fmt2(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "NA" || value === "") return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return num.toFixed(2);
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border-t-4 border-t-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
        <div className="h-4 w-12 animate-pulse rounded bg-stone-200" />
      </div>
      <div className="mt-4 h-10 w-16 animate-pulse rounded bg-stone-200" />
      <div className="mt-2 h-1.5 w-full animate-pulse rounded bg-stone-200" />
      <div className="mt-5 space-y-2.5 border-t border-stone-100 pt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between">
            <div className="h-4 w-16 animate-pulse rounded bg-stone-200" />
            <div className="h-4 w-12 animate-pulse rounded bg-stone-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

type MetricsLike = Pick<StockMetrics, "profitabilityScore" | "valuationScore"> & {
  fundamentals?: StockFundamentals | null;
};

type MetricRowProps = {
  label: string;
  value: React.ReactNode;
  metric?: React.ReactNode;
};

function MetricRow({ label, value, metric }: MetricRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="inline-flex items-center gap-1.5 font-medium text-stone-700">
        {value}
        {metric}
      </span>
    </div>
  );
}

type AnalysisCardsProps = {
  loadingMetrics: boolean;
  loadingQuote: boolean;
  loadingNews: boolean;
  metrics: MetricsLike | null;
  sentimentLabel: "positive" | "neutral" | "negative";
  stockDataUnavailable: boolean;
  effectiveChange: number | null;
  newsCount: number;
};

export default function AnalysisCards({
  loadingMetrics,
  loadingQuote,
  loadingNews,
  metrics,
  sentimentLabel,
  stockDataUnavailable,
  effectiveChange,
  newsCount,
}: AnalysisCardsProps) {
  return (
    <section className="mb-12 grid gap-6 sm:grid-cols-3">
      {loadingMetrics ? (
        <CardSkeleton />
      ) : (() => {
        const score = metrics?.profitabilityScore ?? 50;
        const verdict = getVerdict(score);
        return (
          <div className={`rounded-xl border-t-4 ${VERDICT[verdict].accent.replace("border-l-", "border-t-")} bg-white p-5 shadow-sm`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-600">Business quality</p>
                <p className="mt-1 text-xs text-stone-500">Screening score</p>
              </div>
              {metrics && <span className={`text-xs font-semibold ${VERDICT[verdict].text}`}>{scoreLabel(score)}</span>}
            </div>

            {metrics ? (
              <>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className={`text-4xl font-semibold ${VERDICT[verdict].text}`}>{score}</span>
                  <span className="text-base font-medium text-stone-500">/100</span>
                  <ScoreExplanation score={score} metric="businessQuality" />
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div className={`h-1.5 rounded-full transition-all ${VERDICT[verdict].bg}`} style={{ width: `${score}%` }} />
                </div>

                <div className="mt-5 space-y-2.5 border-t border-stone-100 pt-4">
                  <MetricRow label="ROE" value={`${fmt2(metrics.fundamentals?.roe)}%`} metric={<MetricExplanation metric="roe" />} />
                  <MetricRow label="ROCE" value={`${fmt2(metrics.fundamentals?.roce)}%`} metric={<MetricExplanation metric="roce" />} />
                  <MetricRow label="Dividend" value={`${fmt2(metrics.fundamentals?.dividendYield)}%`} metric={<MetricExplanation metric="dividendYield" />} />
                </div>
              </>
            ) : (
              <p className="mt-6 text-sm text-stone-500">Data unavailable</p>
            )}
          </div>
        );
      })()}

      {loadingQuote && loadingNews ? (
        <CardSkeleton />
      ) : (() => {
        const verdict = sentimentVerdict(sentimentLabel);
        const momentumScore = sentimentLabel === "positive" ? 70 : sentimentLabel === "negative" ? 30 : 50;
        return (
          <div className={`rounded-xl border-t-4 ${VERDICT[verdict].accent.replace("border-l-", "border-t-")} bg-white p-5 shadow-sm`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-600">Recent signals</p>
                <p className="mt-1 text-xs text-stone-500">Market & news</p>
              </div>
              <span className={`text-xs font-semibold ${VERDICT[verdict].text}`}>
                {sentimentLabel === "positive" ? "Yes" : sentimentLabel === "negative" ? "No" : "Mixed"}
              </span>
            </div>

            {stockDataUnavailable || effectiveChange === null ? (
              <p className="mt-6 text-sm text-stone-500">Data unavailable</p>
            ) : (
              <>
                <p className={`mt-4 text-4xl font-semibold ${effectiveChange >= 1 ? "text-teal-600" : effectiveChange <= -1 ? "text-amber-600" : "text-stone-600"}`}>
                  {effectiveChange >= 0 ? "+" : ""}
                  {effectiveChange.toFixed(2)}%
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div className={`h-1.5 rounded-full transition-all ${VERDICT[verdict].bg}`} style={{ width: `${momentumScore}%` }} />
                </div>

                <div className="mt-5 space-y-2.5 border-t border-stone-100 pt-4">
                  <MetricRow label="Today" value={<span className={effectiveChange >= 0 ? "text-teal-600" : "text-amber-600"}>{effectiveChange >= 0 ? "Up" : "Down"}</span>} />
                  <MetricRow label="News tone" value={<span className="capitalize">{sentimentLabel}</span>} metric={<MetricExplanation metric="newsSentiment" />} />
                  <MetricRow label="Articles" value={newsCount} />
                </div>
              </>
            )}
          </div>
        );
      })()}

      {loadingMetrics ? (
        <CardSkeleton />
      ) : (() => {
        const score = metrics?.valuationScore ?? 50;
        const verdict = getVerdict(score);
        return (
          <div className={`rounded-xl border-t-4 ${VERDICT[verdict].accent.replace("border-l-", "border-t-")} bg-white p-5 shadow-sm`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-600">Fair price?</p>
                <p className="mt-1 text-xs text-stone-500">Valuation</p>
              </div>
              {metrics && <span className={`text-xs font-semibold ${VERDICT[verdict].text}`}>{scoreLabel(score)}</span>}
            </div>

            {metrics ? (
              <>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className={`text-4xl font-semibold ${VERDICT[verdict].text}`}>{score}</span>
                  <span className="text-base font-medium text-stone-500">/100</span>
                  <ScoreExplanation score={score} metric="valuation" />
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div className={`h-1.5 rounded-full transition-all ${VERDICT[verdict].bg}`} style={{ width: `${score}%` }} />
                </div>

                <div className="mt-5 space-y-2.5 border-t border-stone-100 pt-4">
                  <MetricRow label="P/E" value={`${fmt2(metrics.fundamentals?.peRatio)}x`} metric={<MetricExplanation metric="peRatio" />} />
                  <MetricRow label="P/B" value={`${fmt2(metrics.fundamentals?.pbRatio)}x`} metric={<MetricExplanation metric="pbRatio" />} />
                  <MetricRow label="Book value" value={`₹${fmt2(metrics.fundamentals?.bookValue)}`} metric={<MetricExplanation metric="bookValue" />} />
                </div>
              </>
            ) : (
              <p className="mt-6 text-sm text-stone-500">Data unavailable</p>
            )}
          </div>
        );
      })()}
    </section>
  );
}
