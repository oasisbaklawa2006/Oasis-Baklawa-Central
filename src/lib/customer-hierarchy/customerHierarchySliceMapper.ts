import type { Customer360Slice } from "@/lib/customer-360/customer360Types";
import type {
  CustomerHierarchyResolution,
  CustomerHierarchySummary,
} from "./customerHierarchyTypes";

export function customer360HierarchySliceFromResolution(
  resolution: CustomerHierarchyResolution,
): Customer360Slice<CustomerHierarchySummary> {
  switch (resolution.status) {
    case "resolved":
      return {
        availability: "available",
        programmeOwner: "POINT60",
        data: resolution.hierarchy,
      };
    case "unlinked":
      return {
        availability: "unavailable_unlinked",
        programmeOwner: "POINT60",
        reason: resolution.reason,
      };
    case "ambiguous":
      return {
        availability: "error",
        programmeOwner: "POINT60",
        errorMessage: resolution.reason,
      };
    case "inactive_membership":
      return {
        availability: "unavailable_not_governed",
        programmeOwner: "POINT60",
        reason: resolution.reason,
      };
    case "cross_company_denied":
      return {
        availability: "error",
        programmeOwner: "POINT60",
        errorMessage: resolution.reason,
      };
    case "core_contract_missing":
      return {
        availability: "unavailable_core_prerequisite",
        programmeOwner: "POINT60",
        reason: resolution.reason,
        corePrerequisiteId: resolution.corePrerequisite.prerequisiteId,
      };
    default: {
      const exhaustive: never = resolution;
      return exhaustive;
    }
  }
}
