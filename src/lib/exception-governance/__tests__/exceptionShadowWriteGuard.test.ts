import { describe, expect, it } from "vitest";
import { assertNotShadowWrite, isShadowWriteSurface } from "../exceptionShadowWriteGuard";
import { ExceptionGovernanceError } from "../exceptionGovernanceTypes";

describe("exceptionShadowWriteGuard", () => {
  it("blocks factory_inventory direct writes", () => {
    expect(isShadowWriteSurface("factory_inventory")).toBe(true);
    expect(() => assertNotShadowWrite("factory_inventory", "wastage adjust")).toThrow(ExceptionGovernanceError);
  });

  it("blocks orders.is_waste soft reject", () => {
    expect(() => assertNotShadowWrite("orders.is_waste")).toThrow(/governed production/i);
  });

  it("blocks daily_production_logs direct insert", () => {
    expect(() => assertNotShadowWrite("daily_production_logs")).toThrow(/record_production_output/i);
  });
});
