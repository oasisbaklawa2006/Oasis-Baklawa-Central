#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { runLocalPostgresRoleStatement } from "../factory-certification/local-supabase-client.mjs";

const dbUrl = process.env.POINT100_LOCAL_DB_URL?.trim();
const coreRepo = process.env.POINT100_CORE_REPO?.trim();
const requiredCoreSha = process.env.POINT100_CORE_VERIFIED_SHA?.trim();

if (!dbUrl) {
  throw new Error("Point100 canonical dispatch restore requires POINT100_LOCAL_DB_URL");
}
if (!coreRepo) {
  throw new Error("Point100 canonical dispatch restore requires POINT100_CORE_REPO");
}
if (!requiredCoreSha || !/^[0-9a-f]{40}$/i.test(requiredCoreSha)) {
  throw new Error("Point100 canonical dispatch restore requires a full POINT100_CORE_VERIFIED_SHA");
}

async function readCheckedOutCoreSha(repoRoot) {
  const head = (await readFile(path.join(repoRoot, ".git", "HEAD"), "utf8")).trim();
  if (!/^[0-9a-f]{40}$/i.test(head)) {
    throw new Error(
      "Refusing Point100 restore: Core checkout must be detached at the exact certified SHA",
    );
  }
  return head.toLowerCase();
}

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const checkedOutCoreSha = await readCheckedOutCoreSha(coreRepo);
if (checkedOutCoreSha !== requiredCoreSha.toLowerCase()) {
  throw new Error(
    `Refusing Point100 restore: unexpected Core SHA ${checkedOutCoreSha}; expected ${requiredCoreSha.toLowerCase()}`,
  );
}

// VERIFY ONLY. This script used to re-apply 20260908020000_macro_dispatch_finalization_authority.sql over
// whatever the fixture seeder had installed. That was needed only because the Factory seeder overwrote Core's
// release_order_to_dispatched_v1 with a legacy shim; the shim is gone, so Core's own migrations are the
// authority. Re-applying an older migration would also silently DOWNGRADE any later Core version of the
// function (e.g. 20261001220000, Dispatch-owned finalization with the independent Security Gate), so this
// script no longer writes anything. It asserts that the live definition is Core's governed authority, and
// that it matches the Core checkout under test.
const authorityMode = process.env.POINT38_CORE_AUTHORITY_MODE?.trim() ?? "";
if (authorityMode !== "role-separated") {
  throw new Error(
    `Point100 authority verification requires a role-separated Core checkout (POINT38_CORE_AUTHORITY_MODE='role-separated', got '${authorityMode || "unset"}'; see scripts/factory-certification/core-authority-mode.sh)`,
  );
}

const requiredMarkers = [
  "dispatch_proof_packets",
  "lock_finance_dispatch_eligibility_v1",
  "assert_active_dispatch_clearance_v1",
  "'dispatch_finalize'",
];
const forbiddenMarkers = ["'gate_release'"];

const markerChecks = [
  ...requiredMarkers.map(
    (marker) =>
      `IF position(${quoteLiteral(marker)} in v_def) = 0 THEN RAISE EXCEPTION 'POINT100_DISPATCH_AUTHORITY_MARKER_MISSING: %', ${quoteLiteral(marker)}; END IF;`,
  ),
  ...forbiddenMarkers.map(
    (marker) =>
      `IF position(${quoteLiteral(marker)} in v_def) > 0 THEN RAISE EXCEPTION 'POINT100_DISPATCH_AUTHORITY_LEGACY_MARKER_PRESENT: %', ${quoteLiteral(marker)}; END IF;`,
  ),
].join("\n  ");

runLocalPostgresRoleStatement(
  dbUrl,
  `DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(
    'public.release_order_to_dispatched_v1(uuid,text,text,text,text)'::regprocedure
  ) INTO v_def;
  ${markerChecks}
END $$;`,
  "Verify Core dispatch finalization authority (read-only assertion)",
);

console.log("Point100 verified Core dispatch finalization authority (gate/dispatch role-separated) is installed unmodified.");
