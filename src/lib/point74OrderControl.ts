import {
  compareOrderPoolQueueItems,
  fetchOrderPriorityOwnerSlaFacts,
  fetchOrderPriorityOwnerSlaFactsBatch,
  projectFromRawFacts,
} from "@/lib/order-priority-owner-sla";
import type {
  OrderPoolQueueSortInput,
  OrderPriorityOwnerSlaFacts,
  OrderPriorityOwnerSlaRawFacts,
} from "@/lib/order-priority-owner-sla";

export class Point74OrderControlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Point74OrderControlError";
  }
}

/** Fail-closed order identity for Point74 priority/owner/SLA control surfaces. */
export function requireOrderControlId(orderId: string | null | undefined, field = "order id"): string {
  const normalized = orderId?.trim();
  if (!normalized) {
    throw new Point74OrderControlError(`${field} is required for Point74 order control`);
  }
  return normalized;
}

export function requireOrderControlAnchor(nowIso?: string | null): string {
  const normalized = nowIso?.trim();
  if (normalized) return normalized;
  return new Date().toISOString();
}

export function projectPoint74OrderControlFacts(
  raw: OrderPriorityOwnerSlaRawFacts,
  nowIso?: string | null,
): OrderPriorityOwnerSlaFacts {
  const anchor = requireOrderControlAnchor(nowIso);
  return projectFromRawFacts(raw, anchor);
}

export async function loadPoint74OrderControlFacts(
  orderId: string | null | undefined,
  nowIso?: string | null,
): Promise<OrderPriorityOwnerSlaFacts> {
  const id = requireOrderControlId(orderId);
  const anchor = requireOrderControlAnchor(nowIso);
  const batch = await fetchOrderPriorityOwnerSlaFactsBatch([id], anchor);
  const facts = batch.get(id);
  if (!facts) {
    throw new Point74OrderControlError(`Order ${id} not found for Point74 order control`);
  }
  return facts;
}

export async function loadPoint74OrderControlFactsBatch(
  orderIds: Array<string | null | undefined>,
  nowIso?: string | null,
): Promise<Map<string, OrderPriorityOwnerSlaFacts>> {
  const anchor = requireOrderControlAnchor(nowIso);
  const uniqueIds = [...new Set(orderIds.map((orderId) => orderId?.trim()).filter((id): id is string => Boolean(id)))];
  if (uniqueIds.length === 0) return new Map();
  return fetchOrderPriorityOwnerSlaFactsBatch(uniqueIds, anchor);
}

export function buildPoint74QueueSortInput(input: {
  orderId: string | null | undefined;
  createdAt: string | null;
  hasComplaint?: boolean;
  raw: OrderPriorityOwnerSlaRawFacts;
  nowIso?: string | null;
}): OrderPoolQueueSortInput {
  const orderId = requireOrderControlId(input.orderId);
  const anchor = requireOrderControlAnchor(input.nowIso);
  return {
    orderId,
    createdAt: input.createdAt,
    hasComplaint: input.hasComplaint,
    facts: projectFromRawFacts(input.raw, anchor),
  };
}

export function comparePoint74QueueItems(left: OrderPoolQueueSortInput, right: OrderPoolQueueSortInput): number {
  return compareOrderPoolQueueItems(left, right);
}

/** Direct single-order fetch retained for trace/amendment surfaces that already hold a governed id. */
export async function fetchPoint74OrderControlFacts(orderId: string, nowIso?: string | null): Promise<OrderPriorityOwnerSlaFacts> {
  const anchor = requireOrderControlAnchor(nowIso);
  return fetchOrderPriorityOwnerSlaFacts(requireOrderControlId(orderId), anchor);
}
