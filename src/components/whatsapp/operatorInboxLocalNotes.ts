const STORAGE_KEY = "oasis_c2b2_operator_inbox_packet_notes_v1";

export interface OperatorInboxPacketNote {
  text: string;
  updatedAt: string;
}

export type OperatorInboxPacketNotesMap = Record<string, OperatorInboxPacketNote>;

export function loadPacketNotesMap(): OperatorInboxPacketNotesMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: OperatorInboxPacketNotesMap = {};
    for (const [packetId, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (!packetId || !val || typeof val !== "object" || Array.isArray(val)) continue;
      const o = val as Record<string, unknown>;
      const text = typeof o.text === "string" ? o.text : "";
      const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString();
      if (text.trim()) out[packetId] = { text, updatedAt };
    }
    return out;
  } catch {
    return {};
  }
}

/** Drops empty notes before persist. */
export function persistPacketNotesMap(map: OperatorInboxPacketNotesMap): void {
  if (typeof window === "undefined") return;
  try {
    const pruned: OperatorInboxPacketNotesMap = {};
    for (const [k, v] of Object.entries(map)) {
      if (v.text.trim()) pruned[k] = v;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    /* quota */
  }
}
