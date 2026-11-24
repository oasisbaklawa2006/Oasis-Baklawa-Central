/**
 * Narrow success guard for the Core-owned staff invitation endpoint.
 * A 2xx response by itself is never proof of role provisioning.
 */
type RecordObject = Record<string, unknown>;
const asRecord = (value: unknown): RecordObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as RecordObject
    : null;

export function assertStaffInviteResponse(payload: unknown): string {
  const data = asRecord(payload);
  if (!data || data.ok !== true) {
    // The provider exposes safe, actionable authorization and configuration
    // errors; passwords, tokens, and identifiers are never accepted here.
    throw new Error(typeof data?.error === "string" && data.error.trim()
      ? data.error
      : "Staff invitation was not confirmed by Core");
  }

  const user = asRecord(data.user);
  if (!user || typeof user.id !== "string" ||
      !/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(user.id)) {
    throw new Error("Core did not confirm an employee identity");
  }
  return user.id;
}
