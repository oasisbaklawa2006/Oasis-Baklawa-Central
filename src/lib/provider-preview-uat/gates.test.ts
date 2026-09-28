import { describe, expect, it } from "vitest";
import { PROVIDER_PREVIEW_TARGETS } from "./catalogue";
import { assertChromiumNeverCertifiesScannerPass, scannerAcceptanceStatus } from "./gates";

describe("provider-preview physical gates", () => {
  it("never allows scanner PASS semantics from Chromium crawl", () => {
    const scannerTarget = PROVIDER_PREVIEW_TARGETS.find((t) => t.uatId === "UAT-0128")!;
    expect(scannerAcceptanceStatus(scannerTarget)).toBe("PHYSICAL_GATE_PENDING");
    expect(assertChromiumNeverCertifiesScannerPass(scannerTarget, "NOT-TESTED")).toBe("NOT-TESTED");
    expect(assertChromiumNeverCertifiesScannerPass(scannerTarget, "OBSERVED")).toBe("OBSERVED");
  });

  it("keeps camera flow on software observation only", () => {
    const cameraTarget = PROVIDER_PREVIEW_TARGETS.find((t) => t.uatId === "UAT-0127")!;
    expect(cameraTarget.physicalGate).toBe("camera");
    expect(scannerAcceptanceStatus(cameraTarget)).toBe("NOT_APPLICABLE");
  });
});
