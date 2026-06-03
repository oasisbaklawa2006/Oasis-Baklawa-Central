import type { SenderIdentityViewModel } from "./senderIdentityTypes";

export type ClientResolutionConfidenceBand =
  | "auto_highlight"
  | "suggested"
  | "needs_clarification";

export interface ClientResolutionCandidate {
  companyId: string;
  companyName: string;
  ownerId: string | null;
  ownerName: string | null;
  confidence: number;
  reasons: string[];
}

export interface ClientResolutionResult {
  candidateClients: ClientResolutionCandidate[];
  bestMatch: ClientResolutionCandidate | null;
  band: ClientResolutionConfidenceBand;
}

export interface ClientResolutionInput {
  messageText: string;
  stitchedPlainText?: string;
  senderPhone?: string;
  waContactId?: string | null;
  waCustomerName?: string | null;
  waCompanyName?: string | null;
  senderIdentity?: SenderIdentityViewModel | null;
}

export interface ClientResolutionTextSignals {
  combinedText: string;
  nameCandidates: string[];
  gstNumbers: string[];
  phoneLast10: string[];
  orderReferences: string[];
  numericCodes: string[];
  locationTokens: string[];
}

export interface CompanyResolutionRow {
  id: string;
  business_name: string;
  account_manager_id: string | null;
  phone: string | null;
  gst_number: string | null;
  status: string | null;
  registered_address: string | null;
}

export interface OwnerProfileRow {
  id: string;
  full_name: string | null;
  name: string | null;
}

export type ClientResolutionScoreReason = {
  companyId: string;
  weight: number;
  reason: string;
};
