#!/usr/bin/env bash
set -euo pipefail

: "${BUYER_CERT_CORE_REPO:?Set BUYER_CERT_CORE_REPO to a local oasis-supabase-core checkout}"

CREDENTIAL_FILE="/tmp/oasis-buyer-certification.env"
CORE_REPO="$(cd "${BUYER_CERT_CORE_REPO}" && pwd)"
pushd "${CORE_REPO}" >/dev/null
supabase stop --no-backup
popd >/dev/null

if [[ -f "${CREDENTIAL_FILE}" ]]; then
  rm -f "${CREDENTIAL_FILE}"
  echo "Removed disposable Buyer credential export at ${CREDENTIAL_FILE}."
fi

echo "Disposable Buyer certification Core database destroyed without backup."
