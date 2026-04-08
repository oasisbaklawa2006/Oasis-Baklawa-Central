import { isThirdPartyDepartment, isThirdPartyItem } from "@/lib/third-party";
import { classifyFlow, isAssemblyDept, type TriadFlow } from "@/utils/departmentClassifier";

type FlowItemLike = {
  department?: string | null;
  notes?: string | null;
  production_department?: string | null;
  task_type?: string | null;
  product?: {
    name?: string | null;
    production_department?: string | null;
  } | null;
};

export function resolveOrderItemFlow(item: FlowItemLike): TriadFlow {
  const productDepartment = item.product?.production_department || item.production_department || null;
  const department = item.department || null;

  if (item.task_type === "assembly_support" || isThirdPartyDepartment(department)) {
    return "FLOW_3PCS";
  }

  if (isAssemblyDept(productDepartment || department)) {
    return "FLOW_ASSEMBLY";
  }

  if (isThirdPartyItem(department, productDepartment)) {
    return "FLOW_3PCS";
  }

  return classifyFlow(productDepartment || department);
}

export function getOrderItemDisplayName(item: Pick<FlowItemLike, "notes" | "product">) {
  if (item.product?.name) return item.product.name;

  const componentMatch = item.notes?.match(/component:\s*([^|]+)/i);
  if (componentMatch?.[1]) return componentMatch[1].trim();

  const bomMatch = item.notes?.match(/bom_component:([^|]+)/i);
  if (bomMatch?.[1]) return bomMatch[1].trim();

  return item.notes?.trim() || "Unnamed procurement item";
}