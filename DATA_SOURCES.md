# Zero-Budget Data Sources for Finalysis 3.0

This document outlines free data sources and APIs that can be used with Finalysis 3.0 for Indian equity analysis.

## Stock Price Data

### 1. Yahoo Finance API (Unofficial)
- **Cost**: Free
- **Limitations**: Unofficial, may change without notice
- **Usage**: Stock quotes, historical data
- **Example**: `https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.NS`

### 2. NSE Website (Web Scraping)
- **Cost**: Free
- **Limitations**: Must comply with ToS, rate limiting
- **Usage**: Real-time quotes, corporate actions
- **Note**: Requires proper user-agent headers and respectful rate limiting

### 3. Alpha Vantage (Free Tier)
- **Cost**: Free with limits (5 API calls/min, 500 calls/day)
- **Limitations**: Rate limits, requires API key
- **Usage**: Stock quotes, historical data, technical indicators
- **Signup**: https://www.alphavantage.co/support/#api-key

### 4. Financial Modeling Prep (Free Tier)
- **Cost**: Free with limits (250 requests/day)
- **Limitations**: Rate limits, requires API key
- **Usage**: Financial statements, stock quotes
- **Signup**: https://financialmodelingprep.com/developer/docs/

## Fundamental Data

### 1. Screener.in (Unofficial API)
- **Cost**: Free
- **Limitations**: Unofficial, no API documentation
- **Usage**: P/E ratio, P/B ratio, dividend yield, EPS
- **Note**: Data can be scraped from their website

### 2. MoneyControl
- **Cost**: Free
- **Limitations**: Web scraping required
- **Usage**: Company fundamentals, financial statements
- **Note**: Comprehensive data, requires scraping

### 3. BSE India
- **Cost**: Free
- **Limitations**: Limited API access, mostly manual
- **Usage**: Corporate announcements, financial results
- **Website**: https://www.bseindia.com

### 4. NSE India
- **Cost**: Free
- **Limitations**: Limited API access
- **Usage**: Company information, corporate actions
- **Website**: https://www.nseindia.com

## News Sources (RSS Feeds)

### 1. Economic Times - Markets
- **RSS Feed**: `https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms`
- **Cost**: Free
- **Content**: Market news, stock analysis

### 2. MoneyControl
- **RSS Feed**: `https://www.moneycontrol.com/rss/marketreports.xml`
- **Cost**: Free
- **Content**: Market reports, stock news

### 3. LiveMint - Markets
- **RSS Feed**: `https://www.livemint.com/rss/markets`
- **Cost**: Free
- **Content**: Financial news, market updates

### 4. Business Standard
- **RSS Feed**: `https://www.business-standard.com/rss/markets-106.rss`
- **Cost**: Free
- **Content**: Business news, market analysis

### 5. Financial Express
- **RSS Feed**: `https://www.financialexpress.com/market/market-news/feed/`
- **Cost**: Free
- **Content**: Market news and updates

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
