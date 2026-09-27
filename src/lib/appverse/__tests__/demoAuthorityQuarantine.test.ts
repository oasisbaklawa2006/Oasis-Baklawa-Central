import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX } from "../centralAdminModuleAuthorityMatrix";
import {
  DEMO_AUTHORITY_QUARANTINE_REGISTRY,
  getCanonicalLiveAuthorityRedirect,
  getUnquarantinedPoint58MatrixSurfaces,
} from "../demoAuthorityQuarantine";

const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf-8");
const adminLayout = readFileSync(resolve(process.cwd(), "src/components/AdminLayout.tsx"), "utf-8");

describe("Task 4 / Point 58 authority quarantine", () => {
  it("marks every registry route QUARANTINED in the authority matrix", () => {
    for (const entry of DEMO_AUTHORITY_QUARANTINE_REGISTRY) {
      const row = CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX.find((candidate) => candidate.route === entry.route);
      expect(row?.disposition, entry.route).toBe("QUARANTINED");
    }
    expect(getUnquarantinedPoint58MatrixSurfaces()).toEqual([]);
  });

  it("maps every quarantined surface to a canonical live target", () => {
    for (const entry of DEMO_AUTHORITY_QUARANTINE_REGISTRY) {
      expect(getCanonicalLiveAuthorityRedirect(entry.route)).toBe(entry.canonicalRedirect);
      expect(entry.canonicalRedirect.startsWith("/")).toBe(true);
      expect(entry.canonicalRedirect).not.toBe(entry.route);
    }
  });

  it("removes quarantined routes from AdminLayout navigation", () => {
    for (const entry of DEMO_AUTHORITY_QUARANTINE_REGISTRY) {
      expect(adminLayout).not.toContain(`to: "${entry.route}"`);
    }
  });

  it("keeps production route declarations as redirects rather than legacy page authority", () => {
    for (const entry of DEMO_AUTHORITY_QUARANTINE_REGISTRY) {
      const relative = entry.route.replace(/^\/admin\//, "");
      expect(app).toContain(`path="${relative}"`);
      expect(app).toContain(`to="${entry.canonicalRedirect}"`);
    }
  });
});
