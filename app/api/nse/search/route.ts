/**
 * API Route: /api/nse/search
 * Search for stocks by keyword
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchStocks } from '@/lib/nse';
import { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query) {
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: 'Query parameter (q) is required',
        timestamp: new Date(),
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const results = await searchStocks(query);

    const response: ApiResponse<string[]> = {
      success: true,
      data: results,
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
