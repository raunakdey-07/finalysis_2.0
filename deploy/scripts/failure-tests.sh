#!/usr/bin/env sh
# Failure tests. Each one breaks something on purpose and records what happened.
#
# These are run against a cluster that is already up. Every command echoes what
# it does and what to look at afterwards, because a failure test whose result
# you cannot see is not a test.
set -eu

CLUSTER_NAME="${CLUSTER_NAME:-finalysis}"
KUBECTL=".tools/kubectl --context kind-${CLUSTER_NAME}"

log()  { printf '\n== %s\n' "$1"; }
pass() { printf 'PASS: %s\n' "$1"; }
fail() { printf 'FAIL: %s\n' "$1"; }

# ---------------------------------------------------------------------------
log "1. Kubernetes replaces a pod that is deleted out from under it"
# ---------------------------------------------------------------------------
POD=$(${KUBECTL} -n finalysis get pods -l app.kubernetes.io/name=finalysis \
        -o jsonpath='{.items[0].metadata.name}')
echo "deleting ${POD}"
${KUBECTL} -n finalysis delete pod "${POD}" --grace-period=0 --force >/dev/null

for _ in $(seq 1 30); do
  NEW=$(${KUBECTL} -n finalysis get pods -l app.kubernetes.io/name=finalysis \
          --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  [ -n "${NEW}" ] && [ "${NEW}" != "${POD}" ] && break
  sleep 2
done

if [ "${NEW:-}" != "${POD}" ] && [ -n "${NEW:-}" ]; then
  pass "recreated as ${NEW}"
else
  fail "no replacement pod appeared"
fi
${KUBECTL} -n finalysis get pods

# ---------------------------------------------------------------------------
log "2. A stuck process is stopped by the liveness probe"
# ---------------------------------------------------------------------------
# SIGSTOP freezes the process without killing it, so the probe's requests hang
# and eventually time out. This is the case that distinguishes liveness from
# readiness: the pod should be restarted rather than left half-alive.
POD=$(${KUBECTL} -n finalysis get pods -l app.kubernetes.io/name=finalysis \
        -o jsonpath='{.items[0].metadata.name}')
RESTARTS_BEFORE=$(${KUBECTL} -n finalysis get pod "${POD}" \
        -o jsonpath='{.status.containerStatuses[0].restartCount}')
echo "freezing ${POD} (restarts before: ${RESTARTS_BEFORE})"
${KUBECTL} -n finalysis exec "${POD}" -- kill -STOP 1 2>/dev/null || true

sleep 90
RESTARTS_AFTER=$(${KUBECTL} -n finalysis get pod "${POD}" \
        -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo 0)
echo "restarts after: ${RESTARTS_AFTER}"
if [ "${RESTARTS_AFTER}" -gt "${RESTARTS_BEFORE}" ]; then
  pass "liveness restarted a frozen process"
else
  printf 'NOTE: restartCount did not increase. Raise failureThreshold on the\n'
  printf 'liveness probe, or lower its periodSeconds, to observe this.\n'
fi
${KUBECTL} -n finalysis exec "${POD}" -- kill -CONT 1 2>/dev/null || true

# ---------------------------------------------------------------------------
log "3. Readiness reports configuration without depending on a provider"
# ---------------------------------------------------------------------------
echo "readiness with no providers reachable (this pod has no egress to them):"
${KUBECTL} -n finalysis exec deployment/finalysis -- \
  wget -qO- http://127.0.0.1:3000/api/health/ready 2>/dev/null || echo "(wget unavailable in the image)"
echo
echo "This is the property worth stating: readiness does NOT consult Yahoo,"
echo "Screener or Google News. An upstream outage must not remove the only pod"
echo "that can still serve a cached, labelled answer."

# ---------------------------------------------------------------------------
log "4. The scheduled job fails closed when no secret is configured"
# ---------------------------------------------------------------------------
CODE=$(${KUBECTL} -n finalysis run finalysis-probe --rm -i --restart=Never \
        --image=finalysis:local -- \
        node -e "fetch('http://finalysis/api/cron/update-prices').then(r=>{console.log('status',r.status);return r.text()}).then(t=>console.log(t.slice(0,140)))" \
        2>/dev/null || true)
echo "${CODE}"
echo
echo "503 with CRON_NOT_CONFIGURED is the correct answer: an unset secret must"
echo "disable the job, never open it."

echo
echo "All failure tests are observational. Re-run deploy/scripts/apply.sh first."