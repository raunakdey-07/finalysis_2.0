/**
 * Failure wording.
 *
 * A reader is told what failed so they know whether to wait, retry, or look
 * elsewhere. Getting that wrong is worse than saying nothing: a dead
 * connection was reported as a wrong ticker because the message the app
 * composed happened to contain the words the not-found check looked for.
 */
import { describe, it, expect } from 'vitest';
import { describeOutage } from '@/lib/errors';

describe('describeOutage', () => {
  it('reports a network failure as a connection problem, not a wrong ticker', () => {
    // This is the message the quote route used to compose. The transport
    // failure has to win over the "no quote" wording wrapped around it.
    const message = describeOutage('price', new Error('No NSE quote available for ITC (fetch failed)'));
    expect(message).not.toMatch(/ticker|symbol may differ/i);
    expect(message).toMatch(/could not be reached/i);
  });

  it('reports a genuine 404 as a ticker problem', () => {
    const message = describeOutage('price', new Error('No NSE quote available for ZZZZ'));
    expect(message).toMatch(/ticker|symbol may differ/i);
  });

  it('reports a missing company page as a ticker problem', () => {
    const message = describeOutage(
      'fundamentals',
      new Error('Screener.in has no page for AXIS. Its ticker may differ from the NSE symbol.')
    );
    expect(message).toMatch(/ticker|symbol may differ/i);
  });

  it('reports a timeout as a timeout', () => {
    expect(describeOutage('news', new Error('Request timed out after 8000ms'))).toMatch(
      /did not respond in time/i
    );
  });

  it('reports rate limiting as rate limiting', () => {
    expect(describeOutage('news', new Error('Google News returned HTTP 429'))).toMatch(
      /rate limiting/i
    );
  });

  it('reports a rejected value as rejected rather than as an outage', () => {
    const message = describeOutage(
      'price',
      new Error('Provider returned a price outside the plausible range for an NSE share')
    );
    expect(message).toMatch(/did not look like an NSE share/i);
  });

  it('falls back to a plain sentence rather than leaking a provider error', () => {
    const message = describeOutage('fundamentals', new Error('ETIMEDOUT at 10.0.0.1:6379:connection'));
    expect(message).not.toMatch(/ETIMEDOUT|10\.0\.0\.1/);
    expect(message.length).toBeGreaterThan(0);
  });

  it('names the source that failed', () => {
    expect(describeOutage('price', new Error('boom'))).toMatch(/Live pricing/);
    expect(describeOutage('fundamentals', new Error('boom'))).toMatch(/Company figures/);
    expect(describeOutage('news', new Error('boom'))).toMatch(/News coverage/);
  });
});
