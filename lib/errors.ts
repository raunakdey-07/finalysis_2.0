/**
 * Turns internal failure detail into something a reader can act on.
 *
 * Provider names, HTTP status codes and stack-ish messages stay in the server
 * logs. What reaches the page says which part of the data failed and that the
 * app fell back, because a vague "something went wrong" is not actionable and
 * an upstream status code is not the reader's business.
 */

type Scope = 'price' | 'fundamentals' | 'news';

const SCOPE_LABEL: Record<Scope, string> = {
  price: 'Live pricing',
  fundamentals: 'Company figures',
  news: 'News coverage',
};

function classify(message: string): 'timeout' | 'not-found' | 'unavailable' | 'rejected' | 'unknown' {
  if (/timed out|abort|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(message)) return 'timeout';
  if (/404|no page for|no NSE quote|not found|no longer/i.test(message)) return 'not-found';
  if (/429|rate limit|too many/i.test(message)) return 'unavailable';
  if (/plausible range|currency|rejected/i.test(message)) return 'rejected';
  return 'unknown';
}

/**
 * A single sentence describing why a data source did not answer, safe to show.
 */
export function describeOutage(scope: Scope, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const label = SCOPE_LABEL[scope];

  switch (classify(message)) {
    case 'timeout':
      return `${label} did not respond in time.`;
    case 'not-found':
      return `${label} has no record for this ticker. Its NSE symbol may differ from the company name.`;
    case 'unavailable':
      return `${label} is rate limiting requests right now.`;
    case 'rejected':
      return `${label} returned a value that did not look like an NSE share, so it was discarded.`;
    default:
      return `${label} could not be retrieved from its provider.`;
  }
}

/** Kept server-side for logs; never serialised into an API response. */
export function logDetail(scope: Scope, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return `[${scope}] ${message}`;
}
