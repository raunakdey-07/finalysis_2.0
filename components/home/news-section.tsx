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
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center gap-4">
        <div className="h-px flex-1 bg-stone-200" />
        <span className="text-xs font-medium uppercase tracking-widest text-stone-500">What People Are Saying</span>
        <div className="h-px flex-1 bg-stone-200" />
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
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
      <p className="mt-3 text-center text-xs text-stone-500">
        News aggregated from {newsProv?.source ?? "Google News RSS"} for sentiment analysis
      </p>
    </section>
  );
}
