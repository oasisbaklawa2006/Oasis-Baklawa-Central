import { enqueueOperatorWorkspaceMutation } from "./operatorInboxWorkspaceMutations";

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

function prunedNotes(map: OperatorInboxPacketNotesMap): OperatorInboxPacketNotesMap {
  const pruned: OperatorInboxPacketNotesMap = {};
  for (const [packetId, note] of Object.entries(map)) {
    if (note.text.trim()) pruned[packetId] = note;
  }
  return pruned;
}

/** Browser storage is a cache. Changes enqueue governed Core mutations. */
export function persistPacketNotesMap(map: OperatorInboxPacketNotesMap): void {
  if (typeof window === "undefined") return;
  try {
    const previous = loadPacketNotesMap();
    const next = prunedNotes(map);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    const ids = new Set([...Object.keys(previous), ...Object.keys(next)]);
    for (const packetId of ids) {
      const before = previous[packetId]?.text.trim() ?? "";
      const after = next[packetId]?.text.trim() ?? "";
      if (before === after) continue;
      if (after) {
        enqueueOperatorWorkspaceMutation({ kind: "UPSERT_NOTE", packetId, text: after });
      } else if (before) {
        enqueueOperatorWorkspaceMutation({ kind: "DELETE_NOTE", packetId });
      }
    }
  } catch {
    /* quota */
  }
}

/** Hydration path only: replace browser cache without producing a server mutation. */
export function replacePacketNotesFromServer(map: OperatorInboxPacketNotesMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prunedNotes(map)));
  } catch {
    /* quota */
  }
}
