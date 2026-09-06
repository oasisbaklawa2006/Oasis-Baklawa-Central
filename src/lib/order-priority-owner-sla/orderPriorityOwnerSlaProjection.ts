import type {
  OrderOwnerProvenance,
  OrderOwnerSlot,
  OrderPoolQueueSortInput,
  OrderPriorityBand,
  OrderPriorityOwnerSlaFacts,
  OrderPriorityOwnerSlaRawFacts,
  OrderSourceChannel,
  OrderSourceProvenance,
  SlaDateProvenance,
} from "./orderPriorityOwnerSlaTypes";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(iso: string): number {
  const d = new Date(iso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function daysBetweenUtc(fromIso: string, toIso: string): number {
  return Math.round((startOfUtcDay(toIso) - startOfUtcDay(fromIso)) / DAY_MS);
}

export function normalizePriorityBand(dispatchUrgency: string | null | undefined): OrderPriorityBand {
  if (!dispatchUrgency) return "unknown";
  const normalized = dispatchUrgency.trim().toLowerCase();
  if (normalized === "panic") return "panic";
  if (normalized === "standard" || normalized === "normal") return "standard";
  return "unknown";
}

export function priorityRankForBand(band: OrderPriorityBand): number {
  switch (band) {
    case "panic":
      return 10;
    case "standard":
      return 50;
    default:
      return 60;
  }
}

export function resolveSlaDueDate(raw: OrderPriorityOwnerSlaRawFacts): {
  dueDate: string | null;
  promisedDispatchDate: string | null;
  requestedDispatchDate: string | null;
  provenance: SlaDateProvenance;
} {
  const promisedDispatchDate =
    raw.commercialPromisedDispatchDate ?? raw.adminPromisedDate ?? null;
  const requestedDispatchDate =
    raw.commercialRequestedDispatchDate ?? raw.requestedDispatchDate ?? null;

  if (raw.commercialPromisedDispatchDate) {
    return {
      dueDate: raw.commercialPromisedDispatchDate,
      promisedDispatchDate,
      requestedDispatchDate,
      provenance: "core_commercial_facts_promised_dispatch",
    };
  }
  if (raw.adminPromisedDate) {
    return {
      dueDate: raw.adminPromisedDate,
      promisedDispatchDate,
      requestedDispatchDate,
      provenance: "orders_admin_promised",
    };
  }
  if (raw.estimatedDespatchDate) {
    return {
      dueDate: raw.estimatedDespatchDate,
      promisedDispatchDate,
      requestedDispatchDate,
      provenance: "orders_estimated_despatch",
    };
  }
  if (raw.systemEstimatedDate) {
    return {
      dueDate: raw.systemEstimatedDate,
      promisedDispatchDate,
      requestedDispatchDate,
      provenance: "orders_system_estimated",
    };
  }
  if (raw.requestedDispatchDate) {
    return {
      dueDate: raw.requestedDispatchDate,
      promisedDispatchDate,
      requestedDispatchDate,
      provenance: "orders_requested_dispatch",
    };
  }
  return {
    dueDate: null,
    promisedDispatchDate,
    requestedDispatchDate,
    provenance: "none",
  };
}

export function resolveOrderOwner(raw: OrderPriorityOwnerSlaRawFacts): {
  userId: string | null;
  displayName: string | null;
  slot: OrderOwnerSlot;
  provenance: OrderOwnerProvenance;
} {
  if (raw.draftOrderHandlerId) {
    return {
      userId: raw.draftOrderHandlerId,
      displayName: raw.draftOrderHandlerName,
      slot: "order_handler",
      provenance: "sales_order_draft",
    };
  }
  if (raw.draftClientOwnerId) {
    return {
      userId: raw.draftClientOwnerId,
      displayName: raw.draftClientOwnerName,
      slot: "client_owner",
      provenance: "sales_order_draft",
    };
  }
  if (raw.accountManagerId) {
    return {
      userId: raw.accountManagerId,
      displayName: null,
      slot: "account_manager",
      provenance: "companies_account_manager",
    };
  }
  return {
    userId: null,
    displayName: null,
    slot: "unassigned",
    provenance: "none",
  };
}

export function resolveOrderSource(raw: OrderPriorityOwnerSlaRawFacts): {
  channel: OrderSourceChannel;
  provenance: OrderSourceProvenance;
  wamid: string | null;
} {
  if (raw.wamid) {
    return { channel: "whatsapp", provenance: "orders_wamid", wamid: raw.wamid };
  }
  const status = (raw.status ?? "").toLowerCase();
  if (status === "cart" || status === "draft") {
    return { channel: "buyer_app", provenance: "orders_status_heuristic", wamid: null };
  }
  return { channel: "unknown", provenance: "none", wamid: null };
}

export function projectOrderPriorityOwnerSlaFacts(
  raw: OrderPriorityOwnerSlaRawFacts,
  fetchedAt: string,
  nowIso = fetchedAt,
): OrderPriorityOwnerSlaFacts {
  const band = normalizePriorityBand(raw.dispatchUrgency);
  const slaResolved = resolveSlaDueDate(raw);
  const overdue =
    slaResolved.dueDate !== null && startOfUtcDay(nowIso) > startOfUtcDay(slaResolved.dueDate);
  const daysUntilDue =
    slaResolved.dueDate !== null ? daysBetweenUtc(nowIso, slaResolved.dueDate) : null;

  return {
    orderId: raw.orderId,
    priority: {
      band,
      rank: priorityRankForBand(band),
      provenance: "orders_dispatch_urgency",
      raw: raw.dispatchUrgency ?? null,
    },
    sla: {
      dueDate: slaResolved.dueDate,
      promisedDispatchDate: slaResolved.promisedDispatchDate,
      requestedDispatchDate: slaResolved.requestedDispatchDate,
      provenance: slaResolved.provenance,
      overdue,
      daysUntilDue,
    },
    owner: resolveOrderOwner(raw),
    source: resolveOrderSource(raw),
    fetchedAt,
  };
}

/** Deterministic queue ordering for Order Pool / War Room surfaces (Point71 preserved). */
export function compareOrderPoolQueueItems(a: OrderPoolQueueSortInput, b: OrderPoolQueueSortInput): number {
  if (a.hasComplaint && !b.hasComplaint) return -1;
  if (!a.hasComplaint && b.hasComplaint) return 1;

  const priorityDelta = a.facts.priority.rank - b.facts.priority.rank;
  if (priorityDelta !== 0) return priorityDelta;

  if (a.facts.sla.overdue && !b.facts.sla.overdue) return -1;
  if (!a.facts.sla.overdue && b.facts.sla.overdue) return 1;

  const aDue = a.facts.sla.dueDate ? startOfUtcDay(a.facts.sla.dueDate) : Number.POSITIVE_INFINITY;
  const bDue = b.facts.sla.dueDate ? startOfUtcDay(b.facts.sla.dueDate) : Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue - bDue;

  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}

export function isDispatchPanicFromUrgency(dispatchUrgency: string | null | undefined): boolean {
  return normalizePriorityBand(dispatchUrgency) === "panic";
}
