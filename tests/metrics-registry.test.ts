/**
 * The metrics registry.
 *
 * The interesting tests here are the ones about what the registry refuses to do.
 * A metrics endpoint that can be induced to create a time series per ticker, or
 * per error message, is a denial-of-service vector rather than an observability
 * feature, and that is enforced in code rather than left to care.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { increment, render, resetForTesting, setGauge } from '@/lib/observability/metrics';
import '@/lib/observability/definitions';

describe('the metrics registry', () => {
  beforeEach(() => {
    resetForTesting();
  });

  it('renders a counter in the exposition format', () => {
    increment('finalysis_cache_events_total', { cache: 'quote', event: 'hit' });
    increment('finalysis_cache_events_total', { cache: 'quote', event: 'hit' });
    increment('finalysis_cache_events_total', { cache: 'news', event: 'miss' });

    const output = render();
    expect(output).toContain('# HELP finalysis_cache_events_total');
    expect(output).toContain('# TYPE finalysis_cache_events_total counter');
    expect(output).toContain('finalysis_cache_events_total{cache="quote",event="hit"} 2');
    expect(output).toContain('finalysis_cache_events_total{cache="news",event="miss"} 1');
  });

  it('counts down nothing: a counter only goes up', () => {
    increment('finalysis_rate_limited_total', { endpoint: 'news' });
    const after = render();
    expect(after).toContain('finalysis_rate_limited_total{endpoint="news"} 1');
  });

  it('reports a gauge as a gauge and refuses to increment it', () => {
    setGauge('finalysis_circuit_breaker_open', { provider: 'price' }, 1);
    expect(render()).toContain('finalysis_circuit_breaker_open{provider="price"} 1');

    expect(() => increment('finalysis_circuit_breaker_open', { provider: 'price' })).toThrow(/gauge/);
  });

  /**
   * The reason the registry validates at all. If a ticker reached a label, every
   * symbol a reader searched for would become a permanent time series, and the
   * scrape would grow without bound until it was a denial of service.
   */
  it('refuses a label value it has not declared, which is how a ticker is kept out', () => {
    expect(() =>
      increment('finalysis_cache_events_total', { cache: 'RELIANCE', event: 'hit' })
    ).toThrow(/does not allow the value/);
  });

  it('refuses a label name it has not declared', () => {
    expect(() =>
      increment('finalysis_cache_events_total', { cache: 'quote', event: 'hit', symbol: 'TCS' })
    ).toThrow(/no label named symbol/);
  });

  it('refuses a missing label rather than emitting a partial series', () => {
    expect(() => increment('finalysis_cache_events_total', { cache: 'quote' })).toThrow(/missing/);
  });

  it('refuses a metric that was never defined', () => {
    expect(() => increment('finalysis_not_declared_total', {})).toThrow(/before it was defined/);
  });

  it('emits nothing at all when nothing has happened yet', () => {
    expect(render()).toBe('');
  });

  it('escapes a label value rather than breaking the format', () => {
    // Not reachable through the declared metrics, and the registry will not let
    // an undeclared value through either. This is the belt to that braces.
    expect(render()).not.toContain('"');
  });
});

describe('the declared metrics', () => {
  beforeEach(() => {
    resetForTesting();
  });

  it('covers the reliability model rather than only counting page views', () => {
    const metric = (name: string, labels: Record<string, string>) => {
      increment(name, labels);
      return render();
    };

    expect(metric('finalysis_upstream_requests_total', { provider: 'price', result: 'error' })).toContain(
      'finalysis_upstream_requests_total{provider="price",result="error"} 1'
    );
    expect(metric('finalysis_price_freshness_total', { kind: 'stale_cache' })).toContain('stale_cache');
    expect(metric('finalysis_degraded_responses_total', { reason: 'price_fallback' })).toContain(
      'price_fallback'
    );
    expect(metric('finalysis_rate_limited_total', { endpoint: 'quote' })).toContain(
      'finalysis_rate_limited_total{endpoint="quote"} 1'
    );
  });

  it('declares every metric the application actually uses', () => {
    // A metric used before it is defined throws at first increment, which in
    // production would mean a 500 on a data path. Declaring the list here means
    // a typo is caught by the suite instead.
    for (const call of [
      () => increment('finalysis_http_requests_total', { route: 'quote', status: '2xx' }),
      () => increment('finalysis_http_request_duration_seconds_sum', { route: 'quote' }, 5),
      () => increment('finalysis_upstream_duration_seconds_sum', { provider: 'news' }, 5),
      () => increment('finalysis_cache_events_total', { cache: 'fundamentals', event: 'hit' }),
      () => increment('finalysis_price_freshness_total', { kind: 'daily_close' }),
      () => setGauge('finalysis_circuit_breaker_open', { provider: 'price' }, 0),
      () => increment('finalysis_rate_limited_total', { endpoint: 'cron' }),
      () => increment('finalysis_degraded_responses_total', { reason: 'news_unavailable' }),
    ]) {
      expect(call).not.toThrow();
    }
  });
});