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

cat <<EOF

Point100 dress rehearsal backend is ready (factory certification stack reused).

Load disposable credentials:
  set -a
  source /tmp/oasis-factory-certification.env
  set +a

Run the full dress rehearsal (fail-closed, no silent skips):
  export POINT100_ALLOW_DISPOSABLE_BOOTSTRAP=true
  npm run test:point100

Capability matrix only:
  npx playwright test -c playwright.point100.config.ts tests/point100/capability-matrix.cert.spec.ts
EOF
