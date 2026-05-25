import { describe, expect, it } from "vitest";
import { EXECUTION_QUEUE_ACTIONS } from "../executionAuthorityTypes";
import { isForbiddenBusinessAction, isKnownQueueAction } from "../executionAuthorityMatrix";

describe("executionAuthorityMatrix", () => {
  it("defines only queue-scoped actions", () => {
    for (const action of EXECUTION_QUEUE_ACTIONS) {
      expect(action.startsWith("queue:")).toBe(true);
      expect(isKnownQueueAction(action)).toBe(true);
    }
  });

  it("denies forbidden business action prefixes", () => {
    const forbidden = [
      "finance:approve",
      "stock:reserve",
      "dispatch:complete",
      "payment:capture",
      "invoice:generate",
      "notification:send",
    ];
    for (const action of forbidden) {
      expect(isForbiddenBusinessAction(action)).toBe(true);
      expect(isKnownQueueAction(action)).toBe(false);
    }
  });
});
