/**
 * Explainable metrics calculation
 * Provides transparent stock analysis metrics with explanations
 */

import { StockFundamentals, StockMetrics, StockPrice } from '@/types';

/**
 * Calculate valuation score based on P/E and P/B ratios
 */
function calculateValuationScore(fundamentals: StockFundamentals): { score: number; explanation: string } {
  let score = 50; // Start with neutral score
  const factors: string[] = [];

  if (fundamentals.peRatio !== null) {
    if (fundamentals.peRatio < 15) {
      score += 20;
      factors.push('Low P/E ratio indicates undervaluation');
    } else if (fundamentals.peRatio > 30) {
      score -= 20;
      factors.push('High P/E ratio suggests overvaluation');
    } else {
      factors.push('P/E ratio is in reasonable range');
    }
  }

  if (fundamentals.pbRatio !== null) {
    if (fundamentals.pbRatio < 1.5) {
      score += 15;
      factors.push('Low P/B ratio indicates good value');
    } else if (fundamentals.pbRatio > 5) {
      score -= 15;
      factors.push('High P/B ratio suggests premium pricing');
    } else {
      factors.push('P/B ratio is moderate');
    }
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
    if (fundamentals.epsLast4Quarters > 50) {
      score += 25;
      factors.push('Strong earnings per share indicates good growth');
    } else if (fundamentals.epsLast4Quarters < 0) {
      score -= 30;
      factors.push('Negative EPS indicates losses');
    } else {
      factors.push('Moderate earnings performance');
    }
  }

  // Industry-based adjustment (simplified)
  if (fundamentals.industry.toLowerCase().includes('tech') || 
      fundamentals.industry.toLowerCase().includes('pharma')) {
    score += 10;
    factors.push('Growth-oriented industry sector');
  }

  const explanation = factors.join('. ') + '.';
  return { score: Math.max(0, Math.min(100, score)), explanation };
}

/**
 * Calculate profitability score
 */
function calculateProfitabilityScore(fundamentals: StockFundamentals): { score: number; explanation: string } {
  let score = 50;
  const factors: string[] = [];

  if (fundamentals.dividendYield !== null) {
    if (fundamentals.dividendYield > 3) {
      score += 20;
      factors.push('High dividend yield indicates strong profitability');
    } else if (fundamentals.dividendYield > 1) {
      score += 10;
      factors.push('Moderate dividend yield');
    } else {
      factors.push('Low or no dividend yield');
    }
  }

  if (fundamentals.bookValue !== null && fundamentals.peRatio !== null) {
    // Simple ROE approximation
    const approximateROE = (fundamentals.epsLast4Quarters || 0) / fundamentals.bookValue;
    if (approximateROE > 0.15) {
      score += 15;
      factors.push('Strong return on equity');
    } else if (approximateROE < 0.05) {
      score -= 15;
      factors.push('Weak return on equity');
    }
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

  if (price.changePercent > 5) {
    score += 25;
    factors.push('Strong positive momentum with significant price increase');
  } else if (price.changePercent > 0) {
    score += 10;
    factors.push('Positive price momentum');
  } else if (price.changePercent < -5) {
    score -= 25;
    factors.push('Negative momentum with significant price decline');
  } else if (price.changePercent < 0) {
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
  const valuation = calculateValuationScore(fundamentals);
  const growth = calculateGrowthScore(fundamentals);
  const profitability = calculateProfitabilityScore(fundamentals);
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
