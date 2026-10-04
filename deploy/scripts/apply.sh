#!/usr/bin/env sh
# Build the image and apply the raw Kubernetes manifests.
#
# This is the "what is actually in the manifests" path. deploy/scripts/helm.sh
# installs the same application through the chart instead.
set -eu

CLUSTER_NAME="${CLUSTER_NAME:-finalysis}"
IMAGE="${IMAGE:-finalysis:local}"
KUBECTL=".tools/kubectl --context kind-${CLUSTER_NAME}"

log() { printf '\n== %s\n' "$1"; }

log "Building ${IMAGE}"
# --format docker keeps the image in Docker format so the HEALTHCHECK in the
# Dockerfile survives. The OCI default drops it.
podman build --format docker -t "${IMAGE}" -f Dockerfile .

log "Creating or reusing the kind cluster"
if ! .tools/kind get clusters 2>/dev/null | grep -qx "${CLUSTER_NAME}"; then
  deploy/scripts/cluster-up.sh
fi

log "Applying manifests"
# 30-secret.example.yaml is applied too: it contains empty values, which is
# exactly the "run without any secret configured" case the Deployment supports
# through optional secretKeyRefs. A real secret would be created separately and
# would not be committed.
${KUBECTL} apply -f deploy/kubernetes/

log "Waiting for rollout"
${KUBECTL} -n finalysis rollout status deployment/finalysis --timeout=180s

log "State"
${KUBECTL} -n finalysis get pods -o wide
${KUBECTL} -n finalysis get svc

echo
echo "View it:  ${KUBECTL} -n finalysis port-forward svc/finalysis 8080:80"
echo "Follow:   ${KUBECTL} -n finalysis logs -f deployment/finalysis"