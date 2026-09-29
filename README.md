# Finalysis

Read an NSE company from published numbers.

Finalysis pulls a share price with the timestamp the exchange recorded it, the
valuation and return figures a public company page actually publishes, and
recent headlines. It compares those figures against sector bands and says what
it found. It is an educational research tool, not financial advice, and it does
not recommend buying or selling anything.

## What it shows

- **A price with a timestamp.** Every price says whether it is live, served
  from a short cache, a scheduled end-of-day close, or the last price retrieved
  while the live source was failing. A stale price is never dressed up as a
  current one.
- **Business quality and valuation scores.** Built from published P/E, P/B,
  ROE, ROCE and dividend yield, compared against ranges for the company's
  sector. A figure that was not published contributes nothing and is named as
  missing. If nothing a score needs was published, no score is shown.
- **Recent signals.** The day's move, and the tone of retrieved headlines.
  No tone is reported at all when fewer than five articles matched.
- **A data status note.** The price timestamp and the reporting period are stated
  in the open, because that is what you need before trusting a number. Sources,
  cache windows and anything that failed are behind the "?". Failures are never
  hidden there; a degraded source is stated in the open.
- **Five links to the primary sources** for every company: the Screener.in page
  the figures are read from, the Yahoo Finance profile, NSE filings, NSE results,
  and the BSE quote page.

## What it does not do

- It does not estimate intrinsic value or a fair price.
- It does not measure management quality, competitive advantage, or accounting
  quality.
- It does not measure growth. The company pages Finalysis reads publish one
  figure at a time, and none of them is a growth series.
- It does not give a recommendation, a target, or a probability of anything.

## Coverage

Finalysis covers a fixed dataset of NSE tickers held in `data/stocks.json`
(2,364 at the time of writing), not every listed company. Within that set,
figures are available only for companies the source pages cover, so some
symbols will return a price but no company figures. The page says which
happened.

## Sources

| Data | Source | Refresh |
| --- | --- | --- |
| Share price | Yahoo Finance chart API | 10 minutes, per instance |
| Company figures | Screener.in public company page | 30 days, per instance |
| Headlines | Google News RSS | 1 hour, per instance |
| End-of-day close | Redis snapshot, written by a scheduled job | rotating slice, weekdays |
| Ticker list | `data/stocks.json`, checked in | manual |

Caching is per server instance, not shared. A cold instance always pays the
full upstream cost.

## Local setup

Requires Node 20.11 or newer. This project uses pnpm.

```bash
pnpm install
cp .env.example .env.local   # then fill it in
pnpm dev
```

Open http://localhost:3000.

### Environment variables

Copy `.env.example` and set the values you need. Only the first is required.

| Variable | Required | Purpose |
| --- | --- | --- |
| `CRON_SECRET` | For the snapshot job | Bearer token the job requires. If it is unset the job returns 503 rather than running open. |
| `KV_REDIS_URL` | For the snapshot job | Redis used to store the end-of-day close snapshot. Without it, prices fall back to a cache-only policy. |
| `NEXT_PUBLIC_SITE_URL` | Optional | Canonical URL used for metadata, robots and sitemap. Defaults to `https://finalysis.vercel.app`. |

Vercel cron requests automatically send `CRON_SECRET` as an
`Authorization: Bearer` header when that variable is set, so the scheduled job
authenticates without any header a client could forge.

## Scripts

```bash
pnpm dev            # development server
pnpm build          # production build
pnpm start          # serve the production build
pnpm lint           # eslint
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest
pnpm stocks:sync    # refresh data/stocks.json from NSE
pnpm stocks:validate # validate the dataset
```

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/metrics?symbol=RELIANCE` | Price, company figures, scores, verdict, provenance |
| `GET /api/nse/quote?symbol=RELIANCE` | Price only |
| `GET /api/nse/search?q=hdfc` | Ticker and company-name search, local dataset only |
| `GET /api/news?symbol=RELIANCE` | Headlines and tone, or direct source links when none were retrieved |
| `GET /api/cron/update-prices` | Refreshes a slice of the end-of-day snapshot. Requires `Authorization: Bearer $CRON_SECRET`. |

Every route rate limits per client, and every route that takes a symbol
rejects anything outside the covered dataset before making an upstream request.

## How the scores work

Each score starts from a neutral 50 and adjusts it for published figures:

- **Business quality**: ROE against the sector band, ROCE against the sector
  band, and dividend yield.
- **Valuation**: P/E and P/B against the sector bands.

Sector bands come from the broad sector the source publishes. When the sector
is missing, the general-market bands are used and the page says so.

A published figure moves the score. A missing one does not. If no figure a
score needs was published, the score is absent rather than 50, because a neutral
score is indistinguishable from a real, unremarkable reading.

## Maintenance

```bash
pnpm run stocks:sync
pnpm run stocks:validate
```

The snapshot job walks a bounded slice of the universe each run and merges it
into the stored snapshot, because a full sweep does not fit in a single
serverless invocation. Configure it in `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/update-prices", "schedule": "45 10 * * 1-5" }] }
```

## Known limitations

- Headline tone is a keyword count, not an understanding of the article. It
  needs at least five retrieved articles before it is reported at all.
- A failed request is retried once automatically, so the page does not depend on
  the reader pressing anything.
- Company figures are the latest completed financial year. They are not a
  trailing twelve-month view and are not adjusted for later restatements.
- Screener.in does not publish a debt-to-equity figure on the pages Finalysis
  reads, so leverage is not shown and is not scored.
- The cache is per instance, so upstream request volume scales with traffic.
- The site is light-only. A dark palette was previously declared while every
  surface was hard-coded light, which rendered a near-black page behind white
  cards; the half-implementation was removed instead of shipping a broken mode.

## License

MIT, see [LICENSE](LICENSE).
