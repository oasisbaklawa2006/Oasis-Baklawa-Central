import { supabase } from "@/integrations/supabase/client";

/**
 * Staff queue for Gifting website enquiries (Central #677).
 *
 * Central owns the UI only. Core owns the data and the authorization: the two RPCs below are
 * SECURITY DEFINER-gated in Core (active admin / super_admin) and the table itself is not readable.
 * Contract: oasis-supabase-core docs/programme/GIFTING_ENQUIRY_STAFF_QUEUE.md.
 */

export const GIFTING_ENQUIRY_STATUSES = ["received", "triaged", "closed", "spam"] as const;
export type GiftingEnquiryStatus = (typeof GIFTING_ENQUIRY_STATUSES)[number];

export type GiftingEnquiry = {
  id: string;
  kind: string;
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  source: string;
  marketingConsent: boolean;
  status: GiftingEnquiryStatus;
  receiptCount: number;
  environment: string;
  firstReceivedAt: string;
  lastReceivedAt: string;
  statusChangedAt: string | null;
};

export type GiftingQueueErrorKind = "forbidden" | "invalid" | "not_found" | "unavailable";

export class GiftingQueueError extends Error {
  readonly kind: GiftingQueueErrorKind;
  constructor(kind: GiftingQueueErrorKind) {
    super(`gifting_queue_${kind}`);
    this.name = "GiftingQueueError";
    this.kind = kind;
  }
}

type RpcResult = { data: unknown; error: { message?: string; code?: string } | null };
export type GiftingQueueRpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
};

export function defaultGiftingQueueClient(): GiftingQueueRpcClient {
  return supabase as unknown as GiftingQueueRpcClient;
}

/** Maps Core's stable error codes without ever surfacing raw backend text to the UI. */
export function classifyGiftingQueueError(error: { message?: string; code?: string }): GiftingQueueError {
  const message = error.message ?? "";
  if (error.code === "42501" || message.startsWith("GIFTING_QUEUE_FORBIDDEN")) {
    return new GiftingQueueError("forbidden");
  }
  if (error.code === "22023" || message.startsWith("GIFTING_QUEUE_INVALID")) {
    return new GiftingQueueError("invalid");
  }
  if (error.code === "P0002" || message.startsWith("GIFTING_QUEUE_NOT_FOUND")) {
    return new GiftingQueueError("not_found");
  }
  return new GiftingQueueError("unavailable");
}

const isStatus = (value: unknown): value is GiftingEnquiryStatus =>
  typeof value === "string" && (GIFTING_ENQUIRY_STATUSES as readonly string[]).includes(value);

const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

function mapRow(raw: unknown): GiftingEnquiry {
  const row = (raw ?? {}) as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.kind !== "string" ||
    typeof row.source !== "string" ||
    typeof row.first_received_at !== "string" ||
    typeof row.last_received_at !== "string" ||
    typeof row.environment !== "string" ||
    typeof row.marketing_consent !== "boolean" ||
    typeof row.receipt_count !== "number" ||
    !isStatus(row.status)
  ) {
    throw new GiftingQueueError("unavailable");
  }
  return {
    id: row.id,
    kind: row.kind,
    name: text(row.name),
    company: text(row.company),
    email: text(row.email),
    phone: text(row.phone),
    message: text(row.message),
    source: row.source,
    marketingConsent: row.marketing_consent,
    status: row.status,
    receiptCount: row.receipt_count,
    environment: row.environment,
    firstReceivedAt: row.first_received_at,
    lastReceivedAt: row.last_received_at,
    statusChangedAt: text(row.status_changed_at),
  };
}

export async function listGiftingEnquiries(
  client: GiftingQueueRpcClient,
  options: { status?: GiftingEnquiryStatus | null; limit?: number; offset?: number } = {},
): Promise<GiftingEnquiry[]> {
  const { data, error } = await client.rpc("gifting_enquiry_queue_list_v1", {
    p_status: options.status ?? null,
    p_limit: options.limit ?? 50,
    p_offset: options.offset ?? 0,
  });
  if (error) throw classifyGiftingQueueError(error);
  if (!Array.isArray(data)) throw new GiftingQueueError("unavailable");
  return data.map(mapRow);
}

export async function setGiftingEnquiryStatus(
  client: GiftingQueueRpcClient,
  enquiryId: string,
  status: GiftingEnquiryStatus,
): Promise<{ id: string; status: GiftingEnquiryStatus; statusChangedAt: string | null }> {
  const { data, error } = await client.rpc("gifting_enquiry_queue_set_status_v1", {
    p_enquiry_id: enquiryId,
    p_status: status,
  });
  if (error) throw classifyGiftingQueueError(error);
  const result = (data ?? {}) as Record<string, unknown>;
  if (typeof result.id !== "string" || !isStatus(result.status)) throw new GiftingQueueError("unavailable");
  return { id: result.id, status: result.status, statusChangedAt: text(result.statusChangedAt) };
}
