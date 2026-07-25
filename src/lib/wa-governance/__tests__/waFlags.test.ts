import { describe, expect, it } from "vitest";
import {
  WA_FLAG_ENV,
  isWaWebhookAutoOrderWritesEnabled,
  isWaWebhookOwnerReassignmentEnabled,
  parseEnvFlagTrue,
} from "@/config/waFlags";

describe("waFlags", () => {
  it("defaults auto-order writes to disabled when env unset", () => {
    expect(isWaWebhookAutoOrderWritesEnabled(() => undefined)).toBe(false);
  });

  it("defaults owner reassignment to disabled when env unset", () => {
    expect(isWaWebhookOwnerReassignmentEnabled(() => undefined)).toBe(false);
  });

  it("cannot re-enable retired mutation paths through environment values", () => {
    const env = (name: string) =>
      name === WA_FLAG_ENV.WEBHOOK_AUTO_ORDER_WRITES ||
      name === WA_FLAG_ENV.WEBHOOK_OWNER_REASSIGNMENT
        ? "true"
        : undefined;
    expect(isWaWebhookAutoOrderWritesEnabled(env)).toBe(false);
    expect(isWaWebhookOwnerReassignmentEnabled(env)).toBe(false);
  });

  it("does not treat false or empty as enabled", () => {
    expect(parseEnvFlagTrue("false")).toBe(false);
    expect(parseEnvFlagTrue("")).toBe(false);
    expect(parseEnvFlagTrue(undefined)).toBe(false);
    expect(isWaWebhookAutoOrderWritesEnabled(() => "false")).toBe(false);
  });

  it("accepts 1 and yes as enabled", () => {
    expect(parseEnvFlagTrue("1")).toBe(true);
    expect(parseEnvFlagTrue("YES")).toBe(true);
  });
});
