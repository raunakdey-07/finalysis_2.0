"use client";

import type { StockFundamentals, StockMetrics } from "@/types";

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
              <p className="text-sm font-medium text-stone-600">Good business?</p>
              {metrics && <span className={`text-xs font-semibold ${VERDICT[verdict].text}`}>{scoreLabel(score)}</span>}
            </div>

            {metrics ? (
              <>
                <p className={`mt-4 text-4xl font-semibold ${VERDICT[verdict].text}`}>{score}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div className={`h-1.5 rounded-full transition-all ${VERDICT[verdict].bg}`} style={{ width: `${score}%` }} />
                </div>

                <div className="mt-5 space-y-2.5 border-t border-stone-100 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">ROE</span>
                    <span className="font-medium text-stone-700">{fmt2(metrics.fundamentals?.roe)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">ROCE</span>
                    <span className="font-medium text-stone-700">{fmt2(metrics.fundamentals?.roce)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Dividend</span>
                    <span className="font-medium text-stone-700">{fmt2(metrics.fundamentals?.dividendYield)}%</span>
                  </div>
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
              <p className="text-sm font-medium text-stone-600">Getting better?</p>
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
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Today</span>
                    <span className={`font-medium ${effectiveChange >= 0 ? "text-teal-600" : "text-amber-600"}`}>
                      {effectiveChange >= 0 ? "Up" : "Down"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">News tone</span>
                    <span className="font-medium capitalize text-stone-700">{sentimentLabel}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Articles</span>
                    <span className="font-medium text-stone-700">{newsCount}</span>
                  </div>
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
              <p className="text-sm font-medium text-stone-600">Fair price?</p>
              {metrics && <span className={`text-xs font-semibold ${VERDICT[verdict].text}`}>{scoreLabel(score)}</span>}
            </div>

            {metrics ? (
              <>
                <p className={`mt-4 text-4xl font-semibold ${VERDICT[verdict].text}`}>{score}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div className={`h-1.5 rounded-full transition-all ${VERDICT[verdict].bg}`} style={{ width: `${score}%` }} />
                </div>

                <div className="mt-5 space-y-2.5 border-t border-stone-100 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">P/E</span>
                    <span className="font-medium text-stone-700">{fmt2(metrics.fundamentals?.peRatio)}x</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">P/B</span>
                    <span className="font-medium text-stone-700">{fmt2(metrics.fundamentals?.pbRatio)}x</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Book value</span>
                    <span className="font-medium text-stone-700">₹{fmt2(metrics.fundamentals?.bookValue)}</span>
                  </div>
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
