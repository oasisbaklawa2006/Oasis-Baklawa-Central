import { describe, expect, it } from "vitest";
import { assertExecutionAuthority } from "../executionAuthorityGuard";

describe("executionAuthorityGuard", () => {
  it("denies unknown actions", () => {
    const d = assertExecutionAuthority("stock:deduct", {
      actorUserId: "u1",
      actorRole: "SUPER_ADMIN",
    });
    expect(d.allowed).toBe(false);
  });

  it("denies finance approval style actions", () => {
    const d = assertExecutionAuthority("finance:approve", {
      actorUserId: "u1",
      actorRole: "SUPER_ADMIN",
    });
    expect(d.allowed).toBe(false);
  });

  it("allows super admin for queue assign", () => {
    const d = assertExecutionAuthority("queue:assign", {
      actorUserId: "u1",
      actorRole: "SUPER_ADMIN",
      queueType: "production_queue",
    });
    expect(d.allowed).toBe(true);
  });

  it("denies ADMIN cancel", () => {
    const d = assertExecutionAuthority("queue:cancel", {
      actorUserId: "u1",
      actorRole: "ADMIN",
      queueType: "production_queue",
    });
    expect(d.allowed).toBe(false);
  });

  it("denies production manager outside department queue", () => {
    const d = assertExecutionAuthority("queue:start", {
      actorUserId: "u1",
      actorRole: "PRODUCTION_MANAGER",
      queueType: "dispatch_queue",
    });
    expect(d.allowed).toBe(false);
  });

  it("allows production manager on production queue", () => {
    const d = assertExecutionAuthority("queue:start", {
      actorUserId: "u1",
      actorRole: "PRODUCTION_MANAGER",
      queueType: "production_queue",
    });
    expect(d.allowed).toBe(true);
  });
});
