/**
 * Graham Number Calculator
 * 
 * The Graham Number is a figure that measures a stock's fundamental value by taking into account
 * the company's earnings per share (EPS) and book value per share (BVPS).
 * 
 * Formula: Graham Number = √(22.5 × EPS × BVPS)
 * 
 * The constant 22.5 is derived from Graham's recommendation of:
 * - Maximum P/E ratio of 15
 * - Maximum P/B ratio of 1.5
 * - 15 × 1.5 = 22.5
 * 
 * Interpretation:
 * - Current Price < Graham Number: Stock may be undervalued
 * - Current Price > Graham Number: Stock may be overvalued
 * - Margin of Safety = (Graham Number - Current Price) / Graham Number × 100%
 * 
 * Why it matters:
 * - Simple valuation metric for value investors
 * - Based on Benjamin Graham's principles (Warren Buffett's mentor)
 * - Focuses on fundamentals, not market sentiment
 * 
 * Common pitfalls:
 * - Doesn't account for growth potential
 * - May undervalue growth stocks
 * - Doesn't consider industry-specific factors
 * - Assumes book value is accurate (may not be for tech/service companies)
 */

export interface GrahamInput {
  eps: number;           // Earnings Per Share (trailing 12 months)
  bookValuePerShare: number; // Book Value Per Share
  currentPrice: number;  // Current stock price
}

export interface GrahamResult {
  grahamNumber: number;
  currentPrice: number;
  valuation: 'undervalued' | 'fairly-valued' | 'overvalued';
  marginOfSafety: number; // Percentage
  intrinsicValue: number;
  recommendation: string;
  explanation: {
    grahamNumber: string;
    valuation: string;
    marginOfSafety: string;
  };
  assumptions: {
    maxPE: number;
    maxPB: number;
    multiplier: number;
  };
  confidenceLevel: 'high' | 'medium' | 'low';
  warnings: string[];
}

export function calculateGrahamNumber(input: GrahamInput): GrahamResult {
  const warnings: string[] = [];
  
  // Validate inputs
  if (input.eps <= 0) {
    warnings.push('Negative or zero EPS - Graham Number not applicable for loss-making companies');
  }
  
  if (input.bookValuePerShare <= 0) {
    warnings.push('Negative or zero book value - May indicate financial distress or intangible-heavy business');
  }
  
  // Calculate Graham Number
  // Graham Number = √(22.5 × EPS × BVPS)
  let grahamNumber = 0;
  
  if (input.eps > 0 && input.bookValuePerShare > 0) {
    grahamNumber = Math.sqrt(22.5 * input.eps * input.bookValuePerShare);
  }
  
  // Calculate margin of safety
  // Margin of Safety = (Intrinsic Value - Current Price) / Intrinsic Value × 100%
  const marginOfSafety = grahamNumber > 0 
    ? ((grahamNumber - input.currentPrice) / grahamNumber) * 100
    : 0;
  
  // Determine valuation
  let valuation: 'undervalued' | 'fairly-valued' | 'overvalued';
  let recommendation: string;
  
  if (marginOfSafety > 20) {
    valuation = 'undervalued';
    recommendation = 'Strong Buy - Stock trading significantly below intrinsic value';
  } else if (marginOfSafety > 0) {
    valuation = 'fairly-valued';
    recommendation = 'Hold - Stock trading near intrinsic value with modest upside';
  } else if (marginOfSafety > -20) {
    valuation = 'overvalued';
    recommendation = 'Sell - Stock trading above intrinsic value';
  } else {
    valuation = 'overvalued';
    recommendation = 'Strong Sell - Stock trading significantly above intrinsic value';
  }
  
  // Adjust for warnings
  if (warnings.length > 0) {
    recommendation = 'Not Applicable - ' + warnings[0];
  }
  
  // Confidence level
  const confidenceLevel: 'high' | 'medium' | 'low' = 
    warnings.length === 0 ? 'high' : warnings.length === 1 ? 'medium' : 'low';
  
  return {
    grahamNumber: parseFloat(grahamNumber.toFixed(2)),
    currentPrice: parseFloat(input.currentPrice.toFixed(2)),
    valuation,
    marginOfSafety: parseFloat(marginOfSafety.toFixed(2)),
    intrinsicValue: parseFloat(grahamNumber.toFixed(2)),
    recommendation,
    explanation: {
      grahamNumber: `Graham Number = √(22.5 × EPS × BVPS) = √(22.5 × ${input.eps} × ${input.bookValuePerShare}) = ${grahamNumber.toFixed(2)}`,
      valuation: valuation === 'undervalued' 
        ? 'Stock price is below the calculated intrinsic value, suggesting potential upside'
        : valuation === 'fairly-valued'
        ? 'Stock price is close to its calculated intrinsic value'
        : 'Stock price exceeds calculated intrinsic value, suggesting it may be overpriced',
      marginOfSafety: `Margin of Safety: ${marginOfSafety > 0 ? '+' : ''}${marginOfSafety.toFixed(2)}%. ` +
        (marginOfSafety > 20 ? 'Excellent safety buffer' : 
         marginOfSafety > 0 ? 'Modest safety buffer' :
         marginOfSafety > -20 ? 'No safety buffer' :
         'Significant overvaluation'),
    },
    assumptions: {
      maxPE: 15,
      maxPB: 1.5,
      multiplier: 22.5,
    },
    confidenceLevel,
    warnings,
  };
}

/**
 * Calculate the maximum price to pay based on Graham's formula
 * with a desired margin of safety
 */
export function calculateMaxPrice(eps: number, bookValuePerShare: number, marginOfSafety: number = 20): number {
  if (eps <= 0 || bookValuePerShare <= 0) {
    return 0;
  }
  
  const grahamNumber = Math.sqrt(22.5 * eps * bookValuePerShare);
  const maxPrice = grahamNumber * (1 - marginOfSafety / 100);
  
  return parseFloat(maxPrice.toFixed(2));
}

/**
 * Validate if a stock meets Graham's criteria for defensive investors
 */
export function meetsGrahamCriteria(input: {
  eps: number;
  bookValuePerShare: number;
  currentPrice: number;
  debtToEquity: number;
  currentRatio: number;
  dividendHistory: number; // years of uninterrupted dividends
}): { meets: boolean; reasons: string[] } {
  const reasons: string[] = [];
  
  // Criterion 1: Adequate size (skip - subjective)
  
  // Criterion 2: Strong financial condition
  if (input.currentRatio < 2) {
    reasons.push('Current ratio below 2 (should be at least 2)');
  }
  
  if (input.debtToEquity > 0.5) {
    reasons.push('Debt-to-equity above 0.5 (should be below 0.5)');
  }
  
  // Criterion 3: Earnings stability (20 years of positive earnings - simplified)
  if (input.eps <= 0) {
    reasons.push('Not currently profitable');
  }
  
  // Criterion 4: Dividend record (10 years uninterrupted)
  if (input.dividendHistory < 10) {
    reasons.push('Dividend history less than 10 years');
  }
  
  // Criterion 5: Earnings growth (1/3 over 10 years - skip, need historical data)
  
  // Criterion 6: Moderate P/E
  const pe = input.currentPrice / input.eps;
  if (pe > 15) {
    reasons.push(`P/E ratio ${pe.toFixed(2)} exceeds 15`);
  }
  
  // Criterion 7: Moderate P/B
  const pb = input.currentPrice / input.bookValuePerShare;
  if (pb > 1.5) {
    reasons.push(`P/B ratio ${pb.toFixed(2)} exceeds 1.5`);
  }
  
  return {
    meets: reasons.length === 0,
    reasons,
  };
}
