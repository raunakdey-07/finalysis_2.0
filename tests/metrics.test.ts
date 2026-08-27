/**
 * Regression tests for the Finalysis metrics/scoring engine.
 * These test the actual implementation, not the specification.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateMetrics,
  calculateGrowthScore,
  calculateProfitabilityScore,
  calculateValuationScore,
  calculateMomentumScore,
  getRecommendation,
  SectorProfile,
} from '@/lib/metrics';
import { StockFundamentals, StockPrice } from '@/types';

const defaultFundamentals: StockFundamentals = {
  symbol: 'TEST',
  companyName: 'Test Company',
  marketCap: 1000000000,
  peRatio: 25,
  pbRatio: 3,
  dividendYield: 2,
  epsLast4Quarters: 2.5,
  bookValue: 20,
  faceValue: 10,
  industry: 'Technology',
  roe: 15,
  roce: 12,
  debtToEquity: 1,
  revenueGrowth: 10,
  lastUpdated: new Date(),
};

describe('calculateGrowthScore', () => {
  it('adds 10 points for positive EPS', () => {
    const fundamentals = { ...defaultFundamentals, epsLast4Quarters: 2.5 };
    const result = calculateGrowthScore(fundamentals);
    expect(result.score).toBeGreaterThan(50);
  });

  it('subtracts 30 points for negative EPS', () => {
    const fundamentals = { ...defaultFundamentals, epsLast4Quarters: -1.0 };
    const result = calculateGrowthScore(fundamentals);
    expect(result.score).toBeLessThan(30);
  });

  it('sets score to 50 when EPS is null', () => {
    const fundamentals = { ...defaultFundamentals, epsLast4Quarters: null };
    const result = calculateGrowthScore(fundamentals);
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  it('adds points for positive revenue growth > 15', () => {
    const fundamentals = { ...defaultFundamentals, revenueGrowth: 20 };
    const result = calculateGrowthScore(fundamentals);
    expect(result.score).toBeGreaterThan(65);
  });

  it('subtracts 12 points for negative revenue growth', () => {
    const fundamentals = { ...defaultFundamentals, revenueGrowth: -5 };
    const result = calculateGrowthScore(fundamentals);
    expect(result.score).toBeLessThan(50);
  });

  it('keeps score at 50 when revenueGrowth is null', () => {
    const fundamentals = { ...defaultFundamentals, revenueGrowth: null };
    const result = calculateGrowthScore(fundamentals);
    expect(result.score).toBeGreaterThanOrEqual(50);
  });
});

describe('calculateProfitabilityScore', () => {
  it('adds 18 for strong ROE', () => {
    const fundamentals = { ...defaultFundamentals, roe: 20 };
    const profile: SectorProfile = { key: 'technology', label: 'Technology', peLow: 18, peFair: 40, peHigh: 60, pbLow: 3, pbFair: 10, pbHigh: 16, roeStrong: 20, roeHealthy: 14, roeWeak: 9, roceStrong: 18, roceWeak: 10, leverageHigh: 1.2, leverageLow: 0.3 };
    const result = calculateProfitabilityScore(fundamentals, profile);
    expect(result.score).toBeGreaterThanOrEqual(68);
  });

  it('subtracts 10 for high leverage', () => {
    const fundamentals = { ...defaultFundamentals, debtToEquity: 10 };
    const profile: SectorProfile = { key: 'technology', label: 'Technology', peLow: 18, peFair: 40, peHigh: 60, pbLow: 3, pbFair: 10, pbHigh: 16, roeStrong: 20, roeHealthy: 14, roeWeak: 9, roceStrong: 18, roceWeak: 10, leverageHigh: 1.2, leverageLow: 0.3 };
    const result = calculateProfitabilityScore(fundamentals, profile);
    expect(result.score).toBeLessThan(50);
  });

  it('adds 6 for low leverage', () => {
    const fundamentals = { ...defaultFundamentals, debtToEquity: 0.1 };
    const profile: SectorProfile = { key: 'technology', label: 'Technology', peLow: 18, peFair: 40, peHigh: 60, pbLow: 3, pbFair: 10, pbHigh: 16, roeStrong: 20, roeHealthy: 14, roeWeak: 9, roceStrong: 18, roceWeak: 10, leverageHigh: 1.2, leverageLow: 0.3 };
    const result = calculateProfitabilityScore(fundamentals, profile);
    expect(result.score).toBeGreaterThan(56);
  });

  it('adds 4 for dividend yield > 2', () => {
    const fundamentals = { ...defaultFundamentals, dividendYield: 3 };
    const profile: SectorProfile = { key: 'technology', label: 'Technology', peLow: 18, peFair: 40, peHigh: 60, pbLow: 3, pbFair: 10, pbHigh: 16, roeStrong: 20, roeHealthy: 14, roeWeak: 9, roceStrong: 18, roceWeak: 10, leverageHigh: 1.2, leverageLow: 0.3 };
    const result = calculateProfitabilityScore(fundamentals, profile);
    expect(result.score).toBeGreaterThan(54);
  });

  it('sets score to 50 when all data is missing', () => {
    const fundamentals = {
      ...defaultFundamentals,
      roe: null,
      roce: null,
      debtToEquity: null,
      dividendYield: null,
    };
    const profile: SectorProfile = { key: 'general', label: 'General Indian Market', peLow: 15, peFair: 35, peHigh: 55, pbLow: 2, pbFair: 6, pbHigh: 10, roeStrong: 18, roeHealthy: 12, roeWeak: 8, roceStrong: 15, roceWeak: 10, leverageHigh: 1.5, leverageLow: 0.5 };
    const result = calculateProfitabilityScore(fundamentals, profile);
    expect(result.score).toBe(50);
  });
});

describe('calculateValuationScore', () => {
  it('adds 15 for low P/E', () => {
    const fundamentals = { ...defaultFundamentals, peRatio: 8 };
    const profile: SectorProfile = { key: 'technology', label: 'Technology', peLow: 18, peFair: 40, peHigh: 60, pbLow: 3, pbFair: 10, pbHigh: 16, roeStrong: 20, roeHealthy: 14, roeWeak: 9, roceStrong: 18, roceWeak: 10, leverageHigh: 1.2, leverageLow: 0.3 };
    const result = calculateValuationScore(fundamentals, profile);
    expect(result.score).toBeGreaterThanOrEqual(65);
  });

  it('subtracts 8 for elevated P/E', () => {
    const fundamentals = { ...defaultFundamentals, peRatio: 50 };
    const profile: SectorProfile = { key: 'technology', label: 'Technology', peLow: 18, peFair: 40, peHigh: 60, pbLow: 3, pbFair: 10, pbHigh: 16, roeStrong: 20, roeHealthy: 14, roeWeak: 9, roceStrong: 18, roceWeak: 10, leverageHigh: 1.2, leverageLow: 0.3 };
    const result = calculateValuationScore(fundamentals, profile);
    expect(result.score).toBeLessThanOrEqual(42);
  });

  it('sets score to 50 when P/E is null', () => {
    const fundamentals = { ...defaultFundamentals, peRatio: null };
    const profile: SectorProfile = { key: 'technology', label: 'Technology', peLow: 18, peFair: 40, peHigh: 60, pbLow: 3, pbFair: 10, pbHigh: 16, roeStrong: 20, roeHealthy: 14, roeWeak: 9, roceStrong: 18, roceWeak: 10, leverageHigh: 1.2, leverageLow: 0.3 };
    const result = calculateValuationScore(fundamentals, profile);
    expect(result.score).toBe(50);
  });
});

describe('calculateMomentumScore', () => {
  it('adds 25 for strong positive daily change', () => {
    const price: StockPrice = {
      symbol: 'TEST',
      price: 100,
      change: 5,
      changePercent: 5,
      daily_change_percent: 5,
      volume: 2000000,
      open: 98,
      high: 102,
      low: 97,
      previousClose: 95,
      fiftyTwoWeekHigh: 120,
      fiftyTwoWeekLow: 80,
      timestamp: new Date(),
    };
    const result = calculateMomentumScore(price);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it('subtracts 25 for strong negative daily change', () => {
    const price: StockPrice = {
      symbol: 'TEST',
      price: 100,
      change: -5,
      changePercent: -5,
      daily_change_percent: -5,
      volume: 2000000,
      open: 102,
      high: 105,
      low: 98,
      previousClose: 105,
      fiftyTwoWeekHigh: 120,
      fiftyTwoWeekLow: 80,
      timestamp: new Date(),
    };
    const result = calculateMomentumScore(price);
    expect(result.score).toBeLessThan(55);
  });

  it('sets score to 50 when price is null', () => {
    const result = calculateMomentumScore(null);
    expect(result.score).toBe(50);
  });

  it('adds 10 for positive but small daily change', () => {
    const price: StockPrice = {
      symbol: 'TEST',
      price: 100,
      change: 1,
      changePercent: 1,
      daily_change_percent: 1,
      volume: 500000,
      open: 99,
      high: 101,
      low: 98,
      previousClose: 99,
      fiftyTwoWeekHigh: 120,
      fiftyTwoWeekLow: 80,
      timestamp: new Date(),
    };
    const result = calculateMomentumScore(price);
    expect(result.score).toBeGreaterThan(59);
  });

  it('subtracts 10 for small negative daily change', () => {
    const price: StockPrice = {
      symbol: 'TEST',
      price: 100,
      change: -1,
      changePercent: -1,
      daily_change_percent: -1,
      volume: 500000,
      open: 101,
      high: 103,
      low: 99,
      previousClose: 101,
      fiftyTwoWeekHigh: 120,
      fiftyTwoWeekLow: 80,
      timestamp: new Date(),
    };
    const result = calculateMomentumScore(price);
    expect(result.score).toBeLessThan(41);
  });
});

describe('getRecommendation', () => {
  it('returns Strong Buy for score >= 75', () => {
    expect(getRecommendation(75)).toBe('Strong Buy');
    expect(getRecommendation(80)).toBe('Strong Buy');
    expect(getRecommendation(100)).toBe('Strong Buy');
  });

  it('returns Buy for score >= 60 and < 75', () => {
    expect(getRecommendation(60)).toBe('Buy');
    expect(getRecommendation(64)).toBe('Buy');
    expect(getRecommendation(74)).toBe('Buy');
  });

  it('returns Hold for score >= 45 and < 60', () => {
    expect(getRecommendation(45)).toBe('Hold');
    expect(getRecommendation(50)).toBe('Hold');
    expect(getRecommendation(59)).toBe('Hold');
  });

  it('returns Sell for score >= 30 and < 45', () => {
    expect(getRecommendation(30)).toBe('Sell');
    expect(getRecommendation(35)).toBe('Sell');
    expect(getRecommendation(44)).toBe('Sell');
  });

  it('returns Strong Sell for score < 30', () => {
    expect(getRecommendation(29)).toBe('Strong Sell');
    expect(getRecommendation(0)).toBe('Strong Sell');
    expect(getRecommendation(-1)).toBe('Strong Sell');
  });
});

describe('calculateMetrics end-to-end', () => {
  it('produces valid scores with all data available', () => {
    const price: StockPrice = {
      symbol: 'TEST',
      price: 100,
      change: 2,
      changePercent: 2,
      daily_change_percent: 2,
      volume: 1500000,
      open: 98,
      high: 101,
      low: 97,
      previousClose: 96,
      fiftyTwoWeekHigh: 120,
      fiftyTwoWeekLow: 80,
      timestamp: new Date(),
    };
    const fundamentals = { ...defaultFundamentals, peRatio: 25, pbRatio: 3 };
    const result = calculateMetrics(fundamentals, price);

    expect(result).toHaveProperty('valuationScore');
    expect(result).toHaveProperty('growthScore');
    expect(result).toHaveProperty('profitabilityScore');
    expect(result).toHaveProperty('momentumScore');
    expect(result).toHaveProperty('overallScore');
    expect(result).toHaveProperty('explanation');
    expect(typeof result.overallScore).toBe('number');
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('handles missing price gracefully', () => {
    const fundamentals = { ...defaultFundamentals, peRatio: 25 };
    const result = calculateMetrics(fundamentals, null);

    expect(result).toBeDefined();
    expect(result.momentumScore).toBe(50); // neutral when no price data
    expect(result.explanation.momentum).toBeDefined();
  });

  it('handles missing peRatio gracefully', () => {
    const price: StockPrice = {
      symbol: 'TEST',
      price: 100,
      change: 2,
      changePercent: 2,
      daily_change_percent: 2,
      volume: 1500000,
      open: 98,
      high: 101,
      low: 97,
      previousClose: 96,
      fiftyTwoWeekHigh: 120,
      fiftyTwoWeekLow: 80,
      timestamp: new Date(),
    };
    const fundamentals = { ...defaultFundamentals, peRatio: null };
    const result = calculateMetrics(fundamentals, price);

    expect(result).toBeDefined();
    expect(result.valuationScore).toBe(50); // neutral when no P/E
    expect(result.explanation.valuation).toBeDefined();
  });
});