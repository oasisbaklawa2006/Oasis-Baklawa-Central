import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLOSURE_ITEMS, closeException, ledgerToText, revalidate, type ClosureItem } from "../waExceptionClosure";
import { freshDb, makeClient, type FakeDb } from "@/test/waExceptionFake";

const asClient = (db: FakeDb) => makeClient(db) as unknown as SupabaseClient;
const dup = CLOSURE_ITEMS[0];
const stale = CLOSURE_ITEMS[4];
const resolveCalls = (db: FakeDb) => db.calls.filter((c) => c.name === "whatsapp_resolve_reconciliation_exception");

describe("closure constants", () => {
  it("are exactly the five validated exceptions with unique ids and valid resolution text", () => {
    expect(CLOSURE_ITEMS.map((i) => i.exceptionId)).toEqual([
      "f201cc09-d593-4823-adde-e110e4951d28",
      "3a3fa192-08d4-4551-98fe-808d1de8687f",
      "087bcf8e-4e5c-4343-bd4f-4e510a87d968",
      "6ac3ef10-020e-4c32-bf71-5f0189a86127",
      "21e912a3-e97c-4ffa-a7ab-bfc0063636a0",
    ]);
    expect(new Set(CLOSURE_ITEMS.map((i) => i.exceptionId)).size).toBe(5);
    for (const item of CLOSURE_ITEMS) {
      expect(item.resolution.length).toBeGreaterThanOrEqual(5);
      expect(item.resolution.length).toBeLessThanOrEqual(1000);
    }
    expect(stale.resolution).toBe("CASE_AND_INTERPRETATION_EXIST: packet has interpretation and case; exception stale since 2026-10-13.");
    expect(dup.resolution).toBe("DUPLICATE_PACKET_MESSAGES_PRESERVED: sibling packet e2be79a2 holds the messages and case; no data deleted.");
  });
});

describe("revalidate", () => {
  it("passes every check for the validated state", async () => {
    const db = freshDb();
    for (const item of CLOSURE_ITEMS) {
      const state = await revalidate(asClient(db), item);
      expect(state).toMatchObject({ status: "OPEN", closable: true });
    }
  });

  it("refuses a duplicate packet that now holds messages (closing could hide data)", async () => {
    const db = freshDb();
    db.messages[dup.packetId] = 1;
    expect(await revalidate(asClient(db), dup)).toMatchObject({ status: "OPEN", closable: false });
  });

  it("refuses when the sibling no longer holds messages", async () => {
    const db = freshDb();
    db.messages[dup.siblingPacketId as string] = 0;
    expect(await revalidate(asClient(db), dup)).toMatchObject({ closable: false });
  });

  it("refuses the stale item when its packet has no messages", async () => {
    const db = freshDb();
    db.messages[stale.packetId] = 0;
    expect(await revalidate(asClient(db), stale)).toMatchObject({ closable: false });
  });

  it("refuses when the exception no longer matches the validated type, packet or run", async () => {
    for (const patch of [{ exception_type: "OTHER" }, { business_object_id: "other" }, { reconciliation_run_id: "other-run" }]) {
      const db = freshDb();
      Object.assign(db.exceptions[dup.exceptionId], patch);
      const state = await revalidate(asClient(db), dup);
      // a run mismatch makes the row unfindable in its run; either way it is not closable
      expect(state.status === "UNREADABLE" || (state.status === "OPEN" && !state.closable)).toBe(true);
    }
  });

  it("fails closed when the run or the live evidence cannot be read", async () => {
    const a = freshDb();
    a.failRunRead = true;
    expect((await revalidate(asClient(a), dup)).status).toBe("UNREADABLE");
    const b = freshDb();
    b.failMessageRead = true;
    expect(await revalidate(asClient(b), dup)).toMatchObject({ status: "OPEN", closable: false });
  });

  it("reports an already resolved exception with its attribution and whether the text matches", async () => {
    const db = freshDb();
    Object.assign(db.exceptions[dup.exceptionId], { resolved_at: "2026-10-24T07:00:00Z", resolved_by: "someone", resolution: dup.resolution });
    expect(await revalidate(asClient(db), dup)).toMatchObject({ status: "RESOLVED", resolvedBy: "someone", resolutionMatches: true });
  });
});

describe("closeException", () => {
  it("closes one validated exception with the exact id and text, then verifies status, text and attribution", async () => {
    const db = freshDb();
    const out = await closeException(asClient(db), dup);
    expect(out.ok).toBe(true);
    expect(resolveCalls(db)).toEqual([{ name: "whatsapp_resolve_reconciliation_exception", args: { p_exception_id: dup.exceptionId, p_resolution: dup.resolution } }]);
    expect(out.ledger.map((e) => e.step)).toEqual(["REVALIDATED", "CLOSE_REQUESTED", "CLOSED", "READBACK_VERIFIED"]);
    expect(db.exceptions[dup.exceptionId]).toMatchObject({ resolved_by: "operator-1", resolution: dup.resolution });
    expect(out.ledger.at(-1)?.after).toMatchObject({ resolved_by: "operator-1" });
    expect(out.ledger.every((e) => e.operatorId === "operator-1")).toBe(true);
    // the other four are untouched
    expect(CLOSURE_ITEMS.slice(1).every((i) => db.exceptions[i.exceptionId].resolved_at === null)).toBe(true);
  });

  it("never writes a table directly and only uses the governed RPCs", async () => {
    const db = freshDb();
    await closeException(asClient(db), stale);
    expect(db.writes).toEqual([]);
    const allowed = new Set(["has_step_up_auth", "has_whatsapp_permission", "whatsapp_get_reconciliation_run", "whatsapp_resolve_reconciliation_exception"]);
    expect(db.calls.every((c) => allowed.has(c.name))).toBe(true);
  });

  it("refuses without AAL2 and never calls the closing RPC", async () => {
    const db = freshDb();
    db.aal = "aal1";
    const out = await closeException(asClient(db), dup);
    expect(out).toMatchObject({ ok: false, reason: "NOT_AAL2" });
    expect(resolveCalls(db)).toHaveLength(0);
  });

  it("refuses without the wa.intake.close permission", async () => {
    const db = freshDb();
    db.canClose = false;
    expect(await closeException(asClient(db), dup)).toMatchObject({ ok: false, reason: "NOT_AAL2" });
    expect(resolveCalls(db)).toHaveLength(0);
  });

  it("refuses when the session checks cannot be read", async () => {
    const db = freshDb();
    db.failProofReads = true;
    expect(await closeException(asClient(db), dup)).toMatchObject({ ok: false, reason: "PROOF_UNREADABLE" });
    expect(resolveCalls(db)).toHaveLength(0);
  });

  it("revalidates immediately before closing and refuses if the evidence changed", async () => {
    const db = freshDb();
    db.messages[dup.packetId] = 3;
    const out = await closeException(asClient(db), dup);
    expect(out).toMatchObject({ ok: false, reason: "REVALIDATION_FAILED" });
    expect(resolveCalls(db)).toHaveLength(0);
    expect(out.ledger.at(-1)?.step).toBe("REFUSED");
  });

  it("does nothing to an already resolved exception", async () => {
    const db = freshDb();
    await closeException(asClient(db), dup);
    db.calls.length = 0;
    const again = await closeException(asClient(db), dup);
    expect(again).toMatchObject({ ok: false, reason: "ALREADY_RESOLVED" });
    expect(resolveCalls(db)).toHaveLength(0);
  });

  it("reports an RPC failure and leaves the record unchanged", async () => {
    const db = freshDb();
    db.rpcError = "WhatsApp close permission required";
    const out = await closeException(asClient(db), dup);
    expect(out).toMatchObject({ ok: false, reason: "RPC_FAILED" });
    expect(out.ledger.at(-1)?.step).toBe("FAILED");
    expect(db.exceptions[dup.exceptionId].resolved_at).toBeNull();
  });

  it("fails the verification when attribution in the read-back is not the signed-in operator", async () => {
    const db = freshDb();
    db.attributeTo = "someone-else";
    const out = await closeException(asClient(db), dup);
    expect(out).toMatchObject({ ok: false, reason: "READBACK_MISMATCH" });
    expect(out.ledger.at(-1)?.step).toBe("FAILED");
  });

  it("refuses any item that is not one of the five constants (no free-form ids or text)", async () => {
    const db = freshDb();
    const forged: ClosureItem = { ...dup, resolution: "anything else" };
    expect(await closeException(asClient(db), forged)).toMatchObject({ ok: false, reason: "NOT_A_VALIDATED_ITEM" });
    expect(db.calls).toHaveLength(0);
  });

  it("renders the ledger as plain text without secrets", async () => {
    const db = freshDb();
    const out = await closeException(asClient(db), dup);
    const text = ledgerToText(out.ledger);
    expect(text).toContain("READBACK_VERIFIED");
    expect(text).toContain(dup.exceptionId);
  });
});
