import { dedupeOperationalEventsById } from "./normalize";
import { RetailOperationalEventKind, type OperationalEventRecord } from "./types";

const SOURCE = "derived_store_coordination" as const;

/** Canonical outlet list for coordination UI until a live directory API exists. */
export const DEFAULT_RETAIL_OUTLETS: { id: string; name: string }[] = [
  { id: "outlet-south-extension", name: "South Extension" },
  { id: "outlet-paschim-vihar", name: "Paschim Vihar" },
  { id: "outlet-kamla-nagar", name: "Kamla Nagar" },
  { id: "outlet-ashok-vihar", name: "Ashok Vihar" },
  { id: "outlet-mall-of-india-noida", name: "Mall of India Noida" },
  { id: "outlet-select-city-walk", name: "Select City Walk" },
  { id: "outlet-amritsar", name: "Amritsar" },
  { id: "outlet-srinagar", name: "Srinagar" },
];

export interface StoreCoordinationOutletSnapshot {
  id: string;
  name: string;
}

export interface StoreCoordinationReservationRow {
  id: string;
  customer: string;
  store: string;
  product: string;
  qty: string;
  pickupDate: string;
  status: string;
  notes?: string;
}

export interface StoreCoordinationFollowupRow {
  id: string;
  store: string;
  product: string;
  neededBy: string;
  urgency: string;
  department: string;
  status: string;
  lastFollowup: string;
}

export interface StoreCoordinationFeedInput {
  outlets: StoreCoordinationOutletSnapshot[];
  reservations: StoreCoordinationReservationRow[];
  followups: StoreCoordinationFollowupRow[];
  /** Reserved for future deterministic ordering; never written to occurredAt. */
  nowMs: number;
}

function storeEntity(id: string): OperationalEventRecord["entities"] {
  return [{ entityType: "store", id }];
}

function reservationEntity(id: string): OperationalEventRecord["entities"] {
  return [{ entityType: "reservation", id }];
}

/**
 * Pure read-only projection feed for the store coordination surface.
 * All snapshot rows use occurredAt = null (no fabricated wall-clock events).
 */
export function buildStoreCoordinationOperationalFeed(input: StoreCoordinationFeedInput): OperationalEventRecord[] {
  const outlets = input.outlets.length > 0 ? input.outlets : DEFAULT_RETAIL_OUTLETS;
  let sortKey = 1000;
  const nextSort = () => sortKey++;

  const out: OperationalEventRecord[] = [];
  const actor: OperationalEventRecord["actor"] = { role: "store", displayLabel: "Store coordination projection" };

  out.push({
    id: "store-coord:shell:stock_visible_channel",
    kind: RetailOperationalEventKind.STOCK_VISIBLE,
    category: "operational",
    severity: "info",
    title: "Stock visibility channel (shell)",
    detail:
      "UI route is live; live stock, ready goods, and store inventory feeds are not connected. Do not treat counts on this page as authoritative.",
    occurredAt: null,
    sortKey: nextSort(),
    actor,
    entities: [],
    source: SOURCE,
  });

  for (const o of outlets) {
    out.push({
      id: `store-coord:outlet:${o.id}:stock_unknown`,
      kind: RetailOperationalEventKind.STOCK_UNKNOWN,
      category: "operational",
      severity: "warning",
      title: `Stock confidence · ${o.name}`,
      detail:
        "Live stock integration pending · ready goods source pending · store inventory feed pending. Manual verification required before promising availability.",
      occurredAt: null,
      sortKey: nextSort(),
      actor,
      entities: storeEntity(o.id),
      source: SOURCE,
    });
  }

  if (input.reservations.length === 0) {
    out.push({
      id: "store-coord:reservations:prebooking_pending",
      kind: RetailOperationalEventKind.PREBOOKING_PENDING,
      category: "operational",
      severity: "warning",
      title: "Reservation / prebooking backend pending",
      detail:
        "Reservation capture is not active yet. Do not promise held stock from this screen. No stock deduction is performed here.",
      occurredAt: null,
      sortKey: nextSort(),
      actor,
      entities: reservationEntity("reservation-backend-pending"),
      source: SOURCE,
    });
    out.push({
      id: "store-coord:pickup:pending_placeholder",
      kind: RetailOperationalEventKind.PICKUP_PENDING,
      category: "dispatch",
      severity: "warning",
      title: "Pickup coordination pending feed",
      detail:
        "Pickup dates will appear here once reservations sync. Until then confirm verbally with the outlet.",
      occurredAt: null,
      sortKey: nextSort(),
      actor,
      entities: [],
      source: SOURCE,
    });
  } else {
    for (const r of input.reservations) {
      out.push({
        id: `store-coord:reservation:${r.id}:requested`,
        kind: RetailOperationalEventKind.RESERVATION_REQUESTED,
        category: "operational",
        severity: "info",
        title: `Reservation requested · ${r.customer}`,
        detail: [`Store · ${r.store}`, `SKU / pack · ${r.product}`, `Qty · ${r.qty}`, `Pickup · ${r.pickupDate}`, `Status · ${r.status}`, r.notes].filter(Boolean).join("\n"),
        occurredAt: null,
        sortKey: nextSort(),
        actor,
        entities: reservationEntity(r.id),
        source: SOURCE,
      });
      out.push({
        id: `store-coord:reservation:${r.id}:pickup_pending`,
        kind: RetailOperationalEventKind.PICKUP_PENDING,
        category: "dispatch",
        severity: "warning",
        title: `Pickup pending · ${r.store}`,
        detail: `Linked reservation ${r.id} · ${r.pickupDate}`,
        occurredAt: null,
        sortKey: nextSort(),
        actor,
        entities: reservationEntity(r.id),
        source: SOURCE,
      });
    }
  }

  if (input.followups.length === 0) {
    out.push({
      id: "store-coord:factory:followup_pending",
      kind: RetailOperationalEventKind.FACTORY_FOLLOWUP_NEEDED,
      category: "operational",
      severity: "warning",
      title: "Factory follow-up integration pending",
      detail:
        "No persisted factory follow-up queue yet. Use phone, WhatsApp, or manual confirmation with production until backend wiring is complete.",
      occurredAt: null,
      sortKey: nextSort(),
      actor,
      entities: [],
      source: SOURCE,
    });
  } else {
    for (const f of input.followups) {
      out.push({
        id: `store-coord:factory:${f.id}:followup_needed`,
        kind: RetailOperationalEventKind.FACTORY_FOLLOWUP_NEEDED,
        category: "operational",
        severity: f.urgency.toLowerCase().includes("panic") ? "urgent" : "warning",
        title: `Factory follow-up · ${f.store}`,
        detail: [`Product · ${f.product}`, `Needed by · ${f.neededBy}`, `Urgency · ${f.urgency}`, `Dept · ${f.department}`, `Status · ${f.status}`, `Last follow-up · ${f.lastFollowup}`].join("\n"),
        occurredAt: null,
        sortKey: nextSort(),
        actor,
        entities: storeEntity(`factory-followup-${f.id}`),
        source: SOURCE,
      });
    }
  }

  out.push({
    id: "store-coord:projection:delay_warning",
    kind: RetailOperationalEventKind.DELAY_WARNING,
    category: "escalation",
    severity: "warning",
    title: "Coordination delay risk (readiness)",
    detail:
      "While feeds are disconnected, customers may perceive packing as unavailable and reservations cannot be guaranteed digitally. Escalate via existing manual channels.",
    occurredAt: null,
    sortKey: nextSort(),
    actor: { role: "cmd", displayLabel: "CMD readiness hint" },
    entities: [],
    source: SOURCE,
  });

  return dedupeOperationalEventsById(out);
}

export function normalizeStoreCoordinationEvents(events: OperationalEventRecord[]): OperationalEventRecord[] {
  return dedupeOperationalEventsById(events);
}
