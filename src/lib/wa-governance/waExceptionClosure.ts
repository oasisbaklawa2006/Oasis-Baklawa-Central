/**
 * Governed closure of the five validated WhatsApp v21 reconciliation exceptions.
 *
 * Authority model (nothing here grants or bypasses anything):
 * - The ONLY write is the existing RPC whatsapp_resolve_reconciliation_exception, called with the signed-in
 *   operator's own session. The database enforces wa.intake.close and the AAL2 step-up; this module only reads
 *   them back first so the operator sees a clear reason instead of a bare 42501.
 * - Exception ids and resolution texts are constants in this file. They are never taken from user input, so the
 *   page cannot be used to close any other record or write any other text.
 * - Before each closure the exception is re-read and re-validated. After it, the row is read back and the
 *   operator attribution (resolved_by) must equal the signed-in user.
 * - No reconciliation table is written directly. Only reads of the run RPC and of message counts are used.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchWhatsAppReconciliationRun,
  resolveWhatsAppReconciliationException,
} from "@/lib/wa-governance/caseDecisionDesk";
import { proveSession, type Aal2Proof } from "@/lib/auth/mfaTotp";

export type ClosureKind = "DUPLICATE_PACKET" | "STALE_WITH_CASE";

export interface ClosureItem {
  exceptionId: string;
  runId: string;
  packetId: string;
  /** Packet that holds the messages for a duplicate packet; null when the packet itself holds them. */
  siblingPacketId: string | null;
  kind: ClosureKind;
  resolution: string;
  /** Findings from the 2026-10-23 read-only investigation (not re-checkable from the browser). */
  investigated: string[];
}

const DUPLICATE_TEXT = (sibling: string) =>
  `DUPLICATE_PACKET_MESSAGES_PRESERVED: sibling packet ${sibling} holds the messages and case; no data deleted.`;
const STALE_TEXT =
  "CASE_AND_INTERPRETATION_EXIST: packet has interpretation and case; exception stale since 2026-10-13.";

export const CLOSURE_ITEMS: readonly ClosureItem[] = Object.freeze([
  {
    exceptionId: "f201cc09-d593-4823-adde-e110e4951d28",
    runId: "829ab403-2854-4472-b818-f890c19de477",
    packetId: "012157c2-bed8-43ac-a8be-bffa6abc8337",
    siblingPacketId: "e2be79a2-0d0f-476d-a5eb-65a597e77fae",
    kind: "DUPLICATE_PACKET",
    resolution: DUPLICATE_TEXT("e2be79a2"),
    investigated: ["Sibling packet e2be79a2 was created 0.14 s after the empty packet and holds 2 messages, 1 interpretation and 1 case."],
  },
  {
    exceptionId: "3a3fa192-08d4-4551-98fe-808d1de8687f",
    runId: "da6499e7-a1da-44e0-8590-cc700215e7d2",
    packetId: "4f71bd25-a349-45b4-bab3-5bf5892f1133",
    siblingPacketId: "6e413e86-82ad-4a42-a532-ebbae8ada024",
    kind: "DUPLICATE_PACKET",
    resolution: DUPLICATE_TEXT("6e413e86"),
    investigated: ["Sibling packet 6e413e86 was created 0.03 s after the empty packet and holds 2 messages and 1 case."],
  },
  {
    exceptionId: "087bcf8e-4e5c-4343-bd4f-4e510a87d968",
    runId: "929019a0-3ccd-4998-a204-f8cb6f7e6599",
    packetId: "25650138-6724-4c6e-8e84-43e0e78695ba",
    siblingPacketId: "aabae26e-1b31-4863-b682-d64b300178ab",
    kind: "DUPLICATE_PACKET",
    resolution: DUPLICATE_TEXT("aabae26e"),
    investigated: ["Sibling packet aabae26e was created 0.29 s after the empty packet and holds 1 message and 1 case."],
  },
  {
    exceptionId: "6ac3ef10-020e-4c32-bf71-5f0189a86127",
    runId: "929019a0-3ccd-4998-a204-f8cb6f7e6599",
    packetId: "50187b4a-7a14-4913-af1c-47a371015b17",
    siblingPacketId: "6ede2bd1-a67b-4801-9ec7-f97e308486a4",
    kind: "DUPLICATE_PACKET",
    resolution: DUPLICATE_TEXT("6ede2bd1"),
    investigated: ["Sibling packet 6ede2bd1 was created 0.49 s after the empty packet and holds 1 message and 1 case."],
  },
  {
    exceptionId: "21e912a3-e97c-4ffa-a7ab-bfc0063636a0",
    runId: "fdd3c017-d1f5-4307-986c-3ce7819f9668",
    packetId: "e9174de3-02da-4128-8bb2-24f159bf1e08",
    siblingPacketId: null,
    kind: "STALE_WITH_CASE",
    resolution: STALE_TEXT,
    investigated: ["The packet's own record holds 2 messages, 1 interpretation and 1 case; the exception has been stale since 2026-10-13."],
  },
]);

export interface Check {
  label: string;
  pass: boolean;
  detail?: string;
}

export type ExceptionState =
  | { status: "OPEN"; checks: Check[]; closable: boolean }
  | { status: "RESOLVED"; resolvedAt: string | null; resolvedBy: string | null; resolution: string | null; resolutionMatches: boolean }
  | { status: "UNREADABLE"; reason: string };

export interface ExceptionRow {
  id: string;
  exception_type?: string;
  business_object_type?: string;
  business_object_id?: string;
  reconciliation_run_id?: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolution?: string | null;
}

export interface LedgerEntry {
  at: string;
  exceptionId: string;
  step: "REVALIDATED" | "CLOSE_REQUESTED" | "CLOSED" | "READBACK_VERIFIED" | "REFUSED" | "FAILED";
  detail: string;
  before?: Pick<ExceptionRow, "resolved_at" | "resolved_by" | "resolution">;
  after?: Pick<ExceptionRow, "resolved_at" | "resolved_by" | "resolution">;
  operatorId?: string | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Reads the run through the existing RPC and returns the one exception row, or throws. */
export async function readExceptionRow(supabase: SupabaseClient, item: ClosureItem): Promise<ExceptionRow> {
  const payload = await fetchWhatsAppReconciliationRun(supabase, item.runId);
  const rows = Array.isArray(payload.exceptions) ? payload.exceptions : [];
  const row = rows.find((r): r is Record<string, unknown> => isRecord(r) && r.id === item.exceptionId);
  if (!row) throw new Error("EXCEPTION_NOT_FOUND_IN_RUN");
  return row as unknown as ExceptionRow;
}

async function messageCount(supabase: SupabaseClient, packetId: string): Promise<number> {
  const { count, error } = await supabase
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("packet_id", packetId);
  if (error) throw new Error("MESSAGE_COUNT_UNREADABLE");
  if (typeof count !== "number") throw new Error("MESSAGE_COUNT_UNREADABLE");
  return count;
}

/** Re-reads one exception and checks it is exactly the record that was validated. Fails closed on any read error. */
export async function revalidate(supabase: SupabaseClient, item: ClosureItem): Promise<ExceptionState> {
  let row: ExceptionRow;
  try {
    row = await readExceptionRow(supabase, item);
  } catch (e) {
    return { status: "UNREADABLE", reason: e instanceof Error ? e.message : "READ_FAILED" };
  }

  if (row.resolved_at) {
    return {
      status: "RESOLVED",
      resolvedAt: row.resolved_at ?? null,
      resolvedBy: row.resolved_by ?? null,
      resolution: row.resolution ?? null,
      resolutionMatches: row.resolution === item.resolution,
    };
  }

  const checks: Check[] = [
    { label: "Exception is still open", pass: !row.resolved_at },
    { label: "Type is PACKET_WITHOUT_CASE", pass: row.exception_type === "PACKET_WITHOUT_CASE", detail: row.exception_type },
    { label: "Refers to the validated packet", pass: row.business_object_type === "whatsapp_message_packets" && row.business_object_id === item.packetId },
    { label: "Belongs to the validated run", pass: row.reconciliation_run_id === item.runId },
  ];

  try {
    if (item.siblingPacketId) {
      const own = await messageCount(supabase, item.packetId);
      const sibling = await messageCount(supabase, item.siblingPacketId);
      checks.push({ label: "This packet holds no messages (nothing lost by closing)", pass: own === 0, detail: `${own} message(s)` });
      checks.push({ label: "Sibling packet holds the messages", pass: sibling > 0, detail: `${sibling} message(s)` });
    } else {
      const own = await messageCount(supabase, item.packetId);
      checks.push({ label: "Packet holds its messages", pass: own > 0, detail: `${own} message(s)` });
    }
  } catch {
    checks.push({ label: "Live message evidence could be read", pass: false, detail: "unreadable, so closure is refused" });
  }

  return { status: "OPEN", checks, closable: checks.every((c) => c.pass) };
}

export interface ClosureOutcome {
  ok: boolean;
  reason?: string;
  ledger: LedgerEntry[];
  state?: ExceptionState;
}

async function currentUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

const snap = (r: ExceptionRow) => ({ resolved_at: r.resolved_at ?? null, resolved_by: r.resolved_by ?? null, resolution: r.resolution ?? null });

/**
 * Closes ONE exception. Call only after the operator explicitly confirmed this exact record.
 * Order: AAL2 + permission proof -> revalidate -> RPC -> read-back (status, text, attribution).
 */
export async function closeException(
  supabase: SupabaseClient,
  item: ClosureItem,
  now: () => Date = () => new Date(),
): Promise<ClosureOutcome> {
  const ledger: LedgerEntry[] = [];
  const log = (e: Omit<LedgerEntry, "at" | "exceptionId">) => ledger.push({ at: now().toISOString(), exceptionId: item.exceptionId, ...e });

  if (!CLOSURE_ITEMS.some((c) => c === item)) {
    log({ step: "REFUSED", detail: "Not one of the five validated exceptions." });
    return { ok: false, reason: "NOT_A_VALIDATED_ITEM", ledger };
  }

  let proof: Aal2Proof;
  try {
    proof = await proveSession(supabase);
  } catch {
    log({ step: "REFUSED", detail: "Session could not be proven (expired or unreadable)." });
    return { ok: false, reason: "SESSION", ledger };
  }
  if (!proof.ok) {
    log({
      step: "REFUSED",
      detail: proof.readFailed
        ? "Session checks could not be read; refusing to proceed."
        : "Session is not AAL2 with the database step-up and wa.intake.close permission.",
    });
    return { ok: false, reason: proof.readFailed ? "PROOF_UNREADABLE" : "NOT_AAL2", ledger };
  }
  const operatorId = await currentUserId(supabase);
  if (!operatorId) {
    log({ step: "REFUSED", detail: "No signed-in operator." });
    return { ok: false, reason: "NO_OPERATOR", ledger };
  }

  const state = await revalidate(supabase, item);
  if (state.status !== "OPEN") {
    log({ step: "REFUSED", operatorId, detail: state.status === "RESOLVED" ? "Already resolved; nothing changed." : `Unreadable: ${state.reason}` });
    return { ok: false, reason: state.status === "RESOLVED" ? "ALREADY_RESOLVED" : "UNREADABLE", ledger, state };
  }
  if (!state.closable) {
    log({ step: "REFUSED", operatorId, detail: `Revalidation failed: ${state.checks.filter((c) => !c.pass).map((c) => c.label).join("; ")}` });
    return { ok: false, reason: "REVALIDATION_FAILED", ledger, state };
  }
  const before = await readExceptionRow(supabase, item).catch(() => null);
  log({ step: "REVALIDATED", operatorId, detail: "All checks passed immediately before closure.", before: before ? snap(before) : undefined });

  log({ step: "CLOSE_REQUESTED", operatorId, detail: "Calling whatsapp_resolve_reconciliation_exception." });
  try {
    await resolveWhatsAppReconciliationException(supabase, item.exceptionId, item.resolution);
  } catch (e) {
    log({ step: "FAILED", operatorId, detail: e instanceof Error ? e.message : "RPC_FAILED" });
    return { ok: false, reason: "RPC_FAILED", ledger };
  }
  log({ step: "CLOSED", operatorId, detail: "RPC returned." });

  let after: ExceptionRow;
  try {
    after = await readExceptionRow(supabase, item);
  } catch {
    log({ step: "FAILED", operatorId, detail: "Read-back failed; verify the record before doing anything else." });
    return { ok: false, reason: "READBACK_UNREADABLE", ledger };
  }
  const verified = Boolean(after.resolved_at) && after.resolved_by === operatorId && after.resolution === item.resolution;
  log({
    step: verified ? "READBACK_VERIFIED" : "FAILED",
    operatorId,
    after: snap(after),
    detail: verified
      ? "resolved_at set, resolved_by equals the signed-in operator, resolution text matches exactly."
      : "Read-back does not match (status, attribution or text).",
  });
  return { ok: verified, reason: verified ? undefined : "READBACK_MISMATCH", ledger };
}

export function ledgerToText(entries: LedgerEntry[]): string {
  return entries
    .map((e) => `${e.at} ${e.exceptionId} ${e.step} operator=${e.operatorId ?? "-"} ${e.detail}${e.after ? ` after=${JSON.stringify(e.after)}` : ""}`)
    .join("\n");
}
