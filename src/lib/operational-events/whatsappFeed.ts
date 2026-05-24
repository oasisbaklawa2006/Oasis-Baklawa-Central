import type { Message, OperatorInboxPacket } from "@/components/whatsapp/operatorInboxTypes";
import {
  inferPacketHealth,
  isLastMessageInboundUnanswered,
  messageHasAttachmentHint,
  packetAgeBucket,
  sortMessagesChronological,
  stitchedContentLooksClassified,
} from "@/components/whatsapp/operatorInboxUtils";
import { normalizeOperationalTimestamp } from "./normalize";
import { deriveCustomerWaitingSignal, deriveNoResponseWarning } from "./readOnlyOperationalSignals";
import type { OperationalEventRecord } from "./types";
import { WhatsAppOperationalEventKind } from "./types";

const SOURCE = "derived_whatsapp_inbox" as const;

function packetEntities(packetId: string): OperationalEventRecord["entities"] {
  return [{ entityType: "whatsapp_packet", id: packetId }];
}

const MESSAGE_PROJECTION_CAP = 48;

function truncate(s: string, max = 72): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function lastInboundIso(messages: Message[]): string | null {
  const sorted = sortMessagesChronological(messages);
  for (let i = sorted.length - 1; i >= 0; i--) {
    const m = sorted[i]!;
    if (m.direction === "inbound" && m.created_at) return normalizeOperationalTimestamp(m.created_at);
  }
  return null;
}

/**
 * Projects WhatsApp packet + messages into operational timeline rows.
 * Pure function — no network, no writes, no model authority.
 */
export function buildWhatsAppOperationalFeed(input: {
  packet: OperatorInboxPacket;
  linkedOrderId?: string | null;
  now?: number;
}): OperationalEventRecord[] {
  const now = input.now ?? Date.now();
  const packet = input.packet;
  const pid = packet.id;
  const messages = sortMessagesChronological(packet.messages ?? []);
  const tail = messages.length > MESSAGE_PROJECTION_CAP ? messages.slice(-MESSAGE_PROJECTION_CAP) : messages;
  const out: OperationalEventRecord[] = [];

  const orderEntities = input.linkedOrderId
    ? [
        { entityType: "whatsapp_packet" as const, id: pid },
        { entityType: "order" as const, id: input.linkedOrderId },
      ]
    : packetEntities(pid);

  let sortCursor = 1000;
  for (const msg of tail) {
    const iso = normalizeOperationalTimestamp(msg.created_at);
    const inbound = msg.direction === "inbound";
    const kind = inbound ? WhatsAppOperationalEventKind.MESSAGE_RECEIVED : WhatsAppOperationalEventKind.MESSAGE_SENT;
    const hasAtt = messageHasAttachmentHint(msg);
    const preview = truncate(msg.content ?? (hasAtt ? "[attachment]" : "(no text)"));
    sortCursor += 1;
    out.push({
      id: `oe:wa:${pid}:msg:${msg.id}`,
      kind,
      category: "communication",
      severity: "info",
      title: inbound ? "Inbound WhatsApp" : "Outbound WhatsApp",
      detail: preview,
      occurredAt: iso,
      sortKey: sortCursor,
      actor: { role: inbound ? "customer" : "operator", displayLabel: inbound ? "Customer" : "Operator / system" },
      entities: orderEntities,
      source: SOURCE,
      hasAttachment: hasAtt,
    });
  }

  const statusLower = (packet.status || "").toLowerCase();
  const escalated =
    /escalat|urgent|priority|blocked|hold|review_required|needs_cmd/.test(statusLower) ||
    inferPacketHealth(packet.last_message_at, messages) === "operator_issue";

  sortCursor += 10;
  if (escalated) {
    out.push({
      id: `oe:wa:${pid}:packet_escalated`,
      kind: WhatsAppOperationalEventKind.PACKET_ESCALATED,
      category: "escalation",
      severity: "warning",
      title: "Packet needs attention",
      detail: `Packet status · ${packet.status}`,
      occurredAt: normalizeOperationalTimestamp(packet.last_message_at),
      sortKey: sortCursor,
      actor: { role: "system", displayLabel: "Rule snapshot" },
      entities: packetEntities(pid),
      source: SOURCE,
    });
  } else {
    const classified = stitchedContentLooksClassified(packet.stitched_content);
    out.push({
      id: `oe:wa:${pid}:packet_classified`,
      kind: WhatsAppOperationalEventKind.PACKET_CLASSIFIED,
      category: "operational",
      severity: classified ? "info" : "info",
      title: classified ? "Stitched metadata present" : "Packet status snapshot",
      detail: `Status · ${packet.status} · ${packet.fragment_count} fragments`,
      occurredAt: normalizeOperationalTimestamp(packet.last_message_at),
      sortKey: sortCursor,
      actor: { role: "system", displayLabel: "Inbox projection" },
      entities: packetEntities(pid),
      source: SOURCE,
    });
  }

  const age = packetAgeBucket(packet.last_message_at, now);
  if (age === "stale") {
    sortCursor += 1;
    out.push({
      id: `oe:wa:${pid}:stale_thread`,
      kind: WhatsAppOperationalEventKind.STALE_THREAD,
      category: "escalation",
      severity: "warning",
      title: "Stale thread (idle 24h+)",
      detail: "Last activity exceeds 24h — verify if still actionable.",
      occurredAt: normalizeOperationalTimestamp(packet.last_message_at),
      sortKey: sortCursor,
      actor: { role: "system", displayLabel: "SLA hint" },
      entities: packetEntities(pid),
      source: SOURCE,
    });
  }

  const unanswered = isLastMessageInboundUnanswered(messages);
  const lastInIso = lastInboundIso(messages);
  const waiting = deriveCustomerWaitingSignal(lastInIso, unanswered, now);
  if (waiting.active) {
    sortCursor += 1;
    out.push({
      id: `oe:wa:${pid}:customer_waiting`,
      kind: WhatsAppOperationalEventKind.CUSTOMER_WAITING,
      category: "communication",
      severity: waiting.severity === "urgent" ? "urgent" : "warning",
      title: "Customer may be waiting",
      detail:
        lastInIso && waiting.hoursSinceLastCustomerInbound != null
          ? `~${waiting.hoursSinceLastCustomerInbound}h since last inbound (ends on customer).`
          : "Last message is inbound — confirm reply status.",
      occurredAt: normalizeOperationalTimestamp(packet.last_message_at),
      sortKey: sortCursor,
      actor: { role: "customer", displayLabel: "Customer" },
      entities: packetEntities(pid),
      source: SOURCE,
    });
  }

  const nores = deriveNoResponseWarning(lastInIso, unanswered, now);
  if (nores.active) {
    sortCursor += 1;
    out.push({
      id: `oe:wa:${pid}:no_response_warning`,
      kind: WhatsAppOperationalEventKind.NO_RESPONSE_WARNING,
      category: "escalation",
      severity: "urgent",
      title: "Long-running inbound without reply",
      detail:
        nores.hoursSinceLastInbound != null
          ? `~${nores.hoursSinceLastInbound}h since last inbound — review when staffed.`
          : "No outbound after extended inbound idle (heuristic).",
      occurredAt: normalizeOperationalTimestamp(packet.last_message_at),
      sortKey: sortCursor,
      actor: { role: "cmd", displayLabel: "Ops policy" },
      entities: packetEntities(pid),
      source: SOURCE,
    });
  }

  const attCount = messages.filter(messageHasAttachmentHint).length;
  if (attCount > 0) {
    sortCursor += 1;
    out.push({
      id: `oe:wa:${pid}:attachments_roll`,
      kind: WhatsAppOperationalEventKind.ATTACHMENT_RECEIVED,
      category: "communication",
      severity: "info",
      title: "Attachments in thread",
      detail: `${attCount} message(s) matched attachment/media heuristics (read-only).`,
      occurredAt: normalizeOperationalTimestamp(packet.last_message_at),
      sortKey: sortCursor,
      actor: { role: "system", displayLabel: "Heuristic" },
      entities: packetEntities(pid),
      source: SOURCE,
      hasAttachment: true,
    });
  }

  const opReply = messages.find((m) => m.direction === "outbound" && (m.provider || "").trim() === "operator_reply");
  if (opReply?.created_at) {
    sortCursor += 1;
    out.push({
      id: `oe:wa:${pid}:operator_assigned`,
      kind: WhatsAppOperationalEventKind.OPERATOR_ASSIGNED,
      category: "operational",
      severity: "info",
      title: "Operator-originated outbound on record",
      detail: `Earliest matching outbound · provider ${opReply.provider ?? "—"}`,
      occurredAt: normalizeOperationalTimestamp(opReply.created_at),
      sortKey: sortCursor,
      actor: { role: "operator", displayLabel: "Operator desk" },
      entities: packetEntities(pid),
      source: SOURCE,
    });
  }

  return out;
}
