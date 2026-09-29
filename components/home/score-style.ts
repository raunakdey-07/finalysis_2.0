import type { ScoreVerdict } from "@/lib/metrics";

/**
 * One scale, one label, one colour.
 *
 * The verdict comes from the score itself, so a card can never render as
 * "mixed" in amber while the headline calls it strong. There is no second
 * threshold table to drift out of step.
 */
export type DisplayVerdict = ScoreVerdict | "unknown";

export const VERDICT_STYLE: Record<
  DisplayVerdict,
  { label: string; text: string; bar: string; rule: string; topRule: string }
> = {
  favourable: {
    label: "Favourable",
    text: "text-teal-800",
    bar: "bg-teal-700",
    rule: "border-l-teal-700",
    topRule: "border-t-teal-700",
  },
  mixed: {
    label: "Mixed",
    text: "text-stone-700",
    bar: "bg-stone-500",
    rule: "border-l-stone-500",
    topRule: "border-t-stone-500",
  },
  cautious: {
    label: "Cautious",
    text: "text-amber-800",
    bar: "bg-amber-700",
    rule: "border-l-amber-700",
    topRule: "border-t-amber-700",
  },
  unknown: {
    label: "Not scored",
    text: "text-stone-600",
    bar: "bg-stone-300",
    rule: "border-l-stone-300",
    topRule: "border-t-stone-200",
  },
};

export function styleFor(verdict: DisplayVerdict) {
  return VERDICT_STYLE[verdict] ?? VERDICT_STYLE.unknown;
}
