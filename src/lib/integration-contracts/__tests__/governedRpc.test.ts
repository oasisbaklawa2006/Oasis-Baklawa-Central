import { describe, expect, it } from "vitest";
import {
  classifyGovernedRpcFailure,
  IntegrationError,
  requireGovernedRpcSuccess,
} from "../index";

describe("classifyGovernedRpcFailure", () => {
  it("returns null when RPC succeeded", () => {
    expect(classifyGovernedRpcFailure(null, "dispatch-governed-rpc")).toBeNull();
  });

  it("classifies authority denial as permanent non-retryable", () => {
    const classified = classifyGovernedRpcFailure(
      { message: "Role DISPATCH not scoped to queue" },
      "rgs-governed-rpc:reserve_rgs_stock",
    );
    expect(classified).toBeInstanceOf(IntegrationError);
    expect(classified?.failureClass).toBe("permanent");
    expect(classified?.retryable).toBe(false);
  });

  it("classifies transient upstream failures as retryable for idempotent writes", () => {
    const classified = classifyGovernedRpcFailure(
      { message: "service unavailable" },
      "rgs-governed-rpc:reserve_rgs_stock",
    );
    expect(classified?.failureClass).toBe("transient");
    expect(classified?.retryable).toBe(true);
  });
});

describe("requireGovernedRpcSuccess", () => {
  it("throws classified IntegrationError on RPC error", () => {
    expect(() =>
      requireGovernedRpcSuccess(
        { data: null, error: { message: "stale queue version" } },
        "dispatch-governed-rpc",
      ),
    ).toThrow(IntegrationError);
  });

  it("returns data when RPC succeeds", () => {
    expect(
      requireGovernedRpcSuccess({ data: { ok: true }, error: null }, "dispatch-governed-rpc"),
    ).toEqual({ ok: true });
  });
});
