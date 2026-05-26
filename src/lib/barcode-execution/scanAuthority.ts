import { isForbiddenBusinessAction } from "@/lib/execution-authority/executionAuthorityMatrix";

export type ScanAuthorityAction =
  | "scan:verify"
  | "scan:gate"
  | "scan:handoff"
  | "scan:reject"
  | "scan:escalate";

export interface ScanAuthorityContext {
  actorRole: string;
  scanType?: string;
  actorDepartment?: string | null;
}

const GATE_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATIONS_MANAGER",
  "DISPATCH_MANAGER",
  "DISPATCH_INCHARGE",
  "DISPATCH_HEAD",
]);

const HANDOFF_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATIONS_MANAGER",
  "PRODUCTION_MANAGER",
  "ASSEMBLY_MANAGER",
  "DISPATCH_MANAGER",
  "DISPATCH_HEAD",
  "STORE_INCHARGE",
  "STORE_READY_GOODS",
  "RGS_ADMIN",
  "HOD_ASSEMBLY",
  "HOD_ARABIC",
  "HOD_FUSION",
  "HOD_CHOCOLATE",
  "HOD_BAKERY",
  "HOD_NUTS",
  "HOD_DRAGEES",
]);

const VERIFY_ROLES = new Set([...HANDOFF_ROLES, "DISPATCH_INCHARGE", "PACKING_SUPERVISOR", "SECURITY_CONTROL"]);

export function isKnownScanAction(action: string): action is ScanAuthorityAction {
  return (
    action === "scan:verify" ||
    action === "scan:gate" ||
    action === "scan:handoff" ||
    action === "scan:reject" ||
    action === "scan:escalate"
  );
}

export function assertScanAuthority(action: ScanAuthorityAction, ctx: ScanAuthorityContext): void {
  if (isForbiddenBusinessAction(action)) {
    throw new Error(`Forbidden business action: ${action}`);
  }
  if (!isKnownScanAction(action)) {
    throw new Error(`Unknown scan action: ${action}`);
  }
  const role = ctx.actorRole.trim().toUpperCase();
  if (role === "SUPER_ADMIN") return;

  if (action === "scan:gate") {
    if (!GATE_ROLES.has(role)) {
      throw new Error(`Role ${role} cannot perform dispatch gate scans`);
    }
    return;
  }

  if (action === "scan:handoff") {
    if (!HANDOFF_ROLES.has(role)) {
      throw new Error(`Role ${role} cannot perform department handoff scans`);
    }
    return;
  }

  if (action === "scan:verify" || action === "scan:reject" || action === "scan:escalate") {
    if (!VERIFY_ROLES.has(role)) {
      throw new Error(`Role ${role} denied for ${action}`);
    }
    return;
  }
}
