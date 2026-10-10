#!/usr/bin/env node
/**
 * Point100-only disposable auth repair.
 *
 * The shared Factory bootstrap creates every identity with email_confirm=true,
 * but Point100 run #42 proved the ADMIN credential can still reach GoTrue as
 * unconfirmed after the complete fixture seed. This helper is deliberately
 * limited to the local disposable stack: it verifies the credential belongs
 * to the expected ADMIN profile, confirms that exact auth user through the
 * local Auth Admin API when necessary, then proves a normal anon-key password
 * sign-in succeeds. It never touches business authority tables or production.
 */

import { createClient } from "@supabase/supabase-js";
import {
  assertLoopbackHttpOrigin,
  assertNoError,
  parseCredentialFile,
  readCredential,
  requireBootstrapEnv,
} from "./point38-bootstrap-common.mjs";

const LOCAL_LABEL = "POINT100_ADMIN_AUTH";
const credentials = parseCredentialFile();

const baseUrl = assertLoopbackHttpOrigin(
  requireBootstrapEnv("FACTORY_CERT_SUPABASE_URL", LOCAL_LABEL),
  LOCAL_LABEL,
);
const serviceRoleKey = requireBootstrapEnv("FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY", LOCAL_LABEL);
const anonKey = requireBootstrapEnv("FACTORY_CERT_SUPABASE_ANON_KEY", LOCAL_LABEL);
const email = readCredential(credentials, "FACTORY_CERT_ADMIN_EMAIL", LOCAL_LABEL);
const password = readCredential(credentials, "FACTORY_CERT_ADMIN_PASSWORD", LOCAL_LABEL);

const admin = createClient(baseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const { data: profile, error: profileError } = await admin
  .from("users")
  .select("id,email,role,is_active")
  .eq("email", email)
  .maybeSingle();
assertNoError(profileError, "Point38 ADMIN profile lookup");
if (!profile?.id || String(profile.role ?? "").toUpperCase() !== "ADMIN" || profile.is_active !== true) {
  throw new Error(`POINT100_ADMIN_AUTH_PROFILE_INVALID: ${JSON.stringify(profile)}`);
}

const { data: authUserResult, error: authUserError } = await admin.auth.admin.getUserById(profile.id);
assertNoError(authUserError, "Point38 ADMIN auth lookup");
const authUser = authUserResult?.user;
if (!authUser || String(authUser.email ?? "").toLowerCase() !== email.toLowerCase()) {
  throw new Error("POINT100_ADMIN_AUTH_IDENTITY_MISMATCH");
}

if (!authUser.email_confirmed_at) {
  const { error: confirmError } = await admin.auth.admin.updateUserById(profile.id, { email_confirm: true });
  assertNoError(confirmError, "Point38 ADMIN email confirmation repair");
}

const userClient = createClient(baseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({ email, password });
assertNoError(signInError, "Point38 ADMIN post-repair sign-in");
if (signInData.user?.id !== profile.id) throw new Error("POINT100_ADMIN_AUTH_SIGNIN_IDENTITY_MISMATCH");
await userClient.auth.signOut();

console.log("Point100 disposable ADMIN identity is confirmed and password sign-in verified.");
