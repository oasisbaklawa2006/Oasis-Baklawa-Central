import type {
  ClientInteractionRow,
  CrmCommunicationActorRole,
  CrmCommunicationChannel,
  CrmCommunicationChannelStatus,
  CrmCommunicationDirection,
  CrmCommunicationHistoryEntry,
} from "./crmCommunicationHistoryTypes";
import { stripPoint62Provenance } from "@/lib/crm-action-capture/crmActionCaptureProvenance";

const AUTO_LOG_PREFIX = "[AUTO]";

export function buildCrmCommunicationChannelGovernance(): CrmCommunicationChannelStatus[] {
  return [
    {
      channel: "call",
      availability: "available",
      programmeOwner: "POINT61",
    },
    {
      channel: "visit",
      availability: "available",
      programmeOwner: "POINT61",
    },
    {
      channel: "note",
      availability: "available",
      programmeOwner: "POINT61",
    },
    {
      channel: "whatsapp",
      availability: "partial",
      programmeOwner: "POINT61",
      reason:
        "Governed via client_interactions (manual notes and send-whatsapp auto-log). Unlinked inbound packets and protected historical WA corpus are excluded.",
    },
    {
      channel: "promise",
      availability: "available",
      programmeOwner: "POINT62",
      reason: "Structured promise/commitment capture via governed Point62 action boundary.",
    },
    {
      channel: "email",
      availability: "partial",
      programmeOwner: "POINT62",
      reason: "Intent-only capture via Point62; durable provider send authority is not yet exposed.",
    },
    {
      channel: "system",
      availability: "partial",
      programmeOwner: "POINT61",
      reason: "System-originated rows are projected only when written to client_interactions.",
    },
  ];
}

export function mapInteractionTypeToChannel(interactionType: string | null): CrmCommunicationChannel {
  const normalized = (interactionType ?? "").trim().toLowerCase();
  switch (normalized) {
    case "call":
      return "call";
    case "whatsapp":
    case "wa":
      return "whatsapp";
    case "email":
      return "email";
    case "visit":
      return "visit";
    case "note":
      return "note";
    case "promise":
      return "promise";
    case "system":
      return "system";
    default:
      return normalized ? "unknown" : "unknown";
  }
}

export function inferDirectionFromInteraction(row: ClientInteractionRow): CrmCommunicationDirection {
  const notes = row.notes ?? "";
  if (notes.startsWith(AUTO_LOG_PREFIX)) return "outbound";
  if (notes.startsWith("[POINT62:")) {
    const type = (row.interaction_type ?? "").toLowerCase();
    if (type === "email") return "outbound";
    if (type === "whatsapp" && row.outcome === "intent_recorded") return "outbound";
    return "internal";
  }
  const type = (row.interaction_type ?? "").toLowerCase();
  if (type === "note" || type === "promise") return "internal";
  if (type === "visit") return "outbound";
  return "unknown";
}

export function inferActorRoleFromInteraction(row: ClientInteractionRow): CrmCommunicationActorRole {
  const notes = row.notes ?? "";
  if (notes.startsWith(AUTO_LOG_PREFIX)) return "system";
  if (notes.startsWith("[POINT62:") && row.executive_id) return "sales_executive";
  if (row.executive_id) return "sales_executive";
  return "unknown";
}

export function actorDisplayLabel(role: CrmCommunicationActorRole): string {
  switch (role) {
    case "sales_executive":
      return "Sales executive";
    case "system":
      return "System (auto-log)";
    case "customer":
      return "Customer";
    case "operator":
      return "Operator";
    default:
      return "Unknown actor";
  }
}

function stripAutoLogPrefix(notes: string | null): string | null {
  if (!notes) return null;
  const point62Stripped = stripPoint62Provenance(notes);
  const working = point62Stripped ?? notes;
  if (working.startsWith(AUTO_LOG_PREFIX)) {
    const stripped = working.slice(AUTO_LOG_PREFIX.length).trim();
    return stripped || null;
  }
  return point62Stripped ?? notes;
}

export function normalizeClientInteractionRow(
  row: ClientInteractionRow,
  companyId: string,
): CrmCommunicationHistoryEntry | null {
  if (!row.company_id || row.company_id.toLowerCase() !== companyId.toLowerCase()) {
    return null;
  }

  const channel = mapInteractionTypeToChannel(row.interaction_type);
  const direction = inferDirectionFromInteraction(row);
  const actorRole = inferActorRoleFromInteraction(row);
  const detail = stripAutoLogPrefix(row.notes);
  const summary =
    channel === "unknown"
      ? row.interaction_type?.trim() || "Interaction"
      : channel.charAt(0).toUpperCase() + channel.slice(1);

  return {
    entryId: `ci:${row.id}`,
    occurredAt: row.created_at ?? new Date(0).toISOString(),
    channel,
    direction,
    actor: {
      role: actorRole,
      executiveId: row.executive_id,
      displayLabel: actorDisplayLabel(actorRole),
    },
    summary,
    detail,
    outcome: row.outcome,
    followUpDate: row.follow_up_date,
    source: {
      authority: "client_interactions",
      table: "client_interactions",
      recordId: row.id,
    },
    companyId: companyId.toLowerCase(),
  };
}

export function sortCommunicationHistoryEntries(
  entries: CrmCommunicationHistoryEntry[],
): CrmCommunicationHistoryEntry[] {
  return [...entries].sort((left, right) => {
    const timeDelta = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
    if (timeDelta !== 0) return timeDelta;
    return right.entryId.localeCompare(left.entryId);
  });
}

/** Deterministic dedupe — preserves first occurrence after sort (newest wins). */
export function dedupeCommunicationHistoryEntries(
  entries: CrmCommunicationHistoryEntry[],
): CrmCommunicationHistoryEntry[] {
  const seen = new Set<string>();
  const deduped: CrmCommunicationHistoryEntry[] = [];
  for (const entry of sortCommunicationHistoryEntries(entries)) {
    const key = `${entry.source.table}:${entry.source.recordId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }
  return deduped;
}

export function buildCommunicationHistoryFromClientInteractions(
  rows: ClientInteractionRow[],
  companyId: string,
): CrmCommunicationHistoryEntry[] {
  const normalized = rows
    .map((row) => normalizeClientInteractionRow(row, companyId))
    .filter((entry): entry is CrmCommunicationHistoryEntry => entry != null);
  return dedupeCommunicationHistoryEntries(normalized);
}
