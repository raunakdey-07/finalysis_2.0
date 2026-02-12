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
- **Real-time Prices** — From NSE public endpoints (10min cache)
- **Graceful Not-Found Handling** — Invalid stocks return clear “Data unavailable” state
- **Fundamental Data** — Scraped from Screener.in (60-day cache)
- **News Sentiment** — Google News RSS with keyword-based analysis
- **Mobile Friendly** — Works on any device
- **Zero Cost** — No paid APIs required

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Hosting | Vercel |
| Data | NSE, Screener.in, Google News RSS |

## Run Locally

\`\`\`bash
git clone https://github.com/raunakdey-07/finalysis_2.0.git
cd finalysis_2.0
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000)

To run frontend + backend helper server together:

\`\`\`bash
npm run dev:all
\`\`\`

## API Endpoints

| Endpoint | Description | Rate Limit |
|----------|-------------|------------|
| \`/api/nse/quote?symbol=ITC\` | Live price | 60/min |
| \`/api/metrics?symbol=ITC\` | Fundamentals + scores | 30/min |
| \`/api/news?symbol=ITC\` | News with sentiment | 30/min |
| \`/api/nse/search?q=hdfc\` | Resolve human query to canonical tickers | 20/min |

## Data Sources

| Source | Data | Cache TTL |
|--------|------|-----------|
| NSE public endpoints | Live prices, change % | 10 minutes |
| Screener.in (scraped) | P/E, P/B, ROE, ROCE, etc. | 60 days |
| Google News RSS | Headlines, sentiment | 8 hours |

## Disclaimer

⚠️ **This is not financial advice.** Data may be delayed, incomplete, or inaccurate. Always verify from official sources and consult a SEBI-registered advisor before investing.

## License

MIT — See [LICENSE](LICENSE)

---

Built by [@raunakdey-07](https://github.com/raunakdey-07)
