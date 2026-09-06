/**
 * Point 61 — company-scoped CRM communication history read contract.
 * Canonical customer identity is `companies.id`. This module is read-only.
 */

export type CrmCommunicationChannel =
  | "call"
  | "whatsapp"
  | "email"
  | "note"
  | "visit"
  | "promise"
  | "system"
  | "unknown";

export type CrmCommunicationDirection = "inbound" | "outbound" | "internal" | "unknown";

export type CrmCommunicationActorRole =
  | "sales_executive"
  | "system"
  | "customer"
  | "operator"
  | "unknown";

/** Durable Core authorities surfaced by this read adaptor — never a second ledger. */
export type CrmCommunicationSourceAuthority =
  | "client_interactions"
  | "unavailable";

export type CrmCommunicationChannelAvailability =
  | "available"
  | "partial"
  | "unavailable_not_governed";

export type CrmCommunicationChannelStatus = {
  channel: CrmCommunicationChannel;
  availability: CrmCommunicationChannelAvailability;
  programmeOwner: string;
  reason?: string;
};

export type CrmCommunicationHistoryEntry = {
  /** Stable dedupe key within a company-scoped read. */
  entryId: string;
  occurredAt: string;
  channel: CrmCommunicationChannel;
  direction: CrmCommunicationDirection;
  actor: {
    role: CrmCommunicationActorRole;
    executiveId: string | null;
    displayLabel: string;
  };
  summary: string;
  detail: string | null;
  outcome: string | null;
  followUpDate: string | null;
  source: {
    authority: CrmCommunicationSourceAuthority;
    table: string;
    recordId: string;
  };
  companyId: string;
};

export type CrmCommunicationHistoryReadModel = {
  companyId: string;
  resolvedAt: string;
  entries: CrmCommunicationHistoryEntry[];
  channels: CrmCommunicationChannelStatus[];
};

export type ClientInteractionRow = {
  id: string;
  company_id: string | null;
  executive_id: string | null;
  interaction_type: string | null;
  notes: string | null;
  outcome: string | null;
  follow_up_date: string | null;
  created_at: string | null;
};
