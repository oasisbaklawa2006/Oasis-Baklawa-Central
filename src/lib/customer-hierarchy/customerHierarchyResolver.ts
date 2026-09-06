import type { Database } from "@/integrations/supabase/database.types";
import { normalizeCompanyId } from "@/lib/customer-360/customer360Identity";
import { Customer360IdentityError } from "@/lib/customer-360/customer360Identity";
import {
  CORE_HIERARCHY_CONTRACT,
  STAFF_COMPANY_HIERARCHY_RPC,
} from "./customerHierarchyContract";
import type {
  CustomerHierarchyResolution,
  CustomerHierarchyViewerContext,
} from "./customerHierarchyTypes";

type StaffHierarchyRpcName = typeof STAFF_COMPANY_HIERARCHY_RPC;
type PublicFunctions = Database["public"]["Functions"];

/** Typed compile-time probe — becomes true when Core RPC is added to database.types.ts. */
type StaffHierarchyRpcAvailable = StaffHierarchyRpcName extends keyof PublicFunctions
  ? true
  : false;

const STAFF_HIERARCHY_RPC_AVAILABLE: StaffHierarchyRpcAvailable = false;

const CORE_CONTRACT_MISSING_REASON =
  "Commercial company ↔ org-company mapping and staff hierarchy read RPC are not yet in the Central typed contract. Mission Control must route Core prerequisite CORE-HIERARCHY-MAP-01 before governed branch/contact data can load.";

/** Fail closed when a storefront viewer attempts cross-company hierarchy access. */
export function assertCustomerHierarchyCompanyAccess(
  commercialCompanyId: string,
  viewer: CustomerHierarchyViewerContext,
): void {
  if (!viewer.isStorefrontViewer) return;
  if (!viewer.viewerCompanyId) {
    throw new Customer360IdentityError(
      "ambiguous_identity",
      "Buyer identity is unresolved; customer hierarchy access is blocked.",
    );
  }
  if (viewer.viewerCompanyId.toLowerCase() !== commercialCompanyId.toLowerCase()) {
    throw new Customer360IdentityError(
      "cross_company_access_denied",
      "Cross-company hierarchy access is not authorized.",
    );
  }
}

/**
 * Resolves governed company → branch → contact hierarchy for a commercial company id.
 * Never infers org linkage by name, email, GST, or phone.
 */
export async function resolveCustomerHierarchy(
  rawCommercialCompanyId: string,
  viewer: CustomerHierarchyViewerContext,
): Promise<CustomerHierarchyResolution> {
  const commercialCompanyId = normalizeCompanyId(rawCommercialCompanyId);
  assertCustomerHierarchyCompanyAccess(commercialCompanyId, viewer);

  if (!CORE_HIERARCHY_CONTRACT.availableInCentralTypes || !STAFF_HIERARCHY_RPC_AVAILABLE) {
    return {
      status: "core_contract_missing",
      commercialCompanyId,
      reason: CORE_CONTRACT_MISSING_REASON,
      corePrerequisite: CORE_HIERARCHY_CONTRACT,
    };
  }

  // When Core lands staff_company_hierarchy_v1 in database.types.ts, this branch
  // will call the RPC and map fail-closed outcomes (unlinked, ambiguous, inactive).
  return {
    status: "core_contract_missing",
    commercialCompanyId,
    reason: CORE_CONTRACT_MISSING_REASON,
    corePrerequisite: CORE_HIERARCHY_CONTRACT,
  };
}

export function isCoreHierarchyContractAvailable(): boolean {
  return CORE_HIERARCHY_CONTRACT.availableInCentralTypes && STAFF_HIERARCHY_RPC_AVAILABLE;
}
