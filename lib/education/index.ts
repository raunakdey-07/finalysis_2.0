/**
 * Plain-language definitions shown behind the "?" controls.
 *
 * Every entry states what the number is, why anyone would look at it, and what
 * it does not tell you. The third part is not padding: these are the sentences
 * that stop a screening score being read as a recommendation.
 */

export type EducationKey =
  | 'roe'
  | 'roce'
  | 'dividendYield'
  | 'peRatio'
  | 'pbRatio'
  | 'bookValue'
  | 'eps'
  | 'businessQuality'
  | 'valuation'
  | 'recentSignals'
  | 'screeningVerdict'
  | 'coverage'
  | 'freshness'
  | 'provenance';

export interface MetricDefinition {
  key: EducationKey;
  name: string;
  shortDescription: string;
  whyItMatters: string;
  interpretation: string;
  caveat?: string;
}

const DEFINITIONS: Record<EducationKey, MetricDefinition> = {
  roe: {
    key: 'roe',
    name: 'ROE, return on equity',
    shortDescription: 'Profit earned on each rupee of shareholders’ money.',
    whyItMatters: 'It shows how hard the business works the capital owners have put in.',
    interpretation: 'Compare it with peers and with the company’s own past readings.',
    caveat: 'A heavily borrowed balance sheet or a very small equity base can push ROE up without the business being any stronger.',
  },
  roce: {
    key: 'roce',
    name: 'ROCE, return on capital employed',
    shortDescription: 'Profit from the operating business, measured against the capital tied up in it.',
    whyItMatters: 'It separates operating performance from how the company is financed.',
    interpretation: 'Steady ROCE against comparable companies supports a stronger read on quality.',
    caveat: 'ROCE and ROE answer different questions and are not interchangeable. Capital-intensive industries sit lower by nature.',
  },
  dividendYield: {
    key: 'dividendYield',
    name: 'Dividend yield',
    shortDescription: 'Annual dividend per share, as a percentage of the current price.',
    whyItMatters: 'It is the part of your return that arrives as cash.',
    interpretation: 'A higher yield adds income, provided the payout is covered by earnings.',
    caveat: 'A high yield often means the price has fallen, and a dividend can be cut at any time.',
  },
  peRatio: {
    key: 'peRatio',
    name: 'P/E, price to earnings',
    shortDescription: 'Roughly what you pay for each rupee of annual profit.',
    whyItMatters: 'It makes differently sized companies comparable on price.',
    interpretation: 'Read it against peers, expected growth, and the company’s own history.',
    caveat: 'A low P/E is not automatically a bargain. It can reflect slow growth, risk, or a cyclical peak. It is not meaningful for a company that is losing money, which is why this figure is often left blank here.',
  },
  pbRatio: {
    key: 'pbRatio',
    name: 'P/B, price to book',
    shortDescription: 'What the market pays for each rupee of accounting net worth.',
    whyItMatters: 'It is most useful for banks, insurers and asset-heavy companies.',
    interpretation: 'Judge it inside the industry and alongside profitability and asset quality.',
    caveat: 'A low P/B can signal weak returns or real problems rather than a discount. It is left blank when net worth is negative, because the ratio stops meaning anything.',
  },
  bookValue: {
    key: 'bookValue',
    name: 'Book value per share',
    shortDescription: 'The share of net worth attributable to one share, in rupees.',
    whyItMatters: 'It is the denominator behind P/B.',
    interpretation: 'Compare it with the market price through P/B, and weigh the quality of the underlying assets.',
    caveat: 'Book value is an accounting figure. It is not the market price, not an estimate of worth, and not what you would recover in a sale.',
  },
  eps: {
    key: 'eps',
    name: 'EPS, earnings per share',
    shortDescription: 'Profit attributable to one share, for the latest completed financial year.',
    whyItMatters: 'It is the basis of P/E and a first check on whether the company is profitable.',
    interpretation: 'Read it alongside dilution, one-off gains, and the trend over several years.',
    caveat: 'A single year can be distorted by a one-off. This is the most recent full year, not a trailing twelve-month figure.',
  },
  businessQuality: {
    key: 'businessQuality',
    name: 'Business quality',
    shortDescription: 'A screening score built from return on equity, return on capital, and dividend yield.',
    whyItMatters: 'It condenses three profitability readings into one comparable number.',
    interpretation: 'A higher score means the available metrics sit on the stronger side of the bands for this sector.',
    caveat: 'It does not measure management quality, competitive advantage, accounting quality, or future returns. It is not a probability and not a prediction.',
  },
  valuation: {
    key: 'valuation',
    name: 'Valuation',
    shortDescription: 'A screening score built from P/E and P/B compared against sector bands.',
    whyItMatters: 'It frames what the current price asks relative to what the business has earned and owns.',
    interpretation: 'A higher score means the available ratios sit closer to the stronger end of the sector range.',
    caveat: 'It does not estimate a fair price, intrinsic value, or a target. A cheap-looking stock can stay cheap for years.',
  },
  recentSignals: {
    key: 'recentSignals',
    name: 'Recent signals',
    shortDescription:
      'Where the price sits in its twelve-month range, how it has moved recently, and the tone of retrieved headlines.',
    whyItMatters:
      'It describes how a share has been trading lately, which is separate from how the business is doing.',
    interpretation:
      'A higher number means the price is nearer the top of its 12-month range, or has been holding up. Read it as how the shares have behaved, not as a quality measure.',
    caveat:
      'A company resting near its 52-week low scores low here and may be an excellent business. This is not comparable with the business-quality and valuation scores, and it is not a timing signal. No tone is reported at all when fewer than five articles matched, and the tone reads neutral when too few of them carry a direction either way. Headline tone is a keyword reading, not an understanding of the news: it notices a regulator opens a probe, and it does not notice why.',
  },
  screeningVerdict: {
    key: 'screeningVerdict',
    name: 'Screening verdict',
    shortDescription: 'A plain-language summary of the valuation and business-quality scores.',
    whyItMatters: 'It is the shortest honest description of the screening picture.',
    interpretation: 'It describes what the numbers say, nothing more.',
    caveat: 'It is not a recommendation, not a prediction, and not a statement that the investment is safe. Read the underlying metrics before drawing any conclusion.',
  },
  coverage: {
    key: 'coverage',
    name: 'Data coverage',
    shortDescription: 'How many of the figures behind a score the provider actually published.',
    whyItMatters: 'A score built from one available number carries far less weight than one built from all of them.',
    interpretation: 'When coverage is low, treat the reading as provisional and check the missing figures elsewhere.',
  },
  freshness: {
    key: 'freshness',
    name: 'Data freshness',
    shortDescription: 'When the exchange recorded a price, and whether you are seeing it live.',
    whyItMatters: 'A price from last week and a price from a minute ago lead to different decisions.',
    interpretation: 'Live quotes show the exchange timestamp. Anything cached, delayed, or from a scheduled close says so explicitly.',
  },
  provenance: {
    key: 'provenance',
    name: 'Data sources',
    shortDescription: 'Where each figure came from, when it was last refreshed, and what went wrong if anything did.',
    whyItMatters: 'Prices, company figures and news move at different speeds and degrade independently.',
    interpretation: 'Read the source line and any warning before relying on a reading.',
  },
};

export function getMetricDefinition(key: EducationKey): MetricDefinition | null {
  return DEFINITIONS[key] ?? null;
}

/**
 * A sentence a reader can act on when a source failed.
 * Kept separate from the definitions because it is about the fetch, not the metric.
 */
export function getConfidenceMessage(confidence: 'high' | 'medium' | 'low' | 'unavailable'): string {
  switch (confidence) {
    case 'high':
      return 'Both sources answered directly.';
    case 'medium':
      return 'At least one figure came from a held copy or a fallback.';
    default:
      return 'At least one source could not be read at all.';
  }
}
