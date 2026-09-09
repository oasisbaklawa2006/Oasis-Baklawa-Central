#!/usr/bin/env bash
set -euo pipefail

# Point100 dress rehearsal bootstrap — reuses the canonical factory certification
# disposable Core stack (identities, golden order, Point37/38 fixtures).
# Central never owns Core migrations.

: "${POINT100_CORE_REPO:?Set POINT100_CORE_REPO to a local oasis-supabase-core checkout}"

export FACTORY_CERT_CORE_REPO="${POINT100_CORE_REPO}"
export FACTORY_CERT_ALLOW_LOCAL_RESET="${POINT100_ALLOW_LOCAL_RESET:-true}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
bash "${SCRIPT_DIR}/../factory-certification/start-ephemeral.sh"

# The shared factory fixture seeder still contains a legacy Point-38 disposable
# release_order_to_dispatched_v1 shim for older certification lanes. Final
# Point100 recertification must never certify that substitute. Reapply the exact
# production-certified #260 migration after fixture seeding and verify its live
# function definition before any Point100 probe runs.
if [[ "${POINT100_ALLOW_DISPOSABLE_BOOTSTRAP:-false}" != "true" ]]; then
  STATUS_FILE="$(mktemp)"
  trap 'rm -f "${STATUS_FILE}"' EXIT
  pushd "${POINT100_CORE_REPO}" >/dev/null
  supabase status -o env > "${STATUS_FILE}"
  popd >/dev/null
  # shellcheck disable=SC1090
  source "${STATUS_FILE}"
  : "${DB_URL:?Supabase CLI status did not expose DB_URL}"
  POINT100_LOCAL_DB_URL="${DB_URL}" \
    node "${SCRIPT_DIR}/restore-canonical-dispatch-authority.mjs"
fi

cat <<EOF

Point100 dress rehearsal backend is ready (factory certification stack reused).

Load disposable credentials:
  set -a
  source /tmp/oasis-factory-certification.env
  set +a

Run the full dress rehearsal (fail-closed, no silent skips):
  export POINT100_ALLOW_DISPOSABLE_BOOTSTRAP=${POINT100_ALLOW_DISPOSABLE_BOOTSTRAP:-false}
  npm run test:point100

Capability matrix only:
  npx playwright test -c playwright.point100.config.ts tests/point100/capability-matrix.cert.spec.ts
EOF
