// GitHub App authentication for the Appverse Merge Gate Worker (Cloudflare Workers / Node 20+, WebCrypto only).
//
// Root-cause note: GitHub issues App private keys as PKCS#1 (a PEM whose label is "RSA PRIVATE KEY"). WebCrypto's
// importKey("pkcs8") rejects PKCS#1 with a bare DataError, so a Worker that feeds the downloaded PEM straight in fails
// with a generic Error before any request reaches GitHub. importAppKey() accepts both encodings.
//
// Secret hygiene: nothing in this module logs, returns or throws key material, JWTs or tokens. diagnose() reports only
// a stage name, a boolean and a short fixed-vocabulary code.

const OID_RSA_ENCRYPTION = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];

export class AuthError extends Error {
  constructor(stage, code) {
    super(`${stage}:${code}`);
    this.stage = stage;
    this.code = code;
  }
}

function derLength(length) {
  if (length < 0x80) return [length];
  const bytes = [];
  for (let n = length; n > 0; n >>= 8) bytes.unshift(n & 0xff);
  return [0x80 | bytes.length, ...bytes];
}

function derWrap(tag, content) {
  return Uint8Array.from([tag, ...derLength(content.length), ...content]);
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Wrap a PKCS#1 RSAPrivateKey DER in a PKCS#8 PrivateKeyInfo envelope. */
export function pkcs1ToPkcs8(pkcs1Der) {
  const version = Uint8Array.from([0x02, 0x01, 0x00]);
  const algorithm = derWrap(0x30, Uint8Array.from([...OID_RSA_ENCRYPTION, 0x05, 0x00]));
  return derWrap(0x30, concat(version, algorithm, derWrap(0x04, pkcs1Der)));
}

const LABEL_KIND = new Map([
  ["RSA PRIVATE KEY", "rsa_private"],
  ["PRIVATE KEY", "private"],
  ["ENCRYPTED PRIVATE KEY", "encrypted_private"],
  ["EC PRIVATE KEY", "ec_private"],
  ["PUBLIC KEY", "public"],
  ["RSA PUBLIC KEY", "public"],
  ["CERTIFICATE", "certificate"],
]);

/** Undo the ways a PEM is commonly mangled by secret stores: BOM, one layer of quotes, escaped or CRLF newlines. */
function normalisePem(input) {
  let text = input.replace(/^\uFEFF/, "").trim();
  if (/^(["'])[\s\S]*\1$/.test(text)) text = text.slice(1, -1).trim();
  return text.replace(/\\r\\n|\\n|\\r/g, "\n").replace(/\r\n?/g, "\n").trim();
}

/** A whole PEM that was base64-encoded again before being stored. Returns the decoded text or null. */
function unwrapBase64Pem(text) {
  const compact = text.replace(/\s+/g, "");
  if (compact.length < 200 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;
  try {
    const decoded = atob(compact);
    return decoded.includes("BEGIN") ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Booleans and enum strings only: safe to log and to report from a production Worker. Never returns any substring of
 * the input, so it can tell an operator HOW the secret is malformed without revealing it.
 */
export function describePemShape(input) {
  if (typeof input !== "string") return { type: typeof input };
  const raw = input;
  const text = normalisePem(raw);
  const label = text.match(/BEGIN ([A-Z ]+?)-{5}/)?.[1];
  return {
    type: "string",
    length_bucket: raw.length === 0 ? "0" : raw.length < 200 ? "<200" : raw.length < 1000 ? "200-999" : raw.length < 3000 ? "1000-2999" : ">=3000",
    quoted: /^\s*(["'])[\s\S]*\1\s*$/.test(raw),
    escaped_newlines: /\\n/.test(raw),
    has_real_newlines: /\n/.test(raw),
    crlf: /\r\n/.test(raw),
    has_begin: text.includes("BEGIN"),
    has_end: text.includes("END"),
    base64_wrapped: !text.includes("BEGIN") && unwrapBase64Pem(text) !== null,
    label_kind: label === undefined ? "none" : (LABEL_KIND.get(label) ?? "other"),
  };
}

/** Parse a PEM into { kind: "pkcs1" | "pkcs8", der }. Tolerates quotes, escaped/CRLF newlines and base64-wrapped PEM. */
export function parsePem(pem) {
  if (typeof pem !== "string") throw new AuthError("pem", "not_a_string");
  if (pem.trim().length === 0) throw new AuthError("pem", "empty");
  let text = normalisePem(pem);
  if (!text.includes("BEGIN")) {
    const unwrapped = unwrapBase64Pem(text);
    if (unwrapped === null) throw new AuthError("pem", "no_pem_armor");
    text = normalisePem(unwrapped);
  }
  const begin = text.match(/-----BEGIN ([A-Z ]+?)-----/);
  if (!begin) throw new AuthError("pem", "no_pem_armor");
  const label = begin[1];
  const end = text.match(/-----END ([A-Z ]+?)-----/);
  if (!end) throw new AuthError("pem", "truncated");
  if (end[1] !== label) throw new AuthError("pem", "label_mismatch");
  if (label === "ENCRYPTED PRIVATE KEY") throw new AuthError("pem", "encrypted_key");
  if (label !== "RSA PRIVATE KEY" && label !== "PRIVATE KEY") throw new AuthError("pem", "unsupported_label");
  const body = text.slice(begin.index + begin[0].length, end.index).replace(/\s+/g, "");
  if (body.length === 0) throw new AuthError("pem", "empty_body");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) throw new AuthError("pem", "bad_base64");
  let der;
  try {
    der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  } catch {
    throw new AuthError("pem", "bad_base64");
  }
  return { kind: label === "RSA PRIVATE KEY" ? "pkcs1" : "pkcs8", der };
}

export async function importAppKey(pem, subtle = globalThis.crypto.subtle) {
  let parsed;
  try {
    parsed = parsePem(pem);
  } catch (error) {
    // Only fixed-vocabulary AuthErrors escape; anything unexpected is normalised so no input text can leak.
    throw error instanceof AuthError ? error : new AuthError("pem", "parse_failed");
  }
  const { kind, der } = parsed;
  try {
    const pkcs8 = kind === "pkcs1" ? pkcs1ToPkcs8(der) : der;
    return await subtle.importKey("pkcs8", pkcs8, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  } catch {
    throw new AuthError("import", kind === "pkcs1" ? "pkcs1_import_failed" : "pkcs8_import_failed");
  }
}

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const textB64url = (value) => b64url(new TextEncoder().encode(value));

/** App JWT: RS256, iat backdated 60s for clock skew, exp <= 10 minutes (GitHub's maximum). */
export async function createAppJwt({ appId, pem, now = Math.floor(Date.now() / 1000), subtle = globalThis.crypto.subtle }) {
  if (!/^\d+$/.test(String(appId))) throw new AuthError("jwt", "bad_app_id");
  const key = await importAppKey(pem, subtle);
  const header = textB64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = textB64url(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: String(appId) }));
  try {
    const signature = await subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${payload}`));
    return `${header}.${payload}.${b64url(new Uint8Array(signature))}`;
  } catch {
    throw new AuthError("sign", "sign_failed");
  }
}

/**
 * Staged, read-only, sanitized diagnostic. Stops at the first failing stage and reports only {stage, ok, code}.
 * Stages: pem -> import -> sign -> app (GET /app) -> installations (GET /app/installations) -> repo (installed on repo).
 */
export async function diagnose({ appId, pem, repoFullName, fetchImpl = globalThis.fetch, now, subtle }) {
  const results = [];
  const record = (stage, ok, code) => results.push({ stage, ok, code });
  let jwt;
  try {
    const parsed = parsePem(pem);
    record("pem", true, parsed.kind);
    await importAppKey(pem, subtle);
    record("import", true, "ok");
    jwt = await createAppJwt({ appId, pem, now, subtle });
    record("sign", true, "ok");
  } catch (error) {
    record(error.stage ?? "unknown", false, error.code ?? "error");
    if (error.stage === "pem") results.at(-1).shape = describePemShape(pem);
    return results;
  }
  const call = async (path) => fetchImpl(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${jwt}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "oasis-appverse-merge-gate" },
  });
  try {
    const app = await call("/app");
    if (!app.ok) return record("app", false, `http_${app.status}`), results;
    const body = await app.json();
    if (String(body.id) !== String(appId)) return record("app", false, "app_id_mismatch"), results;
    record("app", true, "ok");
    const installs = await call("/app/installations");
    if (!installs.ok) return record("installations", false, `http_${installs.status}`), results;
    const list = await installs.json();
    record("installations", Array.isArray(list) && list.length > 0, Array.isArray(list) && list.length > 0 ? "ok" : "none_installed");
    const owner = (repoFullName ?? "").split("/")[0];
    const hit = Array.isArray(list) && list.some((i) => i.account?.login === owner);
    record("repo", hit, hit ? "ok" : "owner_not_installed");
  } catch {
    record("network", false, "fetch_failed");
  }
  return results;
}
