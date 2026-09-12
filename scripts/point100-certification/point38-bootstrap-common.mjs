import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export const CREDENTIAL_FILE = "/tmp/oasis-factory-certification.env";
export const RUN_TOKEN = "point100-point38-canonical-v1";

export function requireBootstrapEnv(name, label) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${label}_ENV_REQUIRED: ${name}`);
  return value;
}

export function assertLoopbackHttpOrigin(rawUrl, label) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:" || !LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(`${label}_LOCAL_ONLY: refusing Supabase target ${parsed.origin}`);
  }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${label}_LOCAL_ONLY: Supabase URL must be a canonical loopback origin`);
  }
  return parsed.origin;
}

export function parseCredentialFile(filePath = CREDENTIAL_FILE) {
  const values = new Map();
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = /^export ([A-Z0-9_]+)='([^']*)'$/.exec(line.trim());
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

export function readCredential(values, name, label) {
  const value = values.get(name)?.trim();
  if (!value) throw new Error(`${label}_CREDENTIAL_REQUIRED: ${name}`);
  return value;
}

export function assertNoError(error, operation) {
  if (!error) return;
  throw new Error(`${operation}: ${error.message ?? String(error)}`);
}

export function firstRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Execute one scalar-returning SQL statement on the disposable local Postgres
 * stack. Every value interpolated into `sql` must be a fixed constant the
 * caller controls, never external input.
 */
export function queryLocalPostgresScalar(localDbUrl, sql, operationLabel, localOnlyLabel) {
  const parsed = new URL(localDbUrl);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(`${localOnlyLabel}_LOCAL_ONLY: refusing Postgres target for ${operationLabel}`);
  }
  try {
    return execFileSync("psql", ["-At", "-v", "ON_ERROR_STOP=1", "-q", "-c", sql], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      env: {
        ...process.env,
        PGHOST: parsed.hostname,
        PGPORT: parsed.port || "5432",
        PGUSER: decodeURIComponent(parsed.username),
        PGPASSWORD: decodeURIComponent(parsed.password),
        PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "postgres",
      },
    }).trim();
  } catch (error) {
    const stderr = error?.stderr ? error.stderr.toString("utf8") : String(error?.message ?? error);
    throw new Error(`${operationLabel}: ${stderr.trim()}`);
  }
}
