# Finalysis 2.0

Finalysis is a zero-budget stock analysis app for Indian equities. It helps users quickly understand whether a company looks fundamentally strong, whether momentum is improving, and whether the current price appears reasonable.

Live: https://fin-alysis.vercel.app

## What it does

For any NSE stock, Finalysis brings together:

- fundamental screening (P/E, P/B, ROE, ROCE, dividend yield, EPS, book value, leverage)
- price momentum and recent action
- market/news sentiment for the stock and broader market
- a clean, investor-friendly score and recommendation

The app is designed to be simple and fast: one symbol, one overview, one verdict.

## Core features

- Search and resolve NSE ticker symbols from natural language and user input
- Local stock universe coverage for a large set of Indian equities
- Yahoo Finance-backed live quote feed with cache and circuit-breaker protections
- Daily snapshot fallback for stale/failed pricing scenarios
- Screener.in fundamentals scraping with cache-aware resilience
- Google News RSS and fallback sources for sentiment aggregation
- Recommendation scoring with explainable metric breakdowns
- Mobile-friendly UI built with Next.js and Tailwind

## Stack

- Framework: Next.js 16 (App Router)
- Language: TypeScript
- UI: React 19 + Tailwind CSS 4
- Data sources: Yahoo Finance, Screener.in, Google News RSS, local NSE dataset
- Runtime/cache: Redis for shared cache + in-memory local cache fallbacks
- Testing: Vitest

## Local setup

This project uses pnpm.

```bash
git clone https://github.com/raunakdey-07/finalysis_2.0.git
cd finalysis_2.0
pnpm install
pnpm dev
```

Then open http://localhost:3000

### Environment variables

Create a `.env.local` with the site URL and any required secret values:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.com
CRON_SECRET=your-very-long-secret
```

- `NEXT_PUBLIC_SITE_URL` is recommended for canonical URLs and SEO metadata.
- `CRON_SECRET` protects the price snapshot cron endpoint when it is invoked manually.

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm test
pnpm run stocks:sync
pnpm run stocks:validate
```

## API surface

| Endpoint | Purpose |
| --- | --- |
| `/api/nse/quote?symbol=ITC` | Live price for a symbol |
| `/api/nse/search?q=hdfc` | Search and normalize ticker symbols |
| `/api/metrics?symbol=ITC` | Fundamental and scoring data |
| `/api/news?symbol=ITC` | News + sentiment mix |
| `/api/overview?symbol=ITC` | Combined quote + metrics + news payload |
| `/api/cron/update-prices` | Daily snapshot refresh endpoint |

Rate limits are enforced per client IP and endpoint category.

## Data and freshness model

| Source | Purpose | Freshness |
| --- | --- | --- |
| Yahoo Finance | Live quote and search data | 10-minute cache |
| Daily NSE snapshot | End-of-day fallback / stale recovery | 1 day |
| Screener.in | Valuation and fundamentals | 60-day cache |
| Google News RSS | Market sentiment and headlines | 8-hour cache |
| `data/stocks.json` | Canonical Indian stock universe | source-controlled |

## Maintenance

Refresh the stock dataset:

```bash
pnpm run stocks:sync
pnpm run stocks:validate
```

The stock sync script refreshes the canonical stock list while preserving aliases and metadata where needed.

## Cron job

The daily snapshot route is available at:

```text
/api/cron/update-prices
```

Manual calls should use a bearer token when `CRON_SECRET` is configured:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/update-prices
```

Vercel cron jobs can call this route without the bearer header when the trusted Vercel cron header is present.

## Quality checks

Before shipping, run the same checks used in CI:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm run stocks:validate
pnpm build
```

## Disclaimer

This project is for educational and research use only. It does not provide financial advice. Market data may be delayed, incomplete, or inaccurate. Always verify against official sources before making investment decisions.

## License

MIT — see [LICENSE](LICENSE)

---

Built by @raunakdey-07
