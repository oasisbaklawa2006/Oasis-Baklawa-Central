import { describe, expect, it } from "vitest";

import {
  APPVERSE_WORKSPACES,
  canAccessWorkspace,
  getWorkspaceForPath,
} from "./workspaces";

describe("App-Verse workspace registry", () => {
  it("keeps the permanent workspace count at seven", () => {
    expect(APPVERSE_WORKSPACES).toHaveLength(7);
  });

  it("resolves every workspace landing path back to itself", () => {
    for (const workspace of APPVERSE_WORKSPACES) {
      expect(getWorkspaceForPath(workspace.landingPath).key).toBe(workspace.key);
    }
  });

  it("maps operational routes into Operations", () => {
    expect(getWorkspaceForPath("/admin/execution/production").key).toBe("operations");
    expect(getWorkspaceForPath("/admin/dispatch-readiness").key).toBe("operations");
    expect(getWorkspaceForPath("/admin/live-work-queues").key).toBe("operations");
  });

  it("maps customer and finance routes correctly", () => {
    expect(getWorkspaceForPath("/admin/clients").key).toBe("customers-sales");
    expect(getWorkspaceForPath("/admin/finance").key).toBe("orders-finance");
    expect(getWorkspaceForPath("/admin/finance-governance").key).toBe("orders-finance");
  });

  it("preserves product and trace boundaries", () => {
    expect(getWorkspaceForPath("/admin/catalogue-sync").key).toBe("products-catalogue");
    expect(getWorkspaceForPath("/admin/carton-explorer").key).toBe("trace-dispatch");
  });

  it("allows super access and denies unrelated module sets", () => {
    const products = APPVERSE_WORKSPACES.find((workspace) => workspace.key === "products-catalogue");
    expect(products).toBeDefined();
    expect(canAccessWorkspace(products!, ["*"])).toBe(true);
    expect(canAccessWorkspace(products!, ["finance"])).toBe(false);
    expect(canAccessWorkspace(products!, ["products"])).toBe(true);
  });
});
