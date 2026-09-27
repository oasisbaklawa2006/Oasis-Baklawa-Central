import { describe, expect, it } from "vitest";
import {
  OASIS_DISPLAY_SURFACES,
  buildDisplayAssignmentIntentCommand,
  buildDisplayAssignmentPayload,
  findDisplaySurface,
} from "@/lib/displayDevice/displayAssignmentContract";

describe("displayAssignmentContract", () => {
  it("includes Trace TV surfaces without certifying preview surfaces", () => {
    expect(findDisplaySurface("trace-gate")?.origin).toBe("trace");
    expect(findDisplaySurface("assembly")?.certification).toBe("preview");
  });

  it("builds governed assignment provisioning command", () => {
    const payload = buildDisplayAssignmentPayload({ surfaceKey: "trace-gate", friendlyName: "Gate TV 01" });
    const cmd = buildDisplayAssignmentIntentCommand(payload);
    expect(cmd).toContain("oasis_display_assignment");
    expect(cmd).toContain("trace-gate");
  });

  it("keeps catalog entries unique by key", () => {
    const keys = OASIS_DISPLAY_SURFACES.map((surface) => surface.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
