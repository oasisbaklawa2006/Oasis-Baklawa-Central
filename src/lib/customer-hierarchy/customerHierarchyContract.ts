import type { CustomerHierarchyCorePrerequisite } from "./customerHierarchyTypes";

/**
 * Core contract required before Central may expose governed branch/contact hierarchy.
 * Flip `availableInCentralTypes` to true only after Core lands the mapping RPC and
 * Central regenerates `database.types.ts` — never before.
 */
export const CORE_HIERARCHY_PREREQUISITE_ID = "CORE-HIERARCHY-MAP-01";

export const STAFF_COMPANY_HIERARCHY_RPC = "staff_company_hierarchy_v1" as const;

export const CORE_HIERARCHY_CONTRACT: CustomerHierarchyCorePrerequisite = {
  prerequisiteId: CORE_HIERARCHY_PREREQUISITE_ID,
  orgTables: ["org_companies", "org_branches", "org_contacts", "org_memberships"],
  mappingRequirement:
    "Deterministic companies.id ↔ org_companies.id mapping (FK, governed link table, or explicit unlinked registry). No inference by name, email, GST, or phone.",
  staffReadRpc: `${STAFF_COMPANY_HIERARCHY_RPC}(p_company_id uuid)`,
  coreEvidencePr: "Core#206",
  availableInCentralTypes: false,
};
