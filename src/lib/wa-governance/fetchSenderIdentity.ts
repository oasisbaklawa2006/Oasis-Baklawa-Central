import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IdentifySenderEdgeResponse,
  SenderEmployeeProfile,
  SenderIdentityViewModel,
} from "./senderIdentityTypes";

export interface FetchSenderIdentityInput {
  phone_number: string;
  wa_contact_id?: string | null;
  message_text?: string;
}

async function loadEmployeeProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<SenderEmployeeProfile | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, name, role, department, designation, is_sales_executive")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as SenderEmployeeProfile;
}

export function mapIdentifySenderResponse(
  edge: IdentifySenderEdgeResponse,
  employeeProfile: SenderEmployeeProfile | null,
): SenderIdentityViewModel {
  const kind = edge.sender_kind ?? "unknown";
  return {
    kind,
    confidence: typeof edge.confidence === "number" ? edge.confidence : null,
    normalizedPhone: edge.normalized_phone ?? null,
    employeeProfile,
    roleFromEdge: edge.role ?? null,
    matchedVia: edge.matched_via ?? null,
    contactId: edge.contact_id ?? null,
    customerName: edge.customer_name ?? null,
    companyName: edge.company_name ?? null,
    reason: edge.reason ?? null,
  };
}

/**
 * Read-only sender resolution for operator inbox (TOOL 2).
 * Invokes whatsapp-identify-sender; optional users select for employee display only.
 */
export async function fetchSenderIdentity(
  supabase: SupabaseClient,
  input: FetchSenderIdentityInput,
): Promise<SenderIdentityViewModel> {
  const phone = input.phone_number?.trim();
  if (!phone) {
    return mapIdentifySenderResponse(
      { success: true, sender_kind: "unknown", reason: "missing_phone" },
      null,
    );
  }

  const { data, error } = await supabase.functions.invoke("whatsapp-identify-sender", {
    body: {
      phone_number: phone,
      wa_contact_id: input.wa_contact_id ?? undefined,
      message_text: input.message_text?.trim() || undefined,
    },
  });

  if (error) {
    throw new Error(error.message || "whatsapp-identify-sender invoke failed");
  }

  const edge = (data ?? {}) as IdentifySenderEdgeResponse;
  if (!edge.success) {
    throw new Error(edge.error || "Sender identification failed");
  }

  let employeeProfile: SenderEmployeeProfile | null = null;
  if (edge.sender_kind === "employee" && edge.user_id) {
    employeeProfile = await loadEmployeeProfile(supabase, edge.user_id);
  }

  return mapIdentifySenderResponse(edge, employeeProfile);
}
