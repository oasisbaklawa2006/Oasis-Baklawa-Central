import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getRoleDestination } from "@/lib/auth-routing";
import AdminModuleRoute from "../AdminModuleRoute";

let mockRole = "STORE_READY_GOODS";
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ role: mockRole }) }));

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route
          path="/admin/3pgs-procurement-queue"
          element={
            <AdminModuleRoute moduleKey="inventory">
              <div>3PGS queue content</div>
            </AdminModuleRoute>
          }
        />
        <Route
          path="/admin/3pgs-tv"
          element={
            <AdminModuleRoute moduleKey="inventory">
              <div>3PGS TV content</div>
            </AdminModuleRoute>
          }
        />
        <Route path="/admin" element={<div>Admin landing</div>} />
        <Route path="/tv/3pgs" element={<div>Kiosk 3PGS TV</div>} />
        <Route path="/admin/ready-goods" element={<div>Ready goods landing</div>} />
        <Route path="/admin/dispatch-mgmt" element={<div>Dispatch landing</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminModuleRoute 3PGS operator gate", () => {
  it("blocks a role with generic inventory access but no 3PGS operator authority", () => {
    mockRole = "STORE_READY_GOODS";
    renderAt("/admin/3pgs-procurement-queue");
    expect(screen.queryByText("3PGS queue content")).toBeNull();
    expect(screen.getByText("Ready goods landing")).toBeTruthy();
  });

  // React Router v6 matches a route registered without a trailing slash
  // against a request path that has one; the gate must not be bypassable
  // by a trailing slash reaching the same rendered route.
  it("still blocks a role with generic inventory access when the request path carries a trailing slash", () => {
    mockRole = "STORE_READY_GOODS";
    renderAt("/admin/3pgs-procurement-queue/");
    expect(screen.queryByText("3PGS queue content")).toBeNull();
    expect(screen.getByText("Ready goods landing")).toBeTruthy();
  });

  it("admits a genuine 3PGS operator role", () => {
    mockRole = "STORE_3RD_PARTY";
    renderAt("/admin/3pgs-procurement-queue");
    expect(screen.getByText("3PGS queue content")).toBeTruthy();
  });

  it("admits a genuine 3PGS operator role even with a trailing slash", () => {
    mockRole = "STORE_3RD_PARTY";
    renderAt("/admin/3pgs-procurement-queue/");
    expect(screen.getByText("3PGS queue content")).toBeTruthy();
  });

  // normalizePathname must strip every trailing slash, not just one --
  // React Router still matches the route against a request path carrying
  // repeated trailing slashes.
  it("still blocks a role with generic inventory access when the request path carries repeated trailing slashes", () => {
    mockRole = "STORE_READY_GOODS";
    renderAt("/admin/3pgs-procurement-queue//");
    expect(screen.queryByText("3PGS queue content")).toBeNull();
    expect(screen.getByText("Ready goods landing")).toBeTruthy();
  });

  it("admits a genuine 3PGS operator role even with repeated trailing slashes", () => {
    mockRole = "STORE_3RD_PARTY";
    renderAt("/admin/3pgs-procurement-queue//");
    expect(screen.getByText("3PGS queue content")).toBeTruthy();
  });
});

describe("AdminModuleRoute 3PGS TV gate", () => {
  it.each([
    "DISPATCH_MANAGER",
    "DISPATCH_HEAD",
    "STORE_READY_GOODS",
    "STORE_INCHARGE",
    "RGS_ADMIN",
  ] as const)("blocks %s from the unfiltered admin-shell 3PGS TV route", (role) => {
    mockRole = role;
    renderAt("/admin/3pgs-tv");
    expect(screen.queryByText("3PGS TV content")).toBeNull();
  });

  it("admits STORE_3RD_PARTY to the admin-shell 3PGS TV route", () => {
    mockRole = "STORE_3RD_PARTY";
    renderAt("/admin/3pgs-tv");
    expect(screen.getByText("3PGS TV content")).toBeTruthy();
  });

  it("blocks kiosk-only TV_3PGS from the admin-shell alias while preserving the kiosk predicate", () => {
    mockRole = "TV_3PGS";
    renderAt("/admin/3pgs-tv");
    expect(screen.queryByText("3PGS TV content")).toBeNull();
    expect(screen.getByText("Kiosk 3PGS TV")).toBeTruthy();
    expect(getRoleDestination("TV_3PGS")).toBe("/tv/3pgs");
  });
});
