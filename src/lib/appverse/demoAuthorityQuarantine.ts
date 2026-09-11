/**
 * Point 58 — demo / preview authority quarantine registry.
 *
 * Surfaces listed here must not masquerade as canonical live operational
 * authority in production. Direct navigation redirects to the governed live
 * surface; dev builds may render the legacy page behind an explicit banner.
 */

import {
  CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX,
  type CentralModuleAuthorityEntry,
} from "./centralAdminModuleAuthorityMatrix";

export type DemoQuarantineAction = "redirect" | "dev_only";

export type DemoAuthorityQuarantineEntry = {
  route: string;
  label: string;
  /** Governed live authority operators should use instead. */
  canonicalRedirect: string;
  action: DemoQuarantineAction;
  /** Matrix census reference for audit tests. */
  matrixDisposition: CentralModuleAuthorityEntry["disposition"];
  notes?: string;
};

const POINT58_QUARANTINE_REDIRECTS: DemoAuthorityQuarantineEntry[] = [
  {
    route: "/admin/execution-command-center",
    label: "Execution command center",
    canonicalRedirect: "/admin/live-work-queues",
    action: "redirect",
    matrixDisposition: "PREVIEW",
    notes: "operational_queue_items dead data; POINT71 live work queues are canonical.",
  },
  {
    route: "/admin/execution-risk",
    label: "Execution risk board",
    canonicalRedirect: "/admin/exceptions",
    action: "redirect",
    matrixDisposition: "PREVIEW",
  },
  {
    route: "/admin/execution-bottlenecks",
    label: "Execution bottlenecks",
    canonicalRedirect: "/admin/live-work-queues",
    action: "redirect",
    matrixDisposition: "PREVIEW",
  },
  {
    route: "/admin/queue-execution-preview",
    label: "Queue execution preview",
    canonicalRedirect: "/admin/live-work-queues",
    action: "redirect",
    matrixDisposition: "PREVIEW",
  },
  {
    route: "/admin/barcode-execution-preview",
    label: "Barcode execution preview",
    canonicalRedirect: "/admin/golden-chain-operator",
    action: "redirect",
    matrixDisposition: "PREVIEW",
  },
  {
    route: "/admin/product-intelligence-prototype",
    label: "Product intelligence lab",
    canonicalRedirect: "/admin/products",
    action: "dev_only",
    matrixDisposition: "DEMO",
    notes: "AI Studio link-out; products catalogue is the live Central surface.",
  },
  {
    route: "/admin/execution/retail",
    label: "Retail execution board",
    canonicalRedirect: "/admin/store-coordination",
    action: "redirect",
    matrixDisposition: "PREVIEW",
  },
  {
    route: "/admin/execution/complaints",
    label: "Complaints execution board",
    canonicalRedirect: "/admin/support",
    action: "redirect",
    matrixDisposition: "PREVIEW",
  },
  {
    route: "/admin/inventory-command-center",
    label: "Inventory command center",
    canonicalRedirect: "/admin/ready-goods",
    action: "redirect",
    matrixDisposition: "PREVIEW",
  },
  {
    route: "/admin/inventory-risk-board",
    label: "Inventory risk board",
    canonicalRedirect: "/admin/inventory",
    action: "redirect",
    matrixDisposition: "PREVIEW",
  },
  {
    route: "/admin/verification",
    label: "Verification (legacy bookmark)",
    canonicalRedirect: "/admin/live-work-queues",
    action: "redirect",
    matrixDisposition: "COMPATIBILITY_ALIAS",
    notes: "Former alias to execution-command-center.",
  },
];

const QUARANTINE_BY_ROUTE = new Map(
  POINT58_QUARANTINE_REDIRECTS.map((entry) => [entry.route, entry]),
);

export const DEMO_AUTHORITY_QUARANTINE_REGISTRY = POINT58_QUARANTINE_REDIRECTS;

/** Routes removed from production navigation (POINT58-owned preview/demo surfaces). */
export const DEMO_AUTHORITY_NAV_EXCLUDED_ROUTES = new Set(
  POINT58_QUARANTINE_REDIRECTS.filter((entry) => entry.route !== "/admin/verification").map(
    (entry) => entry.route,
  ),
);

export function getDemoAuthorityQuarantineEntry(
  route: string,
): DemoAuthorityQuarantineEntry | undefined {
  const normalized = route.split("?")[0];
  return QUARANTINE_BY_ROUTE.get(normalized);
}

export function isDemoAuthorityQuarantinedRoute(route: string): boolean {
  return getDemoAuthorityQuarantineEntry(route) !== undefined;
}

export function getCanonicalLiveAuthorityRedirect(route: string): string | null {
  return getDemoAuthorityQuarantineEntry(route)?.canonicalRedirect ?? null;
}

export function shouldExcludeDemoRouteFromNav(route: string): boolean {
  const pathname = route.split("?")[0];
  return DEMO_AUTHORITY_NAV_EXCLUDED_ROUTES.has(pathname);
}

export function isDemoPreviewDevOnlyRoute(route: string): boolean {
  return getDemoAuthorityQuarantineEntry(route)?.action === "dev_only";
}

/** Fail-closed reconciliation: every POINT58 QUARANTINED matrix row must be in the registry. */
export function getUnquarantinedPoint58MatrixSurfaces(): CentralModuleAuthorityEntry[] {
  return CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX.filter((entry) => {
    if (entry.programmeOwnership !== "POINT58") return false;
    if (entry.disposition !== "QUARANTINED") return false;
    return !isDemoAuthorityQuarantinedRoute(entry.route);
  });
}
