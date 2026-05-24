import { dedupeOperationalEventsById } from "./normalize";
import type { OperationalEventRecord } from "./types";
import { InventoryOperationalEventKind } from "./types";
import {
  deriveInventoryVarianceEscalations,
  type InventoryRiskDeriveInput,
} from "@/lib/inventory-operating-system/inventoryRiskDerive";
import { buildInventoryMovementTimeline } from "@/lib/inventory-operating-system/inventoryTimeline";
import type { InventoryMovementProjection } from "@/lib/inventory-operating-system/inventoryTypes";

const SOURCE = "derived_inventory_os" as const;

export interface InventoryOsFeedInput {
  risk: InventoryRiskDeriveInput;
  recentMovements?: InventoryMovementProjection[];
}

export function buildInventoryOsOperationalFeed(input: InventoryOsFeedInput): OperationalEventRecord[] {
  let sortKey = 8000;
  const next = () => sortKey++;
  const actor: OperationalEventRecord["actor"] = { role: "cmd", displayLabel: "Inventory OS projection" };
  const out: OperationalEventRecord[] = [];

  out.push({
    id: "inv-os:shell:ledger_principles",
    kind: InventoryOperationalEventKind.OS_LEDGER_PRINCIPLES,
    category: "audit",
    severity: "info",
    title: "Immutable movement ledger (design)",
    detail:
      "Movements append-only; reversals are new rows. No silent stock mutation from this projection feed. Persistence and enforcement ship separately.",
    occurredAt: null,
    sortKey: next(),
    actor,
    entities: [],
    source: SOURCE,
  });

  for (const v of deriveInventoryVarianceEscalations(input.risk)) {
    out.push({
      id: `inv-os:variance:${v.id}`,
      kind: InventoryOperationalEventKind.VARIANCE_DETECTED,
      category: "escalation",
      severity: v.severity,
      title: `Variance / risk · ${v.reason.replace(/_/g, " ")}`,
      detail: v.detail,
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [{ entityType: "product", id: v.skuOrCartonRef === "—" ? "unscoped" : v.skuOrCartonRef }],
      source: SOURCE,
    });
  }

  if (input.risk.openReservationSignals > 0) {
    out.push({
      id: "inv-os:reservation:pending_window",
      kind: InventoryOperationalEventKind.RESERVATION_PENDING,
      category: "operational",
      severity: "warning",
      title: "Reservation signals pending governance",
      detail:
        "Counts reflect caller-supplied window only — not persisted reservation locks. Approval graph must gate any future hold application.",
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [{ entityType: "reservation", id: "reservation-window" }],
      source: SOURCE,
    });
  }

  for (const row of buildInventoryMovementTimeline(input.recentMovements ?? [])) {
    out.push({
      id: row.id,
      kind: InventoryOperationalEventKind.MOVEMENT_PROJECTED,
      category: "operational",
      severity: "info",
      title: row.label,
      detail: row.detail,
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [{ entityType: "movement", id: row.id }],
      source: SOURCE,
    });
  }

  return dedupeOperationalEventsById(out);
}
