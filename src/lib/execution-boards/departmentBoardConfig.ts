import type { WorkQueueId } from "@/lib/work-queues/queueTypes";

export type DepartmentBoardId =
  | "production"
  | "assembly"
  | "ready-goods"
  | "dispatch"
  | "third-party"
  | "retail"
  | "complaints";

export interface DepartmentBoardConfig {
  id: DepartmentBoardId;
  title: string;
  route: string;
  /** Admin module guard key — must exist in adminModuleAccess. */
  moduleKey: string;
  queueTypes: WorkQueueId[];
  ownerDepartment: string;
  scanCapabilities: Array<"carton" | "handoff" | "gate" | "intake" | "order">;
}

export const DEPARTMENT_BOARDS: Record<DepartmentBoardId, DepartmentBoardConfig> = {
  production: {
    id: "production",
    title: "Production execution",
    route: "/admin/execution/production",
    moduleKey: "production",
    queueTypes: ["production_queue"],
    ownerDepartment: "production",
    scanCapabilities: ["carton", "handoff", "order"],
  },
  assembly: {
    id: "assembly",
    title: "Assembly execution",
    route: "/admin/execution/assembly",
    moduleKey: "production",
    queueTypes: ["assembly_queue"],
    ownerDepartment: "assembly",
    scanCapabilities: ["carton", "handoff"],
  },
  "ready-goods": {
    id: "ready-goods",
    title: "Ready goods execution",
    route: "/admin/execution/ready-goods",
    moduleKey: "inventory",
    queueTypes: ["inventory_verification_queue", "retail_followup_queue"],
    ownerDepartment: "inventory",
    scanCapabilities: ["intake", "carton"],
  },
  dispatch: {
    id: "dispatch",
    title: "Dispatch execution",
    route: "/admin/execution/dispatch",
    moduleKey: "dispatch",
    queueTypes: ["dispatch_queue", "scan_exception_queue"],
    ownerDepartment: "dispatch",
    scanCapabilities: ["gate", "carton"],
  },
  "third-party": {
    id: "third-party",
    title: "Third party execution",
    route: "/admin/execution/third-party",
    moduleKey: "orders",
    queueTypes: ["retail_followup_queue"],
    ownerDepartment: "retail",
    scanCapabilities: ["order", "carton"],
  },
  retail: {
    id: "retail",
    title: "Retail coordination",
    route: "/admin/execution/retail",
    moduleKey: "inventory",
    queueTypes: ["retail_followup_queue", "reservation_verification_queue"],
    ownerDepartment: "retail",
    scanCapabilities: ["intake", "order"],
  },
  complaints: {
    id: "complaints",
    title: "Complaint execution",
    route: "/admin/execution/complaints",
    moduleKey: "support",
    queueTypes: ["customer_support_queue"],
    ownerDepartment: "support",
    scanCapabilities: ["order"],
  },
};

export function getDepartmentBoard(id: DepartmentBoardId): DepartmentBoardConfig {
  return DEPARTMENT_BOARDS[id];
}
