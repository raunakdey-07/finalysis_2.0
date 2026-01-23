/**
 * Altman Z-Score Implementation
 * 
 * The Altman Z-Score is a formula for predicting bankruptcy likelihood.
 * It combines five financial ratios weighted to assess bankruptcy risk.
 * 
 * Score Interpretation:
 * - Z > 2.99: "Safe" zone - Low bankruptcy risk
 * - 1.81 < Z < 2.99: "Grey" zone - Some caution required
 * - Z < 1.81: "Distress" zone - High bankruptcy risk
 * 
 * Why it matters:
 * - Early warning system for financial distress
 * - Combines profitability, leverage, liquidity, solvency
 * - Widely used by creditors and investors
 * 
 * Common pitfalls:
 * - Originally designed for manufacturing firms
 * - May not apply well to service/tech companies
 * - Doesn't predict timing of bankruptcy
 * - Can give false positives for growth companies
 */

export interface AltmanInput {
  // Working capital / Total assets
  workingCapital: number;
  totalAssets: number;
  
  // Retained earnings / Total assets
  retainedEarnings: number;
  
  // EBIT / Total assets
  ebit: number; // Earnings Before Interest and Taxes
  
  // Market value of equity / Book value of total liabilities
  marketValueEquity: number;
  bookValueLiabilities: number;
  
  // Sales / Total assets
  sales: number;
}

export interface AltmanResult {
  zScore: number;
  interpretation: string;
  riskLevel: 'safe' | 'grey' | 'distress';
  components: {
    x1: { value: number; weight: number; contribution: number; explanation: string };
    x2: { value: number; weight: number; contribution: number; explanation: string };
    x3: { value: number; weight: number; contribution: number; explanation: string };
    x4: { value: number; weight: number; contribution: number; explanation: string };
    x5: { value: number; weight: number; contribution: number; explanation: string };
  };
  confidenceLevel: 'high' | 'medium' | 'low';
  dataQuality: string;
  warnings: string[];
}

export function calculateAltmanZScore(input: AltmanInput): AltmanResult {
  const warnings: string[] = [];
  
  // Calculate each component
  // X1 = Working Capital / Total Assets (Liquidity)
  const x1 = input.totalAssets > 0 ? input.workingCapital / input.totalAssets : 0;
  const x1Contribution = x1 * 1.2;
  
  // X2 = Retained Earnings / Total Assets (Cumulative Profitability)
  const x2 = input.totalAssets > 0 ? input.retainedEarnings / input.totalAssets : 0;
  const x2Contribution = x2 * 1.4;
  
  // X3 = EBIT / Total Assets (Operating Efficiency)
  const x3 = input.totalAssets > 0 ? input.ebit / input.totalAssets : 0;
  const x3Contribution = x3 * 3.3;
  
  // X4 = Market Value of Equity / Book Value of Total Liabilities (Leverage)
  const x4 = input.bookValueLiabilities > 0 ? input.marketValueEquity / input.bookValueLiabilities : 0;
  const x4Contribution = x4 * 0.6;
  
  // X5 = Sales / Total Assets (Asset Turnover)
  const x5 = input.totalAssets > 0 ? input.sales / input.totalAssets : 0;
  const x5Contribution = x5 * 1.0;
  
  // Calculate Z-Score
  const zScore = x1Contribution + x2Contribution + x3Contribution + x4Contribution + x5Contribution;
  
  // Determine risk level and interpretation
  let riskLevel: 'safe' | 'grey' | 'distress';
  let interpretation: string;
  
  if (zScore > 2.99) {
    riskLevel = 'safe';
    interpretation = 'Low bankruptcy risk - Strong financial health';
  } else if (zScore > 1.81) {
    riskLevel = 'grey';
    interpretation = 'Moderate risk - Caution advised, monitor closely';
  } else {
    riskLevel = 'distress';
    interpretation = 'High bankruptcy risk - Financial distress indicators present';
  }
  
  // Add warnings based on company characteristics
  if (input.totalAssets === 0) {
    warnings.push('Total assets is zero - Cannot calculate ratios');
  }
  
  if (input.workingCapital < 0) {
    warnings.push('Negative working capital indicates liquidity issues');
  }
  
  if (input.retainedEarnings < 0) {
    warnings.push('Negative retained earnings - Company has cumulative losses');
  }
  
  if (input.ebit < 0) {
    warnings.push('Negative EBIT - Company is not operationally profitable');
  }
  
  // Confidence level based on completeness of data
  const confidenceLevel: 'high' | 'medium' | 'low' = 
    warnings.length === 0 ? 'high' : warnings.length <= 2 ? 'medium' : 'low';
  
  return {
    zScore: parseFloat(zScore.toFixed(2)),
    interpretation,
    riskLevel,
    components: {
      x1: {
        value: parseFloat(x1.toFixed(4)),
        weight: 1.2,
        contribution: parseFloat(x1Contribution.toFixed(2)),
        explanation: 'Working Capital / Total Assets - Measures liquidity and short-term financial health',
      },
      x2: {
        value: parseFloat(x2.toFixed(4)),
        weight: 1.4,
        contribution: parseFloat(x2Contribution.toFixed(2)),
        explanation: 'Retained Earnings / Total Assets - Indicates cumulative profitability over time',
      },
      x3: {
        value: parseFloat(x3.toFixed(4)),
        weight: 3.3,
        contribution: parseFloat(x3Contribution.toFixed(2)),
        explanation: 'EBIT / Total Assets - Shows operating efficiency and asset productivity',
      },
      x4: {
        value: parseFloat(x4.toFixed(4)),
        weight: 0.6,
        contribution: parseFloat(x4Contribution.toFixed(2)),
        explanation: 'Market Value Equity / Book Value Liabilities - Measures financial leverage and solvency',
      },
      x5: {
        value: parseFloat(x5.toFixed(4)),
        weight: 1.0,
        contribution: parseFloat(x5Contribution.toFixed(2)),
        explanation: 'Sales / Total Assets - Asset turnover indicates how efficiently assets generate revenue',
      },
    },
    confidenceLevel,
    dataQuality: 'Based on latest available financial statements',
    warnings,
  };
}

/**
 * Helper function to interpret the Z-Score in plain language
 */
export function getAltmanRecommendation(zScore: number): string {
  if (zScore > 2.99) {
    return 'Strong financial position. Company shows low probability of bankruptcy.';
  } else if (zScore > 1.81) {
    return 'Exercise caution. Company is in grey zone - monitor financial health closely.';
  } else {
    return 'High risk. Company shows signs of financial distress. Avoid or exit position.';
  }
}
