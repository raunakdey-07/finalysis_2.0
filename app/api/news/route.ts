/**
 * API Route: /api/news
 * Get news with sentiment analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchNews, getStockNews, getMarketSentiment } from '@/lib/sentiment';
import { ApiResponse, NewsItem } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const limitParam = searchParams.get('limit');
    const type = searchParams.get('type');
    
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    if (type === 'sentiment') {
      const sentiment = await getMarketSentiment();
      const response: ApiResponse<typeof sentiment> = {
        success: true,
        data: sentiment,
        timestamp: new Date(),
      };
      return NextResponse.json(response);
    }

    let news: NewsItem[];
    if (symbol) {
      news = await getStockNews(symbol.toUpperCase(), limit);
    } else {
      news = await fetchNews(limit);
    }

    const response: ApiResponse<NewsItem[]> = {
      success: true,
      data: news,
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
