import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX,
  CENTRAL_DEFERRED_AUTHORITY_COLLISIONS,
  CENTRAL_NAV_MODULE_OVERRIDES,
  getCentralMatrixEntry,
} from "../centralAdminModuleAuthorityMatrix";
import { getRequiredModuleForAdminPath } from "../routeAccess";

const appTsxPath = resolve(process.cwd(), "src/App.tsx");
const adminLayoutPath = resolve(process.cwd(), "src/components/AdminLayout.tsx");
const appTsx = readFileSync(appTsxPath, "utf-8");
const adminLayout = readFileSync(adminLayoutPath, "utf-8");

function extractAppRoutePaths(): string[] {
  const pattern = /<Route\s+path="([^"]+)"/g;
  const paths: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(appTsx)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

function toAbsoluteRoute(rawPath: string): string | null {
  if (rawPath === "*") return null;
  if (rawPath.startsWith("/")) return rawPath;
  return `/admin/${rawPath}`;
}

function extractAdminModuleRouteKeys(): Map<string, string> {
  const map = new Map<string, string>();
  const blocks = appTsx.split(/<Route\s+/);
  for (const block of blocks) {
    const pathMatch = block.match(/^path="([^"]+)"/);
    const moduleMatch = block.match(/<AdminModuleRoute moduleKey="([^"]+)">/);
    if (pathMatch && moduleMatch) {
      map.set(`/admin/${pathMatch[1]}`, moduleMatch[1]);
    }
  }
  return map;
}

function extractAdminLayoutNavItems(): Array<{ to: string; moduleKey: string }> {
  const items: Array<{ to: string; moduleKey: string }> = [];
  const pattern = /\{\s*to:\s*"([^"]+)",[\s\S]*?moduleKey:\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(adminLayout)) !== null) {
    items.push({ to: match[1], moduleKey: match[2] });
  }
  return items;
}

const mountedRoutes = extractAppRoutePaths()
  .map(toAbsoluteRoute)
  .filter((route): route is string => route !== null);

const matrixRoutes = new Set(CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX.map((e) => e.route));
const deferredCollisionRoutes = new Set<string>(
  CENTRAL_DEFERRED_AUTHORITY_COLLISIONS.map((c) => c.route),
);

describe("Central module authority matrix — registry integrity", () => {
  it("has unique route keys", () => {
    const routes = CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX.map((e) => e.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("covers every mounted App.tsx route", () => {
    const missing = mountedRoutes.filter((route) => !matrixRoutes.has(route));
    expect(missing, `Matrix missing mounted routes: ${missing.join(", ")}`).toEqual([]);
  });

  it("does not invent routes absent from App.tsx", () => {
    const extra = [...matrixRoutes].filter((route) => !mountedRoutes.includes(route));
    expect(extra, `Matrix has routes not in App.tsx: ${extra.join(", ")}`).toEqual([]);
  });
});

describe("Central module authority matrix — routeAccess alignment", () => {
  const adminEntries = CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX.filter(
    (e) => e.surface === "CENTRAL_ADMIN" && e.routeGuardModuleKey !== null,
  );

  it.each(adminEntries.map((e) => [e.route, e.routeGuardModuleKey!] as const))(
    "routeAccess maps %s to matrix routeGuardModuleKey %s",
    (route, expectedModule) => {
      expect(getRequiredModuleForAdminPath(route)).toBe(expectedModule);
    },
  );
});

describe("Central module authority matrix — AdminModuleRoute alignment", () => {
  const adminModuleRoutes = extractAdminModuleRouteKeys();

  it.each([...adminModuleRoutes.entries()])(
    "AdminModuleRoute on %s matches matrix adminModuleRouteKey",
    (route, appModuleKey) => {
      const entry = getCentralMatrixEntry(route);
      expect(entry, `No matrix entry for ${route}`).toBeDefined();
      if (deferredCollisionRoutes.has(route)) return;
      expect(entry!.adminModuleRouteKey ?? null).toBe(appModuleKey);
    },
  );
});

describe("Central module authority matrix — dispatch P0 collision (#456)", () => {
  it("documents dispatch-mgmt dual authority without resolving it", () => {
    const adminModuleRoutes = extractAdminModuleRouteKeys();
    const collision = CENTRAL_DEFERRED_AUTHORITY_COLLISIONS.find(
      (c) => c.route === "/admin/dispatch-mgmt",
    );
    expect(collision?.deferredTo).toBe("DISPATCH_P0_456");
    expect(getCentralMatrixEntry("/admin/dispatch-mgmt")?.routeGuardModuleKey).toBe("packing");
    expect(getCentralMatrixEntry("/admin/dispatch-mgmt")?.adminModuleRouteKey).toBe("dispatch");
    expect(adminModuleRoutes.get("/admin/dispatch-mgmt")).toBe("dispatch");
    expect(getRequiredModuleForAdminPath("/admin/dispatch-mgmt")).toBe("packing");
  });
});

describe("Central module authority matrix — AdminLayout nav alignment", () => {
  const navItems = extractAdminLayoutNavItems();

  it.each(navItems.map((item) => [item.to, item.moduleKey] as const))(
    "nav %s moduleKey is matrix-consistent or an allowed override",
    (to, navModuleKey) => {
      const pathname = to.split("?")[0];
      const override = CENTRAL_NAV_MODULE_OVERRIDES[to];
      if (override) {
        expect(navModuleKey).toBe(override);
        return;
      }

      const entry = getCentralMatrixEntry(pathname);
      if (!entry || entry.routeGuardModuleKey === null) return;
      if (deferredCollisionRoutes.has(pathname)) return;

      expect(navModuleKey).toBe(entry.routeGuardModuleKey);
    },
  );

  it("does not expose duplicate nav paths with conflicting module keys", () => {
    const byPath = new Map<string, Set<string>>();
    for (const { to, moduleKey } of navItems) {
      const pathname = to.split("?")[0];
      if (deferredCollisionRoutes.has(pathname)) continue;
      const keys = byPath.get(pathname) ?? new Set<string>();
      keys.add(moduleKey);
      byPath.set(pathname, keys);
    }

    const conflicts = [...byPath.entries()].filter(([, keys]) => keys.size > 1);
    expect(
      conflicts.map(([path, keys]) => `${path}: ${[...keys].join(" vs ")}`),
      "Nav duplicate paths with conflicting moduleKeys",
    ).toEqual([]);
  });
});

describe("Central module authority matrix — programme ownership census", () => {
  it("tags every entry with a programme owner", () => {
    for (const entry of CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX) {
      expect(entry.programmeOwnership).toBeTruthy();
      expect(entry.owner).toBeTruthy();
      expect(entry.guard).toBeTruthy();
    }
  });

  it("records deferred collisions for cross-lane work", () => {
    expect(CENTRAL_DEFERRED_AUTHORITY_COLLISIONS.length).toBeGreaterThan(0);
    expect(
      CENTRAL_DEFERRED_AUTHORITY_COLLISIONS.some((c) => c.deferredTo === "DISPATCH_P0_456"),
    ).toBe(true);
  });
});
