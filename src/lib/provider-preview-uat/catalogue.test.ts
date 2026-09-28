import { describe, expect, it } from "vitest";
import { PROVIDER_PREVIEW_TARGETS, targetsForTranche } from "./catalogue";

describe("provider-preview catalogue", () => {
  it("covers UAT-0122..0131 with unique ids", () => {
    const ids = PROVIDER_PREVIEW_TARGETS.map((t) => t.uatId);
    expect(ids).toEqual([
      "UAT-0122",
      "UAT-0123",
      "UAT-0124",
      "UAT-0125",
      "UAT-0126",
      "UAT-0127",
      "UAT-0128",
      "UAT-0129",
      "UAT-0130",
      "UAT-0131",
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("splits ai-studio and trace tranches", () => {
    expect(targetsForTranche("ai-studio").every((t) => t.app === "ai-studio")).toBe(true);
    expect(targetsForTranche("trace").every((t) => t.app === "trace")).toBe(true);
    expect(targetsForTranche("all").length).toBe(10);
  });

  it("marks trace scanner rows with scanner physical gate", () => {
    const trace = targetsForTranche("trace");
    expect(trace.every((t) => t.physicalGate === "scanner")).toBe(true);
  });
});
