/**
 * Local-only draft order workflow state (Approve / Reject / Edit).
 * Stored in localStorage — never writes to orders or order_items tables.
 */

import type { DraftOrderLocalDecision, DraftOrderLocalEdits } from "@/lib/wa-governance/draftOrderExtractionTypes";

const STORAGE_KEY = "wa_operator_inbox_draft_order_local_v1";

type DraftOrderLocalStore = Record<string, DraftOrderLocalEdits>;

function readStore(): DraftOrderLocalStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DraftOrderLocalStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: DraftOrderLocalStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function getDraftOrderLocalEdits(packetId: string): DraftOrderLocalEdits {
  const existing = readStore()[packetId];
  return (
    existing ?? {
      lineQuantities: {},
      decision: "pending",
      updatedAt: new Date(0).toISOString(),
    }
  );
}

export function setDraftOrderLocalDecision(
  packetId: string,
  decision: DraftOrderLocalDecision,
): DraftOrderLocalEdits {
  const store = readStore();
  const next: DraftOrderLocalEdits = {
    ...getDraftOrderLocalEdits(packetId),
    decision,
    updatedAt: new Date().toISOString(),
  };
  store[packetId] = next;
  writeStore(store);
  return next;
}

export function setDraftOrderLineQuantity(
  packetId: string,
  lineIndex: number,
  quantity: number,
): DraftOrderLocalEdits {
  const store = readStore();
  const current = getDraftOrderLocalEdits(packetId);
  const next: DraftOrderLocalEdits = {
    ...current,
    lineQuantities: { ...current.lineQuantities, [lineIndex]: quantity },
    updatedAt: new Date().toISOString(),
  };
  store[packetId] = next;
  writeStore(store);
  return next;
}

export function clearDraftOrderLocalEdits(packetId: string): void {
  const store = readStore();
  delete store[packetId];
  writeStore(store);
}

export function draftOrderLocalStorageKey(): string {
  return STORAGE_KEY;
}
