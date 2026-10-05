#!/usr/bin/env sh
# Create the local kind cluster and load Fin-alysis into it.
#
# One cluster, one node. A single node is enough to demonstrate probes, rolling
# updates, resource limits and self-healing, and it keeps a 16 GB laptop from
# spending most of its memory on a control plane nobody is reading.
#
# Every step is idempotent, so running this twice is safe.
set -eu

CLUSTER_NAME="${CLUSTER_NAME:-finalysis}"
IMAGE="${IMAGE:-finalysis:local}"
NODE_IMAGE="${KIND_NODE_IMAGE:-kindest/node:v1.34.0}"

log() { printf '\n== %s\n' "$1"; }

log "Creating kind cluster ${CLUSTER_NAME}"
if .tools/kind get clusters 2>/dev/null | grep -qx "${CLUSTER_NAME}"; then
  echo "cluster already exists, leaving it alone"
else
  # The node image is pinned so a future kind release cannot silently change
  # the Kubernetes version under a demonstration.
  .tools/kind create cluster \
    --name "${CLUSTER_NAME}" \
    --image "${NODE_IMAGE}" \
    --wait 120s
fi

# kind reads the container runtime's image store. `kind load` copies the image
# into the node so no registry is ever needed and nothing has to be public.
log "Loading ${IMAGE} into the cluster"
.tools/kind load docker-image "${IMAGE}" --name "${CLUSTER_NAME}"

log "Cluster is ready"
.tools/kubectl --context "kind-${CLUSTER_NAME}" get nodes -o wide
echo
echo "Deploy with: deploy/scripts/apply.sh"
echo "Then forward a port:  kubectl -n finalysis port-forward svc/finalysis 8080:80"