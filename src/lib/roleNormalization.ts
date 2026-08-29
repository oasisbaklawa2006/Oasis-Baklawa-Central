/**
 * Pure role-string normalization, deliberately free of any runtime
 * dependency (Supabase client, routing, etc.) so certification code and
 * other lightweight callers can normalize a role without pulling in
 * unrelated singletons.
 */
export function normalizeRole(role?: string | null): string | null {
  return role?.trim().toUpperCase() ?? null;
}
