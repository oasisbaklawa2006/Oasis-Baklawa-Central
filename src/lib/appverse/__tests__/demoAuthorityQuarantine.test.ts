import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX,
} from "../centralAdminModuleAuthorityMatrix";
import {
  DEMO_AUTHORITY_QUARANTINE_REGISTRY,
  getCanonicalLiveAuthorityRedirect,
  getUnquarantinedPoint58MatrixSurfaces,
  shouldExcludeDemoRouteFromNav,
} from "../demoAuthorityQuarantine";

const adminLayoutPath = resolve(process.cwd(), "src/components/AdminLayout.tsx");
const adminLayout = readFileSync(adminLayoutPath, "utf-8");

function extractAdminLayoutNavPaths(): string[] {
  const paths: string[] = [];
  const pattern = /to:\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(adminLayout)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

describe("Point 58 demo authority quarantine registry", () => {
  it("quarantines every POINT58 PREVIEW/DEMO matrix surface", () => {
    expect(getUnquarantinedPoint58MatrixSurfaces()).toEqual([]);
  });

  it("maps each quarantined route to a canonical live redirect", () => {
    for (const entry of DEMO_AUTHORITY_QUARANTINE_REGISTRY) {
      expect(getCanonicalLiveAuthorityRedirect(entry.route)).toBe(entry.canonicalRedirect);
      expect(entry.canonicalRedirect.startsWith("/")).toBe(true);
    }
  });

  it("marks quarantined matrix rows as QUARANTINED disposition", () => {
    for (const entry of DEMO_AUTHORITY_QUARANTINE_REGISTRY) {
      const matrixRow = CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX.find((row) => row.route === entry.route);
      expect(matrixRow?.disposition, `Missing or unmarked matrix row for ${entry.route}`).toBe("QUARANTINED");
    }
  });

  it("excludes quarantined demo routes from AdminLayout navigation", () => {
    const navPaths = extractAdminLayoutNavPaths();
    const leaked = navPaths.filter((path) => shouldExcludeDemoRouteFromNav(path));
    expect(leaked, `Demo routes still in nav: ${leaked.join(", ")}`).toEqual([]);
  });

  it("does not redirect canonical live authority targets", () => {
    const canonicalTargets = new Set(
      DEMO_AUTHORITY_QUARANTINE_REGISTRY.map((entry) => entry.canonicalRedirect),
    );
    for (const target of canonicalTargets) {
      expect(getCanonicalLiveAuthorityRedirect(target)).toBeNull();
    }
  });
});
