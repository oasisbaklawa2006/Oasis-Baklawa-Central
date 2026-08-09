import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Point 27, Finding 3: AI-generated allergen/ingredient/HSN/GST data from
// handleAiFullGenerate() must not silently become saved product truth - the
// operator must explicitly review it before handleSaveProduct() can persist.
// This regression guard is source-based (not component-rendered) because this
// file has no React Testing Library harness; it protects the specific
// invariant regardless of internal implementation shuffling.
describe("AdminProducts AI compliance review gate", () => {
  const source = readFileSync(join(__dirname, "../AdminProducts.tsx"), "utf8");

  it("sets an unreviewed flag when AI compliance data is generated", () => {
    expect(source).toMatch(/setAiComplianceUnreviewed\(true\)/);
  });

  it("blocks handleSaveProduct while AI compliance data is unreviewed", () => {
    const saveFnStart = source.indexOf("const handleSaveProduct = async () => {");
    expect(saveFnStart).toBeGreaterThan(-1);
    const nextTwoHundred = source.slice(saveFnStart, saveFnStart + 400);
    expect(nextTwoHundred).toMatch(/if\s*\(aiComplianceUnreviewed\)/);
  });

  it("provides an explicit reviewer acknowledgement control, not just a silent auto-clear", () => {
    expect(source).toContain("Mark as reviewed");
  });
});
