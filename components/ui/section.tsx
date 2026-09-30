/**
 * The page's shared furniture: one section heading, one panel.
 *
 * The heading and the link-list panel were each written out four and two times
 * with slightly different tracking, padding and border colours, so the sections
 * drifted apart. They live here so they cannot.
 */

import { cn } from "@/lib/utils/cn";

/**
 * A section label on a rule, with the section's content below it.
 *
 * The label is the only thing in the page at this size, which is what makes the
 * rule read as a divider rather than as a heading.
 */
export function SectionHeading({
  id,
  children,
  className = "",
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      id={id}
      className={cn(
        "mb-5 flex items-center gap-4 text-xs font-medium uppercase tracking-widest text-stone-500",
        className
      )}
    >
      <span className="h-px flex-1 bg-stone-200" aria-hidden="true" />
      <span>{children}</span>
      <span className="h-px flex-1 bg-stone-200" aria-hidden="true" />
    </h2>
  );
}

/**
 * A white surface under a section heading.
 *
 * `accent` marks the surfaces that carry the product's analytical voice, the
 * coverage and source panels. Leave it off for anything whose rule is
 * reporting a status, because there the colour is carrying meaning rather than
 * identity.
 */
export function Panel({
  accent = false,
  children,
}: {
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-white px-5 py-4 shadow-sm ${accent ? "border-t-4 border-t-accent" : ""}`}>
      {children}
    </div>
  );
}

/**
 * A divided list of links.
 *
 * Both the article list and the research-link list are this, which is why they
 * now line up.
 */
export function LinkList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-stone-100">{children}</ul>;
}
