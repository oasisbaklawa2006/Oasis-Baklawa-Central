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

// Point 27, Phase 12: handleImageUpload must reject an oversized or wrong-type
// file client-side before calling storage, mirroring the product-images
// bucket's server-side enforcement (Core migration
// 20260809211500_enforce_product_images_bucket_limits.sql).
describe("AdminProducts image upload validation", () => {
  const source = readFileSync(join(__dirname, "../AdminProducts.tsx"), "utf8");

  it("rejects an oversized file before uploading to storage", () => {
    const uploadFnStart = source.indexOf("const handleImageUpload = async");
    expect(uploadFnStart).toBeGreaterThan(-1);
    const storageCallIndex = source.indexOf("supabase.storage", uploadFnStart);
    const sizeCheckIndex = source.indexOf("MAX_PRODUCT_IMAGE_BYTES", uploadFnStart);
    expect(sizeCheckIndex).toBeGreaterThan(-1);
    expect(sizeCheckIndex).toBeLessThan(storageCallIndex);
  });

  it("rejects a disallowed MIME type before uploading to storage", () => {
    const uploadFnStart = source.indexOf("const handleImageUpload = async");
    const storageCallIndex = source.indexOf("supabase.storage", uploadFnStart);
    const typeCheckIndex = source.indexOf("ALLOWED_PRODUCT_IMAGE_MIME_TYPES", uploadFnStart);
    expect(typeCheckIndex).toBeGreaterThan(-1);
    expect(typeCheckIndex).toBeLessThan(storageCallIndex);
  });
});
