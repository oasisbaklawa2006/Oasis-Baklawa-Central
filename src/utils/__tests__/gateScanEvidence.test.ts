import { describe, expect, it } from "vitest";
import {
  GATE_SCAN_POST_RELEASE_STATUS,
  GATE_SCAN_PRE_RELEASE_STATUS,
  GATE_SCAN_RELEASE_DENIED_STATUS,
  gateScanCorrelationId,
} from "@/utils/gateScanEvidence";

describe("gateScanEvidence", () => {
  it("uses stable carton+barcode correlation identity", () => {
    expect(gateScanCorrelationId("carton-1", "OASIS-ABC-B1")).toBe("gate:carton-1:OASIS-ABC-B1");
    expect(gateScanCorrelationId("carton-1", "OASIS-ABC-B1")).toBe(
      gateScanCorrelationId("carton-1", "OASIS-ABC-B1"),
    );
  });

  it("never marks verified before governed release succeeds", () => {
    expect(GATE_SCAN_PRE_RELEASE_STATUS).toBe("scanned");
    expect(GATE_SCAN_POST_RELEASE_STATUS).toBe("verified");
    expect(GATE_SCAN_RELEASE_DENIED_STATUS).toBe("rejected");
    expect(GATE_SCAN_PRE_RELEASE_STATUS).not.toBe("verified");
  });
});
