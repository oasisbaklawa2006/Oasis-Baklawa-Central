import type {
  ProductionJobSnapshot,
  ProductionJobStage,
  ProductionJobStatus,
  ProductionLifecycleAction,
} from "./types";
import { PRODUCTION_JOB_STAGES } from "./types";

export type LifecycleTransitionRule = {
  action: ProductionLifecycleAction;
  rpc: string;
  requiredStatuses: readonly ProductionJobStatus[];
  requiredStages?: readonly ProductionJobStage[];
  terminal?: boolean;
};

/**
 * Client-side transition matrix mirroring oasis-supabase-core production_jobs
 * lifecycle guards. Core RPCs remain authoritative; Central uses this matrix to
 * fail closed before issuing an RPC that would certainly be rejected.
 */
export const PRODUCTION_LIFECYCLE_TRANSITIONS: LifecycleTransitionRule[] = [
  {
    action: "accept",
    rpc: "accept_production_job",
    requiredStatuses: ["pending"],
  },
  {
    action: "reject",
    rpc: "reject_production_job",
    requiredStatuses: ["pending"],
    terminal: true,
  },
  {
    action: "start",
    rpc: "start_production_job",
    requiredStatuses: ["accepted"],
  },
  {
    action: "pause",
    rpc: "pause_production_job",
    requiredStatuses: ["in_production"],
  },
  {
    action: "resume",
    rpc: "resume_production_job",
    requiredStatuses: ["paused"],
  },
  {
    action: "advance_stage",
    rpc: "advance_production_job_stage",
    requiredStatuses: ["in_production", "paused"],
  },
  {
    action: "record_output",
    rpc: "record_production_output",
    requiredStatuses: ["in_production", "paused"],
  },
  {
    action: "declare_ready",
    rpc: "declare_production_ready",
    requiredStatuses: ["in_production", "paused"],
    requiredStages: ["ready"],
  },
  {
    action: "dispatch_to_rgs",
    rpc: "dispatch_production_to_rgs",
    requiredStatuses: ["ready", "completed"],
  },
];

export function ruleForAction(action: ProductionLifecycleAction): LifecycleTransitionRule | undefined {
  return PRODUCTION_LIFECYCLE_TRANSITIONS.find((rule) => rule.action === action);
}

export function isStatusAllowedForAction(
  action: ProductionLifecycleAction,
  status: string,
): boolean {
  const rule = ruleForAction(action);
  if (!rule) return true;
  return rule.requiredStatuses.includes(status as ProductionJobStatus);
}

export function isStageAllowedForAction(
  action: ProductionLifecycleAction,
  stage: string,
): boolean {
  const rule = ruleForAction(action);
  if (!rule?.requiredStages) return true;
  return rule.requiredStages.includes(stage as ProductionJobStage);
}

export function assertLifecycleTransition(
  action: ProductionLifecycleAction,
  job: ProductionJobSnapshot,
): void {
  const rule = ruleForAction(action);
  if (!rule) return;

  if (!rule.requiredStatuses.includes(job.status as ProductionJobStatus)) {
    throw new Error(
      `Invalid production transition: action=${action} requires status in [${rule.requiredStatuses.join(", ")}] but job ${job.id} is ${job.status}`,
    );
  }

  if (rule.requiredStages && !rule.requiredStages.includes(job.stage as ProductionJobStage)) {
    throw new Error(
      `Invalid production transition: action=${action} requires stage in [${rule.requiredStages.join(", ")}] but job ${job.id} is at ${job.stage}`,
    );
  }
}

export function nextStageAfter(currentStage: string): ProductionJobStage | null {
  const idx = PRODUCTION_JOB_STAGES.indexOf(currentStage as ProductionJobStage);
  if (idx < 0 || idx >= PRODUCTION_JOB_STAGES.length - 1) return null;
  return PRODUCTION_JOB_STAGES[idx + 1];
}

export function canAdvanceStage(job: ProductionJobSnapshot): boolean {
  return (
    isStatusAllowedForAction("advance_stage", job.status) &&
    nextStageAfter(job.stage) !== null
  );
}

export function isTerminalProductionStatus(status: string): boolean {
  return ["rejected", "completed", "dispatched"].includes(status);
}

export function isStaleVersionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("stale") ||
    normalized.includes("expected_version") ||
    normalized.includes("version mismatch") ||
    normalized.includes("concurrent")
  );
}
