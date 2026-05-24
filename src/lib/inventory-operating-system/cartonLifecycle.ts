import type { CartonLifecycleState } from "./inventoryTypes";

/** Forward-only lifecycle edges (reversible only via new movements / governance — not in-place mutation). */
export const CARTON_VALID_NEXT: Record<CartonLifecycleState, CartonLifecycleState[]> = {
  created: ["labeled", "damaged", "destroyed"],
  labeled: ["scanned_in", "damaged", "destroyed"],
  scanned_in: ["reserved", "scanned_out", "damaged", "destroyed"],
  scanned_out: ["packed", "damaged", "destroyed"],
  reserved: ["packed", "scanned_in", "damaged", "destroyed"],
  packed: ["dispatched", "damaged", "destroyed"],
  dispatched: ["delivered", "damaged", "destroyed"],
  delivered: ["damaged", "destroyed"],
  damaged: ["destroyed"],
  destroyed: [],
};

export function isCartonTransitionValid(from: CartonLifecycleState, to: CartonLifecycleState): boolean {
  return CARTON_VALID_NEXT[from]?.includes(to) ?? false;
}

export function deriveCartonRisk(state: CartonLifecycleState): "low" | "medium" | "high" {
  if (state === "damaged" || state === "destroyed") return "high";
  if (state === "dispatched" || state === "packed") return "medium";
  return "low";
}
