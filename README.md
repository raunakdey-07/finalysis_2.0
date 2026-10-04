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
- **Recent signals.** Where the price sits in its 12-month range, how it has
  moved over the last few sessions, the day's move, and the tone of retrieved
  headlines. It answers a different question from the two screening cards and
  uses different words, because it describes a position rather than judging the
  company. It is not comparable with the other two. No tone is reported at all
  when fewer than five articles matched, and the tone reads neutral when fewer
  than three of them carry a direction either way.
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
| Share price | Yahoo Finance chart API | 30 minutes, per instance |
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
| `KV_REDIS_URL` | For the snapshot job | Redis used to store the end-of-day close snapshot. Without it, prices fall back to a cache-only policy. `REDIS_URL` is accepted as an alias. |
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

The two screening cards each start from a neutral 50 and adjust it for published
figures:

- **Business quality**: ROE against the sector band, ROCE against the sector
  band, and dividend yield.
- **Valuation**: P/E and P/B against the sector bands.

Sector bands come from the broad sector the source publishes. When the sector
is missing, the general-market bands are used and the page says so.

A published figure moves the score. A missing one does not. If no figure a
score needs was published, the score is absent rather than 50, because a neutral
score is indistinguishable from a real, unremarkable reading. A figure that was
published but cannot be read, such as the P/E of a loss-making company,
contributes nothing and says so in its own line.

The label is read off the number printed beside it, so the two can never
disagree: 60 or above is Favourable, 40 to 59 is Mixed, below 40 is Cautious.

### The third card is not a screening score

**Recent signals** answers a different question. It describes where the price
sits and how it has been moving, not what the company is worth, so it is
labelled Buoyant, Steady or Soft rather than Favourable, Mixed or Cautious, and
its number is not comparable with the other two. A company resting on its
52-week low can be an excellent business and read Soft here.

It also starts from 50 and takes four inputs: position in the 12-month range,
the move over the last few sessions, today's move, and the tone of retrieved
headlines. Range position carries double weight, because it is the slowest and
most informative of the four.

The range term is centred on 30, not on the arithmetic midpoint of 50. A
company's 52-week high and low are set at different times, so a falling stock
has its low set recently and sits in the bottom of its own range. Measured
across 39 live large caps, raw range position averaged about 30 with 85% of
names below the midpoint, so a score built on 50 sat around 38 and was largely
that one term rescaled. Centring on the observed value is what makes 50 mean
"an ordinary stock on an ordinary day".

**That 30 is the one number here that is a market assumption rather than a
measurement about the company.** It was measured rather than guessed, but it
drifts as the market's own distribution drifts, and it should be re-measured
rather than trusted.

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

A slice of 300 out of 2,364 symbols means a given symbol is re-fetched roughly
every eight days, so a close can be up to three weeks old by the time it is
read. That window is enforced per symbol rather than on the snapshot as a whole:
because each run merges into the same record, the snapshot's own timestamp is
when the *newest* symbol in it was captured, and a symbol that keeps failing
would otherwise keep serving a quote far older than that. A quote with no
readable capture time is refused rather than assumed fresh. The page always
labels this value as an end-of-day close and never as a live price.

## Checking that the data still arrives

The one failure this repository cannot detect on its own is a provider quietly
changing shape. If Screener.in alters its markup, the parser returns nothing for
every company, the site keeps serving pages, and every test still passes,
because the tests read stored fixtures rather than the provider. Company
figures would disappear site-wide with nothing reporting it.

`pnpm run check:providers` is the check that would catch it. It fetches real
pages and runs them through the real parser and the real validator, and fails
if coverage drops. It is deliberately excluded from `pnpm test` and from CI: a
suite that goes red because a third-party site is having a bad day trains
people to ignore red, and CI would be testing the internet rather than this
code. Run it on a schedule, or after anything odd is seen on the site.

It is also worth running periodically for a duller reason. Company figures are
cached for 30 days, so a provider that changes its markup today keeps serving
the cached copy for up to a month before anything visibly breaks. The damage
arrives all at once rather than gradually.

## Local platform

The container, the local Kubernetes cluster, the Prometheus and Grafana setup,
the Helm chart and the Terraform configuration live in [`deploy/`](deploy/README.md).
That document also has a "Verified / Not verified" section, which is the part
worth reading before trusting any of it.

Everything there is local and free: no cloud account, no trial, no paid API and
no hosted monitoring.

To run the container on its own:

```bash
deploy/scripts/fetch-tools.sh     # one-off: kind, kubectl, helm, terraform
deploy/scripts/build.sh
deploy/scripts/run-local.sh       # http://localhost:3500
```

## Deployment

Deployed on Vercel. One setting is not in the repository and has to be right,
because nothing here can enforce it:

**The Install Command must be pnpm, or unset so Vercel uses the lockfile.**

A Vercel build of this project was observed running `npm install` after
correctly detecting `pnpm-lock.yaml` and `packageManager: pnpm@10.28.1`. npm
ignores `pnpm-lock.yaml` entirely: it resolves the caret ranges fresh from the
registry and writes its own `package-lock.json`, so the tree that deploys is
not the tree CI proved with `--frozen-lockfile`, and it can change without any
commit. It was also the direct cause of a failed build, because npm could not
reconcile a restored build cache against a changed `package.json`.

If a build log says `Running "install" command: npm install`, the deployment is
not reproducible. Fix it in the Vercel project's Settings, and confirm by
reading the build log rather than assuming.

The Node runtime is pinned to 22, matching CI, rather than a `>=` range that
Vercel would silently bump on a future major.

## Known limitations

- **The screening scores are banded, so they are coarse.** A figure inside a
  band contributes a fixed amount, which means two companies in the same band
  score identically however far apart their actual figures are. TCS at ROE 65%
  and Infosys at ROE 36% both read as "strong against the band" and both score
  82 for business quality. That is the design, not a fault: the score answers
  "where does this sit against its sector", not "how good is this company". The
  published figures are on the card, and they are where the difference shows.
- Headline tone is a keyword reading, not an understanding of the article. It
  needs at least five retrieved articles before it is reported at all, and at
  least three of those carrying a direction before it will call one either way.
  Below that it reports neutral, which means thin coverage rather than a
  balanced news picture, and the card says which it was.
- Headline tone cannot measure intensity. A 2% rise and a collapse score the
  same, because a word list does not know how much a word is worth. It says
  which way a headline points, not how hard.
- P/B is derived from the current price and the book value on the company page,
  and that page is cached for 30 days. The ratio is therefore consistent with
  the P/E printed beside it, but not with the live price at the top of the page.
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
