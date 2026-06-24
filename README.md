# Finalysis

**Simple stock research for India** — Understand any NSE stock in 30 seconds.

🔗 **Live:** [fin-alysis.vercel.app](https://fin-alysis.vercel.app/)

## What it does

Finalysis answers three questions about any NSE stock:

1. **Is it a good business?** — ROE, ROCE, dividend yield
2. **Is it getting better?** — Price momentum, news sentiment
3. **Is the price fair?** — P/E, P/B, book value

No jargon. No overwhelming data. Just clear verdicts for everyday investors.

## Features

- **8 Popular Stocks** — ITC, TCS, Reliance, HDFC Bank, Infosys, Airtel, HUL, Asian Paints
- **Human-Friendly Search** — Search by company name, alias, or ticker (e.g. `Bajaj Housing Finance`, `hdfc`, `ITC.NS`)
- **Full Local Coverage** — 2300+ active NSE stocks in a local dataset with sector + industry context for filterable discovery
- **Real-time Prices** — From Yahoo Finance with a 10min cache and end-of-day NSE snapshot fallback
- **Graceful Not-Found Handling** — Invalid stocks return clear “Data unavailable” state
- **Fundamental Data** — Scraped from Screener.in (60-day cache)
- **News Sentiment** — Curated Google News RSS blend with relevance scoring and professional fallback resources
- **Mobile Friendly** — Works on any device
- **Zero Cost** — No paid APIs required

## Backend

Finalysis now runs on a split backend:

- Live quotes and symbol search use Yahoo Finance with Redis caching and a circuit breaker.
- Daily price snapshots are written by `/api/cron/update-prices` after market close.
- Fundamentals and valuation checks still come from Screener.in.
- News and sentiment come from Google News RSS plus fallback market sources.
- The canonical stock universe lives in `data/stocks.json` and is refreshed from NSE data.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Hosting | Vercel |
| Data | Yahoo Finance, NSE snapshot, Screener.in, Google News RSS |

## Run Locally

\`\`\`bash
git clone https://github.com/raunakdey-07/finalysis_2.0.git
cd finalysis_2.0
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000)

Set your canonical site URL (recommended for SEO routes):

```bash
echo "NEXT_PUBLIC_SITE_URL=https://your-domain.com" > .env.local
```

## API Endpoints

| Endpoint | Description | Rate Limit |
|----------|-------------|------------|
| \`/api/nse/quote?symbol=ITC\` | Live price | 60/min |
| \`/api/metrics?symbol=ITC\` | Fundamentals + scores | 30/min |
| \`/api/news?symbol=ITC\` | News with sentiment | 30/min |
| `/api/overview?symbol=ITC` | Aggregated payload (quote + metrics + news + sentiment) | 30/min |
| \`/api/nse/search?q=hdfc\` | Resolve human query to canonical tickers | 20/min |
| \`/api/nse/search?q=hdfc&sector=Banking\` | Resolve query within a sector filter | 20/min |

## Data Sources

| Source | Data | Cache TTL |
|--------|------|-----------|
| Yahoo Finance | Live prices, symbol search | 10 minutes |
| NSE daily snapshot | End-of-day prices for cron fallbacks | 1 day |
| Screener.in (scraped) | P/E, P/B, ROE, ROCE, etc. | 60 days |
| Google News RSS | Headlines, sentiment | 8 hours |

## Maintenance

Refresh the local stock universe (merged with existing aliases):

```bash
npm run stocks:sync
npm run stocks:validate
```

`stocks:sync` refreshes `data/stocks.json` directly from NSE and preserves aliases plus sector metadata.

Pre-freeze quality checks:

```bash
npm run lint
npm run build
```

Daily price snapshot cron:

- Endpoint: `/api/cron/update-prices`
- Optional protection: set `CRON_SECRET` and send `Authorization: Bearer <secret>` when calling manually.
- Vercel cron will keep this updated after market close (weekday schedule).

## Disclaimer

⚠️ **This is not financial advice.** Data may be delayed, incomplete, or inaccurate. Always verify from official sources and consult a SEBI-registered advisor before investing.

## License

MIT — See [LICENSE](LICENSE)

---

Built by [@raunakdey-07](https://github.com/raunakdey-07)
