// supabase/functions/whatsapp-message-stitcher/index.ts
// TOOL 0: Message Stitching Layer
// Groups fragmented inbound WhatsApp rows into packets within a time window (default 5 minutes = 300s).
//
// Root cause fixed here: the webhook triggers this function once per inbound message,
// fire-and-forget and non-blocking. Each invocation used to unconditionally INSERT a
// brand-new `whatsapp_message_packets` row for every batch of currently-unstitched
// messages, even when a still-open packet for the same contact already existed and the
// new message arrived well within the stitching window. A burst of N rapid messages from
// one contact (e.g. several photos sent seconds apart) could each land in its own
// stitcher invocation and therefore each become its own single-fragment packet, instead
// of N fragments of one packet — exactly matching the physically observed "6 messages
// sent, selected packet shows only 1 inbound / 1 fragment" defect. Fixed by looking up
// the contact's existing OPEN packet before creating a new one, and appending to it
// (with an optimistic fragment_count compare-and-swap to stay safe under concurrent
// stitcher invocations) when the new messages arrive within the window.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import {
  groupMessagesByStitchingWindow,
  isWithinAppendWindow,
  mergeStitchedText,
  partitionDuplicateProviderMessages,
  stitchedTextFor,
  type ContactStitchingGroups,
  type StitchingWindowGroup,
} from "../_shared/whatsappStitchingWindow.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface StitchingConfig {
  windowSeconds: number;
  batchSize: number;
}

/** Default grouping window: 5 minutes */
const DEFAULT_STITCHING_CONFIG: StitchingConfig = {
  windowSeconds: 300,
  batchSize: 100,
};

type UnstitchedMessage = {
  id: string;
  contact_id: string;
  direction: string;
  content: string | null;
  created_at: string;
  message_timestamp: string | null;
  provider_message_id: string | null;
};

type ExistingOpenPacket = {
  id: string;
  fragment_count: number;
  stitched_content: { summary?: string; text?: string } | null;
  last_message_at: string;
};

async function findUnstitchedMessages(
  supabaseAdmin: ReturnType<typeof createClient>,
  batchSize: number,
): Promise<UnstitchedMessage[]> {
  const { data: messages, error } = await supabaseAdmin
    .from("whatsapp_messages")
    .select(
      "id, contact_id, direction, content, created_at, message_timestamp, provider_message_id",
    )
    .eq("is_raw", true)
    .is("packet_id", null)
    .eq("direction", "inbound")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    throw new Error(`Failed to find unstitched messages: ${error.message}`);
  }

  return (messages ?? []) as UnstitchedMessage[];
}

/**
 * Provider webhook retries re-insert a row with the same provider_message_id.
 * Looks up, in one batched query, any of `providerMessageIds` that already
 * belong to a fully-stitched packet from an EARLIER stitcher run (this is the
 * cross-run half of duplicate suppression; the within-run half is
 * `partitionDuplicateProviderMessages`). Returns a map of provider_message_id
 * -> packet_id for those already-resolved duplicates.
 */
async function findAlreadyStitchedPacketsByProviderMessageId(
  supabaseAdmin: ReturnType<typeof createClient>,
  providerMessageIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (providerMessageIds.length === 0) return result;

  const { data, error } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("provider_message_id, packet_id")
    .in("provider_message_id", providerMessageIds)
    .not("packet_id", "is", null);

  // A query FAILURE must never be treated the same as a genuine "no duplicates
  // found" empty result — silently treating an error as "nothing already
  // stitched" would let a real retry slip through as a brand-new primary
  // message and be double-counted. Abort the run instead; the next invocation
  // retries from a consistent state.
  if (error) {
    throw new Error(`Failed to look up already-stitched duplicates: ${error.message}`);
  }

  for (const row of (data ?? []) as { provider_message_id: string | null; packet_id: string | null }[]) {
    const providerMessageId = row.provider_message_id?.trim();
    if (!providerMessageId || !row.packet_id) continue;
    // First-write-wins if there is somehow more than one stitched row for the
    // same provider_message_id — never overwrite an already-resolved mapping.
    if (!result.has(providerMessageId)) {
      result.set(providerMessageId, row.packet_id);
    }
  }

  return result;
}

/**
 * Link a duplicate/retry message row to the packet its primary twin already
 * belongs to. Explicitly accounted for (never left dangling with
 * packet_id: null forever), but NOT counted as a new fragment: packet_sequence
 * stays null and the target packet's fragment_count is untouched.
 */
async function linkDuplicateMessageToPacket(
  supabaseAdmin: ReturnType<typeof createClient>,
  message: UnstitchedMessage,
  packetId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("whatsapp_messages")
    .update({
      packet_id: packetId,
      packet_sequence: null,
      is_raw: false,
      stitched_at: new Date().toISOString(),
    })
    .eq("id", message.id);
  if (error) {
    throw new Error(`Failed to link duplicate message ${message.id}: ${error.message}`);
  }
}

/**
 * Look up the contact's most recent OPEN packet. Returns null if none exists,
 * or if it exists but its `last_message_at` is already outside the stitching
 * window relative to `earliestNewMessageAt` (a legitimately new conversation).
 */
async function findAppendableOpenPacket(
  supabaseAdmin: ReturnType<typeof createClient>,
  contactId: string,
  earliestNewMessageAt: string,
  windowSeconds: number,
): Promise<ExistingOpenPacket | null> {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_message_packets")
    .select("id, fragment_count, stitched_content, last_message_at")
    .eq("contact_id", contactId)
    .eq("status", "open")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // Fail safe to "no appendable packet" (a new packet gets created) rather than
    // aborting the whole run over one contact's lookup — worst case is one extra
    // packet, never lost or duplicated data. Still logged so it's observable.
    console.warn(`[whatsapp-message-stitcher] open-packet lookup failed for contact ${contactId}:`, error.message);
    return null;
  }
  if (!data) return null;

  if (!isWithinAppendWindow(data.last_message_at as string, earliestNewMessageAt, windowSeconds)) {
    return null;
  }

  return data as ExistingOpenPacket;
}

/**
 * Append a group of newly-unstitched messages to an existing open packet using an
 * optimistic compare-and-swap on `fragment_count`. If a concurrent stitcher
 * invocation already advanced the packet (0 rows affected), the caller must fall
 * back to creating a new packet for these messages — the messages are never
 * silently dropped either way.
 */
async function tryAppendToExistingPacket(
  supabaseAdmin: ReturnType<typeof createClient>,
  packet: ExistingOpenPacket,
  group: StitchingWindowGroup<UnstitchedMessage>,
  providerMessageIdToPacketId: Map<string, string>,
): Promise<boolean> {
  const mergedText = mergeStitchedText(packet.stitched_content?.text, group.messages);
  const newFragmentCount = packet.fragment_count + group.messages.length;

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("whatsapp_message_packets")
    .update({
      stitched_content: {
        summary: `${newFragmentCount} messages stitched`,
        text: mergedText,
      },
      fragment_count: newFragmentCount,
      last_message_at: group.last_message_at,
    })
    .eq("id", packet.id)
    .eq("fragment_count", packet.fragment_count)
    // A concurrent process could close this packet between the read in
    // findAppendableOpenPacket and this update; without this predicate the CAS
    // would still "succeed" and silently reopen a packet callers assume is final.
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (updateErr || !updated) return false;

  const stitchedAt = new Date().toISOString();
  for (let i = 0; i < group.messages.length; i++) {
    const { error: fragErr } = await supabaseAdmin
      .from("whatsapp_messages")
      .update({
        packet_id: packet.id,
        packet_sequence: packet.fragment_count + i + 1,
        is_raw: false,
        stitched_at: stitchedAt,
      })
      .eq("id", group.messages[i].id);
    if (fragErr) {
      // The packet-level CAS above already committed the inflated fragment_count
      // and merged text. A mid-loop failure here must not leave that claim
      // standing against messages that never actually got linked — that would
      // both corrupt the packet's counters and cause the unlinked messages to be
      // double-stitched on the next run. Best-effort compensating rollback:
      // restore the packet to its pre-append state, then surface the error.
      const { error: rollbackErr } = await supabaseAdmin
        .from("whatsapp_message_packets")
        .update({
          stitched_content: packet.stitched_content,
          fragment_count: packet.fragment_count,
          last_message_at: packet.last_message_at,
        })
        .eq("id", packet.id);
      if (rollbackErr) {
        console.error(
          `[whatsapp-message-stitcher] rollback of packet ${packet.id} after partial append failure also failed:`,
          rollbackErr.message,
        );
      }
      throw new Error(`Failed to link appended fragment ${group.messages[i].id}: ${fragErr.message}`);
    }
    if (group.messages[i].provider_message_id) {
      providerMessageIdToPacketId.set(group.messages[i].provider_message_id as string, packet.id);
    }
  }

  return true;
}

async function insertNewPacket(
  supabaseAdmin: ReturnType<typeof createClient>,
  contactId: string,
  group: StitchingWindowGroup<UnstitchedMessage>,
  providerMessageIdToPacketId: Map<string, string>,
): Promise<number> {
  const stitchedText = stitchedTextFor(group.messages);
  const stitchedContent = {
    summary: `${group.messages.length} messages stitched`,
    text: stitchedText,
  };

  const { data: row, error: insertErr } = await supabaseAdmin
    .from("whatsapp_message_packets")
    .insert({
      contact_id: contactId,
      stitched_content: stitchedContent,
      fragment_count: group.messages.length,
      first_message_at: group.first_message_at,
      last_message_at: group.last_message_at,
      status: "open",
    })
    .select("id")
    .single();

  if (insertErr || !row?.id) {
    console.error(
      "[whatsapp-message-stitcher] packet insert failed:",
      insertErr?.message ?? insertErr,
    );
    throw new Error(
      insertErr?.message ||
        "Failed to insert whatsapp_message_packets (table missing?)",
    );
  }

  const stitchedAt = new Date().toISOString();
  let linked = 0;
  for (let i = 0; i < group.messages.length; i++) {
    const { error: updateErr } = await supabaseAdmin
      .from("whatsapp_messages")
      .update({
        packet_id: row.id,
        packet_sequence: i + 1,
        is_raw: false,
        stitched_at: stitchedAt,
      })
      .eq("id", group.messages[i].id);

    if (updateErr) {
      console.error(
        "[whatsapp-message-stitcher] fragment update failed:",
        updateErr.message,
      );
      // The packet was inserted claiming all `group.messages.length` fragments,
      // but only `linked` of them are actually connected. Correct fragment_count
      // (and the stitched text) down to what's really linked so the count is
      // never inflated — the remaining, still-unlinked messages stay
      // packet_id: null and get picked up (and correctly sequence-continued)
      // by a later run, self-healing rather than being lost or double-counted.
      const linkedMessages = group.messages.slice(0, linked);
      const { error: correctionErr } = await supabaseAdmin
        .from("whatsapp_message_packets")
        .update({
          fragment_count: linked,
          stitched_content: {
            summary: `${linked} messages stitched`,
            text: stitchedTextFor(linkedMessages),
          },
          last_message_at: linked > 0 ? linkedMessages[linked - 1].created_at : group.first_message_at,
        })
        .eq("id", row.id);
      if (correctionErr) {
        console.error(
          `[whatsapp-message-stitcher] fragment_count correction for packet ${row.id} also failed:`,
          correctionErr.message,
        );
      }
      throw new Error(updateErr.message);
    }
    if (group.messages[i].provider_message_id) {
      providerMessageIdToPacketId.set(group.messages[i].provider_message_id as string, row.id);
    }
    linked += 1;
  }

  return linked;
}

async function persistStitchedPackets(
  supabaseAdmin: ReturnType<typeof createClient>,
  packetsByContact: ContactStitchingGroups<UnstitchedMessage>[],
  windowSeconds: number,
  providerMessageIdToPacketId: Map<string, string>,
): Promise<{ fragmentsLinked: number; packetsCreated: number; packetsAppended: number }> {
  let fragmentsLinked = 0;
  let packetsCreated = 0;
  let packetsAppended = 0;

  for (const { contact_id, groups } of packetsByContact) {
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const group = groups[groupIndex];
      if (group.messages.length === 0) continue;

      // Only the first local group for this contact can possibly extend a
      // pre-existing open packet — later groups are already >window apart from
      // it by construction of groupMessagesByStitchingWindow.
      if (groupIndex === 0) {
        const existing = await findAppendableOpenPacket(
          supabaseAdmin,
          contact_id,
          group.first_message_at,
          windowSeconds,
        );
        if (existing) {
          const appended = await tryAppendToExistingPacket(
            supabaseAdmin,
            existing,
            group,
            providerMessageIdToPacketId,
          );
          if (appended) {
            fragmentsLinked += group.messages.length;
            packetsAppended += 1;
            continue;
          }
          // Lost the optimistic race to a concurrent invocation — fall through and
          // create a new packet so these messages are still accounted for, never lost.
        }
      }

      fragmentsLinked += await insertNewPacket(supabaseAdmin, contact_id, group, providerMessageIdToPacketId);
      packetsCreated += 1;
    }
  }

  return { fragmentsLinked, packetsCreated, packetsAppended };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<StitchingConfig>;
    const cfg: StitchingConfig = {
      windowSeconds: Math.min(
        3600,
        Math.max(30, Number(body.windowSeconds) || DEFAULT_STITCHING_CONFIG.windowSeconds),
      ),
      batchSize: Math.min(
        500,
        Math.max(1, Number(body.batchSize) || DEFAULT_STITCHING_CONFIG.batchSize),
      ),
    };

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const unstitched = await findUnstitchedMessages(supabaseAdmin, cfg.batchSize);

    // Duplicate/retry suppression, cross-run half: a webhook retry can re-insert a
    // row whose provider_message_id was already stitched into a packet in an
    // EARLIER invocation. Resolve those immediately — link to the same packet,
    // never grouped as a new fragment or a new packet.
    // Trimmed once here and reused everywhere below — partitionDuplicateProviderMessages
    // also keys on the trimmed value, so an inconsistently-untrimmed lookup here
    // could miss a real duplicate and double-count it as a new primary message.
    const providerKeyOf = (m: UnstitchedMessage): string | null => m.provider_message_id?.trim() || null;
    const candidateProviderMessageIds = unstitched
      .map(providerKeyOf)
      .filter((id): id is string => id !== null);
    const alreadyStitched = await findAlreadyStitchedPacketsByProviderMessageId(
      supabaseAdmin,
      candidateProviderMessageIds,
    );
    const isCrossRunDuplicate = (m: UnstitchedMessage): boolean => {
      const key = providerKeyOf(m);
      return key !== null && alreadyStitched.has(key);
    };
    const crossRunDuplicates = unstitched.filter(isCrossRunDuplicate);
    const remaining = unstitched.filter((m) => !isCrossRunDuplicate(m));

    let duplicatesLinked = 0;
    for (const duplicate of crossRunDuplicates) {
      const targetPacketId = alreadyStitched.get(providerKeyOf(duplicate) as string)!;
      await linkDuplicateMessageToPacket(supabaseAdmin, duplicate, targetPacketId);
      duplicatesLinked += 1;
    }

    // Duplicate/retry suppression, within-run half: two copies of the same
    // provider_message_id both showing up unstitched in THIS batch.
    const { primary, duplicates: withinRunDuplicates } = partitionDuplicateProviderMessages(remaining);

    const providerMessageIdToPacketId = new Map<string, string>();
    const packetsByContact = groupMessagesByStitchingWindow(primary, cfg.windowSeconds);
    const { fragmentsLinked, packetsCreated, packetsAppended } = await persistStitchedPackets(
      supabaseAdmin,
      packetsByContact,
      cfg.windowSeconds,
      providerMessageIdToPacketId,
    );

    for (const duplicate of withinRunDuplicates) {
      const targetPacketId = duplicate.provider_message_id
        ? providerMessageIdToPacketId.get(duplicate.provider_message_id)
        : undefined;
      if (targetPacketId) {
        await linkDuplicateMessageToPacket(supabaseAdmin, duplicate, targetPacketId);
        duplicatesLinked += 1;
      }
      // If the primary's own packet resolution is not yet known (e.g. it lost the
      // append race and is being retried), this duplicate is left unstitched —
      // never lost, just deferred to a future run once its primary resolves.
    }

    return new Response(
      JSON.stringify({
        success: true,
        packetsCreated,
        packetsAppended,
        duplicatesLinked,
        messagesProcessed: unstitched.length,
        ok: true,
        config: cfg,
        raw_rows_scanned: unstitched.length,
        packets_created: packetsCreated,
        packets_appended: packetsAppended,
        fragments_linked: fragmentsLinked,
        duplicates_linked: duplicatesLinked,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[whatsapp-message-stitcher]", message);
    return new Response(
      JSON.stringify({ success: false, ok: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
