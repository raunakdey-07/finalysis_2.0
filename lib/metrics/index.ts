/**
 * Explainable metrics calculation
 * Provides transparent stock analysis metrics with explanations
 */

import { StockFundamentals, StockMetrics, StockPrice } from '@/types';

type SectorProfile = {
  key: 'banking' | 'technology' | 'consumer' | 'pharma' | 'capital' | 'energy' | 'metals' | 'general';
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
  leverageHigh: number;
  leverageLow: number;
};

const SECTOR_PROFILES: Record<SectorProfile['key'], SectorProfile> = {
  banking: {
    key: 'banking',
    label: 'Banking & Financials',
    peLow: 10,
    peFair: 24,
    peHigh: 35,
    pbLow: 1,
    pbFair: 3,
    pbHigh: 5,
    roeStrong: 15,
    roeHealthy: 11,
    roeWeak: 8,
    roceStrong: 12,
    roceWeak: 8,
    leverageHigh: 8,
    leverageLow: 2,
  },
  technology: {
    key: 'technology',
    label: 'Technology',
    peLow: 18,
    peFair: 40,
    peHigh: 60,
    pbLow: 3,
    pbFair: 10,
    pbHigh: 16,
    roeStrong: 20,
    roeHealthy: 14,
    roeWeak: 9,
    roceStrong: 18,
    roceWeak: 10,
    leverageHigh: 1.2,
    leverageLow: 0.3,
  },
  consumer: {
    key: 'consumer',
    label: 'Consumer/FMCG',
    peLow: 20,
    peFair: 45,
    peHigh: 65,
    pbLow: 4,
    pbFair: 12,
    pbHigh: 18,
    roeStrong: 22,
    roeHealthy: 15,
    roeWeak: 10,
    roceStrong: 20,
    roceWeak: 12,
    leverageHigh: 1.5,
    leverageLow: 0.4,
  },
  pharma: {
    key: 'pharma',
    label: 'Pharma/Healthcare',
    peLow: 16,
    peFair: 34,
    peHigh: 50,
    pbLow: 2,
    pbFair: 7,
    pbHigh: 12,
    roeStrong: 18,
    roeHealthy: 12,
    roeWeak: 8,
    roceStrong: 16,
    roceWeak: 10,
    leverageHigh: 1.8,
    leverageLow: 0.5,
  },
  capital: {
    key: 'capital',
    label: 'Capital Goods/Industrial',
    peLow: 14,
    peFair: 30,
    peHigh: 45,
    pbLow: 1.5,
    pbFair: 5,
    pbHigh: 9,
    roeStrong: 17,
    roeHealthy: 11,
    roeWeak: 7,
    roceStrong: 15,
    roceWeak: 9,
    leverageHigh: 2,
    leverageLow: 0.5,
  },
  energy: {
    key: 'energy',
    label: 'Energy/Utilities',
    peLow: 10,
    peFair: 22,
    peHigh: 32,
    pbLow: 1,
    pbFair: 3.5,
    pbHigh: 6,
    roeStrong: 16,
    roeHealthy: 10,
    roeWeak: 7,
    roceStrong: 13,
    roceWeak: 8,
    leverageHigh: 2.5,
    leverageLow: 0.6,
  },
  metals: {
    key: 'metals',
    label: 'Metals/Materials',
    peLow: 8,
    peFair: 18,
    peHigh: 28,
    pbLow: 0.9,
    pbFair: 2.5,
    pbHigh: 4,
    roeStrong: 15,
    roeHealthy: 10,
    roeWeak: 6,
    roceStrong: 14,
    roceWeak: 8,
    leverageHigh: 2.2,
    leverageLow: 0.5,
  },
  general: {
    key: 'general',
    label: 'General Indian Market',
    peLow: 15,
    peFair: 35,
    peHigh: 55,
    pbLow: 2,
    pbFair: 6,
    pbHigh: 10,
    roeStrong: 18,
    roeHealthy: 12,
    roeWeak: 8,
    roceStrong: 15,
    roceWeak: 10,
    leverageHigh: 1.5,
    leverageLow: 0.5,
  },
};

function inferSectorProfile(industry: string): SectorProfile {
  const text = industry.toLowerCase();

  if (text.includes('bank') || text.includes('finance') || text.includes('insurance') || text.includes('nbfc')) {
    return SECTOR_PROFILES.banking;
  }
  if (text.includes('software') || text.includes('it') || text.includes('technology') || text.includes('internet')) {
    return SECTOR_PROFILES.technology;
  }
  if (text.includes('fmcg') || text.includes('consumer') || text.includes('retail') || text.includes('food')) {
    return SECTOR_PROFILES.consumer;
  }
  if (text.includes('pharma') || text.includes('health') || text.includes('hospital') || text.includes('biotech')) {
    return SECTOR_PROFILES.pharma;
  }
  if (text.includes('industrial') || text.includes('capital goods') || text.includes('engineering') || text.includes('construction')) {
    return SECTOR_PROFILES.capital;
  }
  if (text.includes('power') || text.includes('energy') || text.includes('oil') || text.includes('gas') || text.includes('utility')) {
    return SECTOR_PROFILES.energy;
  }
  if (text.includes('metal') || text.includes('steel') || text.includes('mining') || text.includes('cement') || text.includes('material')) {
    return SECTOR_PROFILES.metals;
  }

  return SECTOR_PROFILES.general;
}

/**
 * Calculate valuation score based on P/E and P/B ratios
 */
function calculateValuationScore(fundamentals: StockFundamentals, profile: SectorProfile): { score: number; explanation: string } {
  let score = 50; // Start with neutral score
  const factors: string[] = [`Using ${profile.label} valuation bands`];

  if (fundamentals.peRatio !== null) {
    if (fundamentals.peRatio < profile.peLow) {
      score += 15;
      factors.push('P/E is low versus sector baseline (value-friendly)');
    } else if (fundamentals.peRatio <= profile.peFair) {
      score += 5;
      factors.push('P/E is within expected sector range');
    } else if (fundamentals.peRatio <= profile.peHigh) {
      score -= 8;
      factors.push('P/E is elevated for this sector and needs sustained growth to justify');
    } else {
      score -= 18;
      factors.push('P/E is very high for this sector and implies optimistic expectations');
    }
  } else {
    factors.push('P/E data is unavailable');
  }

  if (fundamentals.pbRatio !== null) {
    if (fundamentals.pbRatio < profile.pbLow) {
      score += 10;
      factors.push('P/B is conservative versus sector asset-value norms');
    } else if (fundamentals.pbRatio <= profile.pbFair) {
      factors.push('P/B is in a normal-to-premium range');
    } else if (fundamentals.pbRatio <= profile.pbHigh) {
      score -= 8;
      factors.push('P/B is high and can increase downside risk if growth slows');
    } else {
      score -= 15;
      factors.push('P/B is very high for this sector and reflects expensive pricing');
    }
  } else {
    factors.push('P/B data is unavailable');
  }

  const explanation = factors.join('. ') + '.';
  return { score: Math.max(0, Math.min(100, score)), explanation };
}

/**
 * Calculate growth score based on EPS and historical performance
 */
function calculateGrowthScore(fundamentals: StockFundamentals): { score: number; explanation: string } {
  let score = 50;
  const factors: string[] = [];

  if (fundamentals.epsLast4Quarters !== null) {
    if (fundamentals.epsLast4Quarters > 0) {
      score += 10;
      factors.push('Company is currently profitable on a trailing EPS basis');
    } else if (fundamentals.epsLast4Quarters < 0) {
      score -= 30;
      factors.push('Negative EPS indicates losses and execution risk');
    } else {
      factors.push('EPS is close to break-even');
    }
  } else {
    factors.push('EPS data is unavailable');
  }

  if (fundamentals.revenueGrowth !== null && fundamentals.revenueGrowth !== undefined) {
    if (fundamentals.revenueGrowth > 15) {
      score += 15;
      factors.push('Revenue growth is strong');
    } else if (fundamentals.revenueGrowth > 5) {
      score += 8;
      factors.push('Revenue growth is healthy');
    } else if (fundamentals.revenueGrowth < 0) {
      score -= 12;
      factors.push('Revenue has contracted');
    } else {
      factors.push('Revenue growth is modest');
    }
  } else {
    factors.push('Revenue growth history is unavailable');
  }

  const explanation = factors.join('. ') + '.';
  return { score: Math.max(0, Math.min(100, score)), explanation };
}

/**
 * Calculate profitability score
 */
function calculateProfitabilityScore(fundamentals: StockFundamentals, profile: SectorProfile): { score: number; explanation: string } {
  let score = 50;
  const factors: string[] = [`Using ${profile.label} quality bands`];

  if (fundamentals.roe !== null && fundamentals.roe !== undefined) {
    if (fundamentals.roe >= profile.roeStrong) {
      score += 18;
      factors.push('ROE is strong');
    } else if (fundamentals.roe >= profile.roeHealthy) {
      score += 8;
      factors.push('ROE is healthy');
    } else if (fundamentals.roe < profile.roeWeak) {
      score -= 12;
      factors.push('ROE is weak');
    } else {
      factors.push('ROE is moderate');
    }
  } else {
    factors.push('ROE data is unavailable');
  }

  if (fundamentals.roce !== null && fundamentals.roce !== undefined) {
    if (fundamentals.roce >= profile.roceStrong) {
      score += 10;
      factors.push('ROCE supports efficient capital use');
    } else if (fundamentals.roce < profile.roceWeak) {
      score -= 8;
      factors.push('ROCE suggests weaker capital efficiency');
    }
  } else {
    factors.push('ROCE data is unavailable');
  }

  if (fundamentals.debtToEquity !== null && fundamentals.debtToEquity !== undefined) {
    if (fundamentals.debtToEquity > profile.leverageHigh) {
      score -= 10;
      factors.push(`Leverage is high for ${profile.label.toLowerCase()} peers`);
    } else if (fundamentals.debtToEquity < profile.leverageLow) {
      score += 6;
      factors.push('Balance sheet leverage is conservative');
    }
  } else {
    factors.push('Debt-to-equity data is unavailable');
  }

  if (fundamentals.dividendYield !== null) {
    if (fundamentals.dividendYield > 2) {
      score += 4;
      factors.push('Dividend yield provides an additional cash-return signal');
    } else {
      factors.push('Low dividend yield is not penalized for growth-oriented businesses');
    }
  } else {
    factors.push('Dividend data is unavailable');
  }

  const explanation = factors.join('. ') + '.';
  return { score: Math.max(0, Math.min(100, score)), explanation };
}

/**
 * Calculate momentum score based on price performance
 */
function calculateMomentumScore(price: StockPrice): { score: number; explanation: string } {
  let score = 50;
  const factors: string[] = [];

  const dailyChangePercent = typeof price.daily_change_percent === 'number'
    ? price.daily_change_percent
    : price.changePercent;

  if (dailyChangePercent > 5) {
    score += 25;
    factors.push('Strong positive momentum with significant price increase');
  } else if (dailyChangePercent > 0) {
    score += 10;
    factors.push('Positive price momentum');
  } else if (dailyChangePercent < -5) {
    score -= 25;
    factors.push('Negative momentum with significant price decline');
  } else if (dailyChangePercent < 0) {
    score -= 10;
    factors.push('Slight negative price momentum');
  } else {
    factors.push('Neutral price action');
  }

  // Volume-based momentum
  if (price.volume > 1000000) {
    score += 10;
    factors.push('High trading volume indicates strong interest');
  }

  const explanation = factors.join('. ') + '.';
  return { score: Math.max(0, Math.min(100, score)), explanation };
}

/**
 * Calculate comprehensive stock metrics with explanations
 * @param fundamentals - Stock fundamental data
 * @param price - Current stock price data
 * @returns Stock metrics with scores and explanations
 */
export function calculateMetrics(
  fundamentals: StockFundamentals,
  price: StockPrice
): StockMetrics {
  const sectorProfile = inferSectorProfile(fundamentals.industry);

  const valuation = calculateValuationScore(fundamentals, sectorProfile);
  const growth = calculateGrowthScore(fundamentals);
  const profitability = calculateProfitabilityScore(fundamentals, sectorProfile);
  const momentum = calculateMomentumScore(price);

  // Weighted overall score
  const overallScore = Math.round(
    valuation.score * 0.3 +
    growth.score * 0.25 +
    profitability.score * 0.25 +
    momentum.score * 0.2
  );

  return {
    symbol: fundamentals.symbol,
    valuationScore: Math.round(valuation.score),
    growthScore: Math.round(growth.score),
    profitabilityScore: Math.round(profitability.score),
    momentumScore: Math.round(momentum.score),
    overallScore,
    explanation: {
      valuation: valuation.explanation,
      growth: growth.explanation,
      profitability: profitability.explanation,
      momentum: momentum.explanation,
    },
  };
}

/**
 * Get recommendation based on overall score
 */
export function getRecommendation(overallScore: number): string {
  if (overallScore >= 75) return 'Strong Buy';
  if (overallScore >= 60) return 'Buy';
  if (overallScore >= 45) return 'Hold';
  if (overallScore >= 30) return 'Sell';
  return 'Strong Sell';
}
