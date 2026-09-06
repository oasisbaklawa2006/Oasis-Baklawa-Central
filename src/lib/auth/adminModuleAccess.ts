import {
  getAllowedModulesForRole,
  hasModuleAccess,
  ROLE_MODULE_ACCESS,
  type AppVerseGrantedModule,
  type AppVerseModuleKey,
} from "@/lib/appverse/roleAccess";

/** @deprecated Prefer `@/lib/appverse/roleAccess` directly. */
export { ROLE_MODULE_ACCESS, type AppVerseGrantedModule, type AppVerseModuleKey };

/** Legacy signature: (role, moduleKey) — delegates to canonical roleAccess. */
export function hasAdminModuleAccess(role: string | null | undefined, moduleKey: string): boolean {
  if (!role) return false;
  return hasModuleAccess(getAllowedModulesForRole(role), moduleKey);
}
