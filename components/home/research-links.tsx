"use client";

import type { StockFundamentals } from "@/types";
import { buildResearchLinks } from "@/lib/research-links";
import { LinkList, Panel, SectionHeading } from "@/components/ui/section";

/**
 * Where to read more for this company.
 *
 * Shown on every company rather than only when news failed, because "go and
 * check the primary source" is useful whether or not the headlines worked. It
 * is also the only place links appear, so the same list is never rendered
 * twice on one page.
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
      <SectionHeading id="research-heading">Go to the source</SectionHeading>

      <Panel accent>
        <LinkList>
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="text-sm text-stone-800 group-hover:underline">{link.label}</span>
                <span className="text-xs text-stone-500">{link.source}</span>
              </a>
            </li>
          ))}
        </LinkList>
        <p className="mt-4 border-t border-stone-100 pt-3 text-xs text-stone-500">
          Finalysis reads a few published figures and nothing else. Filings, notes and disclosures
          live at these links.
        </p>
      </Panel>
    </section>
  );
}
