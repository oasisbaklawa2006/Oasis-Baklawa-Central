import { describe, expect, it } from "vitest";
import { createStockFinalizationBundle } from "../createStockFinalizationBundle";
import { isStockFinalizationDemoPermitted } from "@/lib/integration-contracts";

describe("createStockFinalizationBundle", () => {
  it("demo mode disables writes without explicit staging demo flag", async () => {
    const bundle = await createStockFinalizationBundle(undefined, { forceInMemory: true });
    expect(bundle.persistenceMode).toBe("demo");
    expect(bundle.canExecuteWrites).toBe(isStockFinalizationDemoPermitted());
  });
});
