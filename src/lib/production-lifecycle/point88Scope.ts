/**
 * Point88 scope boundaries — separates lifecycle authority from adjacent lanes.
 *
 * Point87 — production execution workspace (Operations Controller shell, tab
 *           navigation, job listing). No governed mutation authority.
 * Point88 — targets, allocation, assignment, start/pause/resume/complete.
 * Point89 — production exceptions and QH governance (issue report/resolve).
 */

export const POINT88_ASM_ID = "POINT88";

export const POINT87_WORKSPACE_ROUTE = "/operations-controller";

export const POINT88_LIFECYCLE_RPCS = [
  "create_production_shortage_demand",
  "accept_production_job",
  "reject_production_job",
  "start_production_job",
  "pause_production_job",
  "resume_production_job",
  "advance_production_job_stage",
  "record_production_output",
  "declare_production_ready",
  "dispatch_production_to_rgs",
  "quick_log_production_to_rgs",
  "submit_production_day_end",
] as const;

export type Point88LifecycleRpc = (typeof POINT88_LIFECYCLE_RPCS)[number];

export const POINT89_EXCEPTION_RPCS = [
  "report_production_issue",
  "resolve_production_issue",
] as const;

export type Point89ExceptionRpc = (typeof POINT89_EXCEPTION_RPCS)[number];

export const POINT88_LIFECYCLE_ACTIONS = [
  "allocate_shortage_demand",
  "accept",
  "reject",
  "start",
  "pause",
  "resume",
  "advance_stage",
  "record_output",
  "declare_ready",
  "dispatch_to_rgs",
  "quick_complete",
  "day_end_signoff",
] as const;

export function isPoint88LifecycleRpc(rpcName: string): rpcName is Point88LifecycleRpc {
  return (POINT88_LIFECYCLE_RPCS as readonly string[]).includes(rpcName);
}

export function isPoint89ExceptionRpc(rpcName: string): rpcName is Point89ExceptionRpc {
  return (POINT89_EXCEPTION_RPCS as readonly string[]).includes(rpcName);
}

export function assertPoint88LifecycleRpc(rpcName: string): Point88LifecycleRpc {
  if (!isPoint88LifecycleRpc(rpcName)) {
    throw new Error(
      `ROUTING REJECTED — RPC "${rpcName}" is outside Point88 lifecycle authority. ` +
        "Exception/QH actions belong to Point89; workspace-only surfaces belong to Point87.",
    );
  }
  return rpcName;
}
