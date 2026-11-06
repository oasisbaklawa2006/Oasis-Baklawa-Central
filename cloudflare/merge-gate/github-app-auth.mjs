// GitHub App authentication for the Appverse Merge Gate Worker (Cloudflare Workers / Node 20+, WebCrypto only).
//
// Root-cause note: GitHub issues App private keys as PKCS#1 ("-----BEGIN RSA PRIVATE KEY-----"). WebCrypto's
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

/** Parse a PEM into { kind: "pkcs1" | "pkcs8", der }. Accepts escaped "\n" sequences used by some secret stores. */
export function parsePem(pem) {
  if (typeof pem !== "string" || pem.length === 0) throw new AuthError("pem", "empty");
  const text = pem.replace(/\\n/g, "\n").trim();
  const match = text.match(/^-----BEGIN ((?:RSA )?PRIVATE KEY)-----([\s\S]+?)-----END \1-----$/);
  if (!match) throw new AuthError("pem", text.includes("BEGIN") ? "unsupported_label" : "no_pem_armor");
  const body = match[2].replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) throw new AuthError("pem", "bad_base64");
  const raw = atob(body);
  const der = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  return { kind: match[1] === "RSA PRIVATE KEY" ? "pkcs1" : "pkcs8", der };
}

export async function importAppKey(pem, subtle = globalThis.crypto.subtle) {
  const { kind, der } = parsePem(pem);
  const pkcs8 = kind === "pkcs1" ? pkcs1ToPkcs8(der) : der;
  try {
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
