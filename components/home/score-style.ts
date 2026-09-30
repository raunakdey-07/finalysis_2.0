import type { ScoreVerdict } from "@/lib/metrics";

/**
 * One scale, one label, one colour.
 *
 * The verdict comes from the score itself, so a card can never render as
 * "mixed" in amber while the headline calls it strong. There is no second
 * threshold table to drift out of step.
 *
 * `text` and `bar`/`rule` are separate steps of the accent, or of the status
 * colour that applies. Green is reserved for a favourable reading: the neutral
 * and unknown states stay stone so the accent keeps meaning something.
 */
export type DisplayVerdict = ScoreVerdict | "unknown";

export interface VerdictStyle {
  label: string;
  /** Text colour, which has to clear 4.5:1 on the card. */
  text: string;
  /** Rule and bar fill. */
  rule: string;
  topRule: string;
  bar: string;
}

export const VERDICT_STYLE: Record<DisplayVerdict, VerdictStyle> = {
  favourable: {
    label: "Favourable",
    text: "text-accent-ink",
    rule: "border-l-accent",
    topRule: "border-t-accent",
    bar: "bg-accent",
  },
  mixed: {
    label: "Mixed",
    text: "text-stone-700",
    rule: "border-l-stone-400",
    topRule: "border-t-stone-400",
    bar: "bg-stone-500",
  },
  cautious: {
    label: "Cautious",
    text: "text-caution-ink",
    rule: "border-l-caution",
    topRule: "border-t-caution",
    bar: "bg-caution",
  },
  unknown: {
    label: "Not scored",
    text: "text-stone-600",
    rule: "border-l-stone-300",
    topRule: "border-t-stone-200",
    bar: "bg-stone-300",
  },
};

export function styleFor(verdict: DisplayVerdict): VerdictStyle {
  return VERDICT_STYLE[verdict] ?? VERDICT_STYLE.unknown;
}
