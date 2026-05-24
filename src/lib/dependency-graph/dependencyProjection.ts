import { resolveOperationalDependencies } from "./dependencyResolution";
import { projectDependencyEscalation } from "./dependencyEscalation";
import type { LaneSatisfactionMap } from "./dependencyTypes";

export interface UnifiedDependencyProjection {
  resolution: ReturnType<typeof resolveOperationalDependencies>;
  escalation: ReturnType<typeof projectDependencyEscalation>;
  generatedAt: string;
}

export function projectUnifiedDependency(satisfaction: LaneSatisfactionMap): UnifiedDependencyProjection {
  const resolution = resolveOperationalDependencies(satisfaction);
  const escalation = projectDependencyEscalation(resolution);
  return { resolution, escalation, generatedAt: new Date().toISOString() };
}

/** Finance-pending scenario used in CMD / queue demos — explicit inputs only. */
export function financeBlocksProductionProjection(): UnifiedDependencyProjection {
  return projectUnifiedDependency({
    finance: false,
    production: false,
    assembly: false,
    dispatch: false,
    scan: false,
    invoice: false,
    shipment: false,
  });
}
