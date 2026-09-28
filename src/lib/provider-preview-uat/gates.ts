import type { PhysicalGateKind, ProviderPreviewTarget } from "./catalogue";

export type FunctionStatus = "NOT-TESTED" | "BLOCKED" | "OBSERVED" | "FAIL";

export type VisualStatus = "NOT-TESTED" | "BLOCKED" | "OBSERVED" | "FAIL";

export type ScannerAcceptanceStatus = "PHYSICAL_GATE_PENDING" | "NOT_APPLICABLE";

export function scannerAcceptanceStatus(target: ProviderPreviewTarget): ScannerAcceptanceStatus {
  return target.physicalGate === "scanner" ? "PHYSICAL_GATE_PENDING" : "NOT_APPLICABLE";
}

/** Chromium must never certify scanner hardware PASS. */
export function assertChromiumNeverCertifiesScannerPass(
  target: ProviderPreviewTarget,
  proposedFunctionStatus: FunctionStatus,
): FunctionStatus {
  if (target.physicalGate !== "scanner") return proposedFunctionStatus;
  if (proposedFunctionStatus === "OBSERVED" || proposedFunctionStatus === "FAIL") {
    return proposedFunctionStatus;
  }
  return "NOT-TESTED";
}

export function deriveFunctionStatus(opts: {
  target: ProviderPreviewTarget;
  deployBlocked: boolean;
  deploymentWall: boolean;
  meaningfulSurface: boolean;
}): FunctionStatus {
  const { target, deployBlocked, deploymentWall, meaningfulSurface } = opts;
  if (deployBlocked || deploymentWall) return "BLOCKED";
  if (target.physicalGate === "scanner") {
    return meaningfulSurface ? "OBSERVED" : "NOT-TESTED";
  }
  if (target.physicalGate === "camera") {
    return meaningfulSurface ? "OBSERVED" : "NOT-TESTED";
  }
  return meaningfulSurface ? "OBSERVED" : "NOT-TESTED";
}

export function physicalGateNote(gate: PhysicalGateKind): string {
  if (gate === "scanner") {
    return "SCANNER_PHYSICAL_GATE — software preview only; Chromium does not certify scanner PASS.";
  }
  if (gate === "camera") {
    return "CAMERA_PHYSICAL_GATE — software preview only; device camera capture requires physical UAT.";
  }
  return "";
}
