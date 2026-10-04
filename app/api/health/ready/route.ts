/**
 * Readiness.
 *
 * Should this process receive traffic right now? Readiness controls routing, so
 * this reports which optional pieces of configuration are present and checks
 * nothing external at all.
 *
 * It deliberately does not check Yahoo, Screener or Google News. Those providers
 * go down, and when they do the application can still serve a cached price, a
 * cached figure and cached headlines while saying plainly how old they are.
 * Failing readiness on an upstream outage would remove the pod from the service
 * precisely when a degraded answer was still available, turning a partial
 * outage into a total one.
 *
 * Missing optional configuration is reported but does not fail the probe. The
 * application already runs without Redis and without a cron secret, and a probe
 * that disagreed with that would flap on every restart.
 */
import { isRedisConfigured } from '@/lib/nse/daily-prices';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return Response.json(
    {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      configuration: {
        redis: isRedisConfigured() ? 'configured' : 'absent',
        cronSecret: process.env.CRON_SECRET ? 'configured' : 'absent',
      },
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}