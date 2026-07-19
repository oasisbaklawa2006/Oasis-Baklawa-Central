#!/usr/bin/env bash
set -euo pipefail

: "${UAT_DATABASE_URL:?Set UAT_DATABASE_URL to an isolated non-production PostgreSQL database}"
: "${UAT_DATABASE_CONFIRM:?Set UAT_DATABASE_CONFIRM=ISSUE_232_ISOLATED_READ_ONLY}"

if [[ "${UAT_DATABASE_CONFIRM}" != "ISSUE_232_ISOLATED_READ_ONLY" ]]; then
  echo "Refusing to run: UAT_DATABASE_CONFIRM must equal ISSUE_232_ISOLATED_READ_ONLY" >&2
  exit 2
fi

if [[ "${UAT_DATABASE_URL}" == *"tcxvcatsqqertcnycuop"* ]]; then
  echo "Refusing to run against the known production Supabase project" >&2
  exit 3
fi

command -v psql >/dev/null 2>&1 || {
  echo "psql is required" >&2
  exit 4
}

export PGOPTIONS="${PGOPTIONS:-} -c statement_timeout=30000 -c lock_timeout=3000"

psql "${UAT_DATABASE_URL}" \
  --no-psqlrc \
  --set=ON_ERROR_STOP=1 \
  --set=VERBOSITY=verbose \
  --file=supabase/uat/wa_zero_loss_issue_232_preflight.sql
