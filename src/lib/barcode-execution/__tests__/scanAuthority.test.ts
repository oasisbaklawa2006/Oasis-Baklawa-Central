import { describe, expect, it } from "vitest";
import { assertScanAuthority } from "../scanAuthority";

describe("scanAuthority", () => {
  it("allows SUPER_ADMIN all scan actions", () => {
    expect(() => assertScanAuthority("scan:gate", { actorRole: "SUPER_ADMIN" })).not.toThrow();
  });

  it("denies gate scan for production manager", () => {
    expect(() => assertScanAuthority("scan:gate", { actorRole: "PRODUCTION_MANAGER" })).toThrow(
      /cannot perform dispatch gate/i,
    );
  });

  it("allows dispatch manager gate scans", () => {
    expect(() => assertScanAuthority("scan:gate", { actorRole: "DISPATCH_MANAGER" })).not.toThrow();
  });

  it("denies unknown actions via guard", () => {
    expect(() => assertScanAuthority("scan:verify" as "scan:verify", { actorRole: "CUSTOMER" })).toThrow(
      /denied/i,
    );
  });

  it("rejects forbidden business prefixes", () => {
    expect(() =>
      assertScanAuthority("dispatch:complete" as "scan:verify", { actorRole: "SUPER_ADMIN" }),
    ).toThrow(/Forbidden business action/);
  });
});
