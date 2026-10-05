/**
 * Explainable screening metrics.
 *
 * Two rules govern everything here:
 *
 * 1. An input the provider did not disclose is null. It is never rounded to a
 *    neutral contribution, because a neutral contribution is indistinguishable
 *    from a real, unremarkable reading once it reaches the page.
 * 2. A score is only produced when there is at least one real input. The share
 *    of inputs that were actually available travels with the score so the UI
 *    can say how much weight is behind it.
 */

import { StockFundamentals, StockPrice } from '@/types';

export type SectorProfileKey =
  | 'banking'
  | 'technology'
  | 'consumer'
  | 'pharma'
  | 'capital'
  | 'energy'
  | 'metals'
  | 'general';

export interface SectorProfile {
  key: SectorProfileKey;
  label: string;
  peLow: number;
  peFair: number;
  peHigh: number;
  pbLow: number;
  pbFair: number;
  pbHigh: number;
  roeStrong: number;
  roeHealthy: number;
  roeWeak: number;
  roceStrong: number;
  roceWeak: number;
}

const SECTOR_PROFILES: Record<SectorProfileKey, SectorProfile> = {
  banking: {
    key: 'banking', label: 'Banking & Financials',
    peLow: 10, peFair: 24, peHigh: 35,
    pbLow: 1, pbFair: 3, pbHigh: 5,
    roeStrong: 15, roeHealthy: 11, roeWeak: 8,
    roceStrong: 12, roceWeak: 8,
  },
  technology: {
    key: 'technology', label: 'Technology',
    peLow: 18, peFair: 40, peHigh: 60,
    pbLow: 3, pbFair: 10, pbHigh: 16,
    roeStrong: 20, roeHealthy: 14, roeWeak: 9,
    roceStrong: 18, roceWeak: 10,
  },
  consumer: {
    key: 'consumer', label: 'Consumer & FMCG',
    peLow: 20, peFair: 45, peHigh: 65,
    pbLow: 4, pbFair: 12, pbHigh: 18,
    roeStrong: 22, roeHealthy: 15, roeWeak: 10,
    roceStrong: 20, roceWeak: 12,
  },
  pharma: {
    key: 'pharma', label: 'Pharma & Healthcare',
    peLow: 16, peFair: 34, peHigh: 50,
    pbLow: 2, pbFair: 7, pbHigh: 12,
    roeStrong: 18, roeHealthy: 12, roeWeak: 8,
    roceStrong: 16, roceWeak: 10,
  },
  capital: {
    key: 'capital', label: 'Industrials & Capital Goods',
    peLow: 14, peFair: 30, peHigh: 45,
    pbLow: 1.5, pbFair: 5, pbHigh: 9,
    roeStrong: 17, roeHealthy: 11, roeWeak: 7,
    roceStrong: 15, roceWeak: 9,
  },
  energy: {
    key: 'energy', label: 'Energy & Utilities',
    peLow: 10, peFair: 22, peHigh: 32,
    pbLow: 1, pbFair: 3.5, pbHigh: 6,
    roeStrong: 16, roeHealthy: 10, roeWeak: 7,
    roceStrong: 13, roceWeak: 8,
  },
  metals: {
    key: 'metals', label: 'Metals & Mining',
    peLow: 8, peFair: 18, peHigh: 28,
    pbLow: 0.9, pbFair: 2.5, pbHigh: 4,
    roeStrong: 15, roeHealthy: 10, roeWeak: 6,
    roceStrong: 14, roceWeak: 8,
  },
  general: {
    key: 'general', label: 'the general market',
    peLow: 15, peFair: 35, peHigh: 55,
    pbLow: 2, pbFair: 6, pbHigh: 10,
    roeStrong: 18, roeHealthy: 12, roeWeak: 8,
    roceStrong: 15, roceWeak: 10,
  },
};

type KeywordRule = SectorProfileKey;

/**
 * Keywords per sector. Short keywords are matched against a whole word so that
 * "Capital Goods" is not classified as "IT" by the letters inside "capital",
 * and longer ones match inside a word so "pharmaceuticals" still hits "pharma".
 */
const SECTOR_KEYWORDS: Record<KeywordRule, string[]> = {
  banking: ['bank', 'banking', 'financial', 'finance', 'insurance', 'nbfc', 'stockbroking', 'broking'],
  technology: ['technology', 'software', 'internet', 'computer', 'telecom', 'it'],
  consumer: ['consumer', 'fmcg', 'retail', 'food', 'hotel', 'beverage', 'tobacco', 'personal care'],
  pharma: ['pharma', 'healthcare', 'hospital', 'biotech', 'therapeutic', 'laborator'],
  capital: [
    'capital', 'capital goods', 'industrial', 'engineering', 'construction',
    'infrastructure', 'machinery', 'defence', 'auto', 'transport', 'cement', 'electrical',
  ],
  energy: ['energy', 'power', 'oil', 'gas', 'fuel', 'utility', 'utilities', 'refinery', 'electricity'],
  metals: ['metal', 'steel', 'mining', 'cement', 'aluminium', 'zinc', 'copper', 'alloy'],
  general: [],
};

const SHORT_KEYWORD_LIMIT = 4;

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function keywordMatches(tokens: string[], joined: string, keyword: string): boolean {
  if (keyword.includes(' ')) return joined.includes(keyword);
  if (keyword.length <= SHORT_KEYWORD_LIMIT) {
    return tokens.includes(keyword);
  }
  return tokens.some((token) => token.includes(keyword));
}

/**
 * Choose valuation bands from the company's sector.
 *
 * The sector is the broad classification the provider publishes
 * ("Energy", "Financial Services"), not the narrow industry. When it is
 * missing we fall back to general-market bands and say so, because silently
 * scoring a bank on software multiples is the error this avoids.
 */
export function inferSectorProfile(sector: string | null | undefined): {
  profile: SectorProfile;
  recognised: boolean;
} {
  const tokens = tokenize(sector ?? '');
  const joined = tokens.join(' ');

  if (tokens.length > 0) {
    // A capital-markets business is a financial one, so it is checked first.
    if (tokens.includes('capital') && tokens.includes('markets')) {
      return { profile: SECTOR_PROFILES.banking, recognised: true };
    }

    for (const [rule, keywords] of Object.entries(SECTOR_KEYWORDS)) {
      if (keywords.length === 0) continue;
      if (keywords.some((keyword) => keywordMatches(tokens, joined, keyword))) {
        return { profile: SECTOR_PROFILES[rule as SectorProfileKey], recognised: true };
      }
    }
  }

  return { profile: SECTOR_PROFILES.general, recognised: false };
}

export type ScoreVerdict = 'favourable' | 'mixed' | 'cautious';

export interface MetricScore {
  /**
   * The screening score on a 0-100 scale, or null when the provider gave us
   * nothing to score. A null score is never replaced by a default.
   */
  score: number | null;
  verdict: ScoreVerdict | null;
  /** 0 to 1: share of the inputs that were actually available. */
  coverage: number;
  available: number;
  considered: number;
  /** One line per input that had a real value. */
  highlights: string[];
  /** One line per input the provider did not disclose. */
  missing: string[];
}

interface Reading {
  delta: number;
  note: string;
}

interface InputSpec {
  label: string;
  value: number | null;
  read: (value: number) => Reading;
}

const BASE_SCORE = 50;

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function verdictFor(score: number): ScoreVerdict {
  if (score >= 60) return 'favourable';
  if (score >= 40) return 'mixed';
  return 'cautious';
}

/**
 * Combine available readings into a score.
 *
 * The neutral base is the reference point a real reading is measured against,
 * not a stand-in for a missing one. With nothing available there is nothing to
 * measure, so the score is null.
 */
function combine(specs: InputSpec[]): MetricScore {
  const highlights: string[] = [];
  const missing: string[] = [];
  let total = BASE_SCORE;
  let available = 0;

  for (const spec of specs) {
    if (spec.value === null || !Number.isFinite(spec.value)) {
      missing.push(spec.label);
      continue;
    }
    available += 1;
    const reading = spec.read(spec.value);
    total += reading.delta;
    highlights.push(reading.note);
  }

  const coverage = specs.length === 0 ? 0 : available / specs.length;

  if (available === 0) {
    return {
      score: null,
      verdict: null,
      coverage,
      available,
      considered: specs.length,
      highlights,
      missing,
    };
  }

  // The verdict is read off the number the card actually prints, not off the
  // raw total. They are the same value today only because every delta is a
  // whole number; the moment one is not, a total of 59.5 would print 60 on the
  // card and read "Mixed" beside a 60 whose band starts at 60.
  const score = clamp(Math.round(total));

  return {
    score,
    verdict: verdictFor(score),
    coverage,
    available,
    considered: specs.length,
    highlights,
    missing,
  };
}

export function calculateValuationScore(
  fundamentals: StockFundamentals,
  profile: SectorProfile
): MetricScore {
  return combine([
    {
      label: 'P/E',
      value: fundamentals.peRatio,
      read: (value) => {
        if (value <= 0) {
          return { delta: 0, note: 'P/E is not meaningful for a loss-making company' };
        }
        if (value < profile.peLow) {
          return { delta: 15, note: `P/E is ${value.toFixed(2)}, below the ${profile.label} band of ${profile.peLow}, which is usually value-friendly` };
        }
        if (value <= profile.peFair) {
          return { delta: 5, note: `P/E is ${value.toFixed(2)}, within the ${profile.label} range` };
        }
        if (value <= profile.peHigh) {
          return { delta: -8, note: `P/E is ${value.toFixed(2)}, above the ${profile.label} fair band, and needs growth to justify` };
        }
        return { delta: -18, note: `P/E is ${value.toFixed(2)}, well above the ${profile.label} band of ${profile.peHigh}` };
      },
    },
    {
      label: 'P/B',
      value: fundamentals.pbRatio,
      read: (value) => {
        if (value <= 0) {
          return { delta: 0, note: 'P/B is not meaningful on negative net worth' };
        }
        if (value < profile.pbLow) {
          return { delta: 10, note: `P/B is ${value.toFixed(2)}, below the ${profile.label} band of ${profile.pbLow}` };
        }
        if (value <= profile.pbFair) {
          return { delta: 0, note: `P/B is ${value.toFixed(2)}, a normal-to-premium level for ${profile.label}` };
        }
        if (value <= profile.pbHigh) {
          return { delta: -8, note: `P/B is ${value.toFixed(2)}, above the ${profile.label} fair band` };
        }
        return { delta: -15, note: `P/B is ${value.toFixed(2)}, well above the ${profile.label} band of ${profile.pbHigh}` };
      },
    },
  ]);
}

export function calculateBusinessQualityScore(
  fundamentals: StockFundamentals,
  profile: SectorProfile
): MetricScore {
  return combine([
    {
      label: 'ROE',
      value: fundamentals.roe,
      read: (value) => {
        if (value >= profile.roeStrong) {
          return { delta: 18, note: `ROE is ${value.toFixed(1)}%, strong against the ${profile.label} band` };
        }
        if (value >= profile.roeHealthy) {
          return { delta: 8, note: `ROE is ${value.toFixed(1)}%, healthy against the ${profile.label} band` };
        }
        if (value < profile.roeWeak) {
          return { delta: -12, note: `ROE is ${value.toFixed(1)}%, weak against the ${profile.label} band` };
        }
        return { delta: 0, note: `ROE is ${value.toFixed(1)}%, moderate against the ${profile.label} band` };
      },
    },
    {
      label: 'ROCE',
      value: fundamentals.roce,
      read: (value) => {
        if (value >= profile.roceStrong) {
          return { delta: 10, note: `ROCE is ${value.toFixed(1)}%, indicating efficient use of capital` };
        }
        if (value < profile.roceWeak) {
          return { delta: -8, note: `ROCE is ${value.toFixed(1)}%, indicating weaker capital efficiency` };
        }
        return { delta: 0, note: `ROCE is ${value.toFixed(1)}%` };
      },
    },
    {
      label: 'Dividend yield',
      value: fundamentals.dividendYield,
      read: (value) => ({
        delta: value > 2 ? 4 : 0,
        note:
          value > 2
            ? `Dividend yield is ${value.toFixed(2)}%, an added income component`
            : `Dividend yield is ${value.toFixed(2)}%`,
      }),
    },
  ]);
}

/** Raw market signals. Not a score: these are readings, not a judgement. */
export interface MarketSignals {
  dailyChangePercent: number | null;
  hasPrice: boolean;
  note: string;
}

export function readMarketSignals(price: StockPrice | null): MarketSignals {
  if (!price) {
    return {
      dailyChangePercent: null,
      hasPrice: false,
      note: 'No price was available, so there is no market signal to report.',
    };
  }

  if (price.changePercent === null) {
    return {
      dailyChangePercent: null,
      hasPrice: true,
      note: 'Price is available, but the provider did not report a session change for it.',
    };
  }

  const direction = price.changePercent > 0 ? 'up' : price.changePercent < 0 ? 'down' : 'flat';
  return {
    dailyChangePercent: price.changePercent,
    hasPrice: true,
    note: `Price is ${direction} ${Math.abs(price.changePercent).toFixed(2)}% against the previous close.`,
  };
}

/**
 * The practical midpoint of a 12-month range, measured not assumed.
 *
 * The arithmetic midpoint of 50 is the wrong centre. A stock's 52-week high and
 * low are set at different times, so a falling stock has its low set recently
 * and the current price sits in the bottom of its own range. Measured across two
 * independent samples of 39 large caps, raw range position averaged 30.0 and
 * 29.9, with 85% of names below the midpoint.
 *
 * Centring on the observed 30 rather than on 50 is what makes a score of 50 mean
 * "an ordinary stock on an ordinary day". A previous attempt compressed the
 * term toward 50 by 0.6 instead, which lifted the mean from 38 to 43 but
 * shrank the spread from 65 to 38, so the scale only ever used 26 to 64.
 * Recentring keeps the full width.
 *
 * This is a market-level constant, not a per-company one. It will drift as the
 * market's own distribution drifts, and it is the one number here that should
 * be re-measured rather than trusted.
 */
const RANGE_PRACTICAL_MIDPOINT = 30;

/**
 * Points of scale per percent move.
 *
 * Two things have to be true at once. A normal move has to be able to reach
 * the ends of the scale, or the composite can never use them; and a single good
 * day must not be able to outvote where the price actually sits, or a stock
 * resting on its 52-week low reads as healthy on the strength of one session.
 * These gains give a 3% week and a 2% session the reach they need without
 * letting either saturate on a routine move.
 */
const WEEKLY_SCALE = 6;
const DAILY_SCALE = 8;

function rangePosition(price: StockPrice | null): number | null {
  if (!price) return null;
  const { fiftyTwoWeekHigh, fiftyTwoWeekLow, price: current } = price;
  if (fiftyTwoWeekHigh === null || fiftyTwoWeekLow === null) return null;
  if (fiftyTwoWeekHigh <= fiftyTwoWeekLow) return null;

  const raw = ((current - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100;
  const recentred = 50 + (raw - RANGE_PRACTICAL_MIDPOINT);
  return Math.max(0, Math.min(100, recentred));
}

/**
 * A move mapped onto the same 0-100 scale, around a flat period.
 *
 * The scales are set so a normal move can actually reach the ends of the scale.
 * At the original gains, a whole week of 3% moved the term by 12 points and a
 * single 2.5% session by 25, so both terms sat in a narrow band around neutral
 * and could never outvote the much wider range term. Averaging a wide input
 * with two narrow ones cannot produce the composite's own extremes, which left
 * the scale occupying 28 to 76 of its available 0 to 100.
 */
function movePosition(changePercent: number | null, scale: number): number | null {
  if (changePercent === null || !Number.isFinite(changePercent)) return null;
  return Math.max(0, Math.min(100, 50 + changePercent * scale));
}

/**
 * The three label states describe how price and coverage have been behaving.
 *
 * They deliberately do not say "falling" or "near its low". These inputs
 * measure a blend: a stock resting on its 52-week low while flat and one in
 * freefall carry the same label, so any location or movement claim is
 * unsupported. Measured behaviour is what the label can state; the popover
 * carries where the price actually sits and how fast it is moving.
 */
export type SignalsState = 'buoyant' | 'steady' | 'soft';

/** Turn a compressed position back into words a reader can check. */
function describeRange(position: number): string {
  const raw = position - 50 + RANGE_PRACTICAL_MIDPOINT;
  if (raw <= 10) return 'in the bottom tenth';
  if (raw >= 90) return 'in the top tenth';
  return `${raw.toFixed(0)}%`;
}

/**
 * A market-position reading for the third card.
 *
 * This is deliberately not a quality score, and it is labelled with its own
 * vocabulary rather than the Favourable/Mixed/Cautious the other two cards use.
 * A company near its 52-week low is low here and may be an excellent business,
 * and a reader who assumed the three cards were comparable judgements would
 * misread it.
 */
export function calculateSignalsScore(
  price: StockPrice | null,
  tone: 'positive' | 'negative' | 'neutral' | 'unknown' | null,
  toneReported: boolean
): {
  score: number | null;
  state: SignalsState | null;
  coverage: number;
  available: number;
  notes: string[];
} {
  const inputs: {
    label: string;
    value: number | null;
    weight: number;
    note: (value: number) => string;
  }[] = [
    {
      label: '12-month range position',
      value: rangePosition(price),
      // Double weight. The range term is the slowest and most informative input,
      // and it is recentred so it cannot drag the whole reading down with the
      // market. That is what earns the extra weight: a stock resting on its
      // 52-week low should not be rescued by one good session.
      weight: 2,
      note: (value) =>
        `The price sits ${describeRange(value)} of the way between its 52-week low and its 52-week high.`,
    },
    {
      label: 'Recent movement',
      value: movePosition(price?.recentChangePercent ?? null, WEEKLY_SCALE),
      weight: 1,
      note: (value) =>
        value >= 50
          ? `Up over the last few sessions, at ${value.toFixed(0)} on the movement scale.`
          : `Down over the last few sessions, at ${value.toFixed(0)} on the movement scale.`,
    },
    {
      label: "Today's move",
      value: movePosition(price?.changePercent ?? null, DAILY_SCALE),
      weight: 1,
      note: (value) =>
        value >= 50
          ? `The session is up, at ${value.toFixed(0)} on the day's scale.`
          : `The session is down, at ${value.toFixed(0)} on the day's scale.`,
    },
  ];

  // The range term keeps double weight, deliberately. Location is the input a
  // reader most needs respected: a stock sitting on its 52-week low should not
  // be rescued by one good session, and equal weighting let that happen in
  // testing. The cost is that location carries most of the variance, which is
  // the lesser evil now that the term is recentred and cannot bias the level.
  //
  // Headline tone only counts once enough articles were retrieved for it to
  // mean anything.
  if (toneReported && tone !== 'unknown' && tone !== null) {
    const toneValue = tone === 'positive' ? 70 : tone === 'negative' ? 30 : 50;
    inputs.push({
      label: 'Headline tone',
      value: toneValue,
      weight: 1,
      note: (value) =>
        value > 50
          ? 'Retrieved headlines read positive.'
          : value < 50
            ? 'Retrieved headlines read negative.'
            : 'Retrieved headlines read neutral.',
    });
  }

  const notes: string[] = [];
  let total = 0;
  let weight = 0;
  let available = 0;

  for (const input of inputs) {
    if (input.value === null) {
      notes.push(`${input.label} was not available, so it contributed nothing.`);
      continue;
    }
    available += 1;
    weight += input.weight;
    total += input.value * input.weight;
    notes.push(input.note(input.value));
  }

  if (available === 0) {
    return { score: null, state: null, coverage: 0, available: 0, notes };
  }

  // Coverage is against every input the reading could have used, not just the
  // ones present in this call, so a page with no headlines cannot report full
  // coverage by quietly narrowing the denominator.
  const POSSIBLE_INPUTS = 4;

  const score = Math.round(total / weight);
  return {
    score,
    state: score >= 58 ? 'buoyant' : score >= 44 ? 'steady' : 'soft',
    coverage: available / POSSIBLE_INPUTS,
    available,
    notes,
  };
}

export type VerdictLabel = 'favourable' | 'mixed' | 'cautious' | 'insufficient-data';

export interface ScreeningVerdict {
  label: VerdictLabel;
  headline: string;
  summary: string;
  coverage: number;
  basis: string;
}

export interface StockMetrics {
  symbol: string;
  sectorProfile: SectorProfile;
  valuation: MetricScore;
  businessQuality: MetricScore;
  /** Mean of the sub-scores that exist, or null when none do. */
  overallScore: number | null;
  overallCoverage: number;
}

/**
 * Combine the two screening scores that actually exist.
 *
 * A missing sub-score is left out of the average and lowers the stated coverage
 * rather than pulling the result towards neutral.
 */
function combineOverall(valuation: MetricScore, quality: MetricScore): {
  score: number | null;
  coverage: number;
} {
  const present = [valuation, quality].filter((metric) => metric.score !== null);
  if (present.length === 0) return { score: null, coverage: 0 };

  const average = present.reduce((sum, metric) => sum + metric.score!, 0) / present.length;

  const considered = valuation.considered + quality.considered;
  const available = valuation.available + quality.available;

  return {
    score: clamp(Math.round(average)),
    coverage: considered === 0 ? 0 : available / considered,
  };
}

export function calculateMetrics(fundamentals: StockFundamentals): StockMetrics {
  const { profile } = inferSectorProfile(fundamentals.sector);

  const valuation = calculateValuationScore(fundamentals, profile);
  const businessQuality = calculateBusinessQualityScore(fundamentals, profile);
  const overall = combineOverall(valuation, businessQuality);

  return {
    symbol: fundamentals.symbol,
    sectorProfile: profile,
    valuation,
    businessQuality,
    overallScore: overall.score,
    overallCoverage: overall.coverage,
  };
}

/**
 * Turn the screening scores into a plain-language reading.
 *
 * The wording describes what was computed. It never calls a screening score a
 * fair price, a recommendation, or a setup, because none of those is what a
 * band comparison can tell you.
 */
export function describeVerdict(metrics: StockMetrics): ScreeningVerdict {
  const { overallScore, overallCoverage, valuation, businessQuality } = metrics;

  if (overallScore === null) {
    return {
      label: 'insufficient-data',
      headline: 'Not enough data to screen',
      summary:
        'The provider did not publish the metrics this screen needs, so Fin-alysis has nothing to compare against sector bands. It is not a judgement about the company.',
      coverage: 0,
      basis: 'No screening inputs were available.',
    };
  }

  const parts: string[] = [];
  if (valuation.score !== null) parts.push(`valuation ${valuation.score}/100`);
  if (businessQuality.score !== null) parts.push(`business quality ${businessQuality.score}/100`);

  const basis = `Based on ${parts.join(' and ')}, using ${metrics.sectorProfile.label} bands.`;

  const thin = overallCoverage < 0.5;
  const coverageNote = thin
    ? ` Only ${Math.round(overallCoverage * 100)}% of the metrics this screen uses were available, so treat the reading as provisional.`
    : '';

  if (overallScore >= 60) {
    return {
      label: 'favourable',
      headline: 'Screening reads favourably',
      summary: `The available metrics sit on the stronger side of the bands for this sector.${coverageNote}`,
      coverage: overallCoverage,
      basis,
    };
  }

  if (overallScore >= 40) {
    return {
      label: 'mixed',
      headline: 'Screening reads mixed',
      summary: `The available metrics fall around the middle of the sector bands, with offsetting strengths and weaknesses.${coverageNote}`,
      coverage: overallCoverage,
      basis,
    };
  }

  return {
    label: 'cautious',
    headline: 'Screening reads cautious',
    summary: `Most available metrics sit on the weaker side of the sector bands.${coverageNote}`,
    coverage: overallCoverage,
    basis,
  };
}
