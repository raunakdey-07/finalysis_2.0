#!/usr/bin/env sh
# Build the production image.
#
# Kept separate from apply.sh so the build can be run on its own, which is what
# CI would do, and so a slow build is visibly a build rather than a deploy.
set -eu

IMAGE="${IMAGE:-finalysis:local}"

# --format docker is not decoration. Podman's default OCI format silently drops
# the HEALTHCHECK instruction, so the image would build and then have no health
# check at all. Docker users get the same behaviour either way.
podman build --format docker -t "${IMAGE}" -f Dockerfile .

echo
podman images "${IMAGE}" --format "{{.Repository}}:{{.Tag}}  {{.Size}}"
echo
echo "Run it:  deploy/scripts/run-local.sh"