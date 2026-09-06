/**
 * Point 60 — customer company / branch / buyer hierarchy resolution types.
 * Canonical commercial identity input is `companies.id`.
 * Org hierarchy authority lives in Core; Central must not invent linkage.
 */

export type CustomerHierarchyResolutionStatus =
  | "core_contract_missing"
  | "unlinked"
  | "ambiguous"
  | "inactive_membership"
  | "cross_company_denied"
  | "resolved";

export type CustomerHierarchyBranchSummary = {
  branchId: string;
  branchName: string;
  branchType: string | null;
  status: string | null;
};

export type CustomerHierarchyContactSummary = {
  contactId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  membershipStatus: string | null;
  branchScopeIds: string[];
};

export type CustomerHierarchySummary = {
  commercialCompanyId: string;
  orgCompanyId: string;
  branches: CustomerHierarchyBranchSummary[];
  contacts: CustomerHierarchyContactSummary[];
};

export type CustomerHierarchyCorePrerequisite = {
  prerequisiteId: string;
  orgTables: readonly string[];
  mappingRequirement: string;
  staffReadRpc: string;
  coreEvidencePr: string;
  availableInCentralTypes: boolean;
};

export type CustomerHierarchyResolution =
  | {
      status: "core_contract_missing";
      commercialCompanyId: string;
      reason: string;
      corePrerequisite: CustomerHierarchyCorePrerequisite;
    }
  | {
      status: "unlinked";
      commercialCompanyId: string;
      reason: string;
    }
  | {
      status: "ambiguous";
      commercialCompanyId: string;
      reason: string;
    }
  | {
      status: "inactive_membership";
      commercialCompanyId: string;
      reason: string;
    }
  | {
      status: "cross_company_denied";
      commercialCompanyId: string;
      reason: string;
    }
  | {
      status: "resolved";
      commercialCompanyId: string;
      hierarchy: CustomerHierarchySummary;
    };

export type CustomerHierarchyViewerContext = {
  viewerCompanyId: string | null;
  isStorefrontViewer: boolean;
};
