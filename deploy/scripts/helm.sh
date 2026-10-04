#!/usr/bin/env sh
# Install or upgrade Finalysis from the local Helm chart.
#
#   deploy/scripts/helm.sh                 # install with defaults
#   deploy/scripts/helm.sh --set replicaCount=3
#
# The chart is installed from a local path, so there is no repository to add and
# nothing to authenticate against.
set -eu

CLUSTER_NAME="${CLUSTER_NAME:-finalysis}"
RELEASE="${RELEASE:-finalysis}"
NAMESPACE="${NAMESPACE:-finalysis}"
IMAGE="${IMAGE:-finalysis:local}"
HELM=".tools/helm"
KUBECTL=".tools/kubectl --context kind-${CLUSTER_NAME}"

REPOSITORY="${IMAGE%:*}"
TAG="${IMAGE##*:}"

log() { printf '\n== %s\n' "$1"; }

log "Ensuring the namespace exists"
${KUBECTL} get namespace "${NAMESPACE}" >/dev/null 2>&1 || \
  ${KUBECTL} create namespace "${NAMESPACE}"

if ! ${HELM} status "${RELEASE}" -n "${NAMESPACE}" >/dev/null 2>&1; then
  ACTION=install
else
  ACTION=upgrade
fi

log "helm ${ACTION}"
${HELM} ${ACTION} "${RELEASE}" \
  deploy/helm/finalysis \
  --namespace "${NAMESPACE}" \
  --install \
  --atomic \
  --timeout 5m \
  --set image.repository="${REPOSITORY}" \
  --set image.tag="${TAG}" \
  "$@"

log "Result"
${HELM} list -n "${NAMESPACE}"
${KUBECTL} -n "${NAMESPACE}" get pods

echo
echo "Uninstall with: ${HELM} uninstall ${RELEASE} -n ${NAMESPACE}"