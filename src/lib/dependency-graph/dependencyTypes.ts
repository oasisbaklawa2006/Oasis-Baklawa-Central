export type OperationalDependencyLane =
  | "finance"
  | "production"
  | "assembly"
  | "dispatch"
  | "shipment"
  | "invoice"
  | "scan"
  | "reservation"
  | "inventory_verification";

export interface OperationalDependencyNode {
  lane: OperationalDependencyLane;
  label: string;
  dependsOn: OperationalDependencyLane[];
}

export const DEFAULT_OPERATIONAL_DEPENDENCY_GRAPH: OperationalDependencyNode[] = [
  { lane: "finance", label: "Finance verification", dependsOn: [] },
  { lane: "production", label: "Production complete", dependsOn: ["finance"] },
  { lane: "assembly", label: "Assembly complete", dependsOn: ["production"] },
  { lane: "invoice", label: "Invoice issued", dependsOn: ["finance"] },
  { lane: "dispatch", label: "Dispatch ready", dependsOn: ["assembly", "scan"] },
  { lane: "scan", label: "Gate scan complete", dependsOn: ["assembly"] },
  { lane: "shipment", label: "Shipment released", dependsOn: ["dispatch", "invoice"] },
  { lane: "reservation", label: "Reservation confirmed", dependsOn: ["inventory_verification"] },
  { lane: "inventory_verification", label: "Inventory verified", dependsOn: [] },
];

export type LaneSatisfactionMap = Partial<Record<OperationalDependencyLane, boolean>>;
