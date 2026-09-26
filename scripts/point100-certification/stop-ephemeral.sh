#!/usr/bin/env bash
set -euo pipefail

# Tear down the Point100 disposable backend (same stack as factory certification).
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
bash "${SCRIPT_DIR}/../factory-certification/stop-ephemeral.sh"
