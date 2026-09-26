#!/usr/bin/env node
/**
 * Point100 disposable-only bridge from the historical Point38 PI fixture to the
 * current production PI authority. The final-payment authority requires the
 * original Sales Order PI to be genuinely ISSUED and customer-visible.
 *
 * This helper never assigns a PI number itself. FinanceHead AAL2 calls the
 * canonical Core issue_sales_order_proforma_invoice_v1 RPC, whose transactional
 * allocator owns PIYYYY/MM-NNN.
 */

import { createClient } from "@supabase/supabase-js";
import { computeTotpCode } from "../factory-certification/totp.mjs";
import {
  RUN_TOKEN,
  assertLoopbackHttpOrigin,
  assertNoError,
  parseCredentialFile,
  readCredential,
  requireBootstrapEnv,
} from "./point38-bootstrap-common.mjs";

const LOCAL_LABEL = "POINT100_POINT38";
const credentials = parseCredentialFile();
const backendUrl = assertLoopbackHttpOrigin(requireBootstrapEnv("FACTORY_CERT_SUPABASE_URL", LOCAL_LABEL), LOCAL_LABEL);
const anonKey = requireBootstrapEnv("FACTORY_CERT_SUPABASE_ANON_KEY", LOCAL_LABEL);
const orderId = readCredential(credentials, "FACTORY_CERT_POINT38_ORDER_ID", LOCAL_LABEL);
const email = readCredential(credentials, "FACTORY_CERT_FINANCE_HEAD_EMAIL", LOCAL_LABEL);
const password = readCredential(credentials, "FACTORY_CERT_FINANCE_HEAD_PASSWORD", LOCAL_LABEL);
const totpSecret = readCredential(credentials, "FACTORY_CERT_FINANCE_HEAD_TOTP_SECRET", LOCAL_LABEL);

const client = createClient(backendUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

try {
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  assertNoError(signInError, "Point38 FinanceHead PI sign-in");

  const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
  assertNoError(factorsError, "Point38 FinanceHead PI MFA list");
  const factor = factors?.totp?.find((candidate) => candidate.status === "verified");
  if (!factor) throw new Error("POINT100_POINT38_AAL2_FACTOR_REQUIRED: FINANCE_HEAD");

  const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId: factor.id });
  assertNoError(challengeError, "Point38 FinanceHead PI MFA challenge");
  const { error: verifyError } = await client.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code: computeTotpCode(totpSecret),
  });
  assertNoError(verifyError, "Point38 FinanceHead PI MFA verify");

  const { data: userData, error: userError } = await client.auth.getUser();
  assertNoError(userError, "Point38 FinanceHead PI actor");
  const actorId = userData.user?.id;
  if (!actorId) throw new Error("POINT100_POINT38_FINANCE_ACTOR_REQUIRED");

  const { data: bindings, error: bindingError } = await client
    .from("sales_order_proforma_invoice_authority_v1")
    .select("id,status,customer_visible_pi_number")
    .eq("order_id", orderId)
    .in("status", ["READY_FOR_ISSUE", "ISSUED"])
    .limit(1);
  assertNoError(bindingError, "Point38 PI issuance binding read");
  if (!bindings?.length) throw new Error("POINT100_POINT38_PI_BINDING_MISSING");

  const binding = bindings[0];
  const piId = String(binding.id ?? "");
  if (!piId) throw new Error("POINT100_POINT38_PI_ID_MISSING");

  if (binding.status === "READY_FOR_ISSUE") {
    const correlation = `${RUN_TOKEN}:pi-issue`;
    const issue = await client.rpc("issue_sales_order_proforma_invoice_v1", {
      p_pi_id: piId,
      p_reason: "Point100 canonical customer-visible PI issuance",
      p_source: "POINT100_CERTIFICATION",
      p_correlation_id: correlation,
      p_idempotency_key: correlation,
      p_actor_id: actorId,
    });
    assertNoError(issue.error, "Point38 canonical PI issuance");
  }

  const { data: verified, error: verifiedError } = await client
    .from("sales_order_proforma_invoice_authority_v1")
    .select("id,status,customer_visible_pi_number")
    .eq("id", piId)
    .maybeSingle();
  assertNoError(verifiedError, "Point38 customer-visible PI verification");

  const piNumber = String(verified?.customer_visible_pi_number ?? "");
  if (verified?.status !== "ISSUED" || !/^PI\d{4}\/(0[1-9]|1[0-2])-\d{3}$/.test(piNumber)) {
    throw new Error(`POINT100_POINT38_PI_NOT_CUSTOMER_VISIBLE: ${JSON.stringify(verified)}`);
  }

  console.log(`Point100 Point38 canonical PI is customer-visible (${piNumber}).`);
} finally {
  await client.auth.signOut().catch(() => undefined);
}
