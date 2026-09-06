import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutionIntelligenceQueueItem } from "@/lib/execution-intelligence/executionIntelligenceTypes";
import {
  blockedPrerequisiteLanes,
  canonicalReadableLanes,
  laneByKey,
} from "./departmentQueueRoutingContract";
import type { CanonicalDepartmentQueueItem, CanonicalDepartmentQueueReadResult } from "./departmentQueueTypes";
import {
  dedupeCanonicalQueueItems,
  mapAssemblyJobsToQueueItems,
  mapDispatchConsignmentsToQueueItems,
  mapProcurementRequirementsToQueueItems,
  mapProductionJobsToQueueItems,
  mapReservationsToQueueItems,
  type AssemblyJobRow,
  type DispatchConsignmentRow,
  type ProcurementRequirementRow,
  type ProductionJobRow,
  type ReservationRow,
} from "./mapCanonicalQueueRows";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = SupabaseClient<any>;

const OPEN_PRODUCTION_STATUSES = ["pending", "accepted", "in_production", "paused", "blocked"];
const OPEN_ASSEMBLY_STATUSES = ["draft", "planned", "in_progress", "partially_completed", "pending_handover"];
const OPEN_DISPATCH_STATUSES = ["draft", "open", "packing", "packed", "finance_pending", "finance_cleared"];
const OPEN_PROCUREMENT_STATUSES = ["open", "partially_fulfilled", "pending_vendor"];

async function readProductionJobs(db: UntypedDb, limit: number): Promise<ProductionJobRow[]> {
  const { data, error } = await db
    .from("production_jobs")
    .select("id, order_id, status, priority, department, canonical_department, assigned_to, created_at, updated_at")
    .in("status", OPEN_PRODUCTION_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`production_jobs read failed: ${error.message}`);
  return (data ?? []) as ProductionJobRow[];
}

async function readAssemblyJobs(db: UntypedDb, limit: number): Promise<AssemblyJobRow[]> {
  const { data, error } = await db
    .from("b2b_assembly_jobs")
    .select("id, assembly_job_number, order_id, status, created_at, updated_at")
    .in("status", OPEN_ASSEMBLY_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(`b2b_assembly_jobs read failed: ${error.message}`);
  }
  return (data ?? []) as AssemblyJobRow[];
}

async function readOpenReservations(db: UntypedDb, limit: number): Promise<ReservationRow[]> {
  const { data, error } = await db
    .from("inventory_reservations")
    .select("id, order_id, customer_id, sku, reservation_status, reservation_priority, source_department, expires_at, created_at, updated_at")
    .not("reservation_status", "in", '("fulfilled","released","cancelled","expired")')
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(`inventory_reservations read failed: ${error.message}`);
  }
  return (data ?? []) as ReservationRow[];
}

async function readOpenConsignments(db: UntypedDb, limit: number): Promise<DispatchConsignmentRow[]> {
  const { data, error } = await db
    .from("b2b_dispatch_consignments")
    .select("id, order_id, status, created_at, updated_at")
    .in("status", OPEN_DISPATCH_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(`b2b_dispatch_consignments read failed: ${error.message}`);
  }
  return (data ?? []) as DispatchConsignmentRow[];
}

async function readOpenProcurementRequirements(db: UntypedDb, limit: number): Promise<ProcurementRequirementRow[]> {
  const { data, error } = await db
    .from("b2b_procurement_requirements")
    .select("id, requirement_number, sku, status, priority, expected_at, created_at, updated_at")
    .in("status", OPEN_PROCUREMENT_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(`b2b_procurement_requirements read failed: ${error.message}`);
  }
  return (data ?? []) as ProcurementRequirementRow[];
}

/**
 * Point86 canonical department queue reader.
 * SELECT-only over governed Core relations — never writes operational_queue_items.
 */
export async function fetchCanonicalDepartmentQueueItems(
  client: SupabaseClient,
  options?: { perLaneLimit?: number },
): Promise<CanonicalDepartmentQueueReadResult> {
  const db = client as UntypedDb;
  const limit = options?.perLaneLimit ?? 150;
  const items: CanonicalDepartmentQueueItem[] = [];

  const productionLane = laneByKey("production");
  if (productionLane) {
    items.push(...mapProductionJobsToQueueItems(productionLane, await readProductionJobs(db, limit)));
  }

  const assemblyLane = laneByKey("assembly");
  if (assemblyLane) {
    items.push(...mapAssemblyJobsToQueueItems(assemblyLane, await readAssemblyJobs(db, limit)));
  }

  const readyGoodsLane = laneByKey("ready_goods");
  if (readyGoodsLane) {
    const reservations = await readOpenReservations(db, limit);
    items.push(
      ...mapReservationsToQueueItems(readyGoodsLane, reservations, "inventory_verification_queue"),
    );
  }

  const dispatchLane = laneByKey("dispatch");
  if (dispatchLane) {
    items.push(...mapDispatchConsignmentsToQueueItems(dispatchLane, await readOpenConsignments(db, limit)));
  }

  const thirdPartyLane = laneByKey("third_party");
  if (thirdPartyLane) {
    items.push(
      ...mapProcurementRequirementsToQueueItems(
        thirdPartyLane,
        await readOpenProcurementRequirements(db, limit),
      ),
    );
  }

  const blockedLanes = blockedPrerequisiteLanes().map((lane) => ({
    laneKey: lane.laneKey,
    prerequisite: lane.blockedPrerequisite ?? "Core producer authority absent",
  }));

  return {
    items: dedupeCanonicalQueueItems(items),
    blockedLanes,
    quarantinedLegacyRelation: "operational_queue_items",
  };
}

/** Map canonical projection to execution-intelligence input shape. */
export function toExecutionIntelligenceQueueItems(
  items: CanonicalDepartmentQueueItem[],
): ExecutionIntelligenceQueueItem[] {
  return items.map((item) => ({
    id: item.id,
    queueType: item.queueType,
    entityType: item.entityType,
    entityId: item.entityId,
    orderId: item.orderId,
    customerId: item.customerId,
    title: item.title,
    state: item.state,
    ownerDepartment: item.ownerDepartment,
    assignedTo: item.assignedTo,
    escalationLevel: item.escalationLevel,
    blockerCode: item.blockerCode,
    blockerSummary: item.blockerSummary,
    slaDueAt: item.slaDueAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

/** Exported for tests — verifies readable lane census matches contract. */
export function readableLaneKeys(): string[] {
  return canonicalReadableLanes().map((lane) => lane.laneKey);
}
