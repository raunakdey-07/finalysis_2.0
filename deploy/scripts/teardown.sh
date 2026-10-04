#!/usr/bin/env sh
# Tear the local environment down.
#
# Removes the Helm release, the applied manifests, the containers and the kind
# cluster. Nothing here reaches a network or an account.
set -eu

CLUSTER_NAME="${CLUSTER_NAME:-finalysis}"
NAMESPACE="${NAMESPACE:-finalysis}"
HELM=".tools/helm"
KUBECTL=".tools/kubectl --context kind-${CLUSTER_NAME}"

log() { printf '\n== %s\n' "$1"; }

if ! .tools/kind get clusters 2>/dev/null | grep -qx "${CLUSTER_NAME}"; then
  echo "no cluster named ${CLUSTER_NAME}, nothing to do"
  exit 0
fi

log "Removing the Helm release"
${HELM} uninstall finalysis -n "${NAMESPACE}" 2>/dev/null || echo "no helm release found"

log "Deleting anything applied directly from deploy/kubernetes"
${KUBECTL} delete -f deploy/kubernetes/ --ignore-not-found 2>/dev/null || true

log "Deleting the namespace"
${KUBECTL} delete namespace "${NAMESPACE}" --ignore-not-found --wait=false 2>/dev/null || true

log "Removing the kind cluster"
.tools/kind delete cluster --name "${CLUSTER_NAME}"

log "Removing local containers"
podman rm -f finalysis prometheus grafana 2>/dev/null || true

echo
echo "Everything local is gone. Nothing outside this machine was ever created."