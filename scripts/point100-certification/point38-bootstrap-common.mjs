import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";

function isLoopbackHostname(hostname) {
  const normalized = String(hostname ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "");

  if (normalized === "localhost") return true;

  if (isIP(normalized) === 4) {
    const octets = normalized.split(".").map(Number);
    return octets.length === 4 && octets[0] === 127;
  }

  if (isIP(normalized) === 6) {
    const nonEmptySegments = normalized.split(":").filter(Boolean);
    return nonEmptySegments.length === 1 && nonEmptySegments[0] === "1";
  }

  return false;
}

export const CREDENTIAL_FILE = "/tmp/oasis-factory-certification.env";
export const RUN_TOKEN = "point100-point38-canonical-v1";

/** Disposable Point100 bootstrap env keys — literal switch avoids dynamic process.env sinks. */
export function requireBootstrapEnv(name, label) {
  let value;
  switch (name) {
    case "FACTORY_CERT_SUPABASE_URL":
      value = process.env.FACTORY_CERT_SUPABASE_URL?.trim();
      break;
    case "FACTORY_CERT_SUPABASE_ANON_KEY":
      value = process.env.FACTORY_CERT_SUPABASE_ANON_KEY?.trim();
      break;
    case "FACTORY_CERT_LOCAL_DB_URL":
      value = process.env.FACTORY_CERT_LOCAL_DB_URL?.trim();
      break;
    case "FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY":
      value = process.env.FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY?.trim();
      break;
    default:
      throw new Error(`${label}_ENV_UNKNOWN: ${name}`);
  }
  if (!value) throw new Error(`${label}_ENV_REQUIRED: ${name}`);
  return value;
}

export function assertLoopbackHttpOrigin(rawUrl, label) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:" || !isLoopbackHostname(parsed.hostname)) {
    throw new Error(`${label}_LOCAL_ONLY: refusing Supabase target ${parsed.origin}`);
  }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${label}_LOCAL_ONLY: Supabase URL must be a canonical loopback origin`);
  }
  return parsed.origin;
}

export function parseCredentialFile() {
  const values = new Map();
  for (const line of readFileSync(CREDENTIAL_FILE, "utf8").split(/\r?\n/)) {
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
export function queryLocalPostgresScalar(
  localDbUrl,
  sql,
  operationLabel,
  localOnlyLabel,
  bindings = {},
) {
  const parsed = new URL(localDbUrl);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !isLoopbackHostname(parsed.hostname)) {
    throw new Error(`${localOnlyLabel}_LOCAL_ONLY: refusing Postgres target for ${operationLabel}`);
  }

  const bindingEnv = new Map();
  const bindingPrelude = [];
  for (const [name, rawValue] of Object.entries(bindings)) {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      throw new Error(`${localOnlyLabel}_SQL_BINDING_NAME_INVALID: ${name}`);
    }
    const value = String(rawValue ?? "");
    if (value.includes("\0") || /[\r\n]/.test(value)) {
      throw new Error(`${localOnlyLabel}_SQL_BINDING_VALUE_INVALID: ${name}`);
    }
    const envName = `POINT100_SQL_${name.toUpperCase()}`;
    if (!/^POINT100_SQL_[A-Z0-9_]+$/.test(envName)) {
      throw new Error(`${localOnlyLabel}_SQL_BINDING_ENV_INVALID: ${envName}`);
    }
    bindingEnv.set(envName, value);
    bindingPrelude.push(`\\getenv ${name} ${envName}`);
  }

  try {
    return execFileSync("psql", ["-At", "-v", "ON_ERROR_STOP=1", "-q"], {
      input: `${bindingPrelude.join("\n")}\n${sql}`,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
      env: {
        ...process.env,
        ...Object.fromEntries(bindingEnv),
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
