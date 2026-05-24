export type EntityReadinessState = "ready" | "pending" | "blocked" | "not_applicable";

export interface EntityReadinessBlocker {
  code: string;
  label: string;
  upstreamEntityType?: string;
  upstreamEntityId?: string;
}

export interface EntityReadinessProjection {
  state: EntityReadinessState;
  blockers: EntityReadinessBlocker[];
  /** Human summary for queue cards. */
  summary: string;
}

export function blockedReadiness(blockers: EntityReadinessBlocker[]): EntityReadinessProjection {
  const summary =
    blockers.length === 0
      ? "Blocked — reason unspecified"
      : `Blocked: ${blockers.map((b) => b.label).join("; ")}`;
  return { state: "blocked", blockers, summary };
}

export function pendingReadiness(reason: string): EntityReadinessProjection {
  return { state: "pending", blockers: [{ code: "pending", label: reason }], summary: reason };
}

export function readyReadiness(): EntityReadinessProjection {
  return { state: "ready", blockers: [], summary: "Ready for downstream work" };
}

export function notApplicableReadiness(reason: string): EntityReadinessProjection {
  return { state: "not_applicable", blockers: [], summary: reason };
}
