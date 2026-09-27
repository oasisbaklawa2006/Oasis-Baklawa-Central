import type { WorkQueueId } from "@/lib/work-queues/queueTypes";
import type { DepartmentBoardId } from "@/lib/execution-boards/departmentBoardConfig";

/** How Central should treat a department queue lane. */
export type DepartmentQueueDisposition =
  | "CANONICAL_READ"
  | "LEGACY_REDIRECT"
  | "BLOCKED_PREREQUISITE";

/** Canonical Core relation that owns department work for a lane. */
export type DepartmentQueueAuthorityRelation =
  | "production_jobs"
  | "b2b_assembly_jobs"
  | "inventory_reservations"
  | "production_rgs_transfers"
  | "b2b_dispatch_consignments"
  | "b2b_procurement_requirements"
  | "b2b_3pgs_pending_demand_priority"
  | "support_tickets";

export interface DepartmentQueueRoutingEntry {
  /** Stable lane key used in routing contract and tests. */
  laneKey: string;
  /** Legacy execution-board id when one exists. */
  legacyBoardId?: DepartmentBoardId;
  /** Work-queue ids the legacy board used to filter on. */
  legacyQueueTypes: WorkQueueId[];
  /** Governed Core table/view that owns live work for this lane. */
  canonicalRelation: DepartmentQueueAuthorityRelation;
  /** Core RPC or trigger that auto-creates work from upstream events. null = prerequisite missing. */
  coreProducerAuthority: string | null;
  /** Deterministic idempotency key template — `${source}:${entityId}` pattern. */
  idempotencyKeyTemplate: string;
  /** Field on the canonical row that supplies priority (never client-invented). */
  priorityProvenance: string;
  /** Field on the canonical row that supplies SLA/due date when present. */
  slaProvenance: string | null;
  /** Field on the canonical row that supplies lifecycle status. */
  lifecycleStatusField: string;
  /** Department identity field for isolation filters. */
  departmentIdentityField: string;
  /** Terminal status values — closed work must not reappear as open. */
  terminalStatuses: readonly string[];
  /** Canonical Central route operators should use instead of legacy board. */
  canonicalRoute: string;
  disposition: DepartmentQueueDisposition;
  /** When disposition is BLOCKED_PREREQUISITE, exact Core dependency required. */
  blockedPrerequisite?: string;
}

/** Normalized read projection — not a shadow ledger, only a view over Core rows. */
export interface CanonicalDepartmentQueueItem {
  /** Deterministic projection id: `${canonicalRelation}:${sourceRowId}` */
  id: string;
  laneKey: string;
  queueType: WorkQueueId;
  entityType: string;
  entityId: string;
  orderId: string | null;
  customerId: string | null;
  title: string;
  state: string;
  ownerDepartment: string | null;
  assignedTo: string | null;
  escalationLevel: string;
  blockerCode: string | null;
  blockerSummary: string | null;
  priority: string;
  slaDueAt: string | null;
  sourceRelation: DepartmentQueueAuthorityRelation;
  sourceRowId: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalDepartmentQueueReadResult {
  items: CanonicalDepartmentQueueItem[];
  /** Lanes skipped because Core producer authority is absent. */
  blockedLanes: { laneKey: string; prerequisite: string }[];
  /** Legacy relation reads were intentionally not performed. */
  quarantinedLegacyRelation: "operational_queue_items";
}
