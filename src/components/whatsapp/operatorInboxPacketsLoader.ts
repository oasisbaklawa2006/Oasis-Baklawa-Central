// src/components/whatsapp/operatorInboxPacketsLoader.ts
// Bounded, recent-first packet loading for the operator inbox initial load.
//
// Root cause of the ~71s skeleton: the inbox used to fetch up to 1000 open
// packets, then hydrate message history in sequential 55-packet chunks
// before flipping `loading` to false. This module bounds the initial and
// paginated fetches to a small window so the first paint is fast, while
// keeping newest-first ordering, RLS, and governed context untouched.

import { supabase } from "@/integrations/supabase/client";
import type { OperatorInboxPacket } from "./operatorInboxTypes";

/** Conservative initial window so the operator UI becomes usable promptly. */
export const OPERATOR_INBOX_INITIAL_PACKET_LIMIT = 150;
/** Page size for explicit "load more" pagination beyond the initial window. */
export const OPERATOR_INBOX_PACKET_PAGE_SIZE = 150;
/** A stalled dependency (network hang) must not leave the skeleton up forever. */
export const OPERATOR_INBOX_LOAD_TIMEOUT_MS = 20000;

export interface GovernedPotentialOrder {
  id: string;
  provider_message_id: string;
  state: string;
  queue: string;
  next_action: string;
  next_action_due_at: string;
  owner_id: string | null;
}

export interface GovernedEvidenceLink {
  potential_order_id: string;
  provider_message_id: string;
}

/** Rejects with `message` if `promise` has not settled within `ms`. Never leaves a caller hung. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Fetch one bounded, newest-first page of open packets. Always uses `.range` with an
 * explicit upper bound — callers must never request an unbounded window.
 */
export async function fetchOpenPacketsPage(offset: number, limit: number): Promise<OperatorInboxPacket[]> {
  const { data, error } = await supabase
    // whatsapp_* tables not in generated Database types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("whatsapp_message_packets" as any)
    .select(
      `
      id,
      contact_id,
      fragment_count,
      status,
      first_message_at,
      last_message_at,
      stitched_content,
      whatsapp_contacts (
        phone_number,
        customer_name,
        wa_contact_id
      )
    `,
    )
    .eq("status", "open")
    // Secondary tiebreaker: `last_message_at` alone isn't unique, and offset-based
    // pagination over a non-unique sort key can skip or duplicate rows across pages.
    .order("last_message_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as unknown as OperatorInboxPacket[];
}

/** Append-only merge that keeps prior order and drops duplicates already present (by id). */
export function mergeAppendUniqueById<T extends { id: string }>(prev: T[], additions: T[]): T[] {
  const seen = new Set(prev.map((item) => item.id));
  const next = [...prev];
  for (const item of additions) {
    if (!seen.has(item.id)) {
      next.push(item);
      seen.add(item.id);
    }
  }
  return next;
}

/** Append-only merge keyed by a caller-supplied composite key (for rows without a single `id`). */
export function mergeAppendUniqueByKey<T>(prev: T[], additions: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set(prev.map(keyFn));
  const next = [...prev];
  for (const item of additions) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      next.push(item);
      seen.add(key);
    }
  }
  return next;
}
