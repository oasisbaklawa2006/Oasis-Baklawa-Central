import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeSource = readFileSync(new URL("./runtime.ts", import.meta.url), "utf8");

describe("AI-UAT forbidden-route denial timing contract", () => {
  it("waits for asynchronous auth/role route guards instead of sampling after a fixed delay", () => {
    expect(runtimeSource).toContain("FORBIDDEN_ROUTE_SETTLE_TIMEOUT_MS = 10_000");
    expect(runtimeSource).toContain(".poll(() => normalizePathname(new URL(page.url()).pathname)");
    expect(runtimeSource).toContain("must leave the forbidden route after auth/role hydration");
    expect(runtimeSource).not.toContain("page.waitForTimeout(350)");
  });
});
