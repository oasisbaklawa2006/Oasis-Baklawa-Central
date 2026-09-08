#!/usr/bin/env bash
set -euo pipefail

# Re-run Point100 exact-head recertification after Core #260 is:
#   1. review-clean and independently approved
#   2. merged to Core main
#   3. protected-deployed via Production Migration Release
#   4. semantic parity + production contract smoke SUCCESS
#
# Mission Control must supply the new certified boundary before running.

: "${POINT100_CORE_REPO:?Set POINT100_CORE_REPO to oasis-supabase-core checkout}"
: "${POINT100_CORE_VERIFIED_SHA:?Set POINT100_CORE_VERIFIED_SHA to the post-#260 production-certified Core SHA}"
: "${POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID:?Set POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID to the Production Migration Release run id}"

export POINT100_DISPATCH_PRODUCTION_VERIFIED=true
export POINT100_PRODUCTION_MIGRATION_RUN_ID="${POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID}"
export POINT100_ALLOW_LOCAL_RESET="${POINT100_ALLOW_LOCAL_RESET:-true}"
export POINT100_ALLOW_DISPOSABLE_BOOTSTRAP="${POINT100_ALLOW_DISPOSABLE_BOOTSTRAP:-true}"

echo "==> Point100 recert after Core #260"
echo "    Core SHA: ${POINT100_CORE_VERIFIED_SHA}"
echo "    Migration run: ${POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID}"

bash "$(dirname "$0")/run-dress-rehearsal.sh"
