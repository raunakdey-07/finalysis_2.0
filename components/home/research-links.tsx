"use client";

import type { StockFundamentals } from "@/types";
import { buildResearchLinks } from "@/lib/research-links";

/**
 * Where to read more for this company.
 *
 * Shown on every company rather than only when news failed, because "go and
 * check the primary source" is useful whether or not the headlines worked.
 */
export function ResearchLinks({
  symbol,
  fundamentals,
}: {
  symbol: string;
  fundamentals: StockFundamentals | null;
}) {
  const links = buildResearchLinks(symbol, fundamentals?.companyName ?? null);

  return (
    <section aria-labelledby="research-heading" className="mb-12">
      <div className="mb-4 flex items-center gap-4">
        <div className="h-px flex-1 bg-stone-200" aria-hidden="true" />
        <h2 id="research-heading" className="text-xs font-medium uppercase tracking-widest text-stone-500">
          Go to the source
        </h2>
        <div className="h-px flex-1 bg-stone-200" aria-hidden="true" />
      </div>

      <div className="bg-white px-5 py-1 shadow-sm">
        <ul className="divide-y divide-stone-100">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5"
              >
                <span className="text-sm text-stone-800 group-hover:underline">{link.label}</span>
                <span className="text-xs text-stone-500">{link.source}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-2 text-xs text-stone-500">
        Finalysis reads a few published figures and nothing else. Filings, notes and disclosures live
        at these links.
      </p>
    </section>
  );
}
