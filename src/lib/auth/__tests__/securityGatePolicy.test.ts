import { describe, expect, it } from "vitest";
import { canAccessSecurityGate, SECURITY_GATE_ALLOWED_ROLES } from "../securityGatePolicy";

const DISPATCH_ROLES = ["DISPATCH_MANAGER", "DISPATCH_INCHARGE", "DISPATCH_HEAD"] as const;

describe("securityGatePolicy", () => {
  it.each(DISPATCH_ROLES)("denies %s from security gate operations", (role) => {
    expect(canAccessSecurityGate(role)).toBe(false);
    expect(SECURITY_GATE_ALLOWED_ROLES).not.toContain(role);
  });

  it("allows dedicated gate roles", () => {
    expect(canAccessSecurityGate("GATE_SECURITY")).toBe(true);
    expect(canAccessSecurityGate("SECURITY_CONTROL")).toBe(true);
  });
});
