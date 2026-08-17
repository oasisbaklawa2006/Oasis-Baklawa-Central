import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hookSource = readFileSync(
  "src/components/whatsapp/useOperatorInboxProductResolution.ts",
  "utf8",
);

describe("Operator Inbox AI-first interpretation sequencing", () => {
  it("uses server packet AI first without gating interpretation on sender/client resolution", () => {
    expect(hookSource).toContain("fetchLatestPacketAiInterpretation");
    expect(hookSource).toContain("interpretPacketContentRich");
    expect(hookSource).not.toContain("isProductResolutionUpstreamReady");

    const persistedLookup = hookSource.indexOf(
      "const persisted = await fetchLatestPacketAiInterpretation",
    );
    const fallbackInterpretation = hookSource.indexOf(
      "persisted ?? await interpretPacketContentRich",
    );
    const productResolutionCall = hookSource.indexOf(
      "const productResult = await fetchProductResolution",
    );

    expect(persistedLookup).toBeGreaterThan(-1);
    expect(fallbackInterpretation).toBeGreaterThan(persistedLookup);
    expect(productResolutionCall).toBeGreaterThan(fallbackInterpretation);
  });
});
