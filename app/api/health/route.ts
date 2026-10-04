/**
 * Liveness.
 *
 * Is this process working at all? It answers from the process alone and must
 * never call a provider, touch Redis, or depend on configuration.
 *
 * That constraint is the whole point. A liveness probe that fails because an
 * upstream provider is down gets the pod killed for being a bystander, and
 * Kubernetes then restarts an entirely healthy process, which turns a degraded
 * upstream into a restart loop.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return Response.json(
    { status: 'ok', uptimeSeconds: Math.round(process.uptime()) },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}