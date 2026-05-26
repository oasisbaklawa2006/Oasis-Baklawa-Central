import { describe, expect, it } from "vitest";
import { createStockFinalizationBundle } from "../createStockFinalizationBundle";

describe("createStockFinalizationBundle", () => {
  it("demo mode disables writes without VITE_STOCK_FINALIZATION_DEMO", async () => {
    const bundle = await createStockFinalizationBundle(undefined, { forceInMemory: true });
    expect(bundle.persistenceMode).toBe("demo");
    expect(bundle.canExecuteWrites).toBe(
      typeof import.meta !== "undefined" && import.meta.env?.VITE_STOCK_FINALIZATION_DEMO === "true",
    );
  });
});
