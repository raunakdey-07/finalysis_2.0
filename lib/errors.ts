/**
 * Turns internal failure detail into something a reader can act on.
 *
 * Provider names, HTTP status codes and stack-ish messages stay in the server
 * logs. What reaches the page says which part of the data failed and that the
 * app fell back, because a vague "something went wrong" is not actionable and
 * an upstream status code is not the reader's business.
 */

type Scope = 'price' | 'fundamentals' | 'news';

/**
 * Rate limiting is an answer, not a fault.
 *
 * Retrying immediately spends the remaining budget on requests the provider has
 * already refused, and slows recovery. Anything that wraps a provider error in
 * this type tells the retry loop to stop.
 */
export class RateLimited extends Error {
  constructor(public readonly retryAfterMs: number | null) {
    super('Provider is rate limiting requests');
    this.name = 'RateLimited';
  }
}

export function isWorthRetrying(error: unknown): boolean {
  return !(error instanceof RateLimited);
}

/**
 * `Retry-After` is either a number of seconds or an HTTP date. Both are
 * handled, and the result is capped so a hostile or mistaken header cannot park
 * the app for minutes.
 */
export function parseRetryAfter(header: string | undefined): number | null {
  if (!header) return null;

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);

  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_AFTER_MS);
}

const MAX_RETRY_AFTER_MS = 120_000;

const SCOPE_LABEL: Record<Scope, string> = {
  price: 'Live pricing',
  fundamentals: 'Company figures',
  news: 'News coverage',
};

type Failure = 'network' | 'timeout' | 'not-found' | 'rate-limited' | 'rejected' | 'unknown';

/**
 * Ordered most-specific first.
 *
 * Order matters. A network failure used to be reported as a wrong ticker
 * because the wrapper text "No NSE quote available" contains the words
 * "no NSE quote", and a substring test found it even though the real cause was
 * a dead connection. Transport failures are therefore checked before the
 * message the application itself composed.
 */
const FAILURE_PATTERNS: { failure: Failure; pattern: RegExp }[] = [
  { failure: 'timeout', pattern: /timed out|abort|ETIMEDOUT|ESOCKETTIMEDOUT|TimeoutError/i },
  {
    failure: 'network',
    pattern: /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|network|getaddrinfo|socket hang up|aborted/i,
  },
  { failure: 'rate-limited', pattern: /\b429\b|rate limit|too many requests/i },
  { failure: 'not-found', pattern: /(^|\W)(404|no page for|no NSE quote|no record for|no company page)/i },
  { failure: 'rejected', pattern: /plausible range|not \w+ currency|discarded|rejected/i },
];

function classify(message: string): Failure {
  for (const { failure, pattern } of FAILURE_PATTERNS) {
    if (pattern.test(message)) return failure;
  }
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
    case 'network':
      return `${label} could not be reached. The provider may be down, or the connection failed.`;
    case 'rate-limited':
      return `${label} is rate limiting requests right now.`;
    case 'not-found':
      return `${label} has no record for this ticker. Its NSE symbol may differ from the company name.`;
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
