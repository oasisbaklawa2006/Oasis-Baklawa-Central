import { describe, expect, it } from "vitest";
import {
  IntegrationError,
  assertAuthorityAvailable,
  isDemoFallbackPermitted,
  resolveAuthorityAvailability,
} from "../index";

describe("unavailableGuard", () => {
  it("throws unavailable when tables are missing", () => {
    expect(() => assertAuthorityAvailable("unavailable", "governance-board")).toThrow(
      IntegrationError,
    );
    try {
      assertAuthorityAvailable("unavailable", "governance-board");
    } catch (err) {
      expect((err as IntegrationError).failureClass).toBe("unavailable");
      expect((err as IntegrationError).code).toBe("authority_unavailable");
    }
  });

  it("resolves availability from table probe", () => {
    expect(resolveAuthorityAvailability(false)).toBe("unavailable");
    expect(resolveAuthorityAvailability(true)).toBe("available");
    expect(resolveAuthorityAvailability(true, new Error("load failed"))).toBe("degraded");
  });

  it("never permits demo fallback in production runtime", () => {
    expect(isDemoFallbackPermitted()).toBe(false);
  });
});
