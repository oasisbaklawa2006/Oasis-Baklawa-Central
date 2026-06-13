import { describe, expect, it } from "vitest";
import { EMPTY_FORM } from "@/pages/admin/AdminProducts";

describe("AdminProducts EMPTY_FORM", () => {
  it("initializes name as empty string for new product create flow", () => {
    expect(EMPTY_FORM).toHaveProperty("name", "");
  });
});
