import type { WorkQueueId } from "@/lib/work-queues/queueTypes";
import type {
  CanonicalDepartmentQueueItem,
  DepartmentQueueAuthorityRelation,
  DepartmentQueueRoutingEntry,
} from "./departmentQueueTypes";
import { buildQueueIdempotencyKey, isTerminalQueueStatus } from "./departmentQueueRoutingContract";

type ProductionJobRow = {
  id: string;
  order_id: string | null;
  status: string;
  priority: string;
  department: string;
  canonical_department: string | null;
  assigned_to: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AssemblyJobRow = {
  id: string;
  assembly_job_number: string;
  order_id: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
};

type ReservationRow = {
  id: string;
  order_id: string | null;
  customer_id: string | null;
  sku: string;
  reservation_status: string;
  reservation_priority: string;
  source_department: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type DispatchConsignmentRow = {
  id: string;
  order_id: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
};

type ProcurementRequirementRow = {
  id: string;
  requirement_number: string;
  sku: string;
  status: string;
  priority: string | null;
  expected_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SupportTicketRow = {
  id: string;
  order_id: string;
  status: string | null;
  severity: string | null;
  routed_to_department: string | null;
  assigned_employee_id: string | null;
  issue_type: string;
  sla_resolution_due: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function baseItem(
  lane: DepartmentQueueRoutingEntry,
  sourceRowId: string,
  fields: Omit<
    CanonicalDepartmentQueueItem,
    "id" | "laneKey" | "sourceRelation" | "sourceRowId" | "idempotencyKey"
  >,
): CanonicalDepartmentQueueItem {
  const sourceRelation = lane.canonicalRelation;
  return {
    id: `${sourceRelation}:${sourceRowId}`,
    laneKey: lane.laneKey,
    sourceRelation,
    sourceRowId,
    idempotencyKey: buildQueueIdempotencyKey(lane, sourceRowId),
    ...fields,
  };
}

function mapProductionState(status: string): string {
  if (status === "blocked") return "blocked";
  if (status === "paused") return "paused";
  if (status === "in_production" || status === "accepted") return "in_progress";
  return "pending";
}

export function mapProductionJobsToQueueItems(
  lane: DepartmentQueueRoutingEntry,
  rows: ProductionJobRow[],
): CanonicalDepartmentQueueItem[] {
  return rows
    .filter((row) => !isTerminalQueueStatus(lane, row.status))
    .map((row) =>
      baseItem(lane, row.id, {
        queueType: "production_queue",
        entityType: "production_job",
        entityId: row.id,
        orderId: row.order_id,
        customerId: null,
        title: `Production — ${row.canonical_department ?? row.department}`,
        state: mapProductionState(row.status),
        ownerDepartment: row.canonical_department ?? row.department,
        assignedTo: row.assigned_to,
        escalationLevel: "none",
        blockerCode: null,
        blockerSummary: null,
        priority: row.priority,
        slaDueAt: null,
        createdAt: row.created_at ?? new Date(0).toISOString(),
        updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
      }),
    );
}

export function mapAssemblyJobsToQueueItems(
  lane: DepartmentQueueRoutingEntry,
  rows: AssemblyJobRow[],
): CanonicalDepartmentQueueItem[] {
  return rows
    .filter((row) => !isTerminalQueueStatus(lane, row.status))
    .map((row) =>
      baseItem(lane, row.id, {
        queueType: "assembly_queue",
        entityType: "assembly_job",
        entityId: row.id,
        orderId: row.order_id,
        customerId: null,
        title: `Assembly ${row.assembly_job_number}`,
        state: row.status === "in_progress" ? "in_progress" : "pending",
        ownerDepartment: lane.departmentIdentityField,
        assignedTo: null,
        escalationLevel: "none",
        blockerCode: null,
        blockerSummary: null,
        priority: "normal",
        slaDueAt: null,
        createdAt: row.created_at ?? new Date(0).toISOString(),
        updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
      }),
    );
}

export function mapReservationsToQueueItems(
  lane: DepartmentQueueRoutingEntry,
  rows: ReservationRow[],
  queueType: WorkQueueId,
): CanonicalDepartmentQueueItem[] {
  return rows
    .filter((row) => !isTerminalQueueStatus(lane, row.reservation_status))
    .map((row) =>
      baseItem(lane, row.id, {
        queueType,
        entityType: "inventory_reservation",
        entityId: row.id,
        orderId: row.order_id,
        customerId: row.customer_id,
        title: `Reservation — ${row.sku}`,
        state: row.reservation_status,
        ownerDepartment: row.source_department ?? lane.departmentIdentityField,
        assignedTo: null,
        escalationLevel: "none",
        blockerCode: null,
        blockerSummary: null,
        priority: row.reservation_priority,
        slaDueAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );
}

export function mapDispatchConsignmentsToQueueItems(
  lane: DepartmentQueueRoutingEntry,
  rows: DispatchConsignmentRow[],
): CanonicalDepartmentQueueItem[] {
  return rows
    .filter((row) => !isTerminalQueueStatus(lane, row.status))
    .map((row) =>
      baseItem(lane, row.id, {
        queueType: "dispatch_queue",
        entityType: "dispatch_consignment",
        entityId: row.id,
        orderId: row.order_id,
        customerId: null,
        title: `Dispatch consignment`,
        state: row.status,
        ownerDepartment: lane.departmentIdentityField,
        assignedTo: null,
        escalationLevel: "none",
        blockerCode: null,
        blockerSummary: null,
        priority: "normal",
        slaDueAt: null,
        createdAt: row.created_at ?? new Date(0).toISOString(),
        updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
      }),
    );
}

export function mapProcurementRequirementsToQueueItems(
  lane: DepartmentQueueRoutingEntry,
  rows: ProcurementRequirementRow[],
): CanonicalDepartmentQueueItem[] {
  return rows
    .filter((row) => !isTerminalQueueStatus(lane, row.status))
    .map((row) =>
      baseItem(lane, row.id, {
        queueType: "retail_followup_queue",
        entityType: "procurement_requirement",
        entityId: row.id,
        orderId: null,
        customerId: null,
        title: `3PGS ${row.requirement_number} — ${row.sku}`,
        state: row.status,
        ownerDepartment: lane.departmentIdentityField,
        assignedTo: null,
        escalationLevel: "none",
        blockerCode: null,
        blockerSummary: null,
        priority: row.priority ?? "normal",
        slaDueAt: row.expected_at,
        createdAt: row.created_at ?? new Date(0).toISOString(),
        updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
      }),
    );
}

export function mapSupportTicketsToQueueItems(
  lane: DepartmentQueueRoutingEntry,
  rows: SupportTicketRow[],
): CanonicalDepartmentQueueItem[] {
  return rows
    .filter((row) => !isTerminalQueueStatus(lane, row.status ?? "open"))
    .map((row) =>
      baseItem(lane, row.id, {
        queueType: "customer_support_queue",
        entityType: "support_ticket",
        entityId: row.id,
        orderId: row.order_id,
        customerId: null,
        title: `Support — ${row.issue_type}`,
        state: row.status ?? "open",
        ownerDepartment: row.routed_to_department ?? lane.departmentIdentityField,
        assignedTo: row.assigned_employee_id,
        escalationLevel: "none",
        blockerCode: null,
        blockerSummary: null,
        priority: row.severity ?? "normal",
        slaDueAt: row.sla_resolution_due,
        createdAt: row.created_at ?? new Date(0).toISOString(),
        updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
      }),
    );
}

/** Deduplicate by idempotency key — first canonical row wins. */
export function dedupeCanonicalQueueItems(items: CanonicalDepartmentQueueItem[]): CanonicalDepartmentQueueItem[] {
  const seen = new Set<string>();
  const out: CanonicalDepartmentQueueItem[] = [];
  for (const item of items) {
    if (seen.has(item.idempotencyKey)) continue;
    seen.add(item.idempotencyKey);
    out.push(item);
  }
  return out;
}

export type { ProductionJobRow, AssemblyJobRow, ReservationRow, DispatchConsignmentRow, ProcurementRequirementRow, SupportTicketRow };
