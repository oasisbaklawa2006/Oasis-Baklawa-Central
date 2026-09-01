#!/usr/bin/env bash
set -euo pipefail

: "${BUYER_CERT_CORE_REPO:?Set BUYER_CERT_CORE_REPO to a local oasis-supabase-core checkout}"

CREDENTIAL_FILE="/tmp/oasis-buyer-certification.env"
CORE_REPO="$(cd "${BUYER_CERT_CORE_REPO}" && pwd)"
pushd "${CORE_REPO}" >/dev/null
supabase stop --no-backup
popd >/dev/null

rm -f "${CREDENTIAL_FILE}"

echo "Disposable Buyer certification Core database destroyed without backup."
