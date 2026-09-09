#!/usr/bin/env bash
set -euo pipefail

# Final Point100 software recertification boundary after Core #268:
#   - Core main exact SHA b9b690abe166fec1aec547d37c749eda9783fbcb
#   - protected Production Migration Release #165 / run 34346404335
#   - semantic parity + production contract smoke SUCCESS
#
# This runner may use a disposable local database instantiated from that exact
# production-certified Core source, but it must not create or accept shadow Core
# authorities. Physical/device/provider PASS remains outside this software gate.

: "${POINT100_CORE_REPO:?Set POINT100_CORE_REPO to oasis-supabase-core checkout}"

export POINT100_CORE_VERIFIED_SHA="${POINT100_CORE_VERIFIED_SHA:-b9b690abe166fec1aec547d37c749eda9783fbcb}"
export POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID="${POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID:-34346404335}"
export POINT100_PRODUCTION_MIGRATION_RUN_ID="${POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID}"
export POINT100_DISPATCH_PRODUCTION_VERIFIED=true
export POINT100_ALLOW_LOCAL_RESET="${POINT100_ALLOW_LOCAL_RESET:-true}"
export POINT100_ALLOW_DISPOSABLE_BOOTSTRAP=false

if [[ "${POINT100_CORE_VERIFIED_SHA}" != "b9b690abe166fec1aec547d37c749eda9783fbcb" ]]; then
  echo "Refusing Point100 final recert: unexpected Core SHA ${POINT100_CORE_VERIFIED_SHA}" >&2
  exit 1
fi

if [[ "${POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID}" != "34346404335" ]]; then
  echo "Refusing Point100 final recert: unexpected production migration run ${POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID}" >&2
  exit 1
fi

echo "==> Point100 final software recert after Core #268"
echo "    Core SHA: ${POINT100_CORE_VERIFIED_SHA}"
echo "    Production Migration Release run: ${POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID}"
echo "    Disposable shadow bootstrap: ${POINT100_ALLOW_DISPOSABLE_BOOTSTRAP}"

bash "$(dirname "$0")/run-dress-rehearsal.sh"
