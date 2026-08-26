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

async function upsertBootstrapSuperAdmin(id, email) {
  await request("/rest/v1/users?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [{
      id,
      email,
      full_name: "Factory Cert SUPER_ADMIN",
      role: "super_admin",
      department: "Certification",
      designation: "Disposable certification bootstrap",
      is_active: true,
      invite_status: "active",
    }],
  });

  const roleRows = await request("/rest/v1/roles?role_key=eq.super_admin&is_active=eq.true&select=id&limit=1");
  const roleId = roleRows?.[0]?.id;
  if (!roleId) throw new Error("No active super_admin role row exists after canonical Core replay");

  await request("/rest/v1/user_role_map?on_conflict=user_id,role_id", {
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=minimal",
    body: [{ user_id: id, role_id: roleId }],
  });
}

const credentialLines = [
  "# Disposable Factory Operations certification identities.",
  "# Generated locally after a canonical oasis-supabase-core reset.",
  "# DO NOT COMMIT OR COPY INTO VERCEL/PRODUCTION SECRETS.",
];

const bootstrapRole = "super_admin";
const bootstrapEmail = "factory-cert-super-admin@example.invalid";
const bootstrapPassword = password();
const bootstrapId = await createAuthUser(bootstrapEmail, bootstrapPassword);
await upsertBootstrapSuperAdmin(bootstrapId, bootstrapEmail);
credentialLines.push(`export FACTORY_CERT_${envRole(bootstrapRole)}_EMAIL=${shellQuote(bootstrapEmail)}`);
credentialLines.push(`export FACTORY_CERT_${envRole(bootstrapRole)}_PASSWORD=${shellQuote(bootstrapPassword)}`);

const provisionableRoles = await request(
  "/rest/v1/staff_provisionable_roles?is_active=eq.true&select=role_key&order=role_key.asc",
);

for (const row of provisionableRoles ?? []) {
  const roleKey = String(row.role_key ?? "").trim().toLowerCase();
  if (!roleKey || roleKey === bootstrapRole) continue;

  const email = `factory-cert-${roleKey.replaceAll("_", "-")}@example.invalid`;
  const userPassword = password();
  const id = await createAuthUser(email, userPassword);

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

  const envKey = envRole(roleKey);
  credentialLines.push(`export FACTORY_CERT_${envKey}_EMAIL=${shellQuote(email)}`);
  credentialLines.push(`export FACTORY_CERT_${envKey}_PASSWORD=${shellQuote(userPassword)}`);
}

await writeFile(outputFile, `${credentialLines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
await chmod(outputFile, 0o600);
console.log(`Created ${credentialLines.filter((line) => line.startsWith("export FACTORY_CERT_") && line.endsWith("_EMAIL")).length || "role"} disposable role identities.`);
console.log(`Credential exports written to ${outputFile}`);
