#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runLocalPostgresRoleStatement } from "../factory-certification/local-supabase-client.mjs";

const coreRepo = process.env.POINT100_CORE_REPO?.trim();
const dbUrl = process.env.POINT100_LOCAL_DB_URL?.trim();

if (!coreRepo || !dbUrl) {
  throw new Error("Point100 canonical dispatch restore requires POINT100_CORE_REPO and POINT100_LOCAL_DB_URL");
}

const migrationPath = resolve(
  coreRepo,
  "supabase/migrations/20260908020000_macro_dispatch_finalization_authority.sql",
);
const migrationSql = await readFile(migrationPath, "utf8");

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
