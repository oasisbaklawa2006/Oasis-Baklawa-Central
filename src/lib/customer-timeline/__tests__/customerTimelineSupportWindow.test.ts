import { describe, expect, it } from "vitest";
import { computeSupportWindowEndsAt, isSupportWindowActive } from "../customerTimelineSupportWindow";

describe("customerTimelineSupportWindow", () => {
  it("computes 10-day support window", () => {
    const end = computeSupportWindowEndsAt("2026-05-24T12:00:00.000Z");
    expect(end).toBeTruthy();
    expect(new Date(end!).getDate()).toBe(3);
  });

  it("detects active support window", () => {
    expect(isSupportWindowActive("2026-05-24T12:00:00.000Z", "2026-05-28T12:00:00.000Z")).toBe(true);
    expect(isSupportWindowActive("2026-05-24T12:00:00.000Z", "2026-06-10T12:00:00.000Z")).toBe(false);
  });
});
