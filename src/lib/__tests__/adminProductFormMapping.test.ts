import { describe, expect, it } from "vitest";
import {
  mapNumericFieldsToPayload,
  mapProductNumericFieldsFromRow,
  numericToFormValue,
  parseOptionalFloat,
} from "@/lib/adminProductFormMapping";

describe("adminProductFormMapping", () => {
  it("preserves zero in form display", () => {
    expect(numericToFormValue(0)).toBe("0");
    expect(numericToFormValue(null)).toBe("");
  });

  it("does not coerce blank to zero on save", () => {
    expect(parseOptionalFloat("")).toBeNull();
    expect(parseOptionalFloat("15")).toBe(15);
    expect(parseOptionalFloat("0")).toBe(0);
  });

  it("maps DB row numerics without falsy-to-empty bugs", () => {
    const mapped = mapProductNumericFieldsFromRow({
      grams_per_piece: 15,
      weight_per_box_kg: 65,
      primary_pack_weight_kg: 0,
      pcs_per_kg: 0,
      moq: 1,
    });
    expect(mapped.grams_per_piece).toBe("15");
    expect(mapped.weight_per_box_kg).toBe("65");
    expect(mapped.primary_pack_weight_kg).toBe("0");
    expect(mapped.pcs_per_kg).toBe("0");
  });

  it("maps payload without blank-to-zero coercion", () => {
    const payload = mapNumericFieldsToPayload({
      grams_per_piece: "15",
      weight_per_box_kg: "",
      moq: "",
      gst_percentage: "18",
    });
    expect(payload.grams_per_piece).toBe(15);
    expect(payload.weight_per_box_kg).toBeNull();
    expect(payload.moq).toBe(1);
  });
});
