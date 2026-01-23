/**
 * API Route: /api/metrics
 * Get explainable metrics for a stock
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateMetrics, getRecommendation } from '@/lib/metrics';
import { fetchNSEQuote } from '@/lib/nse';
import { ApiResponse, StockFundamentals, StockMetrics } from '@/types';

/**
 * Get mock fundamental data for demonstration
 * 
 * NOTE: This returns MOCK DATA for development/demo purposes only
 * In production, replace with actual data from:
 * 1. Screener.in API (unofficial but widely used)
 * 2. MoneyControl data (web scraping)
 * 3. BSE/NSE annual reports (manual/automated extraction)
 * 4. Commercial data providers
 * 
 * @param symbol - Stock symbol
 * @returns Mock fundamental data
 */
const getMockFundamentals = (symbol: string): StockFundamentals => ({
  symbol,
  companyName: `${symbol} Limited`,
  marketCap: 100000000000,
  peRatio: 25.5,
  pbRatio: 3.2,
  dividendYield: 1.5,
  epsLast4Quarters: 45.2,
  bookValue: 250.0,
  faceValue: 10,
  industry: 'Technology',
  lastUpdated: new Date(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: 'Symbol parameter is required',
        timestamp: new Date(),
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const symbolUpper = symbol.toUpperCase();
    
    // Fetch current price
    const price = await fetchNSEQuote(symbolUpper);
    if (!price) {
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: `Unable to fetch price data for symbol: ${symbol}`,
        timestamp: new Date(),
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Get fundamentals (mocked for now)
    const fundamentals = getMockFundamentals(symbolUpper);

    // Calculate metrics
    const metrics = calculateMetrics(fundamentals, price);
    const recommendation = getRecommendation(metrics.overallScore);

    const response: ApiResponse<StockMetrics & { recommendation: string }> = {
      success: true,
      data: {
        ...metrics,
        recommendation,
      },
      timestamp: new Date(),
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorResponse: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
