import type { OperatorInboxPacket } from "./operatorInboxTypes";
import {
  inferLocalIntentFromText,
  inferPacketHealth,
  packetAgeBucket,
  packetStitchedPlainText,
  type LocalIntentTone,
  type PacketAgeBucket,
  type PacketHealth,
} from "./operatorInboxUtils";

/** Multi-select “bulk” filters (all client-side, read-only). */
export interface OperatorInboxBulkFilters {
  /** Empty = no health filter. Otherwise packet must match any selected health. */
  healthAnyOf: PacketHealth[];
  ageAnyOf: PacketAgeBucket[];
  intentToneAnyOf: LocalIntentTone[];
}

export const EMPTY_INBOX_BULK_FILTERS: OperatorInboxBulkFilters = {
  healthAnyOf: [],
  ageAnyOf: [],
  intentToneAnyOf: [],
};

export function packetMatchesBulkFilters(packet: OperatorInboxPacket, f: OperatorInboxBulkFilters): boolean {
  if (f.healthAnyOf.length > 0) {
    const h = inferPacketHealth(packet.last_message_at, packet.messages ?? []);
    if (!f.healthAnyOf.includes(h)) return false;
  }
  if (f.ageAnyOf.length > 0) {
    const a = packetAgeBucket(packet.last_message_at);
    if (!f.ageAnyOf.includes(a)) return false;
  }
  if (f.intentToneAnyOf.length > 0) {
    const tone = inferLocalIntentFromText(packetStitchedPlainText(packet.stitched_content)).tone;
    if (!f.intentToneAnyOf.includes(tone)) return false;
  }
  return true;
}
