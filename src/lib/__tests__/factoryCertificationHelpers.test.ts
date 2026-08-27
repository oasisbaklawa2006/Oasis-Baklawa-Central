import { describe, expect, it } from "vitest";
import {
  compareExactDestination,
  normalizeRoute,
  resolveJobShortId,
  validateAccessDenial,
  validateDataContainment,
  validateErrorDisplay,
  validateFixtureFound,
} from "../factoryCertificationHelpers";

describe("factoryCertificationHelpers", () => {
  it("preserves route hierarchy while normalizing harmless slash syntax", () => {
    expect(normalizeRoute("admin/ready-goods/")).toBe("/admin/ready-goods");
    expect(normalizeRoute("/admin//ready-goods//")).toBe("/admin/ready-goods");
    expect(normalizeRoute("/ready-goods")).toBe("/ready-goods");
  });

  it("accepts the exact canonical destination while ignoring query/hash/trailing slash", () => {
    const result = compareExactDestination(
      "/admin/ready-goods",
      "https://preview.example.test/admin/ready-goods/?mode=qa#top",
    );
    expect(result.passed).toBe(true);
  });

  it("rejects a missing /admin hierarchy segment", () => {
    const result = compareExactDestination(
      "/admin/ready-goods",
      "https://preview.example.test/ready-goods",
    );
    expect(result.passed).toBe(false);
  });

  it("rejects a redirect to the wrong TV surface", () => {
    const result = compareExactDestination(
      "/tv/arabic-sweets",
      "https://preview.example.test/tv/rgs",
    );
    expect(result.passed).toBe(false);
  });

  it("resolves the human short job id only when it matches a valid full UUID prefix", () => {
    expect(
      resolveJobShortId("E3ED28B0", "e3ed28b0-1234-4567-89ab-0123456789ab").valid,
    ).toBe(true);
    expect(
      resolveJobShortId("E3ED28B0", "ffffffff-1234-4567-89ab-0123456789ab").valid,
    ).toBe(false);
    expect(resolveJobShortId("E3ED28B0", "E3ED28B0-not-a-uuid").valid).toBe(false);
  });

  it("fails when a required golden fixture is absent", () => {
    expect(validateFixtureFound("E3ED28B0", []).found).toBe(false);
  });

  it("fails containment when an Arabic job is projected into another department", () => {
    expect(validateDataContainment("CHOCOLATES_CONFECTIONERY", ["ARABIC_SWEETS"]).contained).toBe(false);
  });

  it("fails silent-empty handling when an injected failure has no user-visible error", () => {
    expect(validateErrorDisplay(true, undefined, true).displayed).toBe(false);
  });

  it("accepts only real authz/authn denials as HTTP-level role-isolation proof", () => {
    expect(validateAccessDenial(401, "unauthenticated").denied).toBe(true);
    expect(validateAccessDenial(403, "forbidden").denied).toBe(true);
    expect(validateAccessDenial(200, undefined).denied).toBe(false);
    expect(validateAccessDenial(302, undefined).denied).toBe(false);
    expect(validateAccessDenial(404, "not found").denied).toBe(false);
    expect(validateAccessDenial(429, "rate limited").denied).toBe(false);
    expect(validateAccessDenial(500, "server exploded").denied).toBe(false);
    expect(validateAccessDenial(undefined, "network failure").denied).toBe(false);
  });
});
