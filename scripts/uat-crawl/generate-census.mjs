#!/usr/bin/env node
/**
 * Phase 1 route census generator — Central App.tsx + cross-repo registry rows.
 * Outputs docs/uat-crawl/UAT_ROUTE_CENSUS.json and .md
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const appTsx = readFileSync(path.join(ROOT, "src/App.tsx"), "utf8");

const BASELINES = {
  central: "08ccb1cfd4a3624103f0681b5515e26727e77cd2",
  core: "06bc02f635be59e8cd505e41e7e963748c0feebf",
  trace: "e395b77f115803ab998266fb7459744fd743110a",
  buyer: "570853c14b18d652301943810f9089acc967a76a",
  aiStudio: "c010b26e96002ca666e470d3f578b2fc1c64e362",
  aiStudioPoint41Preview: "a373564acac6738a9f450201d8bf2c2b3a7c93a2",
};

/** @typedef {{ uatId: string, app: string, route: string, state: string, classification: string, persona: string, device: string, repo: string, baselineSha: string, notes: string }} CensusEntry */

/** @type {CensusEntry[]} */
const entries = [];
let seq = 0;

function nextId() {
  seq += 1;
  return `UAT-${String(seq).padStart(4, "0")}`;
}

function slug(s) {
  return s.replace(/^\//, "").replace(/\//g, "_").replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "root";
}

function add(entry) {
  entries.push({ uatId: nextId(), ...entry });
}

// ── Central routes from App.tsx ──
const routeRe = /<Route\s+path="([^"]+)"/g;
const navigateRe = /<Route\s+path="([^"]+)"\s+element=\{<Navigate/g;
const seen = new Set();

for (const re of [routeRe, navigateRe]) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(appTsx)) !== null) {
    const raw = m[1];
    if (raw === "*" || seen.has(raw)) continue;
    seen.add(raw);
    const fullRoute = raw.startsWith("/") ? raw : `/admin/${raw}`;
    const isRedirect = appTsx.includes(`path="${raw}" element={<Navigate`);
    const isTv = fullRoute.startsWith("/tv/");
    const isBuyer = fullRoute.startsWith("/buyer");
    const isPublic = ["/login", "/reset-password", "/splash", "/"].includes(fullRoute);
    let classification = "ROUTED_COMPONENT";
    if (isRedirect) classification = "LEGACY_REDIRECT";
    if (fullRoute.includes("preview") || fullRoute.includes("prototype")) classification = "INTERNAL_PREVIEW";
    if (fullRoute.includes("execution/") && !isRedirect) classification = "EXECUTION_BOARD";
    let persona = "ADMIN_STAFF";
    if (isTv) persona = "TV";
    if (isBuyer) persona = "BUYER";
    if (fullRoute.includes("dispatch")) persona = "DISPATCH";
    if (fullRoute.includes("finance")) persona = "FINANCE";
    if (fullRoute.includes("ready-goods") || fullRoute.includes("rgs")) persona = "RGS";
    if (fullRoute.includes("3pgs") || fullRoute.includes("3pcs")) persona = "3PGS";
    if (fullRoute.includes("assembly")) persona = "P_AND_A";
    if (fullRoute.includes("security-gate")) persona = "GATE_SECURITY";
    if (fullRoute.includes("sales")) persona = "SALES";
    if (isPublic) persona = "UNAUTHENTICATED";
    const device = isTv ? "tv" : isBuyer ? "phone" : "desktop";
    add({
      app: "central",
      route: fullRoute,
      state: "default",
      classification,
      persona,
      device,
      repo: "Oasis-Baklawa-Central",
      baselineSha: BASELINES.central,
      notes: isRedirect ? "Navigate redirect — capture destination in function crawl" : "",
    });
    if (fullRoute === "/admin/clients" || fullRoute === "/admin/approvals") {
      add({
        app: "central",
        route: fullRoute,
        state: "sheet-review-open",
        classification: "INTERACTIVE_STATE",
        persona: "ADMIN_SALES",
        device: "phone",
        repo: "Oasis-Baklawa-Central",
        baselineSha: BASELINES.central,
        notes: "Issue #481 — Pricing Slab / Account Manager Select-in-Sheet; requires pending application fixture",
      });
    }
    if (fullRoute === "/admin/dispatch-mgmt") {
      add({
        app: "central",
        route: fullRoute,
        state: "filter-empty",
        classification: "INTERACTIVE_STATE",
        persona: "DISPATCH",
        device: "desktop",
        repo: "Oasis-Baklawa-Central",
        baselineSha: BASELINES.central,
        notes: "Known risk: empty B2B dispatch filter / data binding",
      });
    }
  }
}

// Buyer nested routes (Central-hosted BuyerApp)
const buyerRoutes = [
  "/buyer",
  "/buyer/catalogue",
  "/buyer/cart",
  "/buyer/orders",
  "/buyer/account",
  "/buyer/support",
  "/buyer/documents",
  "/buyer/access-request",
];
for (const r of buyerRoutes) {
  add({
    app: "buyer-mobile",
    route: r,
    state: "default",
    classification: "ROUTED_COMPONENT",
    persona: "BUYER",
    device: "phone",
    repo: "oasis-baklawa (hosted in Central)",
    baselineSha: BASELINES.buyer,
    notes: "",
  });
}

// AI Studio — durable head + PR #143 additions (from programme checklist)
const aiStudioRoutes = [
  ["/", "default", "AI_CATALOGUE"],
  ["/media", "default", "AI_CATALOGUE"],
  ["/media/review", "default", "AI_APPROVER"],
  ["/products/new/fast", "default", "AI_CATALOGUE"],
  ["/testing/pilot-readiness", "default", "AI_CATALOGUE"],
];
for (const [r, state, persona] of aiStudioRoutes) {
  add({
    app: "ai-studio",
    route: r,
    state,
    classification: r === "/media/review" ? "GOVERNANCE_DESK" : "ROUTED_COMPONENT",
    persona,
    device: r === "/media" ? "phone" : "desktop",
    repo: "oasis-ai-studio",
    baselineSha: BASELINES.aiStudioPoint41Preview,
    notes: "Point 41 software on PR #143 preview unless merged to main",
  });
}
add({
  app: "ai-studio",
  route: "/media",
  state: "camera-capture-flow",
  classification: "INTERACTIVE_STATE",
  persona: "AI_CATALOGUE",
  device: "phone",
  repo: "oasis-ai-studio",
  baselineSha: BASELINES.aiStudioPoint41Preview,
  notes: "Point 41 physical camera UAT — preview deploy only",
});

// Trace / scanner surfaces
const traceRoutes = [
  ["/", "scan-home", "TRACE_SCANNER"],
  ["/scan", "gate-scan", "TRACE_SCANNER"],
  ["/scan", "carton-scan", "TRACE_SCANNER"],
  ["/scan", "offline-queue", "TRACE_SCANNER"],
];
for (const [r, state, persona] of traceRoutes) {
  add({
    app: "trace",
    route: r,
    state,
    classification: "SCANNER_FLOW",
    persona,
    device: "scanner",
    repo: "oasis-trace",
    baselineSha: BASELINES.trace,
    notes: "",
  });
}

const outDir = path.join(ROOT, "docs/uat-crawl");
mkdirSync(outDir, { recursive: true });

const census = {
  generatedAt: new Date().toISOString(),
  baselines: BASELINES,
  totalEntries: entries.length,
  byApp: Object.fromEntries(
    [...new Set(entries.map((e) => e.app))].map((app) => [
      app,
      entries.filter((e) => e.app === app).length,
    ]),
  ),
  entries,
};

writeFileSync(path.join(outDir, "UAT_ROUTE_CENSUS.json"), JSON.stringify(census, null, 2));

const md = [
  "# UAT Route / Page / State Census",
  "",
  `**Generated:** ${census.generatedAt}`,
  "",
  "## Totals by app",
  "",
  "| App | Page/state count | Baseline SHA |",
  "|---|---:|---|",
  ...Object.entries(census.byApp).map(([app, count]) => {
    const sha =
      app === "central"
        ? BASELINES.central.slice(0, 8)
        : app === "buyer-mobile"
          ? BASELINES.buyer.slice(0, 8)
          : app === "ai-studio"
            ? BASELINES.aiStudioPoint41Preview.slice(0, 8)
            : app === "trace"
              ? BASELINES.trace.slice(0, 8)
              : "—";
    return `| ${app} | ${count} | \`${sha}\` |`;
  }),
  "",
  `**Grand total:** ${census.totalEntries} immutable UAT IDs`,
  "",
  "## Classification legend",
  "",
  "| Class | Meaning |",
  "|---|---|",
  "| ROUTED_COMPONENT | Live route with component |",
  "| LEGACY_REDIRECT | Navigate-only stub |",
  "| INTERNAL_PREVIEW | Preview/prototype/cmd_war_room gated |",
  "| INTERACTIVE_STATE | Tab/sheet/dialog/open state (same route, distinct UAT ID) |",
  "| SCANNER_FLOW | Trace hardware flow state |",
  "",
].join("\n");

writeFileSync(path.join(outDir, "UAT_ROUTE_CENSUS.md"), md);

// Export first 10 for crawl bootstrap
writeFileSync(
  path.join(outDir, "UAT_TRANCHE_01_TARGETS.json"),
  JSON.stringify(entries.slice(0, 10), null, 2),
);

console.log(`Census: ${entries.length} entries → docs/uat-crawl/`);
