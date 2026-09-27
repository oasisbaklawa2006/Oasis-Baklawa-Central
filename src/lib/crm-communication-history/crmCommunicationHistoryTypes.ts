/**
 * Point 61 — company-scoped CRM communication history read contract.
 * Canonical customer identity is `companies.id`. This module is read-only.
 */

import type { Database } from "@/integrations/supabase/types";
import type { CrmCommunicationDeepLink } from "./crmCommunicationDeepLink";

/** PostgREST projection required for ledger normalization (fail-closed on company_id). */
export const CLIENT_INTERACTION_LEDGER_SELECT =
  "id, company_id, executive_id, interaction_type, notes, outcome, follow_up_date, created_at";

/** Ledger fields — must stay aligned with `CLIENT_INTERACTION_LEDGER_SELECT`. */
export const CLIENT_INTERACTION_LEDGER_FIELDS = [
  "id",
  "company_id",
  "executive_id",
  "interaction_type",
  "notes",
  "outcome",
  "follow_up_date",
  "created_at",
] as const satisfies ReadonlyArray<
  keyof Database["public"]["Tables"]["client_interactions"]["Row"]
>;

export type ClientInteractionLedgerRow = Pick<
  Database["public"]["Tables"]["client_interactions"]["Row"],
  (typeof CLIENT_INTERACTION_LEDGER_FIELDS)[number]
>;

function hasClientInteractionLedgerProjection(row: unknown): row is ClientInteractionLedgerRow {
  if (!row || typeof row !== "object") return false;
  return CLIENT_INTERACTION_LEDGER_FIELDS.every((field) => field in row);
}

/** Typed read boundary — drops rows missing required ledger projection fields. */
export function mapClientInteractionLedgerRows(data: unknown): ClientInteractionLedgerRow[] {
  if (!Array.isArray(data)) return [];
  return data.filter(hasClientInteractionLedgerProjection);
}

/** Customer 360 shares one bounded interactions query for legacy + ledger slices. */
export const CUSTOMER360_COMMUNICATION_HISTORY_LIMIT = 25;

/** Standalone adaptor default when not embedded in Customer 360. */
export const STANDALONE_COMMUNICATION_HISTORY_LIMIT = 100;

export function resolveStandaloneCommunicationHistoryLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) {
    return STANDALONE_COMMUNICATION_HISTORY_LIMIT;
  }
  return Math.min(Math.floor(limit), STANDALONE_COMMUNICATION_HISTORY_LIMIT);
}

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
  /** Present when outcome/notes carry a governed wa_packet lineage reference. */
  deepLink?: CrmCommunicationDeepLink;
};

export type CrmCommunicationHistoryReadModel = {
  companyId: string;
  resolvedAt: string;
  /** Bounded source-query window — not a claim of full company history. */
  recordLimit: number;
  entries: CrmCommunicationHistoryEntry[];
  channels: CrmCommunicationChannelStatus[];
};

