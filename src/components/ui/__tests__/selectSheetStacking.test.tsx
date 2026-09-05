import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function readSelectSource() {
  return readFileSync(resolve(process.cwd(), "src/components/ui/select.tsx"), "utf8");
}

describe("Select-in-Sheet stacking contract", () => {
  it("renders SelectContent above Sheet z-[200] via z-[210]", () => {
    const source = readSelectSource();
    expect(source).toContain("z-[210]");
    expect(source).not.toMatch(/SelectContent[\s\S]*z-50/);
  });

  it("keeps pricing slab options visible and selectable inside an open Sheet", async () => {
    render(
      <Sheet open>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Buyer approval review</SheetTitle>
          </SheetHeader>
          <Select>
            <SelectTrigger aria-label="Pricing slab">
              <SelectValue placeholder="Select pricing slab (required)…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slab-a">Slab A</SelectItem>
              <SelectItem value="slab-b">Slab B</SelectItem>
            </SelectContent>
          </Select>
        </SheetContent>
      </Sheet>,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Pricing slab" }));

    const option = await screen.findByRole("option", { name: "Slab A" });
    await waitFor(() => {
      expect(option).toBeVisible();
    });

    const content = option.closest("[data-radix-select-content]") ?? option.parentElement?.parentElement;
    expect(content?.className).toContain("z-[210]");
  });
});
