/**
 * RSS-based news sentiment analysis
 * Fetches news from RSS feeds and performs basic sentiment analysis
 */

import { NewsItem } from '@/types';
import cache from '@/lib/cache';

/**
 * RSS feed sources for Indian financial news
 */
const RSS_FEEDS = [
  'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
  'https://www.moneycontrol.com/rss/marketreports.xml',
  'https://www.livemint.com/rss/markets',
];

/**
 * Basic sentiment keywords for analysis
 */
const POSITIVE_KEYWORDS = [
  'gain', 'growth', 'profit', 'surge', 'rally', 'bullish', 'positive',
  'strong', 'rise', 'up', 'high', 'outperform', 'buy', 'upgrade'
];

const NEGATIVE_KEYWORDS = [
  'loss', 'decline', 'fall', 'drop', 'bearish', 'negative', 'weak',
  'down', 'low', 'underperform', 'sell', 'downgrade', 'crash'
];

/**
 * Calculate sentiment score based on keyword matching
 * @param text - Text to analyze
 * @returns Sentiment score between -1 and 1
 */
function calculateSentiment(text: string): { sentiment: 'positive' | 'negative' | 'neutral'; score: number } {
  const lowerText = text.toLowerCase();
  
  let positiveCount = 0;
  let negativeCount = 0;

  POSITIVE_KEYWORDS.forEach(keyword => {
    if (lowerText.includes(keyword)) positiveCount++;
  });

  NEGATIVE_KEYWORDS.forEach(keyword => {
    if (lowerText.includes(keyword)) negativeCount++;
  });

  const score = (positiveCount - negativeCount) / (positiveCount + negativeCount + 1);
  
  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (score > 0.2) sentiment = 'positive';
  else if (score < -0.2) sentiment = 'negative';

  return { sentiment, score };
}

/**
 * Parse RSS feed XML to extract news items
 * @param xml - RSS feed XML string
 * @returns Array of news items
 */
function parseRSSFeed(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  
  // Basic XML parsing (in production, use a proper XML parser)
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const matches = xml.matchAll(itemRegex);

  for (const match of matches) {
    const itemXml = match[1];
    
    const titleMatch = itemXml.match(/<title>(.*?)<\/title>/s);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/s);
    const descMatch = itemXml.match(/<description>(.*?)<\/description>/s);
    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/s);

    if (titleMatch && linkMatch) {
      const title = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/s, '$1').trim();
      const description = descMatch ? descMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/s, '$1').replace(/<[^>]*>/g, '').trim() : '';
      
      const { sentiment, score } = calculateSentiment(`${title} ${description}`);

      items.push({
        id: `${source}_${Date.now()}_${Math.random()}`,
        title,
        description,
        link: linkMatch[1].trim(),
        pubDate: pubDateMatch ? new Date(pubDateMatch[1]) : new Date(),
        source,
        sentiment,
        sentimentScore: score,
      });
    }
  }

  return items;
}

/**
 * Fetch news from RSS feeds
 * @param limit - Maximum number of news items to return
 * @returns Array of news items with sentiment
 */
export async function fetchNews(limit: number = 20): Promise<NewsItem[]> {
  const cacheKey = 'rss_news_all';
  const cached = cache.get<NewsItem[]>(cacheKey);

  if (cached) {
    return cached.slice(0, limit);
  }

  try {
    const newsPromises = RSS_FEEDS.map(async (feedUrl) => {
      try {
        const response = await fetch(feedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          },
        });

        if (!response.ok) {
          throw new Error(`RSS fetch error: ${response.status}`);
        }

        const xml = await response.text();
        return parseRSSFeed(xml, new URL(feedUrl).hostname);
      } catch (error) {
        console.error(`Error fetching RSS feed ${feedUrl}:`, error);
        return [];
      }
    });

    const results = await Promise.all(newsPromises);
    const allNews = results.flat();

    // Sort by date (newest first)
    allNews.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

    // Cache for 10 minutes
    cache.set(cacheKey, allNews, 600000);

    return allNews.slice(0, limit);
  } catch (error) {
    console.error('Error fetching news:', error);
    return [];
  }
}

/**
 * Get news sentiment for a specific stock symbol
 * @param symbol - Stock symbol
 * @param limit - Maximum number of news items
 * @returns Filtered news items
 */
export async function getStockNews(symbol: string, limit: number = 10): Promise<NewsItem[]> {
  const allNews = await fetchNews(50);
  
  // Filter news related to the symbol
  const filtered = allNews.filter(item => 
    item.title.toUpperCase().includes(symbol.toUpperCase()) ||
    item.description.toUpperCase().includes(symbol.toUpperCase())
  );

  return filtered.slice(0, limit);
}

/**
 * Calculate overall market sentiment
 * @returns Average sentiment score
 */
export async function getMarketSentiment(): Promise<{ sentiment: string; score: number; newsCount: number }> {
  const news = await fetchNews(50);
  
  if (news.length === 0) {
    return { sentiment: 'neutral', score: 0, newsCount: 0 };
  }

  const totalScore = news.reduce((sum, item) => sum + (item.sentimentScore || 0), 0);
  const avgScore = totalScore / news.length;

  let sentiment = 'neutral';
  if (avgScore > 0.1) sentiment = 'positive';
  else if (avgScore < -0.1) sentiment = 'negative';

  return {
    sentiment,
    score: avgScore,
    newsCount: news.length,
  };
}
