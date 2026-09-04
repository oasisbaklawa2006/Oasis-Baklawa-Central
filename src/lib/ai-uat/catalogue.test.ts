import { describe, expect, it } from "vitest";
import { APPVERSE_AI_UAT_TRANCHE_1, getAiUatCase } from "./catalogue";

describe("APPVERSE AI UAT tranche 1 catalogue", () => {
  it("contains exactly UAT-001 through UAT-010 once each", () => {
    const ids = APPVERSE_AI_UAT_TRANCHE_1.map((entry) => entry.id);
    expect(ids).toEqual(Array.from({ length: 10 }, (_, i) => `UAT-${String(i + 1).padStart(3, "0")}`));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every route bounded to an app-relative path", () => {
    for (const testCase of APPVERSE_AI_UAT_TRANCHE_1) {
      for (const route of [testCase.startRoute, ...testCase.allowedRoutes, ...testCase.forbiddenRoutes]) {
        expect(route.startsWith("/")).toBe(true);
        expect(route.startsWith("//")).toBe(false);
      }
    }
  });

  it("binds Dispatch direct-route denial to finance, CMD, admin, store and gate surfaces", () => {
    expect(getAiUatCase("UAT-010").forbiddenRoutes).toEqual(
      expect.arrayContaining([
        "/admin/finance",
        "/admin/users",
        "/admin/cmd-war-room",
        "/admin/ready-goods",
        "/security-gate",
      ]),
    );
  });
});
