import { describe, expect, it } from "vitest";
import { buildQueueFailureRecord } from "../queueFailureBridge";

describe("buildQueueFailureRecord", () => {
  it("marks transient integration failures retryable for operator queue retry", () => {
    const record = buildQueueFailureRecord({
      queueItemId: { value: "q-1" },
      code: "service_unavailable",
      message: "upstream timeout",
      err: new Error("service unavailable"),
      actorUserId: "user-1",
    });
    expect(record.retryable).toBe(true);
  });

  it("marks authority denial permanent and non-retryable", () => {
    const record = buildQueueFailureRecord({
      queueItemId: { value: "q-1" },
      code: "authority_denied",
      message: "Role denied",
      err: new Error("Role OPERATOR not scoped"),
      actorUserId: "user-1",
    });
    expect(record.retryable).toBe(false);
  });
});
