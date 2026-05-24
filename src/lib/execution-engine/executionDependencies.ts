export type ExecutionLane = "finance" | "production" | "packing" | "barcode" | "dispatch" | "reservation" | "pickup";

export interface ExecutionDependency {
  id: string;
  lane: ExecutionLane;
  label: string;
  /** Lanes that must be satisfied before this lane is considered ready. */
  dependsOn: ExecutionLane[];
}

export const DEFAULT_DISPATCH_GRAPH: ExecutionDependency[] = [
  { id: "dep:finance", lane: "finance", label: "Finance verification", dependsOn: [] },
  { id: "dep:production", lane: "production", label: "Production readiness", dependsOn: ["finance"] },
  { id: "dep:packing", lane: "packing", label: "Packing completion", dependsOn: ["production"] },
  { id: "dep:barcode", lane: "barcode", label: "Barcode / label readiness", dependsOn: ["packing"] },
  { id: "dep:dispatch", lane: "dispatch", label: "Dispatch extraction", dependsOn: ["barcode", "finance"] },
];
