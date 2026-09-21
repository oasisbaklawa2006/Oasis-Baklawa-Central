/**
 * Task 4 / Point 58 — demo / preview authority quarantine registry.
 * These surfaces cannot act as production authority.
 */
import {
  CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX,
  type CentralModuleAuthorityEntry,
} from "./centralAdminModuleAuthorityMatrix";

export type DemoAuthorityQuarantineEntry = {
  route: string;
  label: string;
  canonicalRedirect: string;
  matrixDisposition: CentralModuleAuthorityEntry["disposition"];
};

export const DEMO_AUTHORITY_QUARANTINE_REGISTRY: DemoAuthorityQuarantineEntry[] = [
  { route: "/admin/execution-command-center", label: "Execution command center", canonicalRedirect: "/admin/live-work-queues", matrixDisposition: "QUARANTINED" },
  { route: "/admin/execution-risk", label: "Execution risk board", canonicalRedirect: "/admin/exceptions", matrixDisposition: "QUARANTINED" },
  { route: "/admin/execution-bottlenecks", label: "Execution bottlenecks", canonicalRedirect: "/admin/live-work-queues", matrixDisposition: "QUARANTINED" },
  { route: "/admin/queue-execution-preview", label: "Queue execution preview", canonicalRedirect: "/admin/live-work-queues", matrixDisposition: "QUARANTINED" },
  { route: "/admin/barcode-execution-preview", label: "Barcode execution preview", canonicalRedirect: "/admin/golden-chain-operator", matrixDisposition: "QUARANTINED" },
  { route: "/admin/product-intelligence-prototype", label: "Product intelligence prototype", canonicalRedirect: "/admin/products", matrixDisposition: "QUARANTINED" },
  { route: "/admin/execution/retail", label: "Retail execution board", canonicalRedirect: "/admin/store-coordination", matrixDisposition: "QUARANTINED" },
  { route: "/admin/execution/complaints", label: "Complaints execution board", canonicalRedirect: "/admin/support", matrixDisposition: "QUARANTINED" },
  { route: "/admin/inventory-command-center", label: "Inventory command center", canonicalRedirect: "/admin/ready-goods", matrixDisposition: "QUARANTINED" },
  { route: "/admin/inventory-risk-board", label: "Inventory risk board", canonicalRedirect: "/admin/inventory", matrixDisposition: "QUARANTINED" },
  { route: "/admin/verification", label: "Verification legacy bookmark", canonicalRedirect: "/admin/live-work-queues", matrixDisposition: "QUARANTINED" },
];

const BY_ROUTE = new Map(DEMO_AUTHORITY_QUARANTINE_REGISTRY.map((entry) => [entry.route, entry]));

export function getDemoAuthorityQuarantineEntry(route: string) {
  return BY_ROUTE.get(route.split("?")[0]);
}

export function getCanonicalLiveAuthorityRedirect(route: string): string | null {
  return getDemoAuthorityQuarantineEntry(route)?.canonicalRedirect ?? null;
}

export function getUnquarantinedPoint58MatrixSurfaces(): CentralModuleAuthorityEntry[] {
  return CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX.filter(
    (entry) =>
      entry.programmeOwnership === "POINT58"
      && entry.disposition === "QUARANTINED"
      && !BY_ROUTE.has(entry.route),
  );
}
