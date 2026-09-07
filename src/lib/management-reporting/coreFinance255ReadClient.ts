/**
 * Read-only Core Finance #255 facts fetcher for management reporting.
 * Bounded, fail-safe — never mutates canonical finance records.
 */

import { supabase } from "@/integrations/supabase/client";
import { coreFinance255Source } from "./coreFinance255Adapter";

type RpcError = { message: string; code?: string };
type RpcClient = {
  rpc<T = unknown>(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: T | null; error: RpcError | null }>;
  from(table: string): QueryBuilder;
};
type QueryBuilder = PromiseLike<{ data: unknown; error: RpcError | null }> & {
  select(columns: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  in(column: string, values: readonly unknown[]): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  limit(count: number): QueryBuilder;
};

const db = supabase as unknown as RpcClient;

const MAX_PAYMENT_FACT_ORDERS = 25;

export interface CoreFinance255CollectionsSnapshot {
  recoverableOutstanding: number;
  recoveredInPeriod: number;
  recoveredInPeriodAvailable: boolean;
  recoveredInPeriodBlocker: string | null;
  ordersWithCoreFacts: number;
  ordersAttempted: number;
  recoveryOrdersWithFacts: number;
  recoveryOrdersAttempted: number;
  source: string;
  warnings: string[];
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function parsePaymentFactsRow(data: unknown): {
  remainingCommercialAmount: number;
} | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const facts = row as Record<string, unknown>;
  return {
    remainingCommercialAmount: num(facts.remaining_commercial_amount),
  };
}

function sumVerifiedInPeriod(
  data: unknown,
  periodStart: number,
  periodEnd: number,
): { amount: number; hasTimestamps: boolean } {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return { amount: 0, hasTimestamps: false };
  const facts = row as Record<string, unknown>;
  const payments = facts.payments;
  if (!Array.isArray(payments)) return { amount: 0, hasTimestamps: false };

  let amount = 0;
  let hasTimestamps = false;
  for (const item of payments) {
    if (!item || typeof item !== "object") continue;
    const payment = item as Record<string, unknown>;
    const verifiedAt = typeof payment.verified_at === "string" ? payment.verified_at : null;
    const verifiedAmount = num(payment.verified_amount);
    if (!verifiedAt || verifiedAmount <= 0) continue;
    hasTimestamps = true;
    const ts = new Date(verifiedAt).getTime();
    if (Number.isNaN(ts)) continue;
    if (ts >= periodStart && ts <= periodEnd) {
      amount += verifiedAmount;
    }
  }
  return { amount, hasTimestamps };
}

async function resolvePiId(orderId: string): Promise<string | null> {
  const { data, error } = await db
    .from("sales_order_proforma_invoice_authority_v1")
    .select("id, status")
    .eq("order_id", orderId)
    .in("status", ["READY_FOR_ISSUE", "ISSUED"])
    .order("created_at", { ascending: false })
    .limit(2);
  if (error) return null;
  const rows = Array.isArray(data) ? data : [];
  if (rows.length !== 1) return null;
  const id = (rows[0] as { id?: string }).id;
  return typeof id === "string" ? id : null;
}

export async function fetchCoreFinance255CollectionsSnapshot(input: {
  unpaidOrderIds: string[];
  recoveryOrderIds: string[];
  periodStartIso: string;
  periodEndIso: string;
}): Promise<CoreFinance255CollectionsSnapshot> {
  const warnings: string[] = [];
  const boundedUnpaidIds = input.unpaidOrderIds.slice(0, MAX_PAYMENT_FACT_ORDERS);
  const boundedRecoveryIds = input.recoveryOrderIds.slice(0, MAX_PAYMENT_FACT_ORDERS);
  let recoverableOutstanding = 0;
  let recoveredInPeriod = 0;
  let ordersWithCoreFacts = 0;
  let recoveryOrdersWithFacts = 0;
  let recoveryHasTimestampContract = false;
  const periodStart = new Date(input.periodStartIso).getTime();
  const periodEnd = new Date(input.periodEndIso).getTime();

  for (const orderId of boundedUnpaidIds) {
    const piId = await resolvePiId(orderId);
    if (!piId) {
      warnings.push(`Order ${orderId.slice(0, 8)}… has no governed PI binding — skipped for Core payment facts`);
      continue;
    }
    const { data, error } = await db.rpc("get_order_payment_facts_v1", { p_pi_id: piId });
    if (error) {
      warnings.push(`get_order_payment_facts_v1 failed for ${orderId.slice(0, 8)}…: ${error.message}`);
      continue;
    }
    const parsed = parsePaymentFactsRow(data);
    if (!parsed) {
      warnings.push(`get_order_payment_facts_v1 returned no facts for ${orderId.slice(0, 8)}…`);
      continue;
    }
    ordersWithCoreFacts += 1;
    recoverableOutstanding += Math.max(0, parsed.remainingCommercialAmount);
  }

  for (const orderId of boundedRecoveryIds) {
    const piId = await resolvePiId(orderId);
    if (!piId) continue;
    const { data, error } = await db.rpc("get_order_payment_facts_v1", { p_pi_id: piId });
    if (error) {
      warnings.push(`Period recovery lookup failed for ${orderId.slice(0, 8)}…: ${error.message}`);
      continue;
    }
    const periodSum = sumVerifiedInPeriod(data, periodStart, periodEnd);
    recoveryOrdersWithFacts += 1;
    if (periodSum.hasTimestamps) recoveryHasTimestampContract = true;
    recoveredInPeriod += periodSum.amount;
  }

  if (boundedUnpaidIds.length < input.unpaidOrderIds.length) {
    warnings.push(
      `Core payment facts bounded to ${MAX_PAYMENT_FACT_ORDERS} of ${input.unpaidOrderIds.length} unpaid orders`,
    );
  }
  if (boundedRecoveryIds.length < input.recoveryOrderIds.length) {
    warnings.push(
      `Period recovery lookup bounded to ${MAX_PAYMENT_FACT_ORDERS} of ${input.recoveryOrderIds.length} orders`,
    );
  }

  const recoveredInPeriodAvailable =
    recoveryOrdersWithFacts > 0 && recoveryHasTimestampContract;
  const recoveredInPeriodBlocker = recoveredInPeriodAvailable
    ? null
    : recoveryOrdersWithFacts === 0
      ? "No governed PI bindings returned timestamped payment facts for period recovery"
      : "get_order_payment_facts_v1 payments lack verified_at timestamps for period filtering";

  return {
    recoverableOutstanding,
    recoveredInPeriod,
    recoveredInPeriodAvailable,
    recoveredInPeriodBlocker,
    ordersWithCoreFacts,
    ordersAttempted: boundedUnpaidIds.length,
    recoveryOrdersWithFacts,
    recoveryOrdersAttempted: boundedRecoveryIds.length,
    source: coreFinance255Source("get_order_payment_facts_v1"),
    warnings,
  };
}

export interface CoreFinance255CreditExposureRow {
  companyId: string;
  orderId: string;
  source: string;
}

export async function probeCoreFinance255CreditExposure(
  companyId: string,
  orderId: string,
): Promise<{ ok: true; source: string } | { ok: false; reason: string }> {
  const piId = await resolvePiId(orderId);
  if (!piId) return { ok: false, reason: "No governed PI binding" };
  const { data: piRow } = await db
    .from("sales_order_proforma_invoice_authority_v1")
    .select("commercial_version_id")
    .eq("id", piId)
    .limit(1);
  const commercialVersionId = (Array.isArray(piRow) ? piRow[0] : null) as
    | { commercial_version_id?: string }
    | null;
  if (!commercialVersionId?.commercial_version_id) {
    return { ok: false, reason: "No commercial version on PI" };
  }
  const { error } = await db.rpc("get_credit_exposure_facts_v1", {
    p_company_id: companyId,
    p_pi_id: piId,
    p_commercial_version_id: commercialVersionId.commercial_version_id,
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true, source: coreFinance255Source("get_credit_exposure_facts_v1") };
}
