#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { chmod, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { createLocalSupabaseRestClient } from "./local-rest-client.mjs";

const baseUrl = process.env.FACTORY_CERT_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY?.trim();
const requestedOutputFile = process.env.FACTORY_CERT_CREDENTIAL_FILE?.trim() || "/tmp/oasis-factory-certification.env";

if (!baseUrl || !serviceRoleKey) {
  throw new Error("FACTORY_CERT_SUPABASE_URL and FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY are required");
}

const { request } = createLocalSupabaseRestClient({
  baseUrl,
  serviceRoleKey,
  callerLabel: "Identity bootstrap",
});

const credentialRoot = resolve("/tmp");
const outputFile = resolve(requestedOutputFile);
const relativeOutput = relative(credentialRoot, outputFile);
if (
  relativeOutput === "" ||
  relativeOutput === ".." ||
  relativeOutput.startsWith(`..${sep}`) ||
  isAbsolute(relativeOutput)
) {
  throw new Error(`FACTORY_CERT_CREDENTIAL_FILE must stay inside ${credentialRoot}; got ${outputFile}`);
}

const REQUIRED_AUTOMATIC_CERT_ROLES = [
  "prod_arabic_sweets",
  "prod_chocolate",
  "prod_fusion",
  "prod_bakery",
  "prod_nuts",
];

function password() {
  return `${randomBytes(24).toString("base64url")}Aa1`;
}

function envRole(roleKey) {
  return roleKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

async function createAuthUser(email, userPassword) {
  const payload = await request("/auth/v1/admin/users", {
    method: "POST",
    body: {
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: { factory_certification: true },
    },
  });
  const user = payload?.user ?? payload;
  if (!user?.id) throw new Error(`Auth Admin API did not return an id for ${email}`);
  return String(user.id);
}

async function upsertUserProfile({ id, email, roleKey, displayName }) {
  await request("/rest/v1/users?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [{
      id,
      email,
      full_name: displayName,
      role: roleKey,
      department: "Certification",
      designation: "Disposable Factory certification identity",
      is_active: true,
      invite_status: "active",
    }],
  });
}

// Central's real email-login flow resolves both public.users and public.profiles.
// A disposable auth.users + public.users identity without a profiles row signs in
// at GoTrue but is then rejected by completeAuthLogin() as PROFILE_MISSING. Keep
// the certification identity shaped like a real approved portal identity so the
// harness exercises the application's actual login path rather than bypassing it.
async function upsertLoginProfile({ id, email, roleKey }) {
  await request("/rest/v1/profiles?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [{
      id,
      email,
      role: roleKey,
      is_approved: true,
      status: "approved",
      company_id: null,
    }],
  });
}

async function linkRoleMap(userId, roleId) {
  await request("/rest/v1/user_role_map", {
    method: "POST",
    prefer: "return=minimal",
    body: [{ user_id: userId, role_id: roleId }],
  });
}

async function verifyUserProfile(userId, expectedRole) {
  const rows = await request(`/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=id,role,is_active&limit=1`);
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error(`Disposable identity ${userId} was not materialised in public.users`);
  }
  const actualRole = String(rows[0].role ?? "").trim().toLowerCase();
  if (actualRole !== expectedRole || rows[0].is_active !== true) {
    throw new Error(`Disposable identity ${userId} expected active role ${expectedRole}; got ${actualRole || "<empty>"}`);
  }

  const profileRows = await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,role,is_approved,status&limit=1`);
  if (!Array.isArray(profileRows) || profileRows.length !== 1) {
    throw new Error(`Disposable identity ${userId} is missing the public.profiles row required by Central login`);
  }
  const profileRole = String(profileRows[0].role ?? "").trim().toLowerCase();
  const profileStatus = String(profileRows[0].status ?? "").trim().toLowerCase();
  if (profileRole !== expectedRole || profileRows[0].is_approved !== true || profileStatus !== "approved") {
    throw new Error(
      `Disposable identity ${userId} login profile expected approved role ${expectedRole}; got role=${profileRole || "<empty>"}, approved=${String(profileRows[0].is_approved)}, status=${profileStatus || "<empty>"}`,
    );
  }
}

const activeRoleRows = await request("/rest/v1/roles?is_active=eq.true&select=id,role_key&order=role_key.asc");
const roleIdByKey = new Map(
  (activeRoleRows ?? [])
    .map((row) => [String(row.role_key ?? "").trim().toLowerCase(), String(row.id ?? "")])
    .filter(([roleKey, roleId]) => roleKey && roleId),
);

// staff_provisionable_roles is the canonical server-side allowlist used by
// grant_staff_role(). It is intentionally authoritative even when an older
// public.roles catalogue has not yet gained the same alias. Intersecting the
// two tables silently dropped valid roles such as PROD_ARABIC_SWEETS and made
// credential-gated certification false-green via skipped tests.
const provisionableRows = await request(
  "/rest/v1/staff_provisionable_roles?is_active=eq.true&select=role_key&order=role_key.asc",
);
const provisionable = new Set(
  (provisionableRows ?? [])
    .map((row) => String(row.role_key ?? "").trim().toLowerCase())
    .filter(Boolean),
);

const allRoleKeys = Array.from(new Set([...roleIdByKey.keys(), ...provisionable])).sort();
for (const requiredRole of REQUIRED_AUTOMATIC_CERT_ROLES) {
  if (!provisionable.has(requiredRole)) {
    throw new Error(
      `Canonical Core provisioning authority is missing required Factory certification role ${requiredRole}`,
    );
  }
}

const credentialLines = [
  "# Disposable Factory Operations certification identities.",
  "# Generated locally after a canonical oasis-supabase-core reset.",
  "# DO NOT COMMIT OR COPY INTO VERCEL/PRODUCTION SECRETS.",
];

const bootstrapRole = "super_admin";
const bootstrapRoleId = roleIdByKey.get(bootstrapRole);
if (!bootstrapRoleId) throw new Error("No active super_admin role row exists after canonical Core replay");

const bootstrapEmail = "factory-cert-super-admin@example.invalid";
const bootstrapPassword = password();
const bootstrapId = await createAuthUser(bootstrapEmail, bootstrapPassword);
await upsertUserProfile({
  id: bootstrapId,
  email: bootstrapEmail,
  roleKey: bootstrapRole,
  displayName: "Factory Cert SUPER_ADMIN",
});
await upsertLoginProfile({ id: bootstrapId, email: bootstrapEmail, roleKey: bootstrapRole });
await linkRoleMap(bootstrapId, bootstrapRoleId);
await verifyUserProfile(bootstrapId, bootstrapRole);
credentialLines.push(`export FACTORY_CERT_${envRole(bootstrapRole)}_EMAIL=${shellQuote(bootstrapEmail)}`);
credentialLines.push(`export FACTORY_CERT_${envRole(bootstrapRole)}_PASSWORD=${shellQuote(bootstrapPassword)}`);

const createdRoleKeys = new Set([bootstrapRole]);
let identityCount = 1;
for (const roleKey of allRoleKeys) {
  if (!roleKey || roleKey === bootstrapRole) continue;

  const email = `factory-cert-${roleKey.replaceAll("_", "-")}@example.invalid`;
  const userPassword = password();
  const id = await createAuthUser(email, userPassword);

  if (provisionable.has(roleKey)) {
    // This is the canonical authority path. It intentionally does not require
    // a public.roles row: grant_staff_role() itself authorizes against
    // staff_provisionable_roles and writes public.users.role. If a matching
    // legacy role row exists, the Core RPC also links user_role_map.
    await request("/rest/v1/rpc/grant_staff_role", {
      method: "POST",
      body: {
        p_auth_user_id: id,
        p_email: email,
        p_display_name: `Factory Cert ${roleKey.toUpperCase()}`,
        p_role_key: roleKey,
        p_actor: bootstrapId,
        p_department: "Certification",
        p_designation: "Disposable Factory certification identity",
      },
    });
  } else {
    const roleId = roleIdByKey.get(roleKey);
    if (!roleId) {
      throw new Error(`Non-provisionable role ${roleKey} has no canonical public.roles row`);
    }
    // Legacy/device roles outside the staff provisioning allowlist are seeded
    // only in this loopback disposable database so route isolation can be
    // tested. The script refuses every remote host before reaching this path.
    await upsertUserProfile({
      id,
      email,
      roleKey,
      displayName: `Factory Cert ${roleKey.toUpperCase()}`,
    });
    await linkRoleMap(id, roleId);
  }

  await upsertLoginProfile({ id, email, roleKey });
  // Fail fast on the first malformed identity. Continuing would create more
  // disposable credentials after authority verification has already failed.
  await verifyUserProfile(id, roleKey);

  const envKey = envRole(roleKey);
  credentialLines.push(`export FACTORY_CERT_${envKey}_EMAIL=${shellQuote(email)}`);
  credentialLines.push(`export FACTORY_CERT_${envKey}_PASSWORD=${shellQuote(userPassword)}`);
  createdRoleKeys.add(roleKey);
  identityCount += 1;
}

for (const requiredRole of REQUIRED_AUTOMATIC_CERT_ROLES) {
  if (!createdRoleKeys.has(requiredRole)) {
    throw new Error(`CREDENTIAL_BOOTSTRAP_FAILED: required role ${requiredRole} was not created`);
  }
  const envKey = envRole(requiredRole);
  const hasEmail = credentialLines.some((line) => line.startsWith(`export FACTORY_CERT_${envKey}_EMAIL=`));
  const hasPassword = credentialLines.some((line) => line.startsWith(`export FACTORY_CERT_${envKey}_PASSWORD=`));
  if (!hasEmail || !hasPassword) {
    throw new Error(`CREDENTIAL_BOOTSTRAP_FAILED: required role ${requiredRole} has incomplete exports`);
  }
}

await writeFile(outputFile, `${credentialLines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
// writeFile's mode only applies when creating a file; chmod also tightens an
// existing credential file that may have been created with broader permissions.
await chmod(outputFile, 0o600);
console.log(`Created ${identityCount} disposable role identities.`);
console.log(`Required automatic Factory certification roles created: ${REQUIRED_AUTOMATIC_CERT_ROLES.join(", ")}`);
console.log(`Credential exports written to ${outputFile}`);
