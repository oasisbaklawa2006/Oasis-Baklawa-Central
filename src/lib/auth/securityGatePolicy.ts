/** Roles permitted to operate the physical security gate surface. */
export const SECURITY_GATE_ALLOWED_ROLES = [
  "GATE_SECURITY",
  "SECURITY_CONTROL",
  "SUPER_ADMIN",
  "ADMIN",
] as const;

const DISPATCH_ROLES = new Set(["DISPATCH_MANAGER", "DISPATCH_INCHARGE", "DISPATCH_HEAD"]);

export function canAccessSecurityGate(role: string | null | undefined): boolean {
  const normalized = role?.trim().toUpperCase();
  if (!normalized) return false;
  return (SECURITY_GATE_ALLOWED_ROLES as readonly string[]).includes(normalized);
}

export function isDispatchRole(role: string | null | undefined): boolean {
  const normalized = role?.trim().toUpperCase();
  return normalized ? DISPATCH_ROLES.has(normalized) : false;
}
