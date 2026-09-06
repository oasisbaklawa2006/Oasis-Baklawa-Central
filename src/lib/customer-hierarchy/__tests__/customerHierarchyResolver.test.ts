import { describe, expect, it } from "vitest";
import { Customer360IdentityError } from "@/lib/customer-360/customer360Identity";
import { CORE_HIERARCHY_CONTRACT } from "../customerHierarchyContract";
import { customer360HierarchySliceFromResolution } from "../customerHierarchySliceMapper";
import {
  assertCustomerHierarchyCompanyAccess,
  isCoreHierarchyContractAvailable,
  resolveCustomerHierarchy,
} from "../customerHierarchyResolver";

const VALID_UUID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
const OTHER_UUID = "b2c3d4e5-f6a7-4890-b123-456789abcdef0";

describe("resolveCustomerHierarchy", () => {
  it("returns core_contract_missing when org mapping RPC is absent from Central types", async () => {
    const resolution = await resolveCustomerHierarchy(VALID_UUID, {
      viewerCompanyId: null,
      isStorefrontViewer: false,
    });

    expect(resolution.status).toBe("core_contract_missing");
    if (resolution.status === "core_contract_missing") {
      expect(resolution.commercialCompanyId).toBe(VALID_UUID.toLowerCase());
      expect(resolution.corePrerequisite.prerequisiteId).toBe("CORE-HIERARCHY-MAP-01");
      expect(resolution.corePrerequisite.orgTables).toContain("org_companies");
    }
    expect(isCoreHierarchyContractAvailable()).toBe(false);
  });

  it("rejects invalid commercial company ids fail-closed", async () => {
    await expect(
      resolveCustomerHierarchy("not-a-uuid", {
        viewerCompanyId: null,
        isStorefrontViewer: false,
      }),
    ).rejects.toBeInstanceOf(Customer360IdentityError);
  });

  it("denies cross-company hierarchy access for storefront viewers", async () => {
    await expect(
      resolveCustomerHierarchy(VALID_UUID, {
        viewerCompanyId: OTHER_UUID,
        isStorefrontViewer: true,
      }),
    ).rejects.toMatchObject({
      failure: "cross_company_access_denied",
    });
  });

  it("blocks storefront viewers with unresolved buyer identity", async () => {
    await expect(
      resolveCustomerHierarchy(VALID_UUID, {
        viewerCompanyId: null,
        isStorefrontViewer: true,
      }),
    ).rejects.toMatchObject({
      failure: "ambiguous_identity",
    });
  });
});

describe("assertCustomerHierarchyCompanyAccess", () => {
  it("allows staff viewers without company scope checks", () => {
    expect(() =>
      assertCustomerHierarchyCompanyAccess(VALID_UUID, {
        viewerCompanyId: OTHER_UUID,
        isStorefrontViewer: false,
      }),
    ).not.toThrow();
  });
});

describe("customer360HierarchySliceFromResolution", () => {
  it("maps core_contract_missing to unavailable_core_prerequisite slice", () => {
    const slice = customer360HierarchySliceFromResolution({
      status: "core_contract_missing",
      commercialCompanyId: VALID_UUID,
      reason: "Core mapping missing",
      corePrerequisite: CORE_HIERARCHY_CONTRACT,
    });

    expect(slice.availability).toBe("unavailable_core_prerequisite");
    expect(slice.corePrerequisiteId).toBe("CORE-HIERARCHY-MAP-01");
    expect(slice.programmeOwner).toBe("POINT60");
  });

  it("maps unlinked commercial company to unavailable_unlinked slice", () => {
    const slice = customer360HierarchySliceFromResolution({
      status: "unlinked",
      commercialCompanyId: VALID_UUID,
      reason: "No org-company mapping exists for this commercial company.",
    });

    expect(slice.availability).toBe("unavailable_unlinked");
  });

  it("maps ambiguous mapping to error slice", () => {
    const slice = customer360HierarchySliceFromResolution({
      status: "ambiguous",
      commercialCompanyId: VALID_UUID,
      reason: "Multiple org-company candidates matched.",
    });

    expect(slice.availability).toBe("error");
    expect(slice.errorMessage).toContain("Multiple");
  });

  it("maps resolved hierarchy to available slice", () => {
    const slice = customer360HierarchySliceFromResolution({
      status: "resolved",
      commercialCompanyId: VALID_UUID,
      hierarchy: {
        commercialCompanyId: VALID_UUID,
        orgCompanyId: "org-uuid-0001",
        branches: [
          {
            branchId: "branch-1",
            branchName: "HQ",
            branchType: "office",
            status: "active",
          },
        ],
        contacts: [
          {
            contactId: "contact-1",
            displayName: "Buyer Lead",
            email: "buyer@example.com",
            phone: "+91 90000 00001",
            membershipStatus: "active",
            branchScopeIds: ["branch-1"],
          },
        ],
      },
    });

    expect(slice.availability).toBe("available");
    expect(slice.data?.branches).toHaveLength(1);
    expect(slice.data?.contacts).toHaveLength(1);
  });

  it("maps inactive membership to unavailable_not_governed slice", () => {
    const slice = customer360HierarchySliceFromResolution({
      status: "inactive_membership",
      commercialCompanyId: VALID_UUID,
      reason: "All memberships are inactive or revoked.",
    });

    expect(slice.availability).toBe("unavailable_not_governed");
  });
});
