/**
 * Live provider health.
 *
 * This exists because of one specific blind spot. If Screener.in changes its
 * markup, `parseFundamentalsHtml` returns null for every company, the app
 * keeps serving pages perfectly well, every test still passes because the tests
 * run against stored fixtures, and nothing anywhere reports a problem. Company
 * figures would quietly disappear from the site and nothing in the repository
 * would notice.
 *
 * So this fetches real pages and runs them through the real parser and the real
 * validator. It is the check that would have caught it.
 *
 * It is deliberately NOT part of `pnpm test`. That suite must stay hermetic:
 * a suite that fails because a third-party site is down trains people to ignore
 * red, and CI would be testing the internet rather than this code. Run it on
 * purpose with:
 *
 *   pnpm run check:providers
 *
 * The 30-day fundamentals cache means a markup change can stay invisible for up
 * to a month before anything here fails, which is another reason to run this on
 * a schedule rather than only when someone suspects a problem.
 */
import { describe, expect, it } from 'vitest';
import { isValidFundamentals } from '@/lib/fundamentals/validate';
import { parseFundamentalsHtml } from '@/lib/fundamentals';
import { parseYahooChartResult } from '@/lib/yahoo';

const RUN_LIVE = process.env.CHECK_PROVIDERS === '1';

/** Chosen to span sectors, and to include names large enough to stay listed. */
const SAMPLE = [
  'RELIANCE',
  'TCS',
  'HDFCBANK',
  'INFY',
  'ITC',
  'LT',
  'SBIN',
  'TATASTEEL',
];

/** Below this, something has changed upstream and a human should look. */
const MIN_FUNDAMENTALS_COVERAGE = 0.75;
const MIN_QUOTE_COVERAGE = 0.75;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

async function fetchCompanyPage(slug: string): Promise<string | null> {
  try {
    const response = await fetch(`https://www.screener.in/company/${encodeURIComponent(slug)}/`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 404) return null;
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function fetchChart(symbol: string): Promise<unknown | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.NS?interval=1d&range=5d`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) }
    );
    if (!response.ok) return null;
    const json = (await response.json()) as { chart?: { result?: unknown[] } };
    return json.chart?.result?.[0] ?? null;
  } catch {
    return null;
  }
}

const live = RUN_LIVE ? describe : describe.skip;

live('live provider health', () => {
  it(
    'still parses company figures from real provider pages',
    async () => {
      const results: string[] = [];
      let parsed = 0;

      for (const symbol of SAMPLE) {
        const html = await fetchCompanyPage(symbol);
        if (html === null) {
          results.push(`${symbol}: page not retrieved`);
          continue;
        }
        const fundamentals = parseFundamentalsHtml(html, symbol);
        if (!fundamentals) {
          results.push(`${symbol}: MARKUP NOT RECOGNISED`);
          continue;
        }
        if (!isValidFundamentals(fundamentals)) {
          results.push(`${symbol}: parsed but failed validation`);
          continue;
        }
        parsed += 1;
        results.push(
          `${symbol}: ok (${fundamentals.companyName}, ROE ${fundamentals.roe ?? 'n/a'}, sector ${fundamentals.sector ?? 'n/a'})`
        );
      }

      const coverage = parsed / SAMPLE.length;
      // Printed either way, so a partial failure is readable in the log.
      console.log(`\n  fundamentals coverage ${(coverage * 100).toFixed(0)}%`);
      for (const line of results) console.log(`    ${line}`);

      expect(
        coverage,
        `Only ${parsed}/${SAMPLE.length} company pages parsed. If this is a markup change, ` +
          `lib/fundamentals parsing needs updating; if it is the provider, the site will show ` +
          `no company figures for every company at once.`
      ).toBeGreaterThanOrEqual(MIN_FUNDAMENTALS_COVERAGE);
    },
    180_000
  );

  it(
    'still parses quotes from the real chart response',
    async () => {
      const results: string[] = [];
      let parsed = 0;

      for (const symbol of SAMPLE) {
        const chart = await fetchChart(symbol);
        if (chart === null) {
          results.push(`${symbol}: chart not retrieved`);
          continue;
        }
        const quote = parseYahooChartResult(chart as never, symbol);
        if (!quote || !Number.isFinite(quote.price) || quote.price <= 0) {
          results.push(`${symbol}: NO USABLE PRICE`);
          continue;
        }
        parsed += 1;
        results.push(`${symbol}: ok (${quote.price})`);
      }

      const coverage = parsed / SAMPLE.length;
      console.log(`\n  quote coverage ${(coverage * 100).toFixed(0)}%`);
      for (const line of results) console.log(`    ${line}`);

      expect(
        coverage,
        `Only ${parsed}/${SAMPLE.length} quotes parsed. A response-shape change here means ` +
          `prices disappear site-wide while the app keeps returning 200.`
      ).toBeGreaterThanOrEqual(MIN_QUOTE_COVERAGE);
    },
    180_000
  );
});
