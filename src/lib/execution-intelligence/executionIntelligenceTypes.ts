import type { OperationalScanRecord } from "@/lib/barcode-execution/barcodeExecutionTypes";
import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";
import type { WorkQueueSnapshot } from "@/lib/work-queues/queueTypes";

/** Normalized queue row for intelligence (read-only projection input). */
export interface ExecutionIntelligenceQueueItem {
  id: string;
  queueType: string;
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
  slaDueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionIntelligenceInput {
  nowIso: string;
  queueItems: ExecutionIntelligenceQueueItem[];
  events: OperationalStoreEventRecord[];
  scans: OperationalScanRecord[];
  liveFeedSnapshots?: WorkQueueSnapshot[];
}

export type SlaSeverity = "fresh" | "aging" | "breached" | "critical";

export interface SlaAssessment {
  queueItemId: string;
  severity: SlaSeverity;
  ageHours: number;
  breachReason: string | null;
  recommendation: string;
  customerRiskWeight: number;
}

export type ExecutionRiskLevel = "low" | "medium" | "high" | "critical";

export interface ExecutionRiskAssessment {
  entityKey: string;
  entityType: string;
  entityId: string;
  orderId: string | null;
  level: ExecutionRiskLevel;
  score: number;
  signals: string[];
}

export interface EscalationHotspot {
  department: string;
  escalationCount: number;
  blockedCount: number;
  queueTypes: string[];
}

export interface CongestionCell {
  department: string;
  openCount: number;
  breachedCount: number;
  blockedCount: number;
  heat: number;
}

export interface BottleneckNode {
  id: string;
  label: string;
  department: string;
  depth: number;
  blocked: boolean;
  childIds: string[];
}

export interface OwnershipCell {
  actorKey: string;
  department: string;
  assignedCount: number;
  agingCount: number;
  overloaded: boolean;
}

export interface ScanHotspot {
  scanType: string;
  status: string;
  count: number;
  latestAt: string;
}

export interface OperationalEventStreamItem {
  id: string;
  eventType: string;
  title: string;
  severity: string;
  entityType: string;
  entityId: string;
  orderId: string | null;
  createdAt: string;
  /** Hidden from stream when customer-unsafe internal label detected. */
  staffOnly: boolean;
}

export interface ExecutionCommandCenterProjection {
  generatedAt: string;
  globalQueuePressure: { open: number; breached: number; blocked: number; escalated: number };
  slaBreaches: SlaAssessment[];
  escalationHotspots: EscalationHotspot[];
  congestionHeatmap: CongestionCell[];
  ordersAtRisk: ExecutionRiskAssessment[];
  customerRiskLane: ExecutionRiskAssessment[];
  bottlenecks: BottleneckNode[];
  scanHotspots: ScanHotspot[];
  pendingGateVerifications: OperationalScanRecord[];
  ownershipMatrix: OwnershipCell[];
  eventStream: OperationalEventStreamItem[];
  departmentThroughput: { department: string; completedEvents24h: number; openQueues: number }[];
  executionConfidence: number;
}
