"use client";

import type { NewsItem, Provenance } from "@/types";
import { formatExchangeDateTime, formatRelativeTime } from "@/lib/format";
import { LinkList, Panel, SectionHeading } from "@/components/ui/section";

/**
 * The headlines themselves, and where they came from.
 *
 * The tone reading lives in the Recent signals card, which is the part of the
 * page that summarises a position. This section does the one job it can do
 * well: show the articles, with their publisher, their age, and when the list
 * was refreshed. It also distinguishes an empty result from a failed one, so
 * neither claims a retrieval that did not happen.
 */
export function NewsSection({
  items,
  provenance,
  loading,
  state,
  unknownSymbol,
}: {
  items: NewsItem[];
  provenance: Provenance | null;
  loading: boolean;
  state: 'loading' | 'unavailable' | 'empty' | 'ok';
  unknownSymbol: boolean;
}) {
  const articles = items.filter((item) => !item.synthetic);
  const links = items.filter((item) => item.synthetic);

  return (
    <section aria-labelledby="coverage-heading" className="mb-12">
      <SectionHeading id="coverage-heading">Recent coverage</SectionHeading>

      <Panel accent>
        {loading ? (
          <p className="py-3 text-sm text-stone-500" role="status">
            Looking for recent coverage…
          </p>
        ) : null}

        {!loading && articles.length > 0 ? (
          <>
            <LinkList>
              {articles.map((item) => (
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
                        <span className="sr-only">
                          , published {formatExchangeDateTime(item.pubDate)}
                        </span>
                      </time>
                    </span>
                  </a>
                </li>
              ))}
            </LinkList>
            <p className="mt-4 border-t border-stone-100 pt-3 text-xs text-stone-500">
              {articles.length} headline{articles.length === 1 ? "" : "s"} from{" "}
              {provenance?.source ?? "Google News RSS"}
              {provenance?.lastUpdated
                ? `, refreshed ${formatExchangeDateTime(provenance.lastUpdated)}`
                : ""}
              . Headlines are written by newsrooms, not by Fin-alysis.
            </p>
          </>
        ) : null}

        {!loading && articles.length === 0 ? (
          <div>
            <p className="py-2 text-sm leading-relaxed text-stone-700">
              {unknownSymbol
                ? "No headlines were requested, because this ticker is outside the covered list."
                : state === "unavailable"
                  ? "The news source did not answer, so no headlines could be retrieved."
                  : "No articles were retrieved for this company."}
            </p>
            {links.length > 0 && !unknownSymbol ? (
              <p className="mt-2 text-xs leading-relaxed text-stone-600">
                These are links to primary sources, not news. Fin-alysis has not read them. The
                sources are listed below.
              </p>
            ) : null}
          </div>
        ) : null}
      </Panel>
    </section>
  );
}
