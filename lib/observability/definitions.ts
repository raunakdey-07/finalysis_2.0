/**
 * The metrics this application actually publishes.
 *
 * Each one is declared here, next to its allowed label values, so the set of
 * possible time series is finite and reviewable. That is the whole point: a
 * ticker symbol must never appear in a label, so `provider` and `kind` are the
 * only dimensions and both are drawn from the lists below.
 *
 * These describe the reliability model the application already had before any
 * of it was instrumented: a cache, a circuit breaker, stale-while-error
 * fallbacks, a bounded retry policy and a rate limiter. The instrumentation does
 * not add behaviour, it makes behaviour visible.
 */
import { defineMetric } from './metrics';

const PROVIDERS = ['price', 'fundamentals', 'news'] as const;
const RESULTS = ['success', 'error', 'rate_limited', 'rejected'] as const;
const CACHES = ['quote', 'fundamentals', 'news'] as const;
const EVENTS = ['hit', 'miss', 'stale_fallback'] as const;
const FRESHNESS = ['live', 'cached', 'daily_close', 'stale_cache'] as const;
const ENDPOINTS = ['quote', 'metrics', 'news', 'search', 'cron'] as const;

defineMetric({
  name: 'finalysis_http_requests_total',
  help: 'HTTP requests handled, by route and status class.',
  kind: 'counter',
  // Route is a fixed route name, never the URL, so a query string cannot
  // multiply the series count.
  labels: { route: ENDPOINTS, status: ['2xx', '3xx', '4xx', '5xx', 'error'] },
});

defineMetric({
  name: 'finalysis_http_request_duration_seconds_sum',
  help: 'Total time spent handling HTTP requests, by route.',
  kind: 'counter',
  labels: { route: ENDPOINTS },
});

defineMetric({
  name: 'finalysis_upstream_requests_total',
  help: 'Requests to an external data provider, by provider and outcome.',
  kind: 'counter',
  labels: { provider: PROVIDERS, result: RESULTS },
});

defineMetric({
  name: 'finalysis_upstream_duration_seconds_sum',
  help: 'Total time spent waiting on external data providers, by provider.',
  kind: 'counter',
  labels: { provider: PROVIDERS },
});

defineMetric({
  name: 'finalysis_cache_events_total',
  help: 'Cache hits, misses and stale-while-error fallbacks, by cache.',
  kind: 'counter',
  labels: { cache: CACHES, event: EVENTS },
});

defineMetric({
  name: 'finalysis_price_freshness_total',
  help: 'Prices served, by how they were obtained.',
  kind: 'counter',
  // This is the reliability story in one metric: a reader seeing mostly
  // daily_close or stale_cache is looking at a degraded upstream.
  labels: { kind: FRESHNESS },
});

defineMetric({
  name: 'finalysis_circuit_breaker_open',
  help: 'Whether the outbound circuit breaker is open (1) or closed (0).',
  kind: 'gauge',
  labels: { provider: ['price'] },
});

defineMetric({
  name: 'finalysis_rate_limited_total',
  help: 'Requests rejected by the rate limiter, by endpoint.',
  kind: 'counter',
  labels: { endpoint: ENDPOINTS },
});

defineMetric({
  name: 'finalysis_degraded_responses_total',
  help: 'Responses that succeeded but with reduced data, by reason.',
  kind: 'counter',
  labels: {
    reason: ['price_fallback', 'news_unavailable', 'fundamentals_unavailable', 'cron_disabled'],
  },
});