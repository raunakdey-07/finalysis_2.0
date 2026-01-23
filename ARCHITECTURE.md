# Finalysis 3.0 - Architecture Documentation

## Overview

Finalysis 3.0 is a zero-budget stock analysis application for Indian equities built with a modern, scalable architecture. The application follows an API-first approach with clean separation of concerns.

## Technology Stack

### Core Technologies
- **Next.js 16.1+**: React framework with App Router for server-side rendering and API routes
- **TypeScript 5+**: Type-safe JavaScript for better developer experience
- **Tailwind CSS 4+**: Utility-first CSS framework for rapid UI development
- **Node.js 20+**: JavaScript runtime environment

### Architecture Patterns
- **API-First Design**: All business logic exposed through RESTful APIs
- **Server-Side Rendering (SSR)**: Optimized page load performance
- **In-Memory Caching**: Efficient data caching with configurable TTL
- **Modular Structure**: Clean separation of concerns with distinct modules

## Directory Structure

```
finalysis_2.0/              # Repository name (Finalysis 3.0 codebase)
├── app/                    # Next.js App Router
│   ├── api/               # API routes (server-side)
│   │   ├── nse/          # NSE price data endpoints
│   │   │   ├── quote/    # Get stock quote
│   │   │   └── search/   # Search stocks
│   │   ├── fundamentals/ # Fundamental data endpoints
│   │   ├── news/         # RSS news sentiment endpoints
│   │   └── metrics/      # Explainable metrics endpoints
│   ├── layout.tsx        # Root layout component
│   ├── page.tsx          # Home page
│   └── globals.css       # Global styles
├── lib/                   # Business logic and utilities
│   ├── cache/            # Caching implementation
│   ├── nse/              # NSE API integration
│   ├── sentiment/        # Sentiment analysis engine
│   └── metrics/          # Metrics calculation engine
├── components/           # Reusable React components
├── types/               # TypeScript type definitions
│   ├── stock.ts         # Stock-related types
│   ├── api.ts           # API response types
│   └── index.ts         # Type exports
└── public/              # Static assets
```

## Core Modules

### 1. Cache Module (`lib/cache/`)

**Purpose**: Provides in-memory caching with TTL support

**Key Features**:
- Singleton pattern for shared cache across the application
- Configurable TTL (Time To Live) per cache entry
- Automatic cleanup of expired entries
- Type-safe generic implementation

**Usage**:
```typescript
import cache from '@/lib/cache';

// Set with 1 minute TTL
cache.set('key', data, 60000);

// Get cached data
const data = cache.get<DataType>('key');
```

### 2. NSE Integration Module (`lib/nse/`)

**Purpose**: Integrates with NSE (National Stock Exchange) APIs

**Key Features**:
- Fetch stock quotes by symbol
- Search stocks by keyword
- Batch quote fetching
- Automatic caching of responses

**API Functions**:
- `fetchNSEQuote(symbol)`: Get quote for a single stock
- `fetchMultipleQuotes(symbols)`: Get quotes for multiple stocks
- `searchStocks(query)`: Search stocks by keyword

### 3. Sentiment Analysis Module (`lib/sentiment/`)

**Purpose**: RSS-based news sentiment analysis

**Key Features**:
- Fetch news from multiple RSS feeds
- Keyword-based sentiment scoring
- Stock-specific news filtering
- Overall market sentiment calculation

**RSS Sources**:
- Economic Times Markets
- MoneyControl Market Reports
- LiveMint Markets

**Sentiment Scoring**:
- Positive keywords: gain, growth, profit, surge, rally, etc.
- Negative keywords: loss, decline, fall, drop, crash, etc.
- Score range: -1 (negative) to 1 (positive)

### 4. Metrics Module (`lib/metrics/`)

**Purpose**: Calculate explainable stock metrics

**Key Features**:
- Valuation scoring (P/E, P/B ratios)
- Growth scoring (EPS, industry factors)
- Profitability scoring (dividend yield, ROE)
- Momentum scoring (price action, volume)
- Weighted overall score with recommendation

**Scoring System**:
- Each metric scored 0-100
- Clear explanations for each score
- Overall score with weighted calculation
- Buy/Sell recommendations based on score

## API Design

### Response Format

All API endpoints return a standardized response:

```typescript
{
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}
```

### API Endpoints

#### 1. NSE Quote API
**Endpoint**: `GET /api/nse/quote?symbol={SYMBOL}`

**Response**:
```json
{
  "success": true,
  "data": {
    "symbol": "RELIANCE",
    "price": 2450.50,
    "change": 15.25,
    "changePercent": 0.63,
    "volume": 5000000,
    "timestamp": "2026-01-23T18:00:00.000Z"
  },
  "timestamp": "2026-01-23T18:00:01.000Z"
}
```

#### 2. Stock Search API
**Endpoint**: `GET /api/nse/search?q={QUERY}`

**Response**:
```json
{
  "success": true,
  "data": ["TCS", "TATA", "TATASTEEL"],
  "timestamp": "2026-01-23T18:00:00.000Z"
}
```

#### 3. News Sentiment API
**Endpoint**: `GET /api/news?symbol={SYMBOL}&limit={LIMIT}`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "news_123",
      "title": "Stock market rallies on positive sentiment",
      "description": "Markets gained...",
      "link": "https://...",
      "pubDate": "2026-01-23T12:00:00.000Z",
      "source": "economictimes.com",
      "sentiment": "positive",
      "sentimentScore": 0.75
    }
  ],
  "timestamp": "2026-01-23T18:00:00.000Z"
}
```

#### 4. Market Sentiment API
**Endpoint**: `GET /api/news?type=sentiment`

**Response**:
```json
{
  "success": true,
  "data": {
    "sentiment": "positive",
    "score": 0.35,
    "newsCount": 50
  },
  "timestamp": "2026-01-23T18:00:00.000Z"
}
```

#### 5. Metrics API
**Endpoint**: `GET /api/metrics?symbol={SYMBOL}`

**Response**:
```json
{
  "success": true,
  "data": {
    "symbol": "INFY",
    "valuationScore": 75,
    "growthScore": 68,
    "profitabilityScore": 82,
    "momentumScore": 55,
    "overallScore": 72,
    "recommendation": "Buy",
    "explanation": {
      "valuation": "Low P/E ratio indicates undervaluation...",
      "growth": "Strong earnings per share...",
      "profitability": "High dividend yield...",
      "momentum": "Positive price momentum..."
    }
  },
  "timestamp": "2026-01-23T18:00:00.000Z"
}
```

## Caching Strategy

### Cache Levels

1. **Quote Data**: 1 minute TTL
   - Frequently accessed, needs to be relatively fresh
   
2. **Search Results**: 5 minutes TTL
   - Less frequently changed data
   
3. **News Data**: 10 minutes TTL
   - RSS feeds updated periodically
   
4. **Fundamental Data**: 1 hour TTL
   - Rarely changes, safe to cache longer

### Cache Implementation

- In-memory Map-based cache
- Automatic expiry checking on retrieval
- Periodic cleanup every 5 minutes
- Type-safe generic interface

## Data Flow

### 1. Stock Quote Request Flow
```
User Request → API Route → NSE Module → Check Cache
                                       ↓
                                   Cached? → Yes → Return
                                       ↓
                                      No
                                       ↓
                              Fetch from NSE API
                                       ↓
                                  Cache Result
                                       ↓
                                Return to User
```

### 2. Metrics Calculation Flow
```
User Request → API Route → Fetch Price → Fetch Fundamentals
                                ↓
                          Calculate Metrics
                                ↓
                        Generate Explanations
                                ↓
                          Return to User
```

## Scalability Considerations

### Current Implementation
- In-memory caching (suitable for single instance)
- Direct API calls (no queue system)
- Server-side rendering for all pages

### Future Scalability Options
1. **Distributed Caching**: Redis for multi-instance deployment
2. **Database Integration**: PostgreSQL for persistent storage
3. **Message Queues**: RabbitMQ/Redis for async processing
4. **CDN**: CloudFlare for static asset delivery
5. **Load Balancing**: Multiple Next.js instances behind load balancer

## Security Considerations

### Current Implementation
- No authentication required (public APIs)
- CORS enabled for all origins
- Rate limiting not implemented (to be added)

### Recommendations for Production
1. Implement API rate limiting
2. Add authentication for premium features
3. Sanitize all user inputs
4. Add request validation middleware
5. Implement HTTPS only
6. Add security headers
7. Monitor for abuse patterns

## Performance Optimization

### Implemented
- Server-side rendering for fast initial load
- In-memory caching for frequently accessed data
- Code splitting with Next.js App Router
- Tailwind CSS for minimal CSS bundle

### Future Optimizations
- Image optimization with Next.js Image component
- API response compression
- Database query optimization
- Implement pagination for large datasets
- Add service worker for offline support

## Error Handling

All API routes implement consistent error handling:

1. **Input Validation**: Missing or invalid parameters return 400
2. **Not Found**: Missing resources return 404
3. **Server Errors**: Unexpected errors return 500
4. **External API Failures**: Graceful degradation with null returns

## Testing Strategy

### Recommended Tests
1. **Unit Tests**: Test individual modules (cache, metrics, sentiment)
2. **Integration Tests**: Test API endpoints
3. **E2E Tests**: Test user flows with Playwright
4. **Performance Tests**: Load testing with k6 or Artillery

### Test Commands
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

## Monitoring and Observability

### Metrics to Track
- API response times
- Cache hit rates
- Error rates by endpoint
- External API failures
- Memory usage

### Recommended Tools
- Vercel Analytics (built-in)
- Sentry for error tracking
- LogRocket for session replay
- Custom logging with Winston

## Contributing

See [README.md](README.md) for contribution guidelines.

## License

See [LICENSE](LICENSE) for details.
