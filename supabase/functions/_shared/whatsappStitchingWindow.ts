// supabase/functions/_shared/whatsappStitchingWindow.ts
// Pure, side-effect-free grouping/window logic for the WhatsApp message stitcher.
// Deliberately has zero Deno-specific imports (no `Deno.*`, no URL imports) so this
// same file can be imported both by the Deno edge function
// (../whatsapp-message-stitcher/index.ts) and by the Vitest suite under src/ via a
// relative path, giving the core packet-grouping algorithm real, CI-run test coverage
// without duplicating the logic.

export interface StitchableMessage {
  id: string;
  contact_id: string;
  content: string | null;
  created_at: string;
  provider_message_id?: string | null;
}

export interface StitchingWindowGroup<T extends StitchableMessage = StitchableMessage> {
  messages: T[];
  first_message_at: string;
  last_message_at: string;
}

export interface ContactStitchingGroups<T extends StitchableMessage = StitchableMessage> {
  contact_id: string;
  groups: StitchingWindowGroup<T>[];
}

/**
 * Group inbound raw rows by contact, then split each contact's messages into
 * time-window groups. A new group starts whenever the gap since the previous
 * message in the running group exceeds `windowSeconds`. Input must already be
 * sorted by `created_at` ascending (callers query with that order).
 */
export function groupMessagesByStitchingWindow<T extends StitchableMessage>(
  unstitchedMessages: T[],
  windowSeconds: number,
): ContactStitchingGroups<T>[] {
  const groupedByContact: { [key: string]: T[] } = {};

  for (const msg of unstitchedMessages) {
    const contactId = String(msg.contact_id ?? "");
    if (!contactId) continue;
    if (!groupedByContact[contactId]) {
      groupedByContact[contactId] = [];
    }
    groupedByContact[contactId].push(msg);
  }

  const packetsByContact: ContactStitchingGroups<T>[] = [];

  for (const [contactId, messages] of Object.entries(groupedByContact)) {
    const groups: StitchingWindowGroup<T>[] = [];

    let currentGroup: StitchingWindowGroup<T> = {
      messages: [],
      first_message_at: String(messages[0].created_at),
      last_message_at: String(messages[0].created_at),
    };

    for (const msg of messages) {
      const msgTime = new Date(String(msg.created_at)).getTime();
      const lastTime = new Date(currentGroup.last_message_at).getTime();
      const timeDiffSeconds = (msgTime - lastTime) / 1000;

      if (timeDiffSeconds <= windowSeconds && currentGroup.messages.length > 0) {
        currentGroup.messages.push(msg);
        currentGroup.last_message_at = String(msg.created_at);
      } else if (currentGroup.messages.length === 0) {
        currentGroup.messages.push(msg);
        currentGroup.first_message_at = String(msg.created_at);
        currentGroup.last_message_at = String(msg.created_at);
      } else {
        groups.push(currentGroup);
        currentGroup = {
          messages: [msg],
          first_message_at: String(msg.created_at),
          last_message_at: String(msg.created_at),
        };
      }
    }

    if (currentGroup.messages.length > 0) {
      groups.push(currentGroup);
    }

    packetsByContact.push({ contact_id: contactId, groups });
  }

  return packetsByContact;
}

/**
 * Whether a new message batch starting at `newEarliestMessageAt` may extend an
 * existing open packet whose most recent fragment landed at `existingLastMessageAt`.
 * A negative gap (new message timestamped before the packet's last fragment — e.g.
 * an out-of-order/delayed webhook delivery) is treated as NOT appendable so a
 * late-arriving event cannot silently rewrite an already-closed window; it is
 * still accounted for by falling back to a new packet, never dropped.
 */
export function isWithinAppendWindow(
  existingLastMessageAt: string,
  newEarliestMessageAt: string,
  windowSeconds: number,
): boolean {
  const gapSeconds =
    (new Date(newEarliestMessageAt).getTime() - new Date(existingLastMessageAt).getTime()) / 1000;
  return gapSeconds >= 0 && gapSeconds <= windowSeconds;
}

export interface DuplicatePartitionResult<T extends StitchableMessage> {
  /** First-seen occurrence of each provider_message_id, in original order — these count as real fragments. */
  primary: T[];
  /**
   * Later occurrences sharing a provider_message_id already seen (webhook retry /
   * duplicate delivery). Still explicitly accounted for by the caller (linked to the
   * same packet as their primary twin) — never silently dropped, never double-counted
   * as a second fragment or a second packet.
   */
  duplicates: T[];
}

/**
 * Deterministic duplicate/retry suppression: a provider webhook retry (or a
 * genuinely duplicated delivery) re-inserts a row with the SAME provider_message_id.
 * Messages without a provider_message_id are never considered duplicates of
 * anything (nothing to key on) and always pass through as primary.
 */
export function partitionDuplicateProviderMessages<T extends StitchableMessage>(
  messages: T[],
): DuplicatePartitionResult<T> {
  const seen = new Set<string>();
  const primary: T[] = [];
  const duplicates: T[] = [];

  for (const message of messages) {
    const providerMessageId = message.provider_message_id?.trim();
    if (!providerMessageId) {
      primary.push(message);
      continue;
    }
    if (seen.has(providerMessageId)) {
      duplicates.push(message);
      continue;
    }
    seen.add(providerMessageId);
    primary.push(message);
  }

  return { primary, duplicates };
}

/** Deterministic stitched-text join used both for new packets and appends. */
export function stitchedTextFor(messages: Pick<StitchableMessage, "content">[]): string {
  return messages
    .map((m) => String(m.content ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

export function mergeStitchedText(priorText: string | undefined | null, additionalMessages: Pick<StitchableMessage, "content">[]): string {
  const additionalText = stitchedTextFor(additionalMessages);
  return [priorText ?? "", additionalText].filter(Boolean).join("\n");
}
