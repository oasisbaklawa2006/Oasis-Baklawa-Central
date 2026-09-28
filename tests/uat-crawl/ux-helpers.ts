/**
 * Shared UX evaluation helpers for Appverse UAT crawl specs.
 * Criteria authority: docs/uat-crawl/ux-matrix.json (148 checks).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export const UX_CRITERIA_TOTAL = 148;

export type UxEvidenceSlot = "s0" | "s1" | "s2" | "s3";

export type UxEvidence = Record<UxEvidenceSlot, string | null>;

export type UxFailure = {
  failId: string;
  uxRefs: string;
  severity: "P0" | "P1" | "P2" | "P3";
  summary: string;
  screenshots: string[];
};

export type UxManifestFields = {
  uxStatus: "NOT-TESTED" | "PARTIAL" | "PASS" | "FAIL" | "BLOCKED";
  uxEvidence: UxEvidence;
  uxCriteriaTotal: number;
  uxCriteriaEvaluated: number;
  uxCriteriaPassed: number;
  uxCriteriaFailed: number;
  uxCriteriaBlocked: number;
  uxFailures: UxFailure[];
};

const ROOT = path.resolve(import.meta.dirname, "../..");
const UX_MATRIX = JSON.parse(
  readFileSync(path.join(ROOT, "docs/uat-crawl/ux-matrix.json"), "utf8"),
) as { criteriaCount: number };

export function emptyUxEvidence(): UxEvidence {
  return { s0: null, s1: null, s2: null, s3: null };
}

export function uxEvidenceComplete(evidence: UxEvidence): boolean {
  return Boolean(evidence.s0 && evidence.s1 && evidence.s2 && evidence.s3);
}

export function deriveUxStatus(
  evidence: UxEvidence,
  failures: UxFailure[],
  blocked: boolean,
): UxManifestFields["uxStatus"] {
  if (blocked) return "BLOCKED";
  if (failures.length > 0) return "FAIL";
  if (uxEvidenceComplete(evidence)) return "PASS";
  if (evidence.s0) return "PARTIAL";
  return "NOT-TESTED";
}

export function buildUxFields(
  evidence: UxEvidence,
  failures: UxFailure[],
  opts: { blocked?: boolean; evaluated?: number; passed?: number; failed?: number; blockedCount?: number },
): UxManifestFields {
  const blocked = opts.blocked ?? false;
  return {
    uxStatus: deriveUxStatus(evidence, failures, blocked),
    uxEvidence: evidence,
    uxCriteriaTotal: UX_MATRIX.criteriaCount ?? UX_CRITERIA_TOTAL,
    uxCriteriaEvaluated: opts.evaluated ?? 0,
    uxCriteriaPassed: opts.passed ?? 0,
    uxCriteriaFailed: opts.failed ?? failures.length,
    uxCriteriaBlocked: opts.blockedCount ?? (blocked ? UX_CRITERIA_TOTAL : 0),
    uxFailures: failures,
  };
}

export function screenshotName(
  uatId: string,
  app: string,
  persona: string,
  routeSlug: string,
  slot: UxEvidenceSlot | string,
  label: string,
): string {
  return `${uatId}_${app}_${persona.toLowerCase()}_${routeSlug}_${slot}-${label}.png`;
}

/** Automated heuristics runnable without credentials (login/public surfaces). */
export async function runPublicSurfaceUxHeuristics(page: import("@playwright/test").Page): Promise<{
  failures: UxFailure[];
  evaluated: number;
  passed: number;
}> {
  const failures: UxFailure[] = [];
  let evaluated = 0;
  let passed = 0;

  const checks: Array<{ id: number; run: () => Promise<boolean>; severity: UxFailure["severity"]; summary: string }> = [
    {
      id: 1,
      severity: "P2",
      summary: "Document title missing or generic",
      run: async () => {
        const title = await page.title();
        return title.length > 3 && !/^untitled$/i.test(title);
      },
    },
    {
      id: 24,
      severity: "P1",
      summary: "Accidental horizontal scroll on settled page",
      run: async () => {
        return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
      },
    },
    {
      id: 58,
      severity: "P2",
      summary: "Body appears blank after settle (no visible text or controls)",
      run: async () => {
        const text = await page.locator("body").innerText().catch(() => "");
        const inputs = await page.locator("input, button, a[href]").count();
        return text.trim().length > 0 || inputs > 0;
      },
    },
    {
      id: 61,
      severity: "P0",
      summary: "Raw stack/SQL/RPC error visible in page text",
      run: async () => {
        const text = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
        const bad = ["stack trace", "syntax error", "postgresql", "rpc error", "supabase error"];
        return !bad.some((b) => text.includes(b));
      },
    },
  ];

  for (const check of checks) {
    evaluated += 1;
    const ok = await check.run();
    if (ok) {
      passed += 1;
    } else {
      failures.push({
        failId: `FAIL-UX-AUTO-${String(check.id).padStart(3, "0")}`,
        uxRefs: String(check.id),
        severity: check.severity,
        summary: check.summary,
        screenshots: ["s0"],
      });
    }
  }

  return { failures, evaluated, passed };
}

export function formatUxLedgerRow(
  fail: UxFailure,
  uatId: string,
  app: string,
  role: string,
  device: string,
  route: string,
  screenshotNames: string,
): string {
  return `| ${fail.failId} | ${uatId} | ${app} | ${role} | ${device} | ${route} | UX ${fail.uxRefs} | User-safe experience | ${fail.summary} | ${fail.severity} | ${screenshotNames} | — | See UX matrix | ${app} | UI/UX | — |`;
}
