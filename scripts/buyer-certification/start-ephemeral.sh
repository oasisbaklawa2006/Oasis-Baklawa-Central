#!/usr/bin/env bash
set -euo pipefail

# Start/reset a disposable local Supabase stack and seed one synthetic Buyer
# fixture for APP-E2E Tranche 5 golden-path certification. Central never owns
# Core migrations; this script only replays canonical Core locally.

: "${BUYER_CERT_CORE_REPO:?Set BUYER_CERT_CORE_REPO to a local oasis-supabase-core checkout}"
: "${BUYER_CERT_ALLOW_LOCAL_RESET:?Set BUYER_CERT_ALLOW_LOCAL_RESET=true to permit local db reset}"

if [[ "${BUYER_CERT_ALLOW_LOCAL_RESET}" != "true" ]]; then
  echo "Refusing local reset: BUYER_CERT_ALLOW_LOCAL_RESET must be exactly true" >&2
  exit 2
fi

if [[ ! -f "${BUYER_CERT_CORE_REPO}/supabase/config.toml" ]]; then
  echo "BUYER_CERT_CORE_REPO does not look like oasis-supabase-core: missing supabase/config.toml" >&2
  exit 2
fi

command -v supabase >/dev/null 2>&1 || { echo "Supabase CLI is required" >&2; exit 2; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required" >&2; exit 2; }

CORE_REPO="$(cd "${BUYER_CERT_CORE_REPO}" && pwd)"
STATUS_FILE="$(mktemp)"
trap 'rm -f "${STATUS_FILE}"' EXIT

pushd "${CORE_REPO}" >/dev/null
supabase start
supabase db reset --local
supabase status -o env > "${STATUS_FILE}"
popd >/dev/null

# shellcheck disable=SC1090
source "${STATUS_FILE}"

: "${API_URL:?Supabase CLI status did not expose API_URL}"
: "${ANON_KEY:?Supabase CLI status did not expose ANON_KEY}"
: "${SERVICE_ROLE_KEY:?Supabase CLI status did not expose SERVICE_ROLE_KEY}"

export BUYER_CERT_SUPABASE_URL="${API_URL}"
export BUYER_CERT_SUPABASE_ANON_KEY="${ANON_KEY}"
export BUYER_CERT_LOCAL_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}"
export BUYER_CERT_CORE_REPO="${CORE_REPO}"
export BUYER_CERT_ENVIRONMENT_ID="${BUYER_CERT_ENVIRONMENT_ID:-buyer-cert-local-$(date +%Y%m%d%H%M%S)}"

CREDENTIAL_FILE="/tmp/oasis-buyer-certification.env"
if [[ -n "${BUYER_CERT_CREDENTIAL_FILE:-}" && "${BUYER_CERT_CREDENTIAL_FILE}" != "${CREDENTIAL_FILE}" ]]; then
  echo "Refusing alternate BUYER_CERT_CREDENTIAL_FILE; certification credentials must stay at ${CREDENTIAL_FILE}" >&2
  exit 2
fi
export BUYER_CERT_CREDENTIAL_FILE="${CREDENTIAL_FILE}"

node "$(dirname "$0")/seed-synthetic-buyer.mjs"

cat <<EOF
Buyer certification local backend is ready.

Source of schema authority:
  ${CORE_REPO}

Export these NON-SECRET values in the shell that runs Central/Playwright:
  export TEST_PREVIEW_URL=http://127.0.0.1:4173
  export BUYER_CERT_SUPABASE_URL=${API_URL}
  export BUYER_CERT_SUPABASE_ANON_KEY=${ANON_KEY}
  export BUYER_CERT_ENVIRONMENT_ID=${BUYER_CERT_ENVIRONMENT_ID}

Synthetic Buyer credentials were written with chmod 600 to:
  ${CREDENTIAL_FILE}

Load them only into the disposable certification shell:
  set -a
  source "${CREDENTIAL_FILE}"
  set +a

The local service-role key was used only to bootstrap the synthetic fixture and
was NOT written to the credential file.
EOF
