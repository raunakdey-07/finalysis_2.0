/**
 * Prometheus metrics.
 *
 * Deliberately not `/api/metrics`, which is the company-data API the page
 * itself calls.
 *
 * This exposes counters about this process and nothing else. There is no ticker,
 * no company name and no user input anywhere in the response: a metrics endpoint
 * that can be induced to emit arbitrary label values is a way to take a site
 * down, which is why the registry in lib/observability refuses an undeclared
 * label combination rather than creating a new time series for it.
 */
import { render } from '@/lib/observability/metrics';
import '@/lib/observability/definitions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return new Response(render(), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}