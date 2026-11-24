import { describe, expect, it, vi } from "vitest";
import {
  FinanceReversalError,
  classifyFinanceReversalFailure,
  completeFinanceReversalV1,
  decideFinanceReversalV1,
  deriveFinanceReversalStatus,
  requestFinanceReversalV1,
  type FinanceControlEventRow,
} from "../financeReversalClient";

const ctx = { actorId: "actor-1", reason: "reverse the hold", evidenceReference: "evidence", correlationId: "corr-1", idempotencyKey: "key-1" };
const okClient = (data: unknown) => ({ rpc: vi.fn().mockResolvedValue({ data, error: null }) });
const failClient = (message: string, code?: string) => ({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message, code } }) });

describe("two-step Finance reversal client", () => {
  it("sends Core's exact argument names for each step", async () => {
    const request = okClient([{ request_event_id: "req-1", decision: "PENDING", already_requested: false }]);
    await expect(requestFinanceReversalV1({ targetEventId: "evt-1", ctx }, request)).resolves.toEqual({ eventId: "req-1", decision: "PENDING", replayed: false });
    expect(request.rpc).toHaveBeenCalledWith("request_finance_reversal_v1", { p_event_id: "evt-1", p_reason: "reverse the hold", p_evidence_reference: "evidence", p_correlation_id: "corr-1", p_idempotency_key: "key-1", p_actor_id: "actor-1" });

    const decide = okClient([{ approval_event_id: "app-1", decision: "APPROVED", already_decided: true }]);
    await expect(decideFinanceReversalV1({ requestEventId: "req-1", approve: true, ctx }, decide)).resolves.toEqual({ eventId: "app-1", decision: "APPROVED", replayed: true });
    expect(decide.rpc).toHaveBeenCalledWith("decide_finance_reversal_v1", expect.objectContaining({ p_request_event_id: "req-1", p_approve: true }));

    const complete = okClient([{ control_event_id: "rev-1", decision: "REVERSED", already_reversed: false }]);
    await expect(completeFinanceReversalV1({ requestEventId: "req-1", ctx }, complete)).resolves.toEqual({ eventId: "rev-1", decision: "REVERSED", replayed: false });
    expect(complete.rpc).toHaveBeenCalledWith("complete_finance_reversal_v1", expect.objectContaining({ p_request_event_id: "req-1" }));
  });

  it.each([
    ["FINANCE_REVERSAL_MAKER_CHECKER", "maker_checker_denied"],
    ["FINANCE_REVERSAL_SNAPSHOT_STALE: financial position changed since the request", "stale_snapshot"],
    ["FINANCE_REVERSAL_SCOPE_SNAPSHOT_UNAVAILABLE", "unsupported_scope"],
    ["FINANCE_REVERSAL_REQUEST_SUPERSEDED", "request_superseded"],
    ["FINANCE_CLEARANCE_AAL2_REQUIRED", "aal2_required"],
    ["finance authority required", "not_finance_actor"],
    ["FINANCE_REVERSAL_IDEMPOTENCY_CONFLICT", "idempotency_conflict"],
    ["FINANCE_REVERSAL_REQUEST_ALREADY_OPEN", "request_already_open"],
    ["FINANCE_REVERSAL_ALREADY_DECIDED", "already_decided"],
    ["FINANCE_CONTROL_ALREADY_REVERSED", "already_reversed"],
    ["FINANCE_REVERSAL_NOT_APPROVED", "not_approved"],
    ["FINANCE_REVERSAL_REJECTED", "rejected"],
    ["Could not find the function public.request_finance_reversal_v1 in the schema cache", "core_prerequisite_missing"],
    ["something unexpected", "unavailable"],
  ])("classifies Core's rejection %s as %s and surfaces it (never retried or bypassed)", async (message, code) => {
    const client = failClient(message);
    await expect(requestFinanceReversalV1({ targetEventId: "evt-1", ctx }, client)).rejects.toMatchObject({ name: "FinanceReversalError", code });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(classifyFinanceReversalFailure({ message }).code).toBe(code);
  });

  it.each([
    ["request", [{ request_event_id: "", decision: "PENDING", already_requested: false }], "request"],
    ["request", [{ request_event_id: "req-1", decision: "REVERSED", already_requested: false }], "decision"],
    ["request", [{ request_event_id: "req-1", decision: "PENDING", already_requested: "false" }], "replayed"],
    ["request", [], "missing"],
    ["decision", [{ approval_event_id: "app-1", decision: "PENDING", already_decided: false }], "decision"],
    ["completion", [{ control_event_id: "rev-1", decision: "APPROVED", already_reversed: false }], "decision"],
  ])("fails closed for malformed %s Core result (%s)", async (step, data, _failureKind) => {
    const client = okClient(data);
    const invoke = step === "request"
      ? requestFinanceReversalV1({ targetEventId: "evt-1", ctx }, client)
      : step === "decision"
        ? decideFinanceReversalV1({ requestEventId: "req-1", approve: true, ctx }, client)
        : completeFinanceReversalV1({ requestEventId: "req-1", ctx }, client);
    await expect(invoke).rejects.toMatchObject({ name: "FinanceReversalError", code: "unavailable" });
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });

  it("refuses blank evidence before calling Core", async () => {
    const client = okClient([]);
    await expect(requestFinanceReversalV1({ targetEventId: "evt-1", ctx: { ...ctx, reason: "  " } }, client)).rejects.toBeInstanceOf(FinanceReversalError);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("derives pending, approved, rejected and completed status from the append-only history", () => {
    const hold = "hold-1";
    const base: FinanceControlEventRow[] = [{ id: hold, control_kind: "HOLD", decision: "APPLIED", prior_event_id: null }];
    expect(deriveFinanceReversalStatus(hold, base).status).toBe("NONE");
    const requested = [...base, { id: "req-1", control_kind: "REVERSAL_REQUEST", decision: "PENDING", prior_event_id: hold }];
    expect(deriveFinanceReversalStatus(hold, requested)).toEqual({ status: "REQUESTED", requestEventId: "req-1", awaitingSecondPerson: true });
    const approved = [...requested, { id: "app-1", control_kind: "REVERSAL_APPROVAL", decision: "APPROVED", prior_event_id: "req-1" }];
    expect(deriveFinanceReversalStatus(hold, approved)).toEqual({ status: "APPROVED", requestEventId: "req-1", awaitingSecondPerson: false });
    const rejected = [...requested, { id: "app-1", control_kind: "REVERSAL_APPROVAL", decision: "REJECTED", prior_event_id: "req-1" }];
    expect(deriveFinanceReversalStatus(hold, rejected).status).toBe("REJECTED");
    const reopened = [...rejected, { id: "req-2", control_kind: "REVERSAL_REQUEST", decision: "PENDING", prior_event_id: hold }];
    expect(deriveFinanceReversalStatus(hold, reopened).requestEventId).toBe("req-2");
    const done = [...approved, { id: "rev-1", control_kind: "REVERSAL", decision: "REVERSED", prior_event_id: hold }];
    expect(deriveFinanceReversalStatus(hold, done).status).toBe("COMPLETED");
  });

  describe("chronological ordering of the reversal history", () => {
    const hold = "hold-1";
    const at = (minute: number) => `2026-11-10T10:${String(minute).padStart(2, "0")}:00Z`;
    const ev = (id: string, control_kind: string, decision: string, prior: string | null, minute: number): FinanceControlEventRow =>
      ({ id, control_kind, decision, prior_event_id: prior, created_at: at(minute) });
    const holdEvent = ev(hold, "HOLD", "APPLIED", null, 0);
    // Cycle 1 rejected, cycle 2 approved, cycle 3 still awaiting a second person.
    const req1 = ev("req-1", "REVERSAL_REQUEST", "PENDING", hold, 1);
    const rej1 = ev("app-1", "REVERSAL_APPROVAL", "REJECTED", "req-1", 2);
    const req2 = ev("req-2", "REVERSAL_REQUEST", "PENDING", hold, 3);
    const app2 = ev("app-2", "REVERSAL_APPROVAL", "APPROVED", "req-2", 4);
    const req3 = ev("req-3", "REVERSAL_REQUEST", "PENDING", hold, 5);
    const full = [holdEvent, req1, rej1, req2, app2, req3];
    const permutations = <T,>(items: T[]): T[][] =>
      items.length <= 1 ? [items] : items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]));

    it("gives the same answer for every ordering of a multi-cycle history", () => {
      for (const order of permutations(full)) {
        expect(deriveFinanceReversalStatus(hold, order)).toEqual({ status: "REQUESTED", requestEventId: "req-3", awaitingSecondPerson: true });
      }
    });

    it("reports the latest request by time even when it is listed first (shuffled history)", () => {
      const shuffled = [req3, app2, rej1, holdEvent, req2, req1];
      expect(deriveFinanceReversalStatus(hold, shuffled).requestEventId).toBe("req-3");
      expect(deriveFinanceReversalStatus(hold, [req2, app2, req1, rej1, holdEvent])).toEqual({ status: "APPROVED", requestEventId: "req-2", awaitingSecondPerson: false });
    });

    it("reports REJECTED only when the newest cycle was rejected, regardless of listing order", () => {
      const rejectedLast = [holdEvent, req1, rej1];
      for (const order of permutations(rejectedLast)) expect(deriveFinanceReversalStatus(hold, order).status).toBe("REJECTED");
      const earlierApprovalThenNewRejection = [
        ev("req-a", "REVERSAL_REQUEST", "PENDING", hold, 1), ev("app-a", "REVERSAL_APPROVAL", "APPROVED", "req-a", 2),
        ev("req-b", "REVERSAL_REQUEST", "PENDING", hold, 3), ev("app-b", "REVERSAL_APPROVAL", "REJECTED", "req-b", 4),
      ];
      for (const order of permutations(earlierApprovalThenNewRejection)) {
        expect(deriveFinanceReversalStatus(hold, order)).toEqual({ status: "APPROVED", requestEventId: "req-a", awaitingSecondPerson: false });
      }
    });

    it("stays COMPLETED for any ordering once the reversal event exists", () => {
      const done = [...full, ev("rev-1", "REVERSAL", "REVERSED", hold, 6)];
      for (const order of [done, [...done].reverse()]) expect(deriveFinanceReversalStatus(hold, order).status).toBe("COMPLETED");
    });

    it("breaks timestamp ties by id so the result does not depend on listing order", () => {
      const a = ev("req-a", "REVERSAL_REQUEST", "PENDING", hold, 7);
      const b = ev("req-b", "REVERSAL_REQUEST", "PENDING", hold, 7);
      expect(deriveFinanceReversalStatus(hold, [a, b]).requestEventId).toBe("req-b");
      expect(deriveFinanceReversalStatus(hold, [b, a]).requestEventId).toBe("req-b");
    });

    it("sorts undated events before dated ones and keeps their input order", () => {
      const undatedOld: FinanceControlEventRow = { id: "req-old", control_kind: "REVERSAL_REQUEST", decision: "PENDING", prior_event_id: hold };
      const undatedBad: FinanceControlEventRow = { ...undatedOld, id: "req-bad", created_at: "not-a-date" };
      expect(deriveFinanceReversalStatus(hold, [req1, undatedOld]).requestEventId).toBe("req-1");
      expect(deriveFinanceReversalStatus(hold, [undatedOld, undatedBad]).requestEventId).toBe("req-bad");
    });

    it("does not mutate the history it is given", () => {
      const input = [req3, holdEvent, req1];
      const copy = [...input];
      deriveFinanceReversalStatus(hold, input);
      expect(input).toEqual(copy);
    });
  });

  it("does not reference the immediate reversal function", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(__dirname, "../financeReversalClient.ts"), "utf8");
    expect(source).not.toMatch(/rpc\(\s*["']reverse_finance_control_v1/);
    expect(source).not.toMatch(/\bcall\(client, "reverse_finance_control_v1"/);
  });
});
