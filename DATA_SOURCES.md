# Zero-Budget Data Sources for Finalysis 3.0

This document outlines free data sources and APIs that can be used with Finalysis 3.0 for Indian equity analysis.

**IMPORTANT**: This project focuses exclusively on Indian equities. No US-centric data providers.

## Stock Price Data

### 1. NSE India Public Endpoints (PRIMARY)
- **Cost**: Free
- **Limitations**: Rate limiting, requires proper headers
- **Usage**: Real-time quotes, historical data, market status
- **Example Endpoints**:
  - Market status: `https://www.nseindia.com/api/marketStatus`
  - Quote: `https://www.nseindia.com/api/quote-equity?symbol=RELIANCE`
  - Market data: `https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050`
- **Headers Required**:
  ```
  User-Agent: Mozilla/5.0...
  Accept: application/json
  Accept-Language: en-US,en;q=0.9
  ```
- **Rate Limit**: ~2-3 requests/second (be respectful)

### 2. BSE India Public Data
- **Cost**: Free
- **Limitations**: Limited API access, mostly CSV downloads
- **Usage**: EOD data, corporate actions
- **Website**: https://www.bseindia.com

### 3. Alpha Vantage (SECONDARY - For Indian Stocks)
- **Cost**: Free with limits (5 API calls/min, 500 calls/day)
- **Limitations**: Rate limits, requires API key
- **Usage**: Supports NSE/BSE stocks with .NS/.BO suffix
- **Signup**: https://www.alphavantage.co/support/#api-key
- **Example**: `RELIANCE.NS` for NSE, `RELIANCE.BO` for BSE

### ⚠️ NOT RECOMMENDED
- **Yahoo Finance**: Unreliable for Indian stocks, unofficial API
- **US-only providers**: Not suitable for NSE/BSE data

## Fundamental Data

### 1. Screener.in (PRIMARY for Fundamentals)
- **Cost**: Free
- **Limitations**: Unofficial API, no documentation
- **Usage**: P/E, P/B, dividend yield, EPS, ROE, ROCE, debt ratios
- **Strategy**: Parse HTML/JSON responses
- **Example**: `https://www.screener.in/api/company/{company_id}/`
- **Cache TTL**: 60-90 days (fundamentals change quarterly)

### 2. MoneyControl (SECONDARY)
- **Cost**: Free
- **Limitations**: Web scraping required
- **Usage**: Comprehensive fundamental data, financial statements
- **Strategy**: Parse HTML, respect rate limits
- **Cache TTL**: 60-90 days

### 3. NSE Corporate Information
- **Cost**: Free
- **Usage**: Company info, corporate actions, announcements
- **Website**: https://www.nseindia.com/companies-listing/corporate-actions

### 4. BSE Corporate Data
- **Cost**: Free
- **Usage**: Corporate announcements, financial results
- **Website**: https://www.bseindia.com

### 4. NSE India
- **Cost**: Free
- **Limitations**: Limited direct API access
- **Usage**: Company information, corporate actions
- **Website**: https://www.nseindia.com

## News Sources (RSS Feeds)

### 1. Google News RSS (PRIMARY)
- **RSS Feed**: `https://news.google.com/rss/search?q={stock_name}+stock+india&hl=en-IN&gl=IN&ceid=IN:en`
- **Cost**: Free
- **Content**: Real-time news aggregation
- **Cache TTL**: 6-12 hours

### 2. Economic Times - Markets
- **RSS Feed**: `https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms`
- **Cost**: Free
- **Content**: Market news, stock analysis
- **Cache TTL**: 6-12 hours

### 3. MoneyControl
- **RSS Feed**: `https://www.moneycontrol.com/rss/marketreports.xml`
- **Cost**: Free
- **Content**: Market reports, stock news

### 4. LiveMint - Markets
- **RSS Feed**: `https://www.livemint.com/rss/markets`
- **Cost**: Free
- **Content**: Financial news, market updates

### 5. GNews API (FALLBACK)
- **Cost**: Free tier (100 requests/day)
- **Signup**: https://gnews.io/
- **Usage**: Backup when RSS feeds fail
- **Cache TTL**: 12 hours

## Historical Data

### 1. NSE Historical Data
- **Cost**: Free
- **Usage**: Download historical EOD data
- **Format**: CSV files
- **Website**: https://www.nseindia.com/market-data/historical-data

### 2. BSE Historical Data
- **Cost**: Free
- **Usage**: Download historical EOD data
- **Format**: CSV/Excel files
- **Website**: https://www.bseindia.com/markets/MarketInfo/DispQuot.aspx

## Corporate Actions

### 1. NSE Corporate Actions
- **Cost**: Free
- **Usage**: Dividends, splits, bonuses
- **Website**: https://www.nseindia.com/companies-listing/corporate-actions

### 2. BSE Corporate Actions
- **Cost**: Free
- **Usage**: Dividends, splits, bonuses
- **Website**: https://www.bseindia.com/corporates/corporate_act.aspx

## Implementation Tips

### Web Scraping Best Practices
1. **Respect robots.txt**: Always check and follow the website's robots.txt
2. **Rate Limiting**: Add delays between requests (minimum 1-2 seconds)
3. **User-Agent**: Use a proper user-agent header
4. **Caching**: Cache responses to minimize requests
5. **Error Handling**: Handle failures gracefully

### Example: Respectful Scraping
```typescript
// Add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithDelay(url: string) {
  await delay(2000); // 2 second delay
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Finalysis/3.0; +https://github.com/raunakdey-07/finalysis_2.0)',
    },
  });
  return response;
}
```

### Caching Strategy
```typescript
// Cache data to reduce API calls
const CACHE_DURATION = {
  QUOTES: 60 * 1000,        // 1 minute
  FUNDAMENTALS: 3600 * 1000, // 1 hour
  NEWS: 600 * 1000,          // 10 minutes
  HISTORICAL: 86400 * 1000,  // 24 hours
};
```

## Data Quality Considerations

### Limitations of Free Data
1. **Delayed Data**: May not be real-time
2. **Rate Limits**: Limited number of requests
3. **Accuracy**: May have occasional errors
4. **Coverage**: May not cover all stocks
5. **Availability**: Services may go down or change

### Recommendations
1. **Multiple Sources**: Use multiple data sources for redundancy
2. **Validation**: Cross-check critical data points
3. **Graceful Degradation**: Handle missing data gracefully
4. **User Transparency**: Inform users about data limitations
5. **Regular Updates**: Keep data source implementations updated

## Legal Considerations

### Important Notes
1. **Terms of Service**: Always review and comply with ToS
2. **Attribution**: Give credit to data sources when required
3. **Personal Use**: Some sources allow only personal use
4. **Commercial Use**: Verify if commercial use is allowed
5. **Data Rights**: Respect intellectual property rights

### Disclaimer Template
```
Finalysis 3.0 aggregates publicly available data from various sources.
We do not guarantee the accuracy, completeness, or timeliness of the data.
Users should verify critical information before making investment decisions.
This is not financial advice. Invest at your own risk.
```

## Future Considerations

### When Budget Allows
1. **Bloomberg API**: Professional-grade data
2. **Reuters**: Comprehensive news and data
3. **FactSet**: Financial data and analytics
4. **Zerodha/Upstox**: Real-time Indian market data
5. **Quandl**: Financial and economic data

### Open Source Alternatives
1. **Pandas DataReader**: Free financial data access
2. **yfinance**: Yahoo Finance API wrapper
3. **investpy**: Investment data from Investing.com
4. **pyEX**: IEX Cloud Python client

## Contributing

Found a new free data source? Submit a PR with details!

## Resources

- [NSE Website](https://www.nseindia.com)
- [BSE Website](https://www.bseindia.com)
- [SEBI Website](https://www.sebi.gov.in)
- [RSS Feed Finder](https://www.rss.com)
- [Public APIs List](https://github.com/public-apis/public-apis)

## Last Updated

2026-01-23

---

**Note**: This document is provided for educational purposes. Always ensure compliance with applicable laws and terms of service when accessing data sources.
