#!/usr/bin/env bash
set -euo pipefail

# Start/reset a disposable local Supabase stack from the canonical
# oasis-supabase-core repository. Central never copies or owns Core migrations.
# This script is deliberately destructive ONLY to the local Supabase stack and
# therefore requires an explicit reset acknowledgement.

: "${FACTORY_CERT_CORE_REPO:?Set FACTORY_CERT_CORE_REPO to a local oasis-supabase-core checkout}"
: "${FACTORY_CERT_ALLOW_LOCAL_RESET:?Set FACTORY_CERT_ALLOW_LOCAL_RESET=true to permit local db reset}"

if [[ "${FACTORY_CERT_ALLOW_LOCAL_RESET}" != "true" ]]; then
  echo "Refusing local reset: FACTORY_CERT_ALLOW_LOCAL_RESET must be exactly true" >&2
  exit 2
fi

if [[ ! -f "${FACTORY_CERT_CORE_REPO}/supabase/config.toml" ]]; then
  echo "FACTORY_CERT_CORE_REPO does not look like oasis-supabase-core: missing supabase/config.toml" >&2
  exit 2
fi

command -v supabase >/dev/null 2>&1 || { echo "Supabase CLI is required" >&2; exit 2; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required" >&2; exit 2; }

CORE_REPO="$(cd "${FACTORY_CERT_CORE_REPO}" && pwd)"
STATUS_FILE="$(mktemp)"
trap 'rm -f "${STATUS_FILE}"' EXIT

pushd "${CORE_REPO}" >/dev/null

# Match Core's own Migration CI semantics: start performs a zero-state replay,
# and db reset --local proves the complete migration chain again.
supabase start
supabase db reset --local
supabase status -o env > "${STATUS_FILE}"

popd >/dev/null

# shellcheck disable=SC1090
source "${STATUS_FILE}"

: "${API_URL:?Supabase CLI status did not expose API_URL}"
: "${ANON_KEY:?Supabase CLI status did not expose ANON_KEY}"
: "${SERVICE_ROLE_KEY:?Supabase CLI status did not expose SERVICE_ROLE_KEY}"

export FACTORY_CERT_SUPABASE_URL="${API_URL}"
export FACTORY_CERT_SUPABASE_ANON_KEY="${ANON_KEY}"
export FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}"
export FACTORY_CERT_ENVIRONMENT_ID="${FACTORY_CERT_ENVIRONMENT_ID:-factory-cert-local-$(date +%Y%m%d%H%M%S)}"

CREDENTIAL_FILE="${FACTORY_CERT_CREDENTIAL_FILE:-/tmp/oasis-factory-certification.env}"
export FACTORY_CERT_CREDENTIAL_FILE="${CREDENTIAL_FILE}"

# Bootstrap disposable identities and deterministic non-commercial Factory
# fixtures only after the canonical Core replay is complete. Both scripts
# reject every non-loopback backend before using service_role.
node "$(dirname "$0")/create-test-identities.mjs"
node "$(dirname "$0")/seed-production-fixtures.mjs"

cat <<EOF
Factory certification local backend is ready.

Source of schema authority:
  ${CORE_REPO}

Export these NON-SECRET values in the shell that runs Central/Playwright:
  export FACTORY_CERT_TARGET_URL=http://127.0.0.1:4173
  export FACTORY_CERT_SUPABASE_URL=${API_URL}
  export FACTORY_CERT_SUPABASE_ANON_KEY=${ANON_KEY}
  export FACTORY_CERT_ENVIRONMENT_ID=${FACTORY_CERT_ENVIRONMENT_ID}

Role credentials were written with chmod 600 to:
  ${CREDENTIAL_FILE}

Load them only into the disposable certification shell:
  set -a
  source "${CREDENTIAL_FILE}"
  set +a

Deterministic Production fixtures include the controlled Arabic short ID
E3ED28B0 plus one open job for each other Production TV group.

The local service-role key was used only to bootstrap disposable identities and
fixtures and was NOT written to the credential file.
EOF
