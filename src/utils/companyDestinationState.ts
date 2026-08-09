/** Mirrors server company_destination_state_label_v1 for UI pre-checks. */
export function deriveCompanyDestinationStateLabel(
  company: { gst_number?: string | null; registered_address?: string | null } | null | undefined,
): string {
  if (!company) return "";
  const gst = (company.gst_number ?? "").trim().toLowerCase().replace(/\s/g, "");
  if (gst.length >= 2 && gst.startsWith("07")) return "delhi";
  const addr = (company.registered_address ?? "").trim().toLowerCase();
  if (/(^|[, ])delhi([, ]|$)/.test(addr) || addr.includes("new delhi")) return "delhi";
  return "";
}

export function ewayThresholdForDestinationState(destState: string): number {
  const normalized = destState.trim().toLowerCase();
  return normalized === "delhi" || normalized === "new delhi" ? 100000 : 50000;
}
