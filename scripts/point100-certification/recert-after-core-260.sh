#!/usr/bin/env bash
set -euo pipefail

# Final Point100 software recertification boundary after Core #268:
#   - Core main exact SHA 1503d6c5f0dcc04890190e00587fcdbf9abb5b20
#   - protected Production Migration Release #180 / run 34653753066
#   - semantic parity + production contract smoke SUCCESS
#
# This runner may use a disposable local database instantiated from that exact
# production-certified Core source, but it must not create or accept shadow Core
# authorities. Physical/device/provider PASS remains outside this software gate.

: "${POINT100_CORE_REPO:?Set POINT100_CORE_REPO to oasis-supabase-core checkout}"

export POINT100_CORE_VERIFIED_SHA="${POINT100_CORE_VERIFIED_SHA:-1503d6c5f0dcc04890190e00587fcdbf9abb5b20}"
export POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID="${POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID:-34653753066}"
export POINT100_PRODUCTION_MIGRATION_RUN_ID="${POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID}"
export POINT100_DISPATCH_PRODUCTION_VERIFIED=true
export POINT100_ALLOW_LOCAL_RESET="${POINT100_ALLOW_LOCAL_RESET:-true}"
export POINT100_ALLOW_DISPOSABLE_BOOTSTRAP=false

if [[ "${POINT100_CORE_VERIFIED_SHA}" != "1503d6c5f0dcc04890190e00587fcdbf9abb5b20" ]]; then
  echo "Refusing Point100 final recert: unexpected Core SHA ${POINT100_CORE_VERIFIED_SHA}" >&2
  exit 1
fi

if [[ "${POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID}" != "34653753066" ]]; then
  echo "Refusing Point100 final recert: unexpected production migration run ${POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID}" >&2
  exit 1
fi

echo "==> Point100 final software recert after Core #268"
echo "    Core SHA: ${POINT100_CORE_VERIFIED_SHA}"
echo "    Production Migration Release run: ${POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID}"
echo "    Disposable shadow bootstrap: ${POINT100_ALLOW_DISPOSABLE_BOOTSTRAP}"

bash "$(dirname "$0")/run-dress-rehearsal.sh"
