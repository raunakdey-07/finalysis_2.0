"use client";

import type { NewsItem, Provenance } from "@/types";

const SENTIMENT_DOT: Record<"positive" | "neutral" | "negative", string> = {
  positive: "bg-teal-500",
  neutral: "bg-slate-400",
  negative: "bg-amber-400",
};

function relativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function NewsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-4 py-3">
          <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full bg-stone-200" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-full animate-pulse rounded bg-stone-200" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-stone-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

type NewsSectionProps = {
  loadingNews: boolean;
  news: NewsItem[];
  newsProv: Provenance | null;
};

export default function NewsSection({ loadingNews, news, newsProv }: NewsSectionProps) {
  const sourceLabel = newsProv?.source ?? "Google News RSS";
  const usingFallbackResources = sourceLabel.toLowerCase().includes("fallback resources");
  const displaySourceLabel = sourceLabel
    .replace(/^Fallback resources:\s*/i, "")
    .replace(/^Google News RSS \+ fallback resources:\s*/i, "Google News RSS + ");
  const feedStateLabel = usingFallbackResources
    ? "Backup sources"
    : sourceLabel.toLowerCase().includes("gnews fallback")
      ? "Live + backup"
      : newsProv?.cacheHit
        ? "Cached live feed"
        : "Live feed";

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center gap-4">
        <div className="h-px flex-1 bg-stone-200" />
        <span className="text-xs font-medium uppercase tracking-widest text-stone-500">Recent Coverage</span>
        <div className="h-px flex-1 bg-stone-200" />
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        {newsProv ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-stone-500">News aggregated from {displaySourceLabel} for sentiment analysis</p>
            <span
              className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
                usingFallbackResources
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : newsProv.cacheHit
                    ? "border-stone-200 bg-stone-50 text-stone-600"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {feedStateLabel}
            </span>
          </div>
        ) : null}
        {usingFallbackResources ? (
          <p className="mb-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
            Live RSS is thin right now. Showing backup sources so research never stalls.
          </p>
        ) : null}
        {loadingNews ? (
          <NewsSkeleton />
        ) : news.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-500">No recent coverage found for this stock.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {news.slice(0, 5).map((item) => {
              const sentiment = item.sentiment ?? "neutral";
              return (
                <a
                  key={item.id}
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <span className={`mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full ${SENTIMENT_DOT[sentiment]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-stone-700 group-hover:text-stone-900">{item.title}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      <span className="font-medium">{item.source}</span> · {relativeTime(new Date(item.pubDate))}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
