#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { chmod, writeFile } from "node:fs/promises";
import {
  assertNoSupabaseError,
  createLocalSupabaseAdminClient,
} from "./local-supabase-client.mjs";

const baseUrl = process.env.FACTORY_CERT_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY?.trim();
const outputFile = "/tmp/oasis-factory-certification.env";

if (!baseUrl || !serviceRoleKey) {
  throw new Error("FACTORY_CERT_SUPABASE_URL and FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY are required");
}

const { client: supabase } = createLocalSupabaseAdminClient({
  baseUrl,
  serviceRoleKey,
  callerLabel: "Identity bootstrap",
});

const REQUIRED_AUTOMATIC_CERT_ROLES = [
  "prod_arabic_sweets",
  "prod_chocolate",
  "prod_fusion",
  "prod_bakery",
  "prod_nuts",
];

/** Generate a high-entropy disposable password for one certification identity. */
function password() {
  return `${randomBytes(24).toString("base64url")}Aa1`;
}

/** Convert a canonical role key to its certification environment suffix. */
function envRole(roleKey) {
  return roleKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}

/** Quote one value for safe loading by the certification shell. */
function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

/** Create one disposable auth.users identity through the local Admin API. */
async function createAuthUser(email, userPassword) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: userPassword,
    email_confirm: true,
    user_metadata: { factory_certification: true },
  });
  assertNoSupabaseError(error, `Auth Admin createUser failed for ${email}`);
  if (!data?.user?.id) throw new Error(`Auth Admin API did not return an id for ${email}`);
  return String(data.user.id);
}

/** Materialize the public.users row required by Central role resolution. */
async function upsertUserProfile({ id, email, roleKey, displayName }) {
  const { error } = await supabase.from("users").upsert({
    id,
    email,
    full_name: displayName,
    role: roleKey,
    department: "Certification",
    designation: "Disposable Factory certification identity",
    is_active: true,
    invite_status: "active",
  }, { onConflict: "id" });
  assertNoSupabaseError(error, `public.users upsert failed for ${email}`);
}

/** Materialize the public.profiles row required by Central's real login flow. */
async function upsertLoginProfile({ id, email, roleKey }) {
  const { error } = await supabase.from("profiles").upsert({
    id,
    email,
    role: roleKey,
    is_approved: true,
    status: "approved",
    company_id: null,
  }, { onConflict: "id" });
  assertNoSupabaseError(error, `public.profiles upsert failed for ${email}`);
}

/** Link a disposable identity to a legacy/device role row when required. */
async function linkRoleMap(userId, roleId) {
  const { error } = await supabase.from("user_role_map").insert({
    user_id: userId,
    role_id: roleId,
  });
  assertNoSupabaseError(error, `user_role_map insert failed for ${userId}`);
}

/**
 * Prove that both role-bearing profile tables contain the expected active,
 * approved identity. This intentionally fails fast on the first authority
 * mismatch so the bootstrap cannot manufacture more credentials after trust is
 * already invalid.
 */
async function verifyUserProfile(userId, expectedRole) {
  const { data: rows, error: userError } = await supabase
    .from("users")
    .select("id,role,is_active")
    .eq("id", userId)
    .limit(1);
  assertNoSupabaseError(userError, `public.users verification failed for ${userId}`);
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error(`Disposable identity ${userId} was not materialised in public.users`);
  }
  const actualRole = String(rows[0].role ?? "").trim().toLowerCase();
  if (actualRole !== expectedRole || rows[0].is_active !== true) {
    throw new Error(`Disposable identity ${userId} expected active role ${expectedRole}; got ${actualRole || "<empty>"}`);
  }

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,is_approved,status")
    .eq("id", userId)
    .limit(1);
  assertNoSupabaseError(profileError, `public.profiles verification failed for ${userId}`);
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

const { data: activeRoleRows, error: rolesError } = await supabase
  .from("roles")
  .select("id,role_key")
  .eq("is_active", true)
  .order("role_key", { ascending: true });
assertNoSupabaseError(rolesError, "Active role catalogue read failed");

const roleIdByKey = new Map(
  (activeRoleRows ?? [])
    .map((row) => [String(row.role_key ?? "").trim().toLowerCase(), String(row.id ?? "")])
    .filter(([roleKey, roleId]) => roleKey && roleId),
);

// staff_provisionable_roles is the canonical server-side allowlist used by
// grant_staff_role(). It is intentionally authoritative even when an older
// public.roles catalogue has not yet gained the same alias.
const { data: provisionableRows, error: provisionableError } = await supabase
  .from("staff_provisionable_roles")
  .select("role_key")
  .eq("is_active", true)
  .order("role_key", { ascending: true });
assertNoSupabaseError(provisionableError, "Provisionable role catalogue read failed");

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
    const { error } = await supabase.rpc("grant_staff_role", {
      p_auth_user_id: id,
      p_email: email,
      p_display_name: `Factory Cert ${roleKey.toUpperCase()}`,
      p_role_key: roleKey,
      p_actor: bootstrapId,
      p_department: "Certification",
      p_designation: "Disposable Factory certification identity",
    });
    assertNoSupabaseError(error, `grant_staff_role failed for ${roleKey}`);
  } else {
    const roleId = roleIdByKey.get(roleKey);
    if (!roleId) {
      throw new Error(`Non-provisionable role ${roleKey} has no canonical public.roles row`);
    }
    await upsertUserProfile({
      id,
      email,
      roleKey,
      displayName: `Factory Cert ${roleKey.toUpperCase()}`,
    });
    await linkRoleMap(id, roleId);
  }

  await upsertLoginProfile({ id, email, roleKey });
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
// writeFile's mode only applies on creation; chmod also tightens a pre-existing
// file that may have broader permissions.
await chmod(outputFile, 0o600);
console.log(`Created ${identityCount} disposable role identities.`);
console.log(`Required automatic Factory certification roles created: ${REQUIRED_AUTOMATIC_CERT_ROLES.join(", ")}`);
console.log(`Credential exports written to ${outputFile}`);
