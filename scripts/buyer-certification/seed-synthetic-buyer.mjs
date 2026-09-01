#!/usr/bin/env node
/**
 * Bootstrap one clearly marked synthetic Buyer identity and governed catalogue
 * fixtures into a disposable local Core replay. Service-role is used only during
 * local bootstrap and never written to the credential export file.
 */
import { randomBytes } from "node:crypto";
import { chmod, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertNoSupabaseError,
  createLocalSupabaseAdminClient,
} from "./local-supabase-client.mjs";

const BUYER_ID = "30000000-0000-4000-8000-000000000010";
const BUYER_EMAIL = "synthetic.buyer.cert@oasis-disposable.test";
const OUTPUT_FILE = "/tmp/oasis-buyer-certification.env";

const baseUrl = process.env.BUYER_CERT_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.BUYER_CERT_LOCAL_SERVICE_ROLE_KEY?.trim();
const coreRepo = process.env.BUYER_CERT_CORE_REPO?.trim();

if (!baseUrl || !serviceRoleKey) {
  throw new Error("BUYER_CERT_SUPABASE_URL and BUYER_CERT_LOCAL_SERVICE_ROLE_KEY are required");
}
if (!coreRepo) {
  throw new Error("BUYER_CERT_CORE_REPO is required to execute the SQL seed against the local replay");
}

const { client: supabase } = createLocalSupabaseAdminClient({
  baseUrl,
  serviceRoleKey,
  callerLabel: "Buyer certification bootstrap",
});

function password() {
  return `${randomBytes(24).toString("base64url")}Aa1`;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

const buyerPassword = password();

const { data, error } = await supabase.auth.admin.createUser({
  id: BUYER_ID,
  email: BUYER_EMAIL,
  password: buyerPassword,
  email_confirm: true,
  user_metadata: {
    buyer_certification: true,
    synthetic_fixture: true,
    non_production: true,
  },
});
assertNoSupabaseError(error, `Auth Admin createUser failed for ${BUYER_EMAIL}`);
if (!data?.user?.id) throw new Error(`Auth Admin API did not return an id for ${BUYER_EMAIL}`);

const sqlPath = join(dirname(fileURLToPath(import.meta.url)), "seed-synthetic-buyer.sql");

function runSqlSeedFile() {
  const query = spawnSync("supabase", ["db", "query", "--file", sqlPath], {
    cwd: coreRepo,
    encoding: "utf8",
  });
  if (query.status === 0) return;

  const status = spawnSync("supabase", ["status", "-o", "env"], {
    cwd: coreRepo,
    encoding: "utf8",
  });
  if (status.status !== 0) {
    throw new Error(
      `Synthetic buyer SQL seed failed (supabase db query):\n${query.stdout}\n${query.stderr}`,
    );
  }

  const dbUrl = status.stdout
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("DB_URL="))
    ?.slice("DB_URL=".length)
    .replace(/^['"]|['"]$/g, "");
  if (!dbUrl) {
    throw new Error(
      `Synthetic buyer SQL seed failed and DB_URL was unavailable:\n${query.stdout}\n${query.stderr}`,
    );
  }

  const psql = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
    encoding: "utf8",
  });
  if (psql.status !== 0) {
    throw new Error(
      `Synthetic buyer SQL seed failed:\n${query.stdout}\n${query.stderr}\n${psql.stdout}\n${psql.stderr}`,
    );
  }
}

runSqlSeedFile();

const credentialLines = [
  `export TEST_BUYER_EMAIL=${shellQuote(BUYER_EMAIL)}`,
  `export TEST_BUYER_PASSWORD=${shellQuote(buyerPassword)}`,
  `export BUYER_CERT_SYNTHETIC_FIXTURE_ID=${shellQuote(BUYER_ID)}`,
  `export BUYER_CERT_SYNTHETIC_COMPANY_NAME=${shellQuote("SYNTHETIC BUYER CERTIFICATION CO")}`,
  `export BUYER_CERT_SYNTHETIC_PRODUCT_SKU=${shellQuote("CERT-BUYER-GOLDEN-001")}`,
];

await writeFile(OUTPUT_FILE, `${credentialLines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
await chmod(OUTPUT_FILE, 0o600);

console.log(`Synthetic Buyer certification fixture ready for ${BUYER_EMAIL}`);
console.log(`Credential exports written to ${OUTPUT_FILE}`);
