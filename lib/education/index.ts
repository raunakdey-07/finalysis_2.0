export type EducationKey =
  | "roe"
  | "roce"
  | "dividendYield"
  | "peRatio"
  | "pbRatio"
  | "bookValue"
  | "debtToEquity"
  | "eps"
  | "marketCap"
  | "priceChange"
  | "momentum"
  | "newsSentiment"
  | "businessQuality"
  | "valuation"
  | "screeningScore"
  | "favorableSetup"
  | "confidence"
  | "provenance"
  | "sectorContext";

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
    key: "roe",
    name: "ROE — Return on Equity",
    shortDescription: "How effectively a company generates profit using shareholders' equity.",
    whyItMatters: "It helps assess how productively the business is using shareholder capital.",
    interpretation: "Higher ROE can be attractive, but compare it with peers and the company's own history.",
    caveat: "High leverage or a very small equity base can make ROE look unusually high.",
  },
  roce: {
    key: "roce",
    name: "ROCE — Return on Capital Employed",
    shortDescription: "How efficiently the operating business generates returns from the capital employed in it.",
    whyItMatters: "It is useful for judging operating efficiency, especially in capital-intensive businesses.",
    interpretation: "Consistent ROCE compared with similar companies can support a stronger quality assessment.",
    caveat: "ROCE and ROE measure different things; industry and accounting differences matter.",
  },
  dividendYield: {
    key: "dividendYield",
    name: "Dividend yield",
    shortDescription: "Dividend paid by a company relative to its current share price.",
    whyItMatters: "It indicates the income component of owning the stock at the current price.",
    interpretation: "A higher yield may add income, but it should be considered alongside payout sustainability.",
    caveat: "A high yield can result from a falling share price or an unsustainably high payout.",
  },
  peRatio: {
    key: "peRatio",
    name: "P/E — Price-to-Earnings",
    shortDescription: "Approximately how much investors are paying for each ₹1 of annual earnings.",
    whyItMatters: "It is a common way to compare the valuation of profitable companies.",
    interpretation: "Compare it with peers, expected growth, business quality, and the company's historical valuation where reliable data is available.",
    caveat: "Lower is not automatically cheaper or better; it may reflect slower growth, higher risk, or cyclicality.",
  },
  pbRatio: {
    key: "pbRatio",
    name: "P/B — Price-to-Book",
    shortDescription: "How the market values a company compared with its accounting book value.",
    whyItMatters: "It can be particularly useful for banks, financial companies, and asset-heavy businesses.",
    interpretation: "Interpret it within the company's industry and alongside profitability, asset quality, and growth.",
    caveat: "A low P/B can reflect weak profitability or business problems; a higher P/B can be supported by consistently strong returns.",
  },
  bookValue: {
    key: "bookValue",
    name: "Book value per share",
    shortDescription: "The approximate accounting value of shareholders' equity attributable to each share.",
    whyItMatters: "It provides the accounting denominator used in the P/B ratio.",
    interpretation: "Compare the market price with book value through P/B, while considering the quality of the underlying assets.",
    caveat: "Book value is not the same as market price, intrinsic value, or liquidation value.",
  },
  debtToEquity: {
    key: "debtToEquity",
    name: "Debt/Equity",
    shortDescription: "Compares a company's debt with shareholders' equity.",
    whyItMatters: "It provides a quick view of financial leverage and potential balance-sheet risk.",
    interpretation: "Higher leverage can increase financial risk, but appropriate levels vary substantially by industry.",
  },
  eps: {
    key: "eps",
    name: "EPS — Earnings per share",
    shortDescription: "Profit attributable to each share over the measured period.",
    whyItMatters: "It helps show whether the company is profitable on a per-share basis.",
    interpretation: "Consider EPS with growth, dilution, cyclicality, and the quality of reported earnings.",
  },
  marketCap: {
    key: "marketCap",
    name: "Market capitalization",
    shortDescription: "The market value of all outstanding shares.",
    whyItMatters: "It gives context about company size and the scale of the listed business.",
    interpretation: "Size can affect risk, liquidity, and growth expectations, but it does not by itself indicate quality.",
  },
  priceChange: {
    key: "priceChange",
    name: "Today's price change",
    shortDescription: "The recent percentage movement in the share price.",
    whyItMatters: "It describes current market activity and short-term price momentum.",
    interpretation: "Treat it as a recent signal, not evidence that the underlying business is improving or weakening.",
  },
  momentum: {
    key: "momentum",
    name: "Momentum",
    shortDescription: "A screening signal based on recent price movement and available volume information.",
    whyItMatters: "It indicates how recent market activity is affecting the screening picture.",
    interpretation: "Momentum can change quickly and should not be confused with long-term business performance.",
  },
  newsSentiment: {
    key: "newsSentiment",
    name: "News sentiment",
    shortDescription: "A tone estimate derived from the available company or market news articles.",
    whyItMatters: "It provides recent context around how selected coverage is worded.",
    interpretation: "Use it as short-term context and read the underlying articles, especially when the article count is small.",
    caveat: "Positive sentiment does not mean the company is fundamentally strong, and one article is weak evidence.",
  },
  businessQuality: {
    key: "businessQuality",
    name: "Business quality",
    shortDescription: "A screening view of profitability, returns, leverage, and related business indicators.",
    whyItMatters: "It helps organize the available signals about how effectively the company operates.",
    interpretation: "A stronger score means the available indicators look stronger under Finalysis' current sector-aware rules.",
    caveat: "It does not establish management quality, competitive advantage, accounting quality, or future returns. It is not a probability.",
  },
  valuation: {
    key: "valuation",
    name: "Valuation",
    shortDescription: "A screening view of how available valuation measures compare with sector-aware ranges.",
    whyItMatters: "It helps frame what the current price implies relative to selected fundamentals.",
    interpretation: "A stronger score means the available measures look more supportive under the screening ranges.",
    caveat: "It does not estimate intrinsic value or guarantee that a stock is cheap or expensive.",
  },
  screeningScore: {
    key: "screeningScore",
    name: "Screening score",
    shortDescription: "A heuristic summary of the available inputs, shown on a 0–100 scale.",
    whyItMatters: "It makes the current screening picture easier to compare across the page.",
    interpretation: "Higher generally means stronger signals under Finalysis' rules; inspect the underlying metrics before drawing conclusions.",
    caveat: "It is not a probability, expected return, or prediction.",
  },
  favorableSetup: {
    key: "favorableSetup",
    name: "Favorable setup",
    shortDescription: "A screening interpretation based on the available valuation, business-quality, recent-price, and news signals.",
    whyItMatters: "It summarizes the current evidence in a phrase that is easier to scan.",
    interpretation: "It means the combined screening signals look more supportive at this point in time.",
    caveat: "It is not a buy recommendation, prediction, or statement that the investment is safe.",
  },
  confidence: {
    key: "confidence",
    name: "Data confidence",
    shortDescription: "An indication of how directly and completely the displayed information was obtained.",
    whyItMatters: "It helps you judge how much caution to apply to the current screening result.",
    interpretation: "High means no major fallback warning was detected; medium or derived means inspect the accompanying data note.",
  },
  provenance: {
    key: "provenance",
    name: "Data provenance",
    shortDescription: "Where the information came from and when that source was last checked.",
    whyItMatters: "Prices, fundamentals, and news can have different sources, cache windows, and update times.",
    interpretation: "Use the source, timestamp, cache window, and warnings to understand the freshness of each signal.",
  },
  sectorContext: {
    key: "sectorContext",
    name: "Sector context",
    shortDescription: "Financial ratios can mean different things across industries.",
    whyItMatters: "Finalysis uses sector-aware screening ranges rather than treating every company identically.",
    interpretation: "Compare a company with relevant peers and interpret banks, financial companies, and asset-heavy businesses in their industry context.",
  },
};

export function getMetricDefinition(key: EducationKey): MetricDefinition | null {
  return DEFINITIONS[key] ?? null;
}

export function explainScore(score: number, label: "businessQuality" | "valuation" | "screeningScore"): string {
  const definition = getMetricDefinition(label);
  if (!definition || !Number.isFinite(score)) return "Score context is unavailable.";
  return `${Math.round(score)} / 100. ${definition.interpretation} ${definition.caveat ?? "This is a heuristic, not a prediction."}`;
}

export function getConfidenceMessage(confidence: "high" | "medium" | "derived"): string {
  if (confidence === "high") return "No major fallback warnings were detected for this information.";
  if (confidence === "medium") return "Some information may be cached or supported by a fallback source; check the data note.";
  return "Some information was derived or unavailable from the primary source; use extra care and verify it independently.";
}

export function getNewsSentimentMessage(sentiment: string, articleCount: number): string {
  const countLabel = `${articleCount} available ${articleCount === 1 ? "article" : "articles"}`;
  if (articleCount === 0) return "No articles were available, so news sentiment is neutral by default rather than a positive or negative signal.";
  return `Tone is ${sentiment} based on ${countLabel}. This is short-term context, not a measure of long-term business quality.`;
}