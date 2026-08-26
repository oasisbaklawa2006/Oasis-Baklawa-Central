#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { chmod, writeFile } from "node:fs/promises";

const baseUrl = process.env.FACTORY_CERT_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY?.trim();
const outputFile = process.env.FACTORY_CERT_CREDENTIAL_FILE?.trim() || "/tmp/oasis-factory-certification.env";

if (!baseUrl || !serviceRoleKey) {
  throw new Error("FACTORY_CERT_SUPABASE_URL and FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY are required");
}

const parsedBase = new URL(baseUrl);
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsedBase.hostname)) {
  throw new Error(`Identity bootstrap is local-only; refusing Supabase host ${parsedBase.hostname}`);
}

function password() {
  return `${randomBytes(24).toString("base64url")}Aa1`;
}

function envRole(roleKey) {
  return roleKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

async function request(path, { method = "GET", body, prefer } = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} -> HTTP ${response.status}: ${text.slice(0, 600)}`);
  }
  return text ? JSON.parse(text) : null;
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

async function linkRoleMap(userId, roleId) {
  // The local database has just been reset, so there is no prior mapping for
  // this disposable auth user. Keep the write simple and fail if the canonical
  // role row cannot be linked.
  await request("/rest/v1/user_role_map", {
    method: "POST",
    prefer: "return=minimal",
    body: [{ user_id: userId, role_id: roleId }],
  });
}

const activeRoles = await request("/rest/v1/roles?is_active=eq.true&select=id,role_key&order=role_key.asc");
const roleIdByKey = new Map(
  (activeRoles ?? [])
    .map((row) => [String(row.role_key ?? "").trim().toLowerCase(), String(row.id ?? "")])
    .filter(([roleKey, roleId]) => roleKey && roleId),
);

const provisionableRows = await request(
  "/rest/v1/staff_provisionable_roles?is_active=eq.true&select=role_key&order=role_key.asc",
);
const provisionable = new Set((provisionableRows ?? []).map((row) => String(row.role_key ?? "").trim().toLowerCase()).filter(Boolean));

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
await linkRoleMap(bootstrapId, bootstrapRoleId);
credentialLines.push(`export FACTORY_CERT_${envRole(bootstrapRole)}_EMAIL=${shellQuote(bootstrapEmail)}`);
credentialLines.push(`export FACTORY_CERT_${envRole(bootstrapRole)}_PASSWORD=${shellQuote(bootstrapPassword)}`);

let identityCount = 1;
for (const [roleKey, roleId] of Array.from(roleIdByKey.entries()).sort(([a], [b]) => a.localeCompare(b))) {
  if (!roleKey || roleKey === bootstrapRole) continue;

  const email = `factory-cert-${roleKey.replaceAll("_", "-")}@example.invalid`;
  const userPassword = password();
  const id = await createAuthUser(email, userPassword);

  if (provisionable.has(roleKey)) {
    // Exercise the canonical Core provisioning authority whenever the role is
    // on its allowlist.
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
    // Some implemented legacy/TV/store roles exist in public.roles but are not
    // currently on staff_provisionable_roles. For a disposable local database
    // only, service_role seeds the profile+role map directly so route isolation
    // can still be certified. This path is impossible against a remote backend
    // because the script rejects non-loopback Supabase hosts above.
    await upsertUserProfile({
      id,
      email,
      roleKey,
      displayName: `Factory Cert ${roleKey.toUpperCase()}`,
    });
    await linkRoleMap(id, roleId);
  }

  const envKey = envRole(roleKey);
  credentialLines.push(`export FACTORY_CERT_${envKey}_EMAIL=${shellQuote(email)}`);
  credentialLines.push(`export FACTORY_CERT_${envKey}_PASSWORD=${shellQuote(userPassword)}`);
  identityCount += 1;
}

await writeFile(outputFile, `${credentialLines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
await chmod(outputFile, 0o600);
console.log(`Created ${identityCount} disposable role identities.`);
console.log(`Credential exports written to ${outputFile}`);
