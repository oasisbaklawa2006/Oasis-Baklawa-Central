#!/usr/bin/env bash
set -euo pipefail

# One-command Point100 synthetic dress rehearsal — fail-closed, no silent skips.
# Requires: Docker, Supabase CLI, Node 22+, oasis-supabase-core checkout.

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT_DIR}"

: "${POINT100_CORE_REPO:?Set POINT100_CORE_REPO to oasis-supabase-core checkout path}"

echo "==> Point100: bootstrap disposable Core + fixtures"
bash scripts/point100-certification/start-ephemeral.sh

set -a
# shellcheck disable=SC1091
source /tmp/oasis-factory-certification.env
set +a

export FACTORY_CERT_TARGET_URL="${FACTORY_CERT_TARGET_URL:-http://127.0.0.1:4173}"
export FACTORY_CERT_SUPABASE_URL="${FACTORY_CERT_SUPABASE_URL:?missing}"
export FACTORY_CERT_SUPABASE_ANON_KEY="${FACTORY_CERT_SUPABASE_ANON_KEY:?missing}"

echo "==> Point100: build Central against disposable backend"
VITE_SUPABASE_URL="${FACTORY_CERT_SUPABASE_URL}" \
VITE_SUPABASE_ANON_KEY="${FACTORY_CERT_SUPABASE_ANON_KEY}" \
npm run build

echo "==> Point100: serve preview"
PREVIEW_PID=""
cleanup() {
  if [[ -n "${PREVIEW_PID}" ]]; then kill "${PREVIEW_PID}" 2>/dev/null || true; fi
}
trap cleanup EXIT

npm run preview -- --host 127.0.0.1 --port 4173 >/tmp/point100-preview.log 2>&1 &
PREVIEW_PID=$!
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:4173" >/dev/null 2>&1; then break; fi
  sleep 1
done
if ! curl -sf "http://127.0.0.1:4173" >/dev/null 2>&1; then
  echo "Preview server failed to start; see /tmp/point100-preview.log" >&2
  exit 1
fi

echo "==> Point100: run capability matrix + dress rehearsal + negative paths"
npx playwright test -c playwright.point100.config.ts
EXIT_CODE=$?

echo "==> Point100: artifacts"
ls -la point100-*.json 2>/dev/null || true

bash scripts/point100-certification/stop-ephemeral.sh
exit "${EXIT_CODE}"
