#!/usr/bin/env bash
set -euo pipefail

# Buyer-to-Dispatch journey bootstrap (disposable, non-production). Reuses the Point100 Core stack, but the journey
# order is created by a synthetic Buyer through Core's governed checkout, never by a fixture. The Factory fixture's own
# Point38 order (and its forced status) is not used.
: "${POINT100_CORE_REPO:?Set POINT100_CORE_REPO to a local oasis-supabase-core checkout}"
export FACTORY_CERT_CORE_REPO="${POINT100_CORE_REPO}"
export FACTORY_CERT_ALLOW_LOCAL_RESET="${POINT100_ALLOW_LOCAL_RESET:-true}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
P100_DIR="${SCRIPT_DIR}/../point100-certification"
rm -f /tmp/buyer-to-dispatch-journey-ledger.json

FACTORY_CERT_P38_GOVERNED_CHAIN=false bash "${SCRIPT_DIR}/../factory-certification/start-ephemeral.sh"

STATUS_FILE="$(mktemp)"; trap 'rm -f "${STATUS_FILE}"' EXIT
pushd "${POINT100_CORE_REPO}" >/dev/null; supabase status -o env > "${STATUS_FILE}"; popd >/dev/null
# shellcheck disable=SC1090
source "${STATUS_FILE}"
: "${API_URL:?}" "${ANON_KEY:?}" "${SERVICE_ROLE_KEY:?}" "${DB_URL:?}"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../factory-certification/core-authority-mode.sh"
POINT38_CORE_AUTHORITY_MODE="$(core_authority_mode "${POINT100_CORE_REPO}")"
export POINT38_CORE_AUTHORITY_MODE
echo "Journey Core dispatch authority mode: ${POINT38_CORE_AUTHORITY_MODE}"

export FACTORY_CERT_SUPABASE_URL="${API_URL}" FACTORY_CERT_SUPABASE_ANON_KEY="${ANON_KEY}"
export FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}" FACTORY_CERT_LOCAL_DB_URL="${DB_URL}"

POINT100_LOCAL_DB_URL="${DB_URL}" node "${P100_DIR}/restore-canonical-dispatch-authority.mjs"
node "${P100_DIR}/ensure-point38-admin-auth.mjs"
node "${SCRIPT_DIR}/buyer-order-journey.mjs"          # Buyer -> catalogue -> cart -> quote -> checkout -> PI create
node "${P100_DIR}/ensure-point38-pi-issued.mjs"       # Finance issues the PI (AAL2)
POINT38_JOURNEY_GOVERNED_STATUS_PATH=true node "${P100_DIR}/prepare-point38-canonical-exit.mjs"
POINT38_JOURNEY_GOVERNED_STATUS_PATH=true node "${P100_DIR}/finalize-point38-canonical-tail.mjs" # 5 negative probes, Gate release, proof, finalization
node "${SCRIPT_DIR}/verify-buyer-to-dispatch-journey.mjs"
