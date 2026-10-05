#!/usr/bin/env sh
# Run Fin-alysis as a plain container, with no cluster.
#
# This is the smallest thing that proves the image works, and it is what to use
# when the point is the application rather than the orchestration.
set -eu

IMAGE="${IMAGE:-finalysis:local}"
PORT="${PORT:-3500}"

# The same hardening the Deployment sets, so running this is a fair test of the
# image rather than a more permissive one.
podman rm -f finalysis >/dev/null 2>&1 || true
mkdir -p /tmp/finalysis-cache

podman run -d --name finalysis \
  --read-only \
  --user 1000:1000 \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --security-opt label=disable \
  -v /tmp/finalysis-cache:/app/.next/cache \
  -p "${PORT}:3000" \
  "${IMAGE}" >/dev/null

echo "waiting for the container to answer"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo
echo "  app       http://localhost:${PORT}"
echo "  liveness  http://localhost:${PORT}/api/health"
echo "  readiness http://localhost:${PORT}/api/health/ready"
echo "  metrics   http://localhost:${PORT}/api/telemetry"
echo
echo "logs:    podman logs -f finalysis"
echo "stop:    podman rm -f finalysis"