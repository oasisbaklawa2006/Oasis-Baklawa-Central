import type { Database } from "@/integrations/supabase/types";

type Functions = Database["public"]["Functions"];
export type ComplaintHandoff = Functions["get_commercial_complaint_handoff_facts_v1"]["Returns"][number];
export type ComplaintResolution = Functions["resolve_commercial_complaint_v1"]["Returns"][number];

export const COMPLAINT_FINANCE_ROUTE = "/admin/finance/complaints";

export function canResolveCommercialComplaint(role: string | null | undefined) {
  return role === "FINANCE_HEAD" || role === "FINANCE_EXEC";
}

export function canLinkComplaintReturn(role: string | null) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "SUPPORT_EXECUTIVE";
}

export const isBridgeId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function returnLinkError(message: string) {
  switch (message) {
    case "RETURN_COMPLAINT_LINEAGE_MISMATCH":
      return "The return case must belong to the same order and company as this complaint.";
    case "RETURN_CASE_UNBOUND_LEGACY":
      return "This legacy return case has no linked order. Use an order-bound return case.";
    case "RETURN_LINK_CONFLICT":
      return "This return case is already linked to another complaint.";
    case "RETURN_CASE_NOT_FOUND":
      return "Return case not found. Check the case ID.";
    case "RETURN_LINK_ACTOR_NOT_AUTHORIZED":
      return "Your account is not authorized to link return cases.";
    default:
      return "Could not confirm the return link. Check the case ID and retry.";
  }
}

export function complaintResolutionError(message: string) {
  switch (message) {
    case "FINANCE_CLEARANCE_AAL2_REQUIRED":
      return "Verify your authenticator before submitting a Finance resolution.";
    case "COMPLAINT_ALREADY_RESOLVED":
      return "Finance has already resolved this complaint. Refresh the handoff to see the adjustment.";
    case "FINAL_INVOICE_NOT_FOUND":
      return "Finance resolution requires an issued final invoice.";
    default:
      return "Could not confirm the Finance resolution. Retry the same submission or refresh the handoff.";
  }
}
