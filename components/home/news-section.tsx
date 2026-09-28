"use client";

import type { NewsItem, Provenance } from "@/types";
import { formatExchangeDateTime, formatRelativeTime } from "@/lib/format";
import { getNewsCoverageMessage } from "@/lib/education";
import { MetricExplanation } from "@/components/ui/metric-explanation";

type ToneReading = {
  tone: "positive" | "negative" | "neutral" | "unknown";
  articleCount: number;
  note: string;
};

function ArticleList({ items }: { items: NewsItem[] }) {
  return (
    <ul className="divide-y divide-stone-100">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer noopener"
            className="group flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
          >
            <span className="text-sm leading-relaxed text-stone-800 group-hover:underline">
              {item.title}
            </span>
            <span className="text-xs text-stone-500">
              {item.source}
              <span aria-hidden="true"> · </span>
              <time dateTime={item.pubDate}>
                {formatRelativeTime(item.pubDate)}
                <span className="sr-only">, published {formatExchangeDateTime(item.pubDate)}</span>
              </time>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Recent coverage, with the honesty rules attached.
 *
 * Articles and fallback links are never mixed in one list. Links appear only
 * when no article was retrieved, under a heading that says exactly that, and
 * they carry no publication date because they are not articles.
 */
export function NewsSection({
  items,
  tone,
  provenance,
  loading,
}: {
  items: NewsItem[];
  tone: ToneReading | null;
  provenance: Provenance | null;
  loading: boolean;
}) {
  const articles = items.filter((item) => !item.synthetic);
  const links = items.filter((item) => item.synthetic);

  return (
    <section aria-labelledby="coverage-heading" className="mb-12">
      <div className="mb-4 flex items-center gap-4">
        <div className="h-px flex-1 bg-stone-200" aria-hidden="true" />
        <h2
          id="coverage-heading"
          className="text-xs font-medium uppercase tracking-widest text-stone-500"
        >
          Recent coverage
        </h2>
        <div className="h-px flex-1 bg-stone-200" aria-hidden="true" />
      </div>

      <div className="bg-white p-5 shadow-sm">
        {loading ? (
          <p className="py-4 text-sm text-stone-500" role="status">
            Looking for recent coverage…
          </p>
        ) : null}

        {!loading && articles.length > 0 ? (
          <>
            <div className="mb-4 border-l-2 border-stone-200 pl-3">
              <p className="flex items-center text-xs text-stone-600">
                <MetricExplanation metric="recentSignals" />
                {tone?.tone === "unknown"
                  ? "No news tone is reported."
                  : `Headline tone reads ${tone?.tone}.`}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">
                {getNewsCoverageMessage(articles.length, tone?.tone !== "unknown")}
              </p>
            </div>
            <ArticleList items={articles} />
            <p className="mt-4 border-t border-stone-100 pt-3 text-xs text-stone-500">
              Headlines retrieved from {provenance?.source ?? "Google News RSS"}
              {provenance?.lastUpdated
                ? `, refreshed ${formatExchangeDateTime(provenance.lastUpdated)}`
                : ""}
              . Headlines are written by newsrooms, not by Finalysis, and describe what was
              reported rather than what is true.
            </p>
          </>
        ) : null}

        {!loading && articles.length === 0 ? (
          <div>
            <p className="py-2 text-sm leading-relaxed text-stone-700">
              {getNewsCoverageMessage(0, false)}
            </p>
            {links.length > 0 ? (
              <div className="mt-4 border-t border-stone-100 pt-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
                  Where to look instead
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  No articles were retrieved, so these are direct links to primary sources. They are
                  not news, and Finalysis has not read them.
                </p>
                <ul className="mt-3 divide-y divide-stone-100">
                  {links.map((link) => (
                    <li key={link.id}>
                      <a
                        href={link.link}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="group flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
                      >
                        <span className="text-sm text-stone-800 group-hover:underline">
                          {link.title}
                        </span>
                        <span className="text-xs text-stone-500">{link.source}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
