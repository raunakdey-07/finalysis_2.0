#!/usr/bin/env sh
# Start Prometheus and Grafana from their OSS container images.
#
# Both are the upstream open-source images, not a hosted service. Nothing here
# needs an account, a trial or an API key.
#
# Prometheus scrapes Finalysis through the same kind Service the dashboard uses,
# so this works whether Finalysis is in the cluster or running as a container on
# the host. The only difference is the target in the config.
set -eu

CLUSTER_NAME="${CLUSTER_NAME:-finalysis}"
NAMESPACE="${NAMESPACE:-finalysis}"
PROMETHEUS_PORT="${PROMETHEUS_PORT:-9090}"
GRAFANA_PORT="${GRAFANA_PORT:-3001}"
KIND_IP="$(.tools/kind get nodes --name "${CLUSTER_NAME}" -o jsonpath='{.items[0].status.addresses[0].address}' 2>/dev/null || echo '')"

log() { printf '\n== %s\n' "$1"; }

TARGET="${PROMETHEUS_TARGET:-}"
if [ -z "${TARGET}" ]; then
  if [ -n "${KIND_IP}" ]; then
    TARGET="finalysis.${NAMESPACE}.svc.cluster.local:80"
  else
    # No cluster, so Finalysis is running as a container on the host and
    # Prometheus needs to be given the HOST's address, not its own.
    #
    # This was a real bug and the scrape was silently down because of it: a
    # container's 127.0.0.1 is its own loopback, so `127.0.0.1:3500` resolves
    # to Prometheus itself and every scrape fails. `host.containers.internal`
    # is the host as seen from inside a container on Podman and Docker alike.
    #
    # Overridable, because a user may have already published Finalysis
    # somewhere reachable and this should not be the only way to say so.
    HOST_PUBLISHED_PORT="${HOST_PUBLISHED_PORT:-3500}"
    TARGET="${PROMETHEUS_HOST:-host.containers.internal}:${HOST_PUBLISHED_PORT}"
  fi
fi
echo "scraping ${TARGET}"

log "Starting Prometheus"
podman rm -f prometheus >/dev/null 2>&1 || true
# Rendered with the target substituted, so the committed config stays the
# in-cluster one and the local override is visible in one place.
sed "s|finalysis.${NAMESPACE}.svc.cluster.local:80|${TARGET}|" \
  deploy/monitoring/prometheus.yml > /tmp/prometheus.local.yml

podman run -d --name prometheus \
  --security-opt label=disable \
  -p "${PROMETHEUS_PORT}:9090" \
  -v /tmp/prometheus.local.yml:/etc/prometheus/prometheus.yml:ro \
  docker.io/prom/prometheus:v3.5.0 \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.retention.time=6h >/dev/null

log "Starting Grafana"
podman rm -f grafana >/dev/null 2>&1 || true
mkdir -p /tmp/grafana-provisioning/datasources

# Grafana has to reach Prometheus at an address that actually resolves.
#
# This was the second real bug the verification pass found, and it is the same
# mistake as the scrape target: the committed configuration names the in-cluster
# Service, `http://prometheus:9090`, which resolves under Kubernetes and nowhere
# else. Run both as plain containers and Grafana failed with
# `dial tcp: lookup prometheus ... no such host`, and every dashboard panel
# showed "No data" while Grafana itself reported no error at all.
#
# So the URL is chosen the same way the scrape target is: the in-cluster Service
# when there is a cluster, and the host as seen from inside a container when
# there is not.
GRAFANA_PROM_URL="${GRAFANA_PROM_URL:-}"
if [ -z "${GRAFANA_PROM_URL}" ]; then
  if [ -n "${KIND_IP}" ]; then
    GRAFANA_PROM_URL="http://prometheus.${NAMESPACE}.svc.cluster.local:9090"
  else
    GRAFANA_PROM_URL="http://host.containers.internal:${PROMETHEUS_PORT}"
  fi
fi
echo "grafana datasource: ${GRAFANA_PROM_URL}"

# Anonymous admin access is the Grafana OSS default and is fine here: the
# container is published on localhost only and holds no data worth protecting.
# This is NOT a configuration to copy onto a real deployment.
cat > /tmp/grafana-provisioning/datasources/prometheus.yaml <<EOF
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: ${GRAFANA_PROM_URL}
    isDefault: true
    editable: false
EOF
mkdir -p /tmp/grafana-provisioning/dashboards
cat > /tmp/grafana-provisioning/dashboards/dashboards.yaml <<EOF
apiVersion: 1
providers:
  - name: finalysis
    folder: Finalysis
    type: file
    options:
      path: /var/lib/grafana/dashboards
EOF
mkdir -p /tmp/grafana-dashboards
cp deploy/monitoring/finalysis-dashboard.json /tmp/grafana-dashboards/

podman run -d --name grafana \
  --security-opt label=disable \
  -p "${GRAFANA_PORT}:3000" \
  -e GF_AUTH_ANONYMOUS_ENABLED=true \
  -e GF_AUTH_ANONYMOUS_ORG_ROLE=Admin \
  -v /tmp/grafana-provisioning/datasources:/etc/grafana/provisioning/datasources:ro \
  -v /tmp/grafana-provisioning/dashboards:/etc/grafana/provisioning/dashboards:ro \
  -v /tmp/grafana-dashboards:/var/lib/grafana/dashboards:ro \
  docker.io/grafana/grafana:12.1.0 >/dev/null

echo
echo "Prometheus   http://localhost:${PROMETHEUS_PORT}"
echo "Grafana      http://localhost:${GRAFANA_PORT}   (anonymous admin)"
echo "Dashboard    provisioned automatically under the Finalysis folder"
echo
echo "Stop with:   podman rm -f prometheus grafana"