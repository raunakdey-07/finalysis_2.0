/**
 * What the figure cards should show, decided without rendering anything.
 *
 * The cards used to carry their own fallback strings and a condition that
 * mixed "still loading" with "no data", which meant a request in flight
 * announced a failure. Deciding the state here keeps the JSX a renderer, gives
 * the type system the narrowing so no assertion is needed at the call site, and
 * makes the rule testable without a DOM.
 */

/** The score shape each caller passes in. Keeps this module free of imports. */
export type ScoredLike = { score: number | null };

/**
 * The two scores are independent of each other, so they get independent type
 * parameters. A single parameter would force them to unify, which is both wrong
 * and a trap for a caller whose two scores carry different shapes.
 */
export interface FigureCardDecision<B, V> {
  /**
   * One sentence covering both score cards, or null. Never two.
   */
  notice: string | null;
  /** The score to render, or undefined for a quiet placeholder. */
  businessQuality: B | undefined;
  valuation: V | undefined;
}

const NOT_COVERED =
  'This ticker is outside the covered list, so no company figures were looked up.';
const NOT_RETRIEVED = 'Company figures were not retrieved, so neither score could be produced.';

export function decideFigureCards<B extends ScoredLike, V extends ScoredLike>(input: {
  loading: boolean;
  fundamentalsPresent: boolean;
  unknownSymbol: boolean;
  businessQuality: B | undefined;
  valuation: V | undefined;
}): FigureCardDecision<B, V> {
  // A request in flight is not a failure, so nothing is announced while loading.
  if (input.loading) {
    return { notice: null, businessQuality: undefined, valuation: undefined };
  }

  if (!input.fundamentalsPresent) {
    return {
      notice: input.unknownSymbol ? NOT_COVERED : NOT_RETRIEVED,
      businessQuality: undefined,
      valuation: undefined,
    };
  }

  return { notice: null, businessQuality: input.businessQuality, valuation: input.valuation };
}
