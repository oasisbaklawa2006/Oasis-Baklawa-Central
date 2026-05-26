import { describe, expect, it } from "vitest";
import { FORBIDDEN_DISPATCH_ACTIONS } from "../dispatchReadinessTypes";
import { FORBIDDEN_DISPATCH_UI_LABELS } from "@/pages/admin/DispatchReadinessBoard";

describe("dispatch dashboard guards", () => {
  it("forbidden actions list includes complete and mark_dispatched", () => {
    expect(FORBIDDEN_DISPATCH_ACTIONS).toContain("dispatch:complete");
    expect(FORBIDDEN_DISPATCH_ACTIONS).toContain("dispatch:mark_dispatched");
    expect(FORBIDDEN_DISPATCH_ACTIONS).toContain("dispatch:final_release");
  });

  it("UI labels exclude dispatch completion and invoice flows", () => {
    for (const label of FORBIDDEN_DISPATCH_UI_LABELS) {
      expect(label.toLowerCase()).not.toBe("dispatch");
    }
    expect(FORBIDDEN_DISPATCH_UI_LABELS.join(" ")).toMatch(/Dispatch Complete/);
    expect(FORBIDDEN_DISPATCH_UI_LABELS.join(" ")).toMatch(/Invoice/);
  });
});
