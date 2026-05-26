import { assessQueueSla } from "@/lib/execution-intelligence/slaBreachDetection";
import type { ExecutionIntelligenceQueueItem } from "@/lib/execution-intelligence/executionIntelligenceTypes";
import type { MappedQueueItem } from "@/lib/persistent-queues/queueRowMapper";
import type { OperationalScanRecord } from "@/lib/barcode-execution/barcodeExecutionTypes";
import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";
import type { DepartmentBoardConfig } from "./departmentBoardConfig";
import {
  projectBoardReservationIndicator,
  type BoardReservationIndicator,
} from "@/lib/inventory-reservations/reservationProjection";
import type { InventoryReservationRecord } from "@/lib/inventory-reservations/reservationTypes";

export type ExecutionBoardLane =
  | "queue"
  | "blocked"
  | "escalated"
  | "completed_today"
  | "aging"
  | "unowned";

export interface ExecutionBoardCardModel {
  item: MappedQueueItem;
  lane: ExecutionBoardLane;
  slaSeverity: string;
  slaRecommendation: string;
  customerRiskInternal: boolean;
  latestScanStatus: string | null;
  scanIssue: boolean;
  dependencyRisk: boolean;
  reservationIndicator: BoardReservationIndicator;
}

export interface ExecutionBoardLanes {
  queue: ExecutionBoardCardModel[];
  blocked: ExecutionBoardCardModel[];
  escalated: ExecutionBoardCardModel[];
  completedToday: ExecutionBoardCardModel[];
  aging: ExecutionBoardCardModel[];
  unowned: ExecutionBoardCardModel[];
}

function toIntelItem(item: MappedQueueItem): ExecutionIntelligenceQueueItem {
  return {
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
  };
}

function isCompletedToday(item: MappedQueueItem, nowIso: string): boolean {
  if (item.state !== "completed" || !item.completedAt) return false;
  const day = nowIso.slice(0, 10);
  return item.completedAt.slice(0, 10) === day;
}

export function projectExecutionBoardLanes(
  items: MappedQueueItem[],
  config: DepartmentBoardConfig,
  nowIso: string,
  scans: OperationalScanRecord[],
  reservations: InventoryReservationRecord[] = [],
): ExecutionBoardLanes {
  const showReservation =
    config.id === "ready-goods" ||
    config.id === "dispatch" ||
    config.id === "retail" ||
    config.id === "production";
  const scoped = items.filter((i) => config.queueTypes.includes(i.queueType));
  const thirdPartyOnly =
    config.id === "third-party"
      ? scoped.filter((i) => i.source?.includes("third") || i.title.toLowerCase().includes("3p"))
      : scoped;

  const cards: ExecutionBoardCardModel[] = thirdPartyOnly.map((item) => {
    const sla = assessQueueSla(toIntelItem(item), nowIso);
    const entityScans = scans.filter((s) => s.entityId === item.entityId);
    const latest = entityScans[0] ?? null;
    const scanIssue =
      latest != null &&
      (latest.verificationStatus === "mismatch" ||
        latest.verificationStatus === "rejected" ||
        latest.verificationStatus === "duplicate");
    let lane: ExecutionBoardLane = "queue";
    if (item.state === "completed" && isCompletedToday(item, nowIso)) lane = "completed_today";
    else if (item.state === "blocked" || item.blockerCode) lane = "blocked";
    else if (item.escalationLevel !== "none" || item.state === "escalated") lane = "escalated";
    else if (!item.assignedTo && !["completed", "cancelled"].includes(item.state)) lane = "unowned";
    else if (sla.severity === "aging" || sla.severity === "breached" || sla.severity === "critical")
      lane = "aging";
    return {
      item,
      lane,
      slaSeverity: sla.severity,
      slaRecommendation: sla.recommendation,
      customerRiskInternal: Boolean(item.customerId || item.orderId),
      latestScanStatus: latest?.verificationStatus ?? null,
      scanIssue,
      dependencyRisk: Boolean(item.blockerCode) || item.state === "blocked",
      reservationIndicator: showReservation
        ? projectBoardReservationIndicator(item.orderId, reservations, nowIso)
        : "none",
    };
  });

  const lanes: ExecutionBoardLanes = {
    queue: [],
    blocked: [],
    escalated: [],
    completedToday: [],
    aging: [],
    unowned: [],
  };
  for (const c of cards) {
    lanes[c.lane === "completed_today" ? "completedToday" : c.lane].push(c);
  }
  return lanes;
}

export function filterBoardEvents(
  events: OperationalStoreEventRecord[],
  queueItemId: string | null,
  entityId: string | null,
): OperationalStoreEventRecord[] {
  return events.filter(
    (e) => e.queueItemId === queueItemId || (entityId && e.entityId === entityId),
  );
}
