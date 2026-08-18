import { describe, expect, it } from "vitest";
import { APPVERSE_APPS, getInternalApps } from "./appRegistry";
import { APPVERSE_TV_SURFACES, getTvSurfacesForRole } from "./tvSurfaces";

describe("App-Verse application registry", () => {
  it("keeps Central, AI Studio and Trace as the internal application set", () => {
    expect(getInternalApps().map((app) => app.key)).toEqual(["central", "ai-studio", "trace"]);
  });

  it("keeps the buyer application explicitly customer-facing", () => {
    const buyer = APPVERSE_APPS.find((app) => app.key === "buyer");
    expect(buyer?.surface).toBe("customer");
  });
});

describe("App-Verse TV registry", () => {
  it("registers existing production and operational TV surfaces", () => {
    // Owner's six-TV estate (Central issue #368): five production lines +
    // Ready Goods, plus the two non-production-department Assembly/Dispatch
    // preview TVs. Dragees has no entry of its own -- see next test.
    expect(APPVERSE_TV_SURFACES.length).toBe(8);
  });

  it("limits HOD views to their relevant line", () => {
    expect(getTvSurfacesForRole("HOD_BAKERY").map((surface) => surface.route)).toEqual(["/tv/bakery"]);
  });

  it("folds Dragees into the Chocolates & Confectionery TV rather than a standalone screen", () => {
    expect(APPVERSE_TV_SURFACES.some((surface) => surface.key === "dragees")).toBe(false);
    expect(getTvSurfacesForRole("HOD_DRAGEES").map((surface) => surface.route)).toEqual(["/tv/chocolate"]);
  });

  it("routes Ready Goods to its chrome-free kiosk route, not the admin shell", () => {
    expect(getTvSurfacesForRole("TV_READY").map((surface) => surface.route)).toEqual(["/tv/rgs"]);
  });

  it("allows administrators to inspect every display surface", () => {
    expect(getTvSurfacesForRole("ADMIN")).toHaveLength(APPVERSE_TV_SURFACES.length);
  });
});
