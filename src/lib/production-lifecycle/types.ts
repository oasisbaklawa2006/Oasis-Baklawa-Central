/**
 * Point88 — canonical production job lifecycle types.
 *
 * Server-side Core RPCs remain authoritative; these types give Central a
 * deterministic, fail-closed client boundary for validation and tests.
 */

export const PRODUCTION_JOB_STATUSES = [
  "pending",
  "accepted",
  "in_production",
  "paused",
  "ready",
  "completed",
  "rejected",
  "dispatched",
] as const;

export type ProductionJobStatus = (typeof PRODUCTION_JOB_STATUSES)[number];

export const OPEN_PRODUCTION_JOB_STATUSES = [
  "pending",
  "accepted",
  "in_production",
  "paused",
] as const;

export type OpenProductionJobStatus = (typeof OPEN_PRODUCTION_JOB_STATUSES)[number];

export const PRODUCTION_JOB_STAGES = ["prep", "processing", "finishing", "ready"] as const;

export type ProductionJobStage = (typeof PRODUCTION_JOB_STAGES)[number];

export const PAUSE_REASON_CODES = [
  "machine_breakdown",
  "material_shortage",
  "other",
] as const;

export type PauseReasonCode = (typeof PAUSE_REASON_CODES)[number];

export type ProductionLifecycleAction =
  | "allocate_shortage_demand"
  | "accept"
  | "reject"
  | "start"
  | "pause"
  | "resume"
  | "advance_stage"
  | "record_output"
  | "declare_ready"
  | "dispatch_to_rgs"
  | "quick_complete"
  | "day_end_signoff";

export type ProductionLifecycleRpcResult<T = Record<string, unknown>> = {
  data: T | null;
  error: { message: string } | null;
};

export type ProductionJobSnapshot = {
  id: string;
  status: ProductionJobStatus | string;
  stage: ProductionJobStage | string;
  assigned_qty: number;
  produced_qty?: number | null;
  wasted_qty?: number | null;
  department?: string | null;
  canonical_department?: string | null;
  batch_number?: string | null;
  updated_at?: string | null;
};

export const COMPLETION_OVERAGE_TOLERANCE = 0.1;
