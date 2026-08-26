#!/usr/bin/env bash
set -euo pipefail

: "${FACTORY_CERT_CORE_REPO:?Set FACTORY_CERT_CORE_REPO to the local oasis-supabase-core checkout}"
: "${FACTORY_CERT_ALLOW_LOCAL_RESET:?Set FACTORY_CERT_ALLOW_LOCAL_RESET=true to permit local teardown}"

if [[ "${FACTORY_CERT_ALLOW_LOCAL_RESET}" != "true" ]]; then
  echo "Refusing local teardown: FACTORY_CERT_ALLOW_LOCAL_RESET must be exactly true" >&2
  exit 2
fi

if [[ ! -f "${FACTORY_CERT_CORE_REPO}/supabase/config.toml" ]]; then
  echo "FACTORY_CERT_CORE_REPO does not look like oasis-supabase-core" >&2
  exit 2
fi

pushd "${FACTORY_CERT_CORE_REPO}" >/dev/null
supabase stop --no-backup
popd >/dev/null

echo "Disposable Factory certification Supabase stack stopped without backup."
