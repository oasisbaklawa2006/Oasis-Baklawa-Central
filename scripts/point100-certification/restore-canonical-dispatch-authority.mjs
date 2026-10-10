#!/usr/bin/env node
import { execFileSync } from "node:child_process";
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

const checkedOutCoreSha = await readCheckedOutCoreSha(coreRepo);
if (checkedOutCoreSha !== requiredCoreSha.toLowerCase()) {
  throw new Error(
    `Refusing Point100 restore: unexpected Core SHA ${checkedOutCoreSha}; expected ${requiredCoreSha.toLowerCase()}`,
  );
}

const canonicalDispatchMigrationRelative =
  "supabase/migrations/20260908020000_macro_dispatch_finalization_authority.sql";

// Read the migration from the exact certified commit object rather than the
// working tree. A dirty or locally edited checkout must never alter Point100
// authority while still presenting the certified HEAD.
const migrationSql = execFileSync(
  "git",
  ["-C", coreRepo, "show", `${requiredCoreSha}:${canonicalDispatchMigrationRelative}`],
  { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);

for (const marker of [
  "dispatch_proof_packets",
  "lock_finance_dispatch_eligibility_v1",
  "finance_dispatch_clearance_required",
]) {
  if (!migrationSql.includes(marker)) {
    throw new Error(`Refusing Point100 restore: canonical #260 migration missing marker ${marker}`);
  }
}

runLocalPostgresRoleStatement(
  dbUrl,
  migrationSql,
  "Restore canonical Core #260 dispatch authority after legacy fixture bootstrap",
);

runLocalPostgresRoleStatement(
  dbUrl,
  `DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(
    'public.release_order_to_dispatched_v1(uuid,text,text,text,text)'::regprocedure
  ) INTO v_def;
  IF position('dispatch_proof_packets' in v_def) = 0
     OR position('lock_finance_dispatch_eligibility_v1' in v_def) = 0
     OR position('assert_active_dispatch_clearance_v1' in v_def) = 0 THEN
    RAISE EXCEPTION 'POINT100_CANONICAL_DISPATCH_AUTHORITY_NOT_RESTORED';
  END IF;
END $$;`,
  "Verify canonical Core #260 dispatch authority",
);

console.log("Point100 verified canonical Core #260 dispatch authority after fixture seeding.");
