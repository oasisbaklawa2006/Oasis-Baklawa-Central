import { describe, expect, it } from "vitest";
import { SPLASH_POST_DELAY_DESTINATION } from "./splashRouting";

describe("splash routing", () => {
  it("lands unauthenticated users on the real login route", () => {
    expect(SPLASH_POST_DELAY_DESTINATION).toBe("/login");
    expect(SPLASH_POST_DELAY_DESTINATION).not.toBe("/intro");
  });
});
