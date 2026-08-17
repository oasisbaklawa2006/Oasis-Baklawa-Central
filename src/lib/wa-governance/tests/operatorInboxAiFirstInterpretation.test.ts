import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hookSource = readFileSync(
  "src/components/whatsapp/useOperatorInboxProductResolution.ts",
  "utf8",
);

describe("Operator Inbox AI-first interpretation sequencing", () => {
  it("does not gate packet interpretation on sender/client resolution", () => {
    expect(hookSource).toContain("interpretPacketContentRich");
    expect(hookSource).not.toContain("isProductResolutionUpstreamReady");

    const interpretationCall = hookSource.indexOf(
      "const interpretation = await interpretPacketContentRich",
    );
    const productResolutionCall = hookSource.indexOf(
      "const productResult = await fetchProductResolution",
    );

    expect(interpretationCall).toBeGreaterThan(-1);
    expect(productResolutionCall).toBeGreaterThan(interpretationCall);
  });
});
