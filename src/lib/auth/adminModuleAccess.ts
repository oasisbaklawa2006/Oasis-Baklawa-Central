import {
  getAllowedModulesForRole,
  hasModuleAccess,
  ROLE_MODULE_ACCESS,
  type AppVerseGrantedModule,
  type AppVerseModuleKey,
} from "@/lib/appverse/roleAccess";

/** @deprecated Prefer `@/lib/appverse/roleAccess` directly. */
export { ROLE_MODULE_ACCESS, type AppVerseGrantedModule, type AppVerseModuleKey };

/**
 * Legacy role→module check used by execution-board tests.
 * Fail-closed: returns false when role is null/undefined or module is not granted.
 */
export function hasAdminModuleAccess(role: string | null | undefined, moduleKey: string): boolean {
  if (!role) return false;
  return hasModuleAccess(getAllowedModulesForRole(role), moduleKey);
}
