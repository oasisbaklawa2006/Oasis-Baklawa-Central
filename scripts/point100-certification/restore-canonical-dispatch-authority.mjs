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
  const gitDir = path.join(repoRoot, ".git");
  const head = (await readFile(path.join(gitDir, "HEAD"), "utf8")).trim();
  if (/^[0-9a-f]{40}$/i.test(head)) return head.toLowerCase();

  const match = /^ref:\s+(refs\/[A-Za-z0-9._\/-]+)$/.exec(head);
  if (!match || match[1].includes("..")) {
    throw new Error("Refusing Point100 restore: unable to resolve Core checkout HEAD");
  }
  const refName = match[1];
  try {
    const loose = (await readFile(path.join(gitDir, refName), "utf8")).trim();
    if (/^[0-9a-f]{40}$/i.test(loose)) return loose.toLowerCase();
  } catch {
    // fall through to packed-refs
  }
  const packed = await readFile(path.join(gitDir, "packed-refs"), "utf8");
  const row = packed
    .split(/\r?\n/)
    .find((line) => line.endsWith(` ${refName}`) && /^[0-9a-f]{40}\s/.test(line));
  const sha = row?.split(/\s+/)[0] ?? "";
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error("Refusing Point100 restore: Core checkout ref is not resolvable");
  }
  return sha.toLowerCase();
}

const checkedOutCoreSha = await readCheckedOutCoreSha(coreRepo);
if (checkedOutCoreSha !== requiredCoreSha.toLowerCase()) {
  throw new Error(
    `Refusing Point100 restore: unexpected Core SHA ${checkedOutCoreSha}; expected ${requiredCoreSha.toLowerCase()}`,
  );
}

const canonicalDispatchMigrationPath = path.join(
  coreRepo,
  "supabase/migrations/20260908020000_macro_dispatch_finalization_authority.sql",
);

const migrationSql = await readFile(canonicalDispatchMigrationPath, "utf8");

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
