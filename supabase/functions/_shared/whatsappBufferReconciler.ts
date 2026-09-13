// @ts-nocheck — Deno edge module; imported by Vitest for pure helpers only.
// Idempotent whatsapp_buffer housekeeping after governed packet stitching.
// Does not create orders, suggested_orders, or duplicate packets — only marks
// buffer rows flushed once linked whatsapp_messages have packet_id set.

type SupabaseAdmin = {
  from: (table: string) => Record<string, unknown>;
};

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
    const existing = senderLatest.get(sender);
    if (!existing || row.created_at > existing) senderLatest.set(sender, row.created_at);
  }
  return senderLatest;
}

export function pickIdleSenders(senderLatest: Map<string, string>, cutoffIso: string): string[] {
  const eligible: string[] = [];
  for (const [sender, latest] of senderLatest) {
    if (latest < cutoffIso) eligible.push(sender);
  }
  return eligible;
}

export function isStaleFlushingRow(createdAtIso: string, nowMs: number): boolean {
  const createdMs = Date.parse(createdAtIso);
  if (!Number.isFinite(createdMs)) return false;
  return nowMs - createdMs >= BUFFER_FLUSHING_STALE_SECONDS * 1000;
}

async function contactIdForSender(admin: SupabaseAdmin, senderLast10: string): Promise<string | null> {
  const phone91 = to91FromSenderLast10(senderLast10);
  if (!phone91) return null;
  const { data, error } = await admin
    .from("whatsapp_contacts")
    .select("id")
    .eq("phone_number", phone91)
    .maybeSingle();
  if (error || !data?.id) return null;
  return String(data.id);
}

/** True when at least one inbound message for the sender is stitched to a packet. */
export async function senderHasStitchedPacket(admin: SupabaseAdmin, senderLast10: string): Promise<{
  hasPacket: boolean;
  packetIds: string[];
}> {
  const contactId = await contactIdForSender(admin, senderLast10);
  if (!contactId) return { hasPacket: false, packetIds: [] };

  const { data, error } = await admin
    .from("whatsapp_messages")
    .select("packet_id")
    .eq("contact_id", contactId)
    .eq("direction", "inbound")
    .not("packet_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`BUFFER_PACKET_LOOKUP_FAILED: ${error.message}`);

  const packetIds = [...new Set((data ?? [])
    .map((row) => String((row as { packet_id?: string | null }).packet_id ?? "").trim())
    .filter(Boolean))];
  return { hasPacket: packetIds.length > 0, packetIds };
}

export type BufferFlushResult = {
  rowsFlushed: number;
  sendersProcessed: number;
  sendersWaiting: number;
  staleFlushingRecovered: number;
  flushedBufferIds: string[];
  linkedPacketIds: string[];
};

export async function flushGovernedWhatsappBuffer(
  admin: SupabaseAdmin,
  options: { bufferIds?: string[]; idleSeconds?: number; now?: Date } = {},
): Promise<BufferFlushResult> {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const idleSeconds = options.idleSeconds ?? BUFFER_IDLE_SECONDS;
  const cutoffIso = new Date(nowMs - idleSeconds * 1000).toISOString();
  const targetBufferIds = (options.bufferIds ?? []).map((id) => id.trim()).filter(Boolean);

  const { data: flushingRows, error: flushingError } = await admin
    .from("whatsapp_buffer")
    .select("id, sender_phone, created_at, bundle_status")
    .eq("bundle_status", "flushing");
  if (flushingError) throw new Error(`BUFFER_FLUSHING_LOOKUP_FAILED: ${flushingError.message}`);

  const staleFlushingIds = (flushingRows ?? [])
    .filter((row) => isStaleFlushingRow(row.created_at, nowMs))
    .map((row) => row.id);
  if (staleFlushingIds.length > 0) {
    const { error } = await admin
      .from("whatsapp_buffer")
      .update({ bundle_status: "pending" })
      .in("id", staleFlushingIds);
    if (error) throw new Error(`BUFFER_FLUSHING_RECOVERY_FAILED: ${error.message}`);
  }

  let pendingQuery = admin
    .from("whatsapp_buffer")
    .select("id, sender_phone, created_at, bundle_status")
    .in("bundle_status", ["pending", "flushing"]);
  if (targetBufferIds.length > 0) pendingQuery = pendingQuery.in("id", targetBufferIds);

  const { data: pending, error: pendingError } = await pendingQuery;
  if (pendingError) throw new Error(`BUFFER_PENDING_LOOKUP_FAILED: ${pendingError.message}`);

  const pendingRows = (pending ?? []) as BufferRow[];
  if (!pendingRows.length) {
    return {
      rowsFlushed: 0,
      sendersProcessed: 0,
      sendersWaiting: 0,
      staleFlushingRecovered: staleFlushingIds.length,
      flushedBufferIds: [],
      linkedPacketIds: [],
    };
  }

  const senderLatest = latestCreatedAtBySender(pendingRows);
  const idleSenders = new Set(pickIdleSenders(senderLatest, cutoffIso));
  const sendersToProcess = targetBufferIds.length > 0
    ? [...new Set(pendingRows.map((row) => normalizeSenderPhoneLast10(row.sender_phone)).filter(Boolean))]
    : [...idleSenders];

  const pendingBySender = new Map<string, string[]>();
  for (const row of pendingRows) {
    const sender = normalizeSenderPhoneLast10(row.sender_phone);
    if (!sender) continue;
    const bucket = pendingBySender.get(sender) ?? [];
    bucket.push(row.id);
    pendingBySender.set(sender, bucket);
  }

  let rowsFlushed = 0;
  let sendersProcessed = 0;
  let sendersWaiting = 0;
  const flushedBufferIds: string[] = [];
  const linkedPacketIds: string[] = [];

  for (const sender of sendersToProcess) {
    if (!targetBufferIds.length && !idleSenders.has(sender)) {
      sendersWaiting += 1;
      continue;
    }

    const { hasPacket, packetIds } = await senderHasStitchedPacket(admin, sender);
    if (!hasPacket) {
      if (!targetBufferIds.length) sendersWaiting += 1;
      continue;
    }

    const rowIds = pendingBySender.get(sender) ?? [];
    if (!rowIds.length) continue;

    const { data: lockedRows, error: lockError } = await admin
      .from("whatsapp_buffer")
      .update({ bundle_status: "flushing" })
      .in("id", rowIds)
      .in("bundle_status", ["pending", "flushing"])
      .select("id");
    if (lockError || !lockedRows?.length) continue;

    const ids = lockedRows.map((row) => row.id);
    const flushedAt = now.toISOString();
    const { error: flushError } = await admin
      .from("whatsapp_buffer")
      .update({ bundle_status: "flushed", flushed_at: flushedAt })
      .in("id", ids);
    if (flushError) {
      await admin.from("whatsapp_buffer").update({ bundle_status: "pending" }).in("id", ids);
      throw new Error(`BUFFER_FLUSH_FAILED: ${flushError.message}`);
    }

    rowsFlushed += ids.length;
    sendersProcessed += 1;
    flushedBufferIds.push(...ids);
    linkedPacketIds.push(...packetIds);
  }

  return {
    rowsFlushed,
    sendersProcessed,
    sendersWaiting,
    staleFlushingRecovered: staleFlushingIds.length,
    flushedBufferIds,
    linkedPacketIds: [...new Set(linkedPacketIds)],
  };
}
