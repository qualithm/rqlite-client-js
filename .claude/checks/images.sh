#!/usr/bin/env bash
# Hold the repo's image pins to the vendored dx registry, as CI's Detect Changes
# job does. A repo with no vendored registry references no container image.
set -eo pipefail
if [ ! -f .github/images/images.config ]; then
  exit 0
fi
.github/images/images check --config .github/images/images.config .
