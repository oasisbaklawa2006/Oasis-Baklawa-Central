// Pure helpers for whatsapp_buffer housekeeping. Zero Deno/Supabase imports so
// Vitest can import this file directly (same pattern as whatsappStitchingWindow.ts).

export const BUFFER_IDLE_SECONDS = 60;
export const BUFFER_FLUSHING_STALE_SECONDS = 5 * 60;

export type BufferRow = {
  id: string;
  sender_phone: string;
  created_at: string;
  bundle_status: string;
};

export function normalizeSenderPhoneLast10(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function to91FromSenderLast10(senderLast10: string): string {
  const last10 = normalizeSenderPhoneLast10(senderLast10);
  if (last10.length !== 10) return last10;
  return `91${last10}`;
}

export function latestCreatedAtBySender(rows: BufferRow[]): Map<string, string> {
  const senderLatest = new Map<string, string>();
  for (const row of rows) {
    const sender = normalizeSenderPhoneLast10(row.sender_phone);
    if (!sender) continue;
    const rowMs = Date.parse(row.created_at);
    if (!Number.isFinite(rowMs)) continue;
    const existing = senderLatest.get(sender);
    if (!existing || rowMs > Date.parse(existing)) senderLatest.set(sender, row.created_at);
  }
  return senderLatest;
}

export function earliestCreatedAtBySender(rows: BufferRow[]): Map<string, string> {
  const senderEarliest = new Map<string, string>();
  for (const row of rows) {
    const sender = normalizeSenderPhoneLast10(row.sender_phone);
    if (!sender) continue;
    const rowMs = Date.parse(row.created_at);
    if (!Number.isFinite(rowMs)) continue;
    const existing = senderEarliest.get(sender);
    if (!existing || rowMs < Date.parse(existing)) senderEarliest.set(sender, row.created_at);
  }
  return senderEarliest;
}

export function pickIdleSenders(senderLatest: Map<string, string>, cutoffIso: string): string[] {
  const cutoffMs = Date.parse(cutoffIso);
  if (!Number.isFinite(cutoffMs)) return [];

  const eligible: string[] = [];
  for (const [sender, latest] of senderLatest) {
    const latestMs = Date.parse(latest);
    if (Number.isFinite(latestMs) && latestMs < cutoffMs) eligible.push(sender);
  }
  return eligible;
}

export function isStaleFlushingRow(createdAtIso: string, nowMs: number): boolean {
  const createdMs = Date.parse(createdAtIso);
  if (!Number.isFinite(createdMs)) return false;
  return nowMs - createdMs >= BUFFER_FLUSHING_STALE_SECONDS * 1000;
}
