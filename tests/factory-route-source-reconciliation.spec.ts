import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  FACTORY_OPERATIONS_ROUTES,
  ADMIN_STAFF_ROLES_REFERENCE,
  ROLE_NOT_IMPLEMENTED,
  FACTORY_ROUTES_CURRENT_COUNT,
  FACTORY_ROUTES_TOTAL_COUNT,
  FACTORY_ROUTES_LEGACY_REDIRECT_COUNT,
  FACTORY_ROUTES_LEGACY_COUNT,
  FACTORY_ROUTES_PREVIEW_COUNT,
  FACTORY_ROUTES_OUT_OF_SCOPE_COUNT,
  getAllReferencedRoles,
} from "../src/lib/factoryOperationsRouteRegistry";
import { FACTORY_ROUTE_EXCEPTIONS } from "../src/lib/factoryOperationsRouteExceptions";

/**
 * FACTORY ROUTE SOURCE-VS-REGISTRY RECONCILIATION
 *
 * This validator re-derives routes and roles directly from App.tsx and
 * auth-routing.ts. Factory-looking routes must be either classified in the
 * typed registry or explicitly classified in FACTORY_ROUTE_EXCEPTIONS.
 *
 * No credentials needed. Runs in ordinary CI.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appTsxPath = path.resolve(__dirname, "../src/App.tsx");
const authRoutingPath = path.resolve(__dirname, "../src/lib/auth-routing.ts");
const appTsxContent = fs.readFileSync(appTsxPath, "utf-8");
const authRoutingContent = fs.readFileSync(authRoutingPath, "utf-8");

function extractAllRoutePaths(): string[] {
  const pattern = /<Route\s+path="([^"]+)"/g;
  const paths: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(appTsxContent)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

function toAbsoluteAppRoute(rawPath: string): string | null {
  if (rawPath === "*") return null;
  if (rawPath.startsWith("/")) return rawPath;
  return `/admin/${rawPath}`;
}

const FACTORY_ROUTE_CANDIDATE_TOKENS = [
  "production",
  "operations",
  "operational",
  "inventory",
  "logistics",
  "packing",
  "dispatch",
  "ready-goods",
  "assembly",
  "3pgs",
  "3pcs",
  "store-coordination",
  "label-command-center",
  "carton-explorer",
  "scan-timeline",
  "reservation-board",
  "inventory-risk-board",
  "execution",
  "golden-chain",
  "stock-finalization",
  "display-management",
  "target-vs-actual",
  "order-management",
  "verification",
] as const;

function isFactoryRouteCandidate(route: string): boolean {
  if (route === "/operations-controller" || route === "/security-gate") return true;
  if (route.startsWith("/tv/")) return true;
  return FACTORY_ROUTE_CANDIDATE_TOKENS.some(token => route.includes(token));
}

function extractAdminStaffRolesFromSource(): string[] {
  const declMatch = appTsxContent.match(/const ADMIN_STAFF_ROLES = \[([\s\S]*?)\];/);
  expect(declMatch, "ADMIN_STAFF_ROLES declaration must exist in App.tsx").toBeTruthy();
  const body = declMatch![1];
  const roles = new Set<string>();
  const roleLiteralPattern = /"([A-Z0-9_]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = roleLiteralPattern.exec(body)) !== null) {
    roles.add(m[1]);
  }
  if (body.includes("...ADMIN_ONLY_ROLES")) {
    const adminOnlyMatch = appTsxContent.match(/const ADMIN_ONLY_ROLES = \[([\s\S]*?)\];/);
    if (adminOnlyMatch) {
      let am: RegExpExecArray | null;
      const adminOnlyPattern = /"([A-Z0-9_]+)"/g;
      while ((am = adminOnlyPattern.exec(adminOnlyMatch[1])) !== null) {
        roles.add(am[1]);
      }
    }
  }
  return Array.from(roles).sort();
}

function extractStaffRoleDestinationKeys(): string[] {
  const declMatch = authRoutingContent.match(/const STAFF_ROLE_DESTINATIONS: Record<string, string> = \{([\s\S]*?)\n\};/);
  expect(declMatch, "STAFF_ROLE_DESTINATIONS declaration must exist in auth-routing.ts").toBeTruthy();
  const body = declMatch![1];
  const keyPattern = /^\s*([A-Z0-9_]+):\s*"/gm;
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = keyPattern.exec(body)) !== null) {
    keys.push(m[1]);
  }
  return keys.sort();
}

test.describe("Factory route registry vs App.tsx source (reconciliation)", () => {
  test("ADMIN_STAFF_ROLES_REFERENCE matches the literal ADMIN_STAFF_ROLES array in App.tsx", () => {
    const sourceRoles = extractAdminStaffRolesFromSource();
    const registryRoles = [...ADMIN_STAFF_ROLES_REFERENCE].sort();
    expect(registryRoles).toEqual(sourceRoles);
  });

  test("Every classified registry route exists literally in App.tsx", () => {
    const allSourcePaths = extractAllRoutePaths();
    for (const entry of FACTORY_OPERATIONS_ROUTES) {
      if (entry.status === "LEGACY_REDIRECT") continue;
      const relative = entry.route.replace(/^\/admin\//, "");
      const absolute = entry.route;
      const found = allSourcePaths.includes(relative) || allSourcePaths.includes(absolute);
      expect(found, `Route "${entry.route}" (status ${entry.status}) must exist as a literal <Route path> in App.tsx`).toBe(true);
    }
  });

  test("Every LEGACY_REDIRECT route has a matching Navigate target in App.tsx", () => {
    const redirects = FACTORY_OPERATIONS_ROUTES.filter(r => r.status === "LEGACY_REDIRECT");
    expect(redirects.length).toBeGreaterThan(0);
    for (const entry of redirects) {
      const relative = entry.route.replace(/^\/admin\//, "");
      const expected = `<Route path="${relative}" element={<Navigate to="${entry.legacyRedirectTarget}" replace`;
      expect(appTsxContent.includes(expected), `Expected redirect for ${entry.route} -> ${entry.legacyRedirectTarget}`).toBe(true);
    }
  });

  test("Every Factory-looking App.tsx route is classified or explicitly excepted", () => {
    const registryPaths = new Set(FACTORY_OPERATIONS_ROUTES.map(entry => entry.route));
    const exceptionPaths = new Set(Object.keys(FACTORY_ROUTE_EXCEPTIONS));
    const candidates = extractAllRoutePaths()
      .map(toAbsoluteAppRoute)
      .filter((route): route is string => Boolean(route))
      .filter(isFactoryRouteCandidate);

    const unclassified = [...new Set(candidates)]
      .filter(route => !registryPaths.has(route) && !exceptionPaths.has(route))
      .sort();

    expect(
      unclassified,
      `Factory-looking App.tsx routes require registry classification or an explicit exception: ${unclassified.join(", ")}`,
    ).toEqual([]);
  });

  test("Every explicit Factory-route exception exists in App.tsx and carries evidence", () => {
    const absoluteSourcePaths = new Set(
      extractAllRoutePaths()
        .map(toAbsoluteAppRoute)
        .filter((route): route is string => Boolean(route)),
    );

    for (const [route, exception] of Object.entries(FACTORY_ROUTE_EXCEPTIONS)) {
      expect(absoluteSourcePaths.has(route), `Exception route ${route} must exist in App.tsx`).toBe(true);
      expect(exception.reason.trim().length, `Exception route ${route} must have a reason`).toBeGreaterThan(20);

      if (exception.kind === "REDIRECT_ALIAS") {
        expect(exception.expectedTarget, `${route} redirect alias must declare its target`).toBeTruthy();
        const rawPath = route.startsWith("/admin/") ? route.slice("/admin/".length) : route;
        const expected = `<Route path="${rawPath}" element={<Navigate to="${exception.expectedTarget}" replace`;
        expect(appTsxContent.includes(expected), `Expected alias redirect ${route} -> ${exception.expectedTarget}`).toBe(true);
      }
    }
  });

  test("No route in the registry claims a role App.tsx/auth-routing.ts doesn't actually define", () => {
    const knownRoles = new Set([
      ...extractAdminStaffRolesFromSource(),
      ...extractStaffRoleDestinationKeys(),
      "SUPER_ADMIN", "ADMIN", "GATE_SECURITY", "SECURITY_CONTROL",
      "HOD_ARABIC", "PROD_ARABIC_SWEETS", "HOD_CHOCOLATE", "PROD_CHOCOLATE", "HOD_DRAGEES", "PROD_DRAGEES",
      "HOD_FUSION", "PROD_FUSION", "HOD_DATES", "PROD_DATES", "HOD_BAKERY", "PROD_BAKERY", "HOD_NUTS", "PROD_NUTS",
      "STORE_READY_GOODS", "RGS_ADMIN", "TV_READY",
    ]);
    const registryRoles = getAllReferencedRoles();
    const unknown = registryRoles.filter(r => !knownRoles.has(r));
    expect(unknown, `Registry references roles not found in App.tsx/auth-routing.ts: ${unknown.join(", ")}`).toEqual([]);
  });

  test("ROLE_NOT_IMPLEMENTED entries are genuinely absent from source", () => {
    for (const invented of Object.keys(ROLE_NOT_IMPLEMENTED)) {
      const inAdminStaffRoles = extractAdminStaffRolesFromSource().includes(invented);
      const inStaffDestinations = extractStaffRoleDestinationKeys().includes(invented);
      expect(
        inAdminStaffRoles || inStaffDestinations,
        `"${invented}" is listed as ROLE_NOT_IMPLEMENTED but was found in source -- update the registry, it does exist.`,
      ).toBe(false);
    }
  });

  test("TV_DISPLAY is not in any production TV route guard", () => {
    const productionTvRoutes = ["/tv/arabic-sweets", "/tv/chocolate", "/tv/fusion", "/tv/bakery", "/tv/nuts"];
    for (const routePath of productionTvRoutes) {
      const entry = FACTORY_OPERATIONS_ROUTES.find(r => r.route === routePath);
      expect(entry, `${routePath} must exist in registry`).toBeTruthy();
      expect(entry!.technicallyAllowedRoles).not.toContain("TV_DISPLAY");
    }
  });

  test("Derived counts are self-consistent", () => {
    const total = FACTORY_OPERATIONS_ROUTES.length;
    expect(FACTORY_ROUTES_TOTAL_COUNT).toBe(total);
    const sumOfStatuses =
      FACTORY_ROUTES_CURRENT_COUNT +
      FACTORY_ROUTES_LEGACY_REDIRECT_COUNT +
      FACTORY_ROUTES_LEGACY_COUNT +
      FACTORY_ROUTES_PREVIEW_COUNT +
      FACTORY_ROUTES_OUT_OF_SCOPE_COUNT;
    expect(sumOfStatuses).toBe(total);
  });

  test("No route appears twice in the registry", () => {
    const paths = FACTORY_OPERATIONS_ROUTES.map(r => r.route);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
