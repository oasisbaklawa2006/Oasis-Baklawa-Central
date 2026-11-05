#!/usr/bin/env bash
# Prints which dispatch authority the Core checkout under test defines:
#   role-separated  - Core contains 20261001220000_gate_dispatch_role_separation.sql: the independent Security
#                     Gate releases cartons; the Dispatch Manager records the immutable proof and finalizes.
#   pre-separation  - older Core (for example the 30 Sep 2026 Point100 pin): the Gate role performs all three.
# The mode is derived from the checkout, never guessed, and is handed to the Node certification scripts through
# POINT38_CORE_AUTHORITY_MODE so they do not need to open environment-derived file paths themselves.
core_authority_mode() {
  local core_repo="${1:?core_authority_mode requires the Core checkout path}"
  if [[ ! -d "${core_repo}/supabase/migrations" ]]; then
    echo "core_authority_mode: ${core_repo} does not look like oasis-supabase-core" >&2
    return 2
  fi
  if [[ -f "${core_repo}/supabase/migrations/20261001220000_gate_dispatch_role_separation.sql" ]]; then
    echo "role-separated"
  else
    echo "pre-separation"
  fi
}
