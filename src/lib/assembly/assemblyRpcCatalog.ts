/**
 * Canonical governed Core RPCs for P&A assembly execution.
 * Central must route every assembly mutation through this set only.
 */
export const ASSEMBLY_GOVERNED_RPCS = [
  "create_assembly_job",
  "reserve_assembly_components",
  "create_assembly_3pgs_requirement",
  "authorize_partial_assembly_issue",
  "issue_assembly_components",
  "record_assembly_consumption",
  "complete_assembly_job",
  "accept_assembly_output",
  "initiate_assembly_handover",
  "acknowledge_assembly_handover",
  "reconcile_assembly_job",
  "close_assembly_job",
] as const;

/** Read-only helper RPCs (variance display; never mutates job state). */
export const ASSEMBLY_READ_ONLY_RPCS = ["compute_assembly_job_variance"] as const;

export type AssemblyGovernedRpc = (typeof ASSEMBLY_GOVERNED_RPCS)[number];
