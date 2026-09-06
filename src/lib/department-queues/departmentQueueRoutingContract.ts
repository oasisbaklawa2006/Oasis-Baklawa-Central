import type { DepartmentQueueRoutingEntry } from "./departmentQueueTypes";

/**
 * Point86 — Central department queue read/routing contract.
 *
 * Maps each department execution lane to exactly one canonical Core authority.
 * Central must consume these relations read-only; it must not create or maintain
 * a competing queue ledger in operational_queue_items.
 */
export const DEPARTMENT_QUEUE_ROUTING: DepartmentQueueRoutingEntry[] = [
  {
    laneKey: "production",
    legacyBoardId: "production",
    legacyQueueTypes: ["production_queue"],
    canonicalRelation: "production_jobs",
    coreProducerAuthority: "create_production_shortage_demand (oasis-supabase-core)",
    idempotencyKeyTemplate: "production_job:{id}",
    priorityProvenance: "production_jobs.priority",
    slaProvenance: null,
    lifecycleStatusField: "production_jobs.status",
    departmentIdentityField: "production_jobs.canonical_department",
    terminalStatuses: ["completed", "cancelled", "rejected"],
    canonicalRoute: "/operations-controller",
    disposition: "LEGACY_REDIRECT",
  },
  {
    laneKey: "assembly",
    legacyBoardId: "assembly",
    legacyQueueTypes: ["assembly_queue"],
    canonicalRelation: "b2b_assembly_jobs",
    coreProducerAuthority: "governed P&A assembly job RPC lifecycle (oasis-supabase-core)",
    idempotencyKeyTemplate: "assembly_job:{id}",
    priorityProvenance: "derived from order/assembly planning — not client-assigned",
    slaProvenance: null,
    lifecycleStatusField: "b2b_assembly_jobs.status",
    departmentIdentityField: "packing_assembly",
    terminalStatuses: ["accepted", "rejected", "cancelled", "job_closed"],
    canonicalRoute: "/admin/assembly-tasks",
    disposition: "LEGACY_REDIRECT",
  },
  {
    laneKey: "ready_goods",
    legacyBoardId: "ready-goods",
    legacyQueueTypes: ["inventory_verification_queue", "retail_followup_queue"],
    canonicalRelation: "inventory_reservations",
    coreProducerAuthority: "reserve_rgs_stock / governed RGS reservation RPCs (oasis-supabase-core)",
    idempotencyKeyTemplate: "inventory_reservation:{id}",
    priorityProvenance: "inventory_reservations.reservation_priority",
    slaProvenance: "inventory_reservations.expires_at",
    lifecycleStatusField: "inventory_reservations.reservation_status",
    departmentIdentityField: "inventory_reservations.source_department",
    terminalStatuses: ["fulfilled", "released", "cancelled", "expired"],
    canonicalRoute: "/admin/ready-goods",
    disposition: "LEGACY_REDIRECT",
  },
  {
    laneKey: "dispatch",
    legacyBoardId: "dispatch",
    legacyQueueTypes: ["dispatch_queue", "scan_exception_queue"],
    canonicalRelation: "b2b_dispatch_consignments",
    coreProducerAuthority: "open_b2b_dispatch_consignment (oasis-supabase-core FACT-C1)",
    idempotencyKeyTemplate: "dispatch_consignment:{id}",
    priorityProvenance: "order/dispatch planning — server-derived",
    slaProvenance: null,
    lifecycleStatusField: "b2b_dispatch_consignments.status",
    departmentIdentityField: "dispatch",
    terminalStatuses: ["shipped", "cancelled", "gate_released"],
    canonicalRoute: "/admin/dispatch-mgmt",
    disposition: "LEGACY_REDIRECT",
  },
  {
    laneKey: "third_party",
    legacyBoardId: "third-party",
    legacyQueueTypes: ["retail_followup_queue"],
    canonicalRelation: "b2b_procurement_requirements",
    coreProducerAuthority: "create_procurement_requirement / P&A 3PGS bridge RPCs (oasis-supabase-core)",
    idempotencyKeyTemplate: "procurement_requirement:{id}",
    priorityProvenance: "b2b_procurement_requirements.priority",
    slaProvenance: "b2b_procurement_requirements.expected_at",
    lifecycleStatusField: "b2b_procurement_requirements.status",
    departmentIdentityField: "3pgs",
    terminalStatuses: ["fulfilled", "cancelled", "closed"],
    canonicalRoute: "/admin/3pgs-procurement-queue",
    disposition: "LEGACY_REDIRECT",
  },
  {
    laneKey: "retail",
    legacyBoardId: "retail",
    legacyQueueTypes: ["retail_followup_queue", "reservation_verification_queue"],
    canonicalRelation: "inventory_reservations",
    coreProducerAuthority: null,
    idempotencyKeyTemplate: "inventory_reservation:{id}",
    priorityProvenance: "inventory_reservations.reservation_priority",
    slaProvenance: "inventory_reservations.expires_at",
    lifecycleStatusField: "inventory_reservations.reservation_status",
    departmentIdentityField: "retail",
    terminalStatuses: ["fulfilled", "released", "cancelled", "expired"],
    canonicalRoute: "/admin/reservation-board",
    disposition: "BLOCKED_PREREQUISITE",
    blockedPrerequisite:
      "Core order-advance trigger or RPC to auto-create retail_followup_queue work from canonical orders (e.g. create_retail_followup_from_order) — not present in oasis-supabase-core migration ledger",
  },
  {
    laneKey: "complaints",
    legacyBoardId: "complaints",
    legacyQueueTypes: ["customer_support_queue"],
    canonicalRelation: "support_tickets",
    coreProducerAuthority: null,
    idempotencyKeyTemplate: "support_ticket:{id}",
    priorityProvenance: "support_tickets.severity",
    slaProvenance: "support_tickets.sla_resolution_due",
    lifecycleStatusField: "support_tickets.status",
    departmentIdentityField: "support_tickets.routed_to_department",
    terminalStatuses: ["resolved", "closed"],
    canonicalRoute: "/admin/support",
    disposition: "BLOCKED_PREREQUISITE",
    blockedPrerequisite:
      "Core order-advance trigger or RPC to auto-create customer_support_queue work from canonical orders (e.g. create_support_ticket_from_order) — support_tickets exists but has no governed auto-queue producer",
  },
];

/** Lanes Central may read from canonical Core authority. */
export function canonicalReadableLanes(): DepartmentQueueRoutingEntry[] {
  return DEPARTMENT_QUEUE_ROUTING.filter((lane) => lane.disposition !== "BLOCKED_PREREQUISITE");
}

export function laneByKey(laneKey: string): DepartmentQueueRoutingEntry | undefined {
  return DEPARTMENT_QUEUE_ROUTING.find((lane) => lane.laneKey === laneKey);
}

export function laneByLegacyBoard(boardId: string): DepartmentQueueRoutingEntry | undefined {
  return DEPARTMENT_QUEUE_ROUTING.find((lane) => lane.legacyBoardId === boardId);
}

export function blockedPrerequisiteLanes(): DepartmentQueueRoutingEntry[] {
  return DEPARTMENT_QUEUE_ROUTING.filter((lane) => lane.disposition === "BLOCKED_PREREQUISITE");
}

/** Returns true when a lifecycle status is terminal for the lane (closed work must not reappear). */
export function isTerminalQueueStatus(lane: DepartmentQueueRoutingEntry, status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return lane.terminalStatuses.some((t) => t.toLowerCase() === normalized);
}

/** Build deterministic idempotency key from lane template and source row id. */
export function buildQueueIdempotencyKey(lane: DepartmentQueueRoutingEntry, sourceRowId: string): string {
  return lane.idempotencyKeyTemplate.replace("{id}", sourceRowId);
}
