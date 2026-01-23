/**
 * Piotroski F-Score Implementation
 * 
 * The Piotroski F-Score is a 9-point scale (0-9) that assesses the financial strength of a firm.
 * It evaluates profitability, leverage/liquidity, and operating efficiency.
 * 
 * Score Interpretation:
 * - 8-9: Very strong financial position
 * - 6-7: Good financial health  
 * - 4-5: Average/mediocre
 * - 0-3: Weak financial position
 * 
 * Why it matters:
 * - Simple, rule-based assessment
 * - Focuses on fundamental improvement
 * - Historically identifies value stocks
 * 
 * Common pitfalls:
 * - Backward-looking (uses historical data)
 * - May not capture sudden industry changes
 * - Best combined with other metrics
 */

export interface PiotroskiInput {
  // Profitability (4 points)
  netIncome: number;              // Current year net income
  operatingCashFlow: number;      // Current year OCF
  returnOnAssets: number;         // Current year ROA
  returnOnAssetsPrev: number;     // Previous year ROA
  
  // Leverage/Liquidity (3 points)
  longTermDebt: number;           // Current year
  longTermDebtPrev: number;       // Previous year
  currentRatio: number;           // Current assets / Current liabilities
  currentRatioPrev: number;       // Previous year
  sharesOutstanding: number;      // Current year
  sharesOutstandingPrev: number;  // Previous year
  
  // Operating Efficiency (2 points)
  grossMargin: number;            // Current year
  grossMarginPrev: number;        // Previous year
  assetTurnover: number;          // Revenue / Average Total Assets
  assetTurnoverPrev: number;      // Previous year
}

export interface PiotroskiResult {
  score: number;
  maxScore: number;
  interpretation: string;
  breakdown: {
    profitability: {
      score: number;
      maxScore: number;
      details: string[];
    };
    leverage: {
      score: number;
      maxScore: number;
      details: string[];
    };
    efficiency: {
      score: number;
      maxScore: number;
      details: string[];
    };
  };
  confidenceLevel: 'high' | 'medium' | 'low';
  dataQuality: string;
}

export function calculatePiotroskiScore(input: PiotroskiInput): PiotroskiResult {
  let profitabilityScore = 0;
  const profitabilityDetails: string[] = [];
  
  // 1. Positive Net Income
  if (input.netIncome > 0) {
    profitabilityScore++;
    profitabilityDetails.push('✓ Positive net income');
  } else {
    profitabilityDetails.push('✗ Negative net income');
  }
  
  // 2. Positive Operating Cash Flow
  if (input.operatingCashFlow > 0) {
    profitabilityScore++;
    profitabilityDetails.push('✓ Positive operating cash flow');
  } else {
    profitabilityDetails.push('✗ Negative operating cash flow');
  }
  
  // 3. Increasing ROA
  if (input.returnOnAssets > input.returnOnAssetsPrev) {
    profitabilityScore++;
    profitabilityDetails.push('✓ ROA improved year-over-year');
  } else {
    profitabilityDetails.push('✗ ROA declined or flat');
  }
  
  // 4. Quality of Earnings (OCF > Net Income)
  if (input.operatingCashFlow > input.netIncome) {
    profitabilityScore++;
    profitabilityDetails.push('✓ Cash earnings exceed accrual earnings');
  } else {
    profitabilityDetails.push('✗ Accrual earnings exceed cash earnings');
  }
  
  // Leverage/Liquidity
  let leverageScore = 0;
  const leverageDetails: string[] = [];
  
  // 5. Decreasing Long-term Debt
  if (input.longTermDebt < input.longTermDebtPrev) {
    leverageScore++;
    leverageDetails.push('✓ Long-term debt decreased');
  } else {
    leverageDetails.push('✗ Long-term debt increased or flat');
  }
  
  // 6. Increasing Current Ratio
  if (input.currentRatio > input.currentRatioPrev) {
    leverageScore++;
    leverageDetails.push('✓ Current ratio improved (better liquidity)');
  } else {
    leverageDetails.push('✗ Current ratio declined');
  }
  
  // 7. No new shares issued
  if (input.sharesOutstanding <= input.sharesOutstandingPrev) {
    leverageScore++;
    leverageDetails.push('✓ No dilution (shares flat or decreased)');
  } else {
    leverageDetails.push('✗ Share dilution occurred');
  }
  
  // Operating Efficiency
  let efficiencyScore = 0;
  const efficiencyDetails: string[] = [];
  
  // 8. Increasing Gross Margin
  if (input.grossMargin > input.grossMarginPrev) {
    efficiencyScore++;
    efficiencyDetails.push('✓ Gross margin improved');
  } else {
    efficiencyDetails.push('✗ Gross margin declined');
  }
  
  // 9. Increasing Asset Turnover
  if (input.assetTurnover > input.assetTurnoverPrev) {
    efficiencyScore++;
    efficiencyDetails.push('✓ Asset turnover improved');
  } else {
    efficiencyDetails.push('✗ Asset turnover declined');
  }
  
  const totalScore = profitabilityScore + leverageScore + efficiencyScore;
  
  // Determine interpretation
  let interpretation: string;
  if (totalScore >= 8) {
    interpretation = 'Very strong financial position - excellent fundamentals';
  } else if (totalScore >= 6) {
    interpretation = 'Good financial health - solid fundamentals';
  } else if (totalScore >= 4) {
    interpretation = 'Average financial position - mixed signals';
  } else {
    interpretation = 'Weak financial position - concerning fundamentals';
  }
  
  // Confidence level based on data completeness
  const confidenceLevel: 'high' | 'medium' | 'low' = 'high';
  
  return {
    score: totalScore,
    maxScore: 9,
    interpretation,
    breakdown: {
      profitability: {
        score: profitabilityScore,
        maxScore: 4,
        details: profitabilityDetails,
      },
      leverage: {
        score: leverageScore,
        maxScore: 3,
        details: leverageDetails,
      },
      efficiency: {
        score: efficiencyScore,
        maxScore: 2,
        details: efficiencyDetails,
      },
    },
    confidenceLevel,
    dataQuality: 'Based on latest available financial statements',
  };
}
