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
  ])("fails closed for malformed %s Core result (%s)", async (step, data) => {
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

  it("does not reference the immediate reversal function", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(__dirname, "../financeReversalClient.ts"), "utf8");
    expect(source).not.toMatch(/rpc\(\s*["']reverse_finance_control_v1/);
    expect(source).not.toMatch(/\bcall\(client, "reverse_finance_control_v1"/);
  });
});
