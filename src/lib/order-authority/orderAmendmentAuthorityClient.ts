import { supabase } from "@/integrations/supabase/client";
import type {
  OrderAmendmentBlocker,
  OrderAmendmentFacts,
  OrderChangeAuthorityResult,
  RequestOrderAmendmentInput,
  RequestOrderCancellationInput,
  RequestOrderSubstitutionInput,
} from "@/lib/order-authority/orderAmendmentAuthorityTypes";

type RpcError = { message: string; code?: string; details?: string; hint?: string };
type RpcClient = {
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: RpcError | null }>;
};

/** Core RPC family required before Point 75 runtime clearance. Absent from Central database.types.ts at main SHA 64a107df. */
export const POINT75_CORE_RPC_CONTRACT = {
  getFacts: "get_order_amendment_facts_v1",
  requestAmendment: "request_order_amendment_v1",
  requestCancellation: "request_order_cancellation_v1",
  requestSubstitution: "request_order_substitution_v1",
} as const;

export const POINT75_CORE_PREREQUISITE =
  "Core (oasis-supabase-core) must deploy governed order amendment/cancellation/substitution RPC family: " +
  "get_order_amendment_facts_v1, request_order_amendment_v1, request_order_cancellation_v1, request_order_substitution_v1 " +
  "with commercial-version checks, explicit actor/reason/evidence, immutable before/after audit, idempotent replay, " +
  "downstream cutoff enforcement (production/packing/dispatch/finance), and compensating actions for post-reservation changes. " +
  "Central database.types.ts census: ABSENT — fail closed until Core contract is typed and deployed.";

export class OrderAmendmentAuthorityError extends Error {
  readonly code?: string;
  readonly details?: string;
  readonly corePrerequisite = POINT75_CORE_PREREQUISITE;

  constructor(error: RpcError | string) {
    const message = typeof error === "string" ? error : error.message;
    super(message);
    this.name = "OrderAmendmentAuthorityError";
    if (typeof error !== "string") {
      this.code = error.code;
      this.details = error.details;
    }
  }
}

function row<T>(data: unknown, operation: string): T {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") {
    throw new OrderAmendmentAuthorityError(`${operation} returned no governed result`);
  }
  return value as T;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new OrderAmendmentAuthorityError(`Invalid ${field} from Core order amendment authority`);
  }
  return value.trim();
}

function requiredNumber(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number)) {
    throw new OrderAmendmentAuthorityError(`Invalid ${field} from Core order amendment authority`);
  }
  return number;
}

function optionalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new OrderAmendmentAuthorityError(`Invalid ${field} from Core order amendment authority`);
  }
  return value;
}

function blockersFromResult(data: unknown): OrderAmendmentBlocker[] {
  if (!data || typeof data !== "object") return [];
  const blockers = (data as { blockers?: OrderAmendmentBlocker[] }).blockers;
  return Array.isArray(blockers) ? blockers : [];
}

function formatBlockers(blockers: OrderAmendmentBlocker[]): string {
  return blockers.map((b) => b.message ?? b.code ?? "Blocked").join("; ");
}

function isRpcAbsent(error: RpcError): boolean {
  const message = error.message.toLowerCase();
  return (
    error.code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes("schema cache") ||
    message.includes("function public.") && message.includes("does not exist")
  );
}

async function callRpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const rpc = (supabase as unknown as RpcClient).rpc;
  const { data, error } = await rpc.call(supabase, fn, args);
  if (error) {
    if (isRpcAbsent(error)) {
      throw new OrderAmendmentAuthorityError(`Core prerequisite blocked: ${POINT75_CORE_PREREQUISITE}`);
    }
    throw new OrderAmendmentAuthorityError(error);
  }
  return data;
}

function assertActorId(actorId: string): void {
  if (!actorId || actorId.trim() === "") {
    throw new OrderAmendmentAuthorityError("Authenticated actor is required for governed order change");
  }
}

function assertReason(reason: string): void {
  if (!reason || reason.trim().length < 3) {
    throw new OrderAmendmentAuthorityError("Governed order change reason is required");
  }
}

function parseFacts(value: unknown): OrderAmendmentFacts {
  const facts = row<Record<string, unknown>>(value, "getOrderAmendmentFacts");
  const blockersRaw = facts.blockers;
  const blockers = Array.isArray(blockersRaw)
    ? blockersRaw.map((item) => {
        const blocker = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return {
          code: optionalString(blocker.code) ?? undefined,
          message: optionalString(blocker.message) ?? undefined,
          scope: optionalString(blocker.scope) ?? undefined,
        };
      })
    : [];

  return {
    orderId: requiredString(facts.order_id, "order_id"),
    orderNumber: requiredString(facts.order_number, "order_number"),
    orderStatus: requiredString(facts.order_status, "order_status"),
    commercialVersionId: requiredString(facts.commercial_version_id, "commercial_version_id"),
    commercialVersionNumber: requiredNumber(facts.commercial_version_number, "commercial_version_number"),
    frozenSalesOrderValue: requiredNumber(facts.frozen_sales_order_value, "frozen_sales_order_value"),
    financeStatus: optionalString(facts.finance_status),
    productionCutoffReached: requiredBoolean(facts.production_cutoff_reached, "production_cutoff_reached"),
    packingCutoffReached: requiredBoolean(facts.packing_cutoff_reached, "packing_cutoff_reached"),
    dispatchCutoffReached: requiredBoolean(facts.dispatch_cutoff_reached, "dispatch_cutoff_reached"),
    amendmentAllowed: requiredBoolean(facts.amendment_allowed, "amendment_allowed"),
    cancellationAllowed: requiredBoolean(facts.cancellation_allowed, "cancellation_allowed"),
    substitutionAllowed: requiredBoolean(facts.substitution_allowed, "substitution_allowed"),
    blockers,
  };
}

function parseChangeResult(value: unknown, operation: string): OrderChangeAuthorityResult {
  const result = row<Record<string, unknown>>(value, operation);
  const blockers = blockersFromResult(result);
  const ok = result.ok === true;
  if (!ok) {
    throw new OrderAmendmentAuthorityError(formatBlockers(blockers) || `${operation} denied`);
  }
  return {
    ok: true,
    orderId: optionalString(result.order_id) ?? undefined,
    changeId: optionalString(result.change_id) ?? undefined,
    previousStatus: optionalString(result.previous_status) ?? undefined,
    newStatus: optionalString(result.new_status) ?? undefined,
    previousCommercialVersionId: optionalString(result.previous_commercial_version_id) ?? undefined,
    newCommercialVersionId: optionalString(result.new_commercial_version_id) ?? undefined,
    alreadyApplied: result.already_applied === true,
    blockers,
  };
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeIdentity(identity: string, label: string): string {
  const normalized = identity.trim();
  if (!normalized) throw new OrderAmendmentAuthorityError(`Invalid ${label} for governed order change identity`);
  return normalized.slice(0, 512);
}

export async function buildOrderChangeIdempotencyKey(
  action: "amend" | "cancel" | "substitute",
  identity: string,
): Promise<string> {
  const normalized = normalizeIdentity(identity, "idempotency");
  const digest = await sha256Hex(`point75:${action}:${normalized}`);
  return `central:point75:${action}:${digest}`;
}

export async function buildOrderChangeCorrelationId(
  action: "amend" | "cancel" | "substitute",
  identity: string,
): Promise<string> {
  const normalized = normalizeIdentity(identity, "correlation");
  const digest = await sha256Hex(`point75:${action}:${normalized}`);
  return `central:point75:${action}:${digest}`;
}

export function buildOrderChangeDecisionIdentity(parts: Record<string, string | number | null | undefined>): string {
  return Object.entries(parts)
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("|");
}

export async function getOrderAmendmentFacts(orderId: string): Promise<OrderAmendmentFacts> {
  return parseFacts(await callRpc(POINT75_CORE_RPC_CONTRACT.getFacts, { p_order_id: orderId }));
}

export async function requestOrderAmendment(input: RequestOrderAmendmentInput): Promise<OrderChangeAuthorityResult> {
  assertActorId(input.actorId);
  assertReason(input.reason);
  if (!input.lineChanges.length) {
    throw new OrderAmendmentAuthorityError("At least one governed line change is required for amendment");
  }

  const data = await callRpc(POINT75_CORE_RPC_CONTRACT.requestAmendment, {
    p_order_id: input.orderId,
    p_commercial_version_id: input.commercialVersionId,
    p_expected_order_status: input.expectedOrderStatus,
    p_reason: input.reason.trim(),
    p_evidence_reference: input.evidenceReference,
    p_line_changes: input.lineChanges.map((line) => ({
      order_item_id: line.orderItemId,
      new_quantity: line.newQuantity ?? null,
      remove: line.remove === true,
    })),
    p_source_channel: input.sourceChannel,
    p_source_reference: input.sourceReference,
    p_correlation_id: input.correlationId,
    p_idempotency_key: input.idempotencyKey,
    p_actor_id: input.actorId,
  });

  return parseChangeResult(data, "requestOrderAmendment");
}

export async function requestOrderCancellation(
  input: RequestOrderCancellationInput,
): Promise<OrderChangeAuthorityResult> {
  assertActorId(input.actorId);
  assertReason(input.reason);

  const data = await callRpc(POINT75_CORE_RPC_CONTRACT.requestCancellation, {
    p_order_id: input.orderId,
    p_commercial_version_id: input.commercialVersionId,
    p_expected_order_status: input.expectedOrderStatus,
    p_reason: input.reason.trim(),
    p_evidence_reference: input.evidenceReference,
    p_source_channel: input.sourceChannel,
    p_source_reference: input.sourceReference,
    p_correlation_id: input.correlationId,
    p_idempotency_key: input.idempotencyKey,
    p_actor_id: input.actorId,
  });

  return parseChangeResult(data, "requestOrderCancellation");
}

export async function requestOrderSubstitution(
  input: RequestOrderSubstitutionInput,
): Promise<OrderChangeAuthorityResult> {
  assertActorId(input.actorId);
  assertReason(input.reason);
  if (!Number.isFinite(input.newQuantity) || input.newQuantity <= 0) {
    throw new OrderAmendmentAuthorityError("Substitution quantity must be positive");
  }

  const data = await callRpc(POINT75_CORE_RPC_CONTRACT.requestSubstitution, {
    p_order_id: input.orderId,
    p_commercial_version_id: input.commercialVersionId,
    p_expected_order_status: input.expectedOrderStatus,
    p_order_item_id: input.orderItemId,
    p_replacement_product_id: input.replacementProductId,
    p_new_quantity: input.newQuantity,
    p_reason: input.reason.trim(),
    p_evidence_reference: input.evidenceReference,
    p_customer_approval_reference: input.customerApprovalReference ?? null,
    p_source_channel: input.sourceChannel,
    p_source_reference: input.sourceReference,
    p_correlation_id: input.correlationId,
    p_idempotency_key: input.idempotencyKey,
    p_actor_id: input.actorId,
  });

  return parseChangeResult(data, "requestOrderSubstitution");
}
