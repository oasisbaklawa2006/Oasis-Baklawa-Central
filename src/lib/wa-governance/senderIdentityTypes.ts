/** TOOL 2 whatsapp-identify-sender response kinds (read-only). */
export type SenderIdentityKind = "employee" | "customer" | "spam" | "unknown";

export interface IdentifySenderEdgeResponse {
  success: boolean;
  error?: string;
  sender_kind?: SenderIdentityKind;
  confidence?: number;
  normalized_phone?: string;
  user_id?: string;
  role?: string;
  matched_via?: string;
  contact_id?: string;
  customer_name?: string | null;
  company_name?: string | null;
  reason?: string;
}

export interface SenderEmployeeProfile {
  id: string;
  full_name: string | null;
  name: string | null;
  role: string;
  department: string | null;
  designation: string | null;
  is_sales_executive: boolean;
}

export interface SenderIdentityViewModel {
  kind: SenderIdentityKind;
  confidence: number | null;
  normalizedPhone: string | null;
  /** Employee path */
  employeeProfile: SenderEmployeeProfile | null;
  roleFromEdge: string | null;
  matchedVia: string | null;
  /** Customer path */
  contactId: string | null;
  customerName: string | null;
  companyName: string | null;
  reason: string | null;
}
