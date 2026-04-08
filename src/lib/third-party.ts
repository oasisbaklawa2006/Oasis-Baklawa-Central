import { classifyFlow } from "@/utils/departmentClassifier";

const THIRD_PARTY_ALIASES = new Set([
  "3rd party",
  "3rd party goods",
  "3rd party store",
  "3pcs",
  "3rd_party",
  "third party",
  "third_party",
]);

export function normalizeDepartment(raw?: string | null) {
  return raw?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

export function isThirdPartyDepartment(raw?: string | null) {
  const normalized = normalizeDepartment(raw);
  return normalized ? THIRD_PARTY_ALIASES.has(normalized) : false;
}

export function isThirdPartyItem(department?: string | null, productionDepartment?: string | null) {
  if (isThirdPartyDepartment(department) || isThirdPartyDepartment(productionDepartment)) {
    return true;
  }

  return classifyFlow(productionDepartment || department) === "FLOW_3PCS";
}

export function isActiveProductionStatus(status?: string | null) {
  return ["pending", "accepted", "in_progress", "in_production", "partial_ready"].includes(status ?? "");
}

export function isActiveFactoryOrderStatus(status?: string | null) {
  return ["approved", "manufacturing", "in_production", "partial_ready", "packed_ready"].includes(status ?? "");
}
