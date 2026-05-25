import { DispatchFinalizationError } from "./dispatchFinalizationTypes";

export function requireTransporterReference(ref: string | null | undefined): string {
  const trimmed = ref?.trim();
  if (!trimmed) {
    throw new DispatchFinalizationError(
      "validation_failed",
      "Transporter handoff requires transporterReference",
    );
  }
  return trimmed;
}

export function isTransporterHandoffFinalized(
  finalized: boolean,
  transporterReference: string | null,
): boolean {
  return finalized && Boolean(transporterReference?.trim());
}
