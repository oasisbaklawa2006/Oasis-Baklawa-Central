import { describe, expect, it } from "vitest";
import { APPVERSE_WAVE1_AREAS, getVisibleWave1Areas } from "./wave1";

describe("App-Verse Wave 1 registry", () => {
  it("keeps the first implementation wave compact", () => {
    expect(APPVERSE_WAVE1_AREAS.map((area) => area.key)).toEqual([
      "orders-finance",
      "operations-production",
      "whatsapp-support",
    ]);
  });

  it("shows every Wave 1 area to wildcard authority", () => {
    expect(getVisibleWave1Areas(["*"])).toHaveLength(3);
  });

  it("keeps finance-only users out of operations and support", () => {
    expect(getVisibleWave1Areas(["finance", "accounts"]).map((area) => area.key)).toEqual([
      "orders-finance",
    ]);
  });

  it("shows customer-attention workspace when support is granted", () => {
    expect(getVisibleWave1Areas(["support"]).map((area) => area.key)).toEqual([
      "whatsapp-support",
    ]);
  });
});
