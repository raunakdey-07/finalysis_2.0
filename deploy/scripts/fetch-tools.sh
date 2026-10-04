#!/usr/bin/env sh
# Download the local tooling into .tools/ so the repository stays free of a
# system-wide install.
#
# Nothing here needs root, and nothing is installed outside this directory. The
# binaries are the upstream releases, checksummed by the projects themselves.
set -eu

ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)"
TOOLS="${ROOT}/.tools"
mkdir -p "${TOOLS}"

log() { printf '\n== %s\n' "$1"; }

if [ -x "${TOOLS}/kubectl" ]; then
  echo "tooling already present in .tools/, nothing to do"
  exit 0
fi

log "kubectl"
KUBECTL_VERSION="$(curl -fsSL https://dl.k8s.io/release/stable.txt)"
curl -fsSL -o "${TOOLS}/kubectl" \
  "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
chmod +x "${TOOLS}/kubectl"

log "kind"
curl -fsSL -o "${TOOLS}/kind" https://kind.sigs.k8s.io/dl/v0.27.0/kind-linux-amd64
chmod +x "${TOOLS}/kind"

log "helm"
curl -fsSL -o /tmp/helm.tgz https://get.helm.sh/helm-v3.16.4-linux-amd64.tar.gz
tar -xzf /tmp/helm.tgz -C /tmp
mv /tmp/linux-amd64/helm "${TOOLS}/helm"
chmod +x "${TOOLS}/helm"
rm -rf /tmp/linux-amd64 /tmp/helm.tgz

log "terraform"
curl -fsSL -o /tmp/tf.zip \
  https://releases.hashicorp.com/terraform/1.9.8/terraform_1.9.8_linux_amd64.zip
if command -v unzip >/dev/null 2>&1; then
  unzip -oq /tmp/tf.zip -d "${TOOLS}"
else
  # unzip is not always installed. python3's zipfile is, and does the same job.
  python3 -c "import zipfile; zipfile.ZipFile('/tmp/tf.zip').extractall('${TOOLS}')"
fi
chmod +x "${TOOLS}/terraform"
rm -f /tmp/tf.zip

log "Done"
"${TOOLS}/kubectl" version --client
"${TOOLS}/kind" version
"${TOOLS}/helm" version --short
"${TOOLS}/terraform" version | head -1