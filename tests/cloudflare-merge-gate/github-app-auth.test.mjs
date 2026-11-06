import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify, webcrypto } from "node:crypto";
import { AuthError, createAppJwt, diagnose, importAppKey, parsePem, pkcs1ToPkcs8 } from "../../cloudflare/merge-gate/github-app-auth.mjs";

const pair = (type) => generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type, format: "pem" },
});
const PKCS1 = pair("pkcs1");
const PKCS8 = pair("pkcs8");
const NOW = 1_800_000_000;

// The repository's secret scanner (correctly) rejects any literal private-key marker in tracked files. These fixtures are
// deliberately malformed, non-secret strings, so their armor is assembled at runtime rather than weakening the scanner.
const armor = (label, body) => `${"-".repeat(5)}BEGIN ${label}${"-".repeat(5)}\n${body}\n${"-".repeat(5)}END ${label}${"-".repeat(5)}`;

test("hypothesis: WebCrypto rejects the PKCS#1 PEM GitHub issues, with a bare error and before any network call", async () => {
  const { der } = parsePem(PKCS1.privateKey);
  await assert.rejects(
    webcrypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]),
    (error) => error instanceof Error && error.name === "DataError",
  );
});

test("fix: PKCS#1 is wrapped into PKCS#8 and imports; PKCS#8 imports unchanged", async () => {
  assert.equal(parsePem(PKCS1.privateKey).kind, "pkcs1");
  assert.equal(parsePem(PKCS8.privateKey).kind, "pkcs8");
  assert.ok(await importAppKey(PKCS1.privateKey));
  assert.ok(await importAppKey(PKCS8.privateKey));
  assert.ok(pkcs1ToPkcs8(parsePem(PKCS1.privateKey).der).length > parsePem(PKCS1.privateKey).der.length);
});

test("escaped newlines from secret stores are accepted", async () => {
  assert.ok(await importAppKey(PKCS1.privateKey.replace(/\n/g, "\\n")));
});

for (const [name, pem, code] of [
  ["empty", "", "empty"],
  ["not a pem", "hello", "no_pem_armor"],
  ["public key", PKCS1.publicKey, "unsupported_label"],
  ["bad base64", armor("RSA PRIVATE KEY", "@@@@"), "bad_base64"],
]) {
  test(`parse failure is staged and fixed-vocabulary: ${name}`, () => {
    assert.throws(() => parsePem(pem), (e) => e instanceof AuthError && e.stage === "pem" && e.code === code);
  });
}

test("corrupt DER fails at the import stage without leaking input", async () => {
  const corrupt = armor("RSA PRIVATE KEY", "QUJDREVGR0hJSktMTU5PUA==");
  await assert.rejects(importAppKey(corrupt), (e) => e instanceof AuthError && e.stage === "import" && !/QUJD/.test(e.message));
});

test("app JWT: RS256, verifies with the public key, iss is the App id, lifetime within GitHub's 10 minute maximum", async () => {
  for (const { privateKey, publicKey } of [PKCS1, PKCS8]) {
    const jwt = await createAppJwt({ appId: 5645415, pem: privateKey, now: NOW });
    const [h, p, s] = jwt.split(".");
    assert.deepEqual(JSON.parse(Buffer.from(h, "base64url")), { alg: "RS256", typ: "JWT" });
    const claims = JSON.parse(Buffer.from(p, "base64url"));
    assert.equal(claims.iss, "5645415");
    assert.equal(claims.iat, NOW - 60);
    assert.ok(claims.exp - claims.iat <= 10 * 60);
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${h}.${p}`);
    assert.equal(verifier.verify(publicKey, Buffer.from(s, "base64url")), true);
  }
});

test("non-numeric App ids are refused", async () => {
  await assert.rejects(createAppJwt({ appId: "5645415; drop", pem: PKCS8.privateKey, now: NOW }), (e) => e.stage === "jwt");
});

const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("diagnose: healthy path reports every stage and never returns secret material", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization });
    if (url.endsWith("/app")) return respond(200, { id: 5645415 });
    return respond(200, [{ account: { login: "oasisbaklawa2006" } }]);
  };
  const out = await diagnose({ appId: 5645415, pem: PKCS1.privateKey, repoFullName: "oasisbaklawa2006/Oasis-Baklawa-Central", fetchImpl, now: NOW });
  assert.deepEqual(out.map((r) => r.stage), ["pem", "import", "sign", "app", "installations", "repo"]);
  assert.ok(out.every((r) => r.ok));
  const serialised = JSON.stringify(out);
  assert.doesNotMatch(serialised, /BEGIN|PRIVATE|eyJ|Bearer/);
  assert.deepEqual(calls.map((c) => new URL(c.url).pathname), ["/app", "/app/installations"]);
  assert.ok(calls.every((c) => c.url.startsWith("https://api.github.com/") && c.auth.startsWith("Bearer ")));
});

test("diagnose: a bad key stops before any network request", async () => {
  let called = false;
  const out = await diagnose({ appId: 1, pem: "garbage", fetchImpl: async () => { called = true; }, now: NOW });
  assert.deepEqual(out, [{ stage: "pem", ok: false, code: "no_pem_armor" }]);
  assert.equal(called, false);
});

test("diagnose: distinguishes JWT rejection, App id mismatch, missing installation and network failure", async () => {
  const run = (fetchImpl) => diagnose({ appId: 5645415, pem: PKCS8.privateKey, repoFullName: "o/r", fetchImpl, now: NOW });
  assert.deepEqual((await run(async () => respond(401, {}))).at(-1), { stage: "app", ok: false, code: "http_401" });
  assert.deepEqual((await run(async () => respond(200, { id: 7 }))).at(-1), { stage: "app", ok: false, code: "app_id_mismatch" });
  const noInstall = async (url) => (url.endsWith("/app") ? respond(200, { id: 5645415 }) : respond(200, []));
  assert.equal((await run(noInstall)).find((r) => r.stage === "installations").code, "none_installed");
  const otherOwner = async (url) => (url.endsWith("/app") ? respond(200, { id: 5645415 }) : respond(200, [{ account: { login: "someone" } }]));
  assert.deepEqual((await run(otherOwner)).at(-1), { stage: "repo", ok: false, code: "owner_not_installed" });
  assert.deepEqual((await run(async () => { throw new Error("boom with secret"); })).at(-1), { stage: "network", ok: false, code: "fetch_failed" });
});
