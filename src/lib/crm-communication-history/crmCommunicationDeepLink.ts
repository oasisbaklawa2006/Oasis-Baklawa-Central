const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Governed convention for linking client_interactions rows to operator inbox packets. */
export const WA_PACKET_OUTCOME_PREFIX = "wa_packet:";

export type CrmCommunicationDeepLink = {
  kind: "wa_packet";
  packetId: string;
  operatorInboxPath: string;
};

export function operatorInboxPathForPacket(packetId: string): string {
  return `/admin/operator-inbox?packet=${packetId.toLowerCase()}`;
}

/** Parse packet lineage from outcome or notes without inventing identifiers. */
export function parseCrmCommunicationDeepLink(
  notes: string | null,
  outcome: string | null,
): CrmCommunicationDeepLink | null {
  const candidates = [outcome, notes].filter((value): value is string => Boolean(value?.trim()));
  for (const raw of candidates) {
    const trimmed = raw.trim();
    const prefixed = trimmed.match(/^wa_packet:([0-9a-f-]{36})$/i);
    if (prefixed && UUID_PATTERN.test(prefixed[1])) {
      const packetId = prefixed[1].toLowerCase();
      return { kind: "wa_packet", packetId, operatorInboxPath: operatorInboxPathForPacket(packetId) };
    }
    const bracketed = trimmed.match(/\[WA_PACKET:([0-9a-f-]{36})\]/i);
    if (bracketed && UUID_PATTERN.test(bracketed[1])) {
      const packetId = bracketed[1].toLowerCase();
      return { kind: "wa_packet", packetId, operatorInboxPath: operatorInboxPathForPacket(packetId) };
    }
  }
  return null;
}

export function formatWaPacketOutcome(packetId: string): string {
  return `${WA_PACKET_OUTCOME_PREFIX}${packetId.toLowerCase()}`;
}

export function isGovernedPacketUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function formatWaPacketNotesLineage(packetId: string): string {
  return `[WA_PACKET:${packetId.toLowerCase()}]`;
}

/** Build governed client_interactions log fields for outbound WhatsApp sends. */
export function buildWhatsappClientInteractionLog(params: {
  message: string;
  success: boolean;
  packetId: string | null;
}): { notes: string; outcome: string } {
  const autoNotes = `[AUTO] ${params.message.substring(0, 500)}`;
  const notes = params.packetId
    ? `${autoNotes}\n${formatWaPacketNotesLineage(params.packetId)}`
    : autoNotes;
  return {
    notes,
    outcome: params.success ? "delivered" : "failed",
  };
}
