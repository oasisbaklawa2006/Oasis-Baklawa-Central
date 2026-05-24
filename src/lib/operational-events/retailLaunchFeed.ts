import { dedupeOperationalEventsById } from "./normalize";
import { RetailLaunchOperationalEventKind, type OperationalEventRecord } from "./types";

const SOURCE = "derived_retail_launch" as const;

export interface RetailLaunchReservationInput {
  id: string;
  customerName: string;
  phone: string;
  storeName: string;
  productLabel: string;
  qtyDisplay: string;
  /** Valid pickup datetime text (parseable by `Date.parse`), or null/undefined/empty when unset — never a UI placeholder. */
  pickupDisplay: string | null | undefined;
  notes: string;
  status: "draft_only" | "pending_backend" | "manual_verification_required";
}

export interface RetailLaunchFactoryFollowupInput {
  id: string;
  storeName: string;
  productLabel: string;
  qtyDisplay: string;
  neededByDisplay: string;
  department: string;
  urgency: string;
  linkedOrderId: string | null;
  whatsappHint: string | null;
  status: "pending_backend";
}

export interface RetailLaunchLabelPreviewInput {
  id: string;
  labelKind: string;
  context: string;
}

export interface RetailLaunchFeedInput {
  reservations: RetailLaunchReservationInput[];
  factoryFollowups: RetailLaunchFactoryFollowupInput[];
  labelPreviews: RetailLaunchLabelPreviewInput[];
  /** Wall clock for pickup overdue comparison only — never written to occurredAt. */
  nowMs: number;
}

function reservationEntity(id: string): OperationalEventRecord["entities"] {
  return [{ entityType: "reservation", id }];
}

function storeEntityFromName(name: string): OperationalEventRecord["entities"] {
  const slug = name.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 48) || "store";
  return [{ entityType: "store", id: `store-name:${slug}` }];
}

/** Unicode em dash — must not be treated as a real pickup datetime. */
const EM_DASH = "\u2014";

function hasValidPickupDatetime(pickupDisplay: string | null | undefined): pickupDisplay is string {
  if (pickupDisplay == null) return false;
  const s = pickupDisplay.trim();
  if (s.length === 0) return false;
  if (s === EM_DASH || s === "-") return false;
  const t = Date.parse(s);
  return !Number.isNaN(t);
}

function pickupSignal(pickupDisplay: string | null | undefined, nowMs: number): "unknown" | "expected" | "overdue" {
  if (!hasValidPickupDatetime(pickupDisplay)) return "unknown";
  const t = Date.parse(pickupDisplay.trim());
  if (t < nowMs) return "overdue";
  return "expected";
}

/**
 * Read-only retail launch projections (reservations, pickups, factory drafts, label previews).
 * Snapshot rows use occurredAt = null — no fabricated wall-clock event times.
 */
export function buildRetailLaunchOperationalFeed(input: RetailLaunchFeedInput): OperationalEventRecord[] {
  let sortKey = 3000;
  const next = () => sortKey++;
  const actor: OperationalEventRecord["actor"] = { role: "store", displayLabel: "Retail launch projection" };
  const out: OperationalEventRecord[] = [];

  for (const r of input.reservations) {
    const pickupLine = `Pickup · ${r.pickupDisplay?.trim() ? r.pickupDisplay : EM_DASH}`;
    out.push({
      id: `retail-launch:res:${r.id}:draft`,
      kind: RetailLaunchOperationalEventKind.RESERVATION_DRAFT,
      category: "operational",
      severity: "info",
      title: `Reservation draft · ${r.customerName}`,
      detail: [`Store · ${r.storeName}`, `Product · ${r.productLabel}`, `Qty (text) · ${r.qtyDisplay}`, pickupLine, `Phone · ${r.phone}`, r.notes ? `Notes · ${r.notes}` : null, `Status · ${r.status}`]
        .filter(Boolean)
        .join("\n"),
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: reservationEntity(r.id),
      source: SOURCE,
    });

    out.push({
      id: `retail-launch:res:${r.id}:manual_stock`,
      kind: RetailLaunchOperationalEventKind.MANUAL_STOCK_CHECK_REQUIRED,
      category: "escalation",
      severity: "warning",
      title: `Manual stock check · ${r.storeName}`,
      detail: "Shelf truth is not wired — verify stock with the outlet before promising this reservation.",
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [...reservationEntity(r.id), ...storeEntityFromName(r.storeName)],
      source: SOURCE,
    });

    const sig = pickupSignal(r.pickupDisplay, input.nowMs);
    if (sig === "overdue") {
      const pickupField = r.pickupDisplay!.trim();
      out.push({
        id: `retail-launch:res:${r.id}:pickup_overdue`,
        kind: RetailLaunchOperationalEventKind.PICKUP_OVERDUE,
        category: "dispatch",
        severity: "urgent",
        title: `Pickup window appears overdue · ${r.customerName}`,
        detail: `Pickup field · ${pickupField} (operator-entered; confirm with customer).`,
        occurredAt: null,
        sortKey: next(),
        actor,
        entities: reservationEntity(r.id),
        source: SOURCE,
      });
    } else if (sig === "expected") {
      const pickupField = r.pickupDisplay!.trim();
      out.push({
        id: `retail-launch:res:${r.id}:pickup_expected`,
        kind: RetailLaunchOperationalEventKind.PICKUP_EXPECTED,
        category: "dispatch",
        severity: "info",
        title: `Pickup expectation recorded · ${r.customerName}`,
        detail: `Pickup field · ${pickupField}`,
        occurredAt: null,
        sortKey: next(),
        actor,
        entities: reservationEntity(r.id),
        source: SOURCE,
      });
    }
  }

  for (const f of input.factoryFollowups) {
    out.push({
      id: `retail-launch:ff:${f.id}:draft`,
      kind: RetailLaunchOperationalEventKind.FACTORY_FOLLOWUP_DRAFT,
      category: "operational",
      severity: "warning",
      title: `Factory follow-up draft · ${f.storeName}`,
      detail: [
        `Product · ${f.productLabel}`,
        `Qty (text) · ${f.qtyDisplay}`,
        `Needed by · ${f.neededByDisplay}`,
        `Dept · ${f.department}`,
        `Urgency · ${f.urgency}`,
        f.linkedOrderId ? `Order · ${f.linkedOrderId}` : null,
        f.whatsappHint ? `WhatsApp hint · ${f.whatsappHint}` : null,
        `Status · ${f.status}`,
      ]
        .filter(Boolean)
        .join("\n"),
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: storeEntityFromName(f.storeName),
      source: SOURCE,
    });
  }

  for (const l of input.labelPreviews) {
    out.push({
      id: `retail-launch:label:${l.id}`,
      kind: RetailLaunchOperationalEventKind.LABEL_PREVIEW_GENERATED,
      category: "communication",
      severity: "info",
      title: `Label preview · ${l.labelKind}`,
      detail: `Context · ${l.context}`,
      occurredAt: null,
      sortKey: next(),
      actor: { role: "operator", displayLabel: "Label preview" },
      entities: [],
      source: SOURCE,
    });
  }

  return dedupeOperationalEventsById(out);
}

export function filterRetailLaunchTimelineEvents(
  events: OperationalEventRecord[],
  channel: "reservation" | "pickup" | "factory" | "label",
): OperationalEventRecord[] {
  const reservationKinds = new Set<string>([
    RetailLaunchOperationalEventKind.RESERVATION_DRAFT,
    RetailLaunchOperationalEventKind.MANUAL_STOCK_CHECK_REQUIRED,
  ]);
  const pickupKinds = new Set<string>([
    RetailLaunchOperationalEventKind.PICKUP_EXPECTED,
    RetailLaunchOperationalEventKind.PICKUP_OVERDUE,
  ]);
  const factoryKinds = new Set<string>([RetailLaunchOperationalEventKind.FACTORY_FOLLOWUP_DRAFT]);
  const labelKinds = new Set<string>([RetailLaunchOperationalEventKind.LABEL_PREVIEW_GENERATED]);

  const map: Record<typeof channel, Set<string>> = {
    reservation: reservationKinds,
    pickup: pickupKinds,
    factory: factoryKinds,
    label: labelKinds,
  };
  const set = map[channel];
  return events.filter((e) => set.has(e.kind));
}
