import { describe, expect, it } from "vitest";
import { APPVERSE_WAVE1_AREAS } from "./wave1";
import { APPVERSE_WORKSPACES } from "./workspaces";
import {
  WAVE1_HOME_ROUTE,
  WAVE1_LAUNCHPAD_KEYS,
  WAVE1_LAUNCHPAD_LANDING_PATHS,
  WAVE1_WORKSPACE_KEYS,
} from "./wave1Baseline";

describe("App-Verse Wave 1 baseline invariants", () => {
  it("keeps the frozen launchpad area keys", () => {
    expect(APPVERSE_WAVE1_AREAS.map((area) => area.key)).toEqual([...WAVE1_LAUNCHPAD_KEYS]);
  });

  it("keeps the frozen launchpad landing paths", () => {
    expect(APPVERSE_WAVE1_AREAS.map((area) => area.landingPath)).toEqual([
      ...WAVE1_LAUNCHPAD_LANDING_PATHS,
    ]);
  });

  it("keeps the seven workspace containers", () => {
    expect(APPVERSE_WORKSPACES.map((workspace) => workspace.key)).toEqual([
      ...WAVE1_WORKSPACE_KEYS,
    ]);
  });

  it("keeps Home anchored at /admin", () => {
    const home = APPVERSE_WORKSPACES.find((workspace) => workspace.key === "home");
    expect(home?.landingPath).toBe(WAVE1_HOME_ROUTE);
  });
});
