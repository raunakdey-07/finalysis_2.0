/**
 * The figure cards' state rule.
 *
 * This is the behaviour that used to live in JSX, where a `loading || noScore`
 * condition made the page print a retrieval failure while the request was still
 * in flight, and where both cards rendered the identical sentence. It is a pure
 * function so it can be pinned without a DOM.
 */
import { describe, expect, it } from 'vitest';
import { decideFigureCards } from '@/components/home/figure-card-state';

const SCORED = { score: 60, verdict: 'mixed' as const };
const OTHER = { score: 40, verdict: 'favourable' as const };

const settled = {
  loading: false,
  fundamentalsPresent: true,
  unknownSymbol: false,
  businessQuality: SCORED,
  valuation: OTHER,
};

describe('decideFigureCards', () => {
  it('passes both scores through when figures are present', () => {
    expect(decideFigureCards(settled)).toEqual({
      notice: null,
      businessQuality: SCORED,
      valuation: OTHER,
    });
  });

  /**
   * The defect this covers: a request in flight is not a failure, so nothing is
   * announced while the page is still loading.
   */
  it('shows placeholders and says nothing at all while loading', () => {
    const decision = decideFigureCards({ ...settled, loading: true });
    expect(decision.businessQuality).toBeUndefined();
    expect(decision.valuation).toBeUndefined();
    expect(decision.notice).toBeNull();
  });

  it('gives one notice when company figures could not be retrieved', () => {
    const decision = decideFigureCards({
      ...settled,
      fundamentalsPresent: false,
      businessQuality: undefined,
      valuation: undefined,
    });

    expect(decision.businessQuality).toBeUndefined();
    expect(decision.valuation).toBeUndefined();
    expect(decision.notice).toMatch(/not retrieved/i);
  });

  it('distinguishes a ticker outside the covered list from a retrieval failure', () => {
    const uncovered = decideFigureCards({
      ...settled,
      fundamentalsPresent: false,
      businessQuality: undefined,
      valuation: undefined,
      unknownSymbol: true,
    });

    expect(uncovered.notice).toMatch(/outside the covered list/i);
    expect(uncovered.notice).not.toMatch(/not retrieved/i);
  });

  it('never produces a notice for a settled company', () => {
    expect(decideFigureCards(settled).notice).toBeNull();
    expect(decideFigureCards({ ...settled, unknownSymbol: true }).notice).toBeNull();
  });

  it('holds up if figures arrive but the scores do not', () => {
    const decision = decideFigureCards({
      ...settled,
      businessQuality: undefined,
      valuation: undefined,
    });
    expect(decision.businessQuality).toBeUndefined();
    // Figures exist, so this is not a retrieval failure and must not claim one.
    expect(decision.notice).toBeNull();
  });
});
