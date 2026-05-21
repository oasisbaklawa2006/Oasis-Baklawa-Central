/**
 * Pure helpers for the operator WhatsApp inbox (read-only / local-only previews).
 * No network calls; no persistence.
 */

import type { Message } from "./operatorInboxTypes";

export type DayGroupedMessages = { dayKey: string; dayLabel: string; messages: Message[] };

/** Group messages by local calendar day for thread UI. */
export function groupMessagesByDay(messages: Message[], locale = "en-IN"): DayGroupedMessages[] {
  const sorted = [...messages].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });

  const byKey = new Map<string, { label: string; items: Message[] }>();
  for (const msg of sorted) {
    const d = msg.created_at ? new Date(msg.created_at) : null;
    const key = d
      ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
      : "unknown";
    const dayLabel = d
      ? d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })
      : "Unknown date";
    if (!byKey.has(key)) {
      byKey.set(key, { label: dayLabel, items: [] });
    }
    byKey.get(key)!.items.push(msg);
  }

  return Array.from(byKey.entries()).map(([dayKey, v]) => ({
    dayKey,
    dayLabel: v.label,
    messages: v.items,
  }));
}

/** Local-only draft / order hints from visible message text (inbound preferred). */
export function extractDraftOrderHints(messages: Message[], maxHints = 10): string[] {
  const inbound = messages.filter((m) => m.direction === "inbound");
  const text = inbound
    .map((m) => m.content ?? "")
    .join("\n")
    .slice(0, 12000);

  const hints = new Set<string>();

  const soMatches = text.matchAll(/\bSO[-\s]?\d{4,}\b/gi);
  for (const m of soMatches) {
    hints.add(`Order ref: ${m[0].toUpperCase().replace(/\s+/g, "-")}`);
    if (hints.size >= maxHints) return [...hints];
  }

  const gstMatches = text.matchAll(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/g);
  for (const m of gstMatches) {
    hints.add(`GSTIN-like: ${m[0]}`);
    if (hints.size >= maxHints) return [...hints];
  }

  const inrMatches = text.matchAll(/(?:₹|Rs\.?|INR)\s*[\d,]+(?:\.\d{1,2})?/gi);
  for (const m of inrMatches) {
    hints.add(`Amount: ${m[0].trim()}`);
    if (hints.size >= maxHints) return [...hints];
  }

  const qtyMatches = text.matchAll(/\b\d+\s*(?:kg|g|pcs|pieces|boxes|dozen)\b/gi);
  for (const m of qtyMatches) {
    hints.add(`Qty / unit: ${m[0]}`);
    if (hints.size >= maxHints) return [...hints];
  }

  if (hints.size === 0) {
    hints.add("No draft-like tokens detected in inbound text (local parse only).");
  }

  return [...hints].slice(0, maxHints);
}

/** Local-only “AI-style” preview — keyword heuristics only, not model output. */
export function localOnlyAiSuggestionPreview(messages: Message[]): {
  headline: string;
  bullets: string[];
} {
  const inbound = messages.filter((m) => m.direction === "inbound");
  const text = inbound
    .map((m) => m.content ?? "")
    .join(" ")
    .toLowerCase();

  const bullets: string[] = [];
  let headline = "General thread";

  if (/dispatch|dispatched|tracking|awb|courier|delivery/.test(text)) {
    headline = "Likely logistics / dispatch";
    bullets.push("Keywords suggest shipment or tracking questions.");
  } else if (/payment|pay|upi|invoice|gst|advance|due/.test(text)) {
    headline = "Likely payment / billing";
    bullets.push("Keywords suggest payment, invoice, or tax context.");
  } else if (/price|rate|quote|quotation|moq|discount/.test(text)) {
    headline = "Likely pricing / commercial";
    bullets.push("Keywords suggest pricing or negotiation.");
  } else if (/complaint|damage|wrong|issue|return/.test(text)) {
    headline = "Likely support / quality";
    bullets.push("Keywords suggest an issue or complaint.");
  } else {
    bullets.push("No strong keyword bucket matched — use Classify Intent for a real model suggestion.");
  }

  bullets.push("Preview is computed in-browser only; nothing is saved.");

  return { headline, bullets };
}

export function uniqueMessageStatuses(messages: Message[]): string[] {
  const s = new Set<string>();
  for (const m of messages) {
    if (m.status?.trim()) s.add(m.status.trim());
  }
  return [...s].sort();
}

export function uniqueProviders(messages: Message[]): string[] {
  const s = new Set<string>();
  for (const m of messages) {
    if (m.provider?.trim()) s.add(m.provider.trim());
  }
  return [...s].sort();
}
