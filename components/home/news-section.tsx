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
  activeView: "research" | "live";
  loadingResearchNews: boolean;
  loadingLiveNews: boolean;
  liveNewsReady: boolean;
  researchNews: NewsItem[];
  liveNews: NewsItem[];
  researchNewsProv: Provenance | null;
  liveNewsProv: Provenance | null;
  onViewChange: (view: "research" | "live") => void;
};

export default function NewsSection({
  activeView,
  loadingResearchNews,
  loadingLiveNews,
  liveNewsReady,
  researchNews,
  liveNews,
  researchNewsProv,
  liveNewsProv,
  onViewChange,
}: NewsSectionProps) {
  const activeNews = activeView === "research" ? researchNews : liveNews;
  const isResearchView = activeView === "research";
  const liveButtonDisabled = !liveNewsReady;
  const isLiveLoading = activeView === "live" && loadingLiveNews && !liveNewsReady;
  const activeProvenance = activeView === "research" ? researchNewsProv : liveNewsProv;

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center gap-4">
        <div className="h-px flex-1 bg-stone-200" />
        <span className="text-xs font-medium uppercase tracking-widest text-stone-500">Recent Coverage</span>
        <div className="h-px flex-1 bg-stone-200" />
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-1">
            <button
              type="button"
              onClick={() => onViewChange("research")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                isResearchView ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              Quick research
            </button>
            <button
              type="button"
              onClick={() => {
                if (liveNewsReady) {
                  onViewChange("live");
                }
              }}
              disabled={liveButtonDisabled}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                liveButtonDisabled
                  ? "cursor-not-allowed bg-stone-100 text-stone-400 opacity-70"
                  : !isResearchView
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-800"
              }`}
            >
              News sentiment
            </button>
          </div>
        </div>

        {isResearchView && loadingResearchNews && activeNews.length === 0 ? (
          <NewsSkeleton />
        ) : activeNews.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-500">
            {isResearchView ? "No research links available right now." : "No live coverage found right now."}
          </p>
        ) : (
          <div className="relative">
            {isLiveLoading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/50">
                <p className="text-xs font-medium uppercase tracking-widest text-stone-500">Loading live articles</p>
              </div>
            ) : null}
            <div className={`divide-y divide-stone-100 ${isLiveLoading ? "pointer-events-none select-none opacity-75" : ""}`}>
              {activeNews.slice(0, 5).map((item) => {
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
          </div>
        )}

        <p className="mt-3 text-center text-xs text-stone-500">
          News aggregated from {activeProvenance?.source ?? "Google News RSS"} for sentiment analysis
        </p>
      </div>
    </section>
  );
}
