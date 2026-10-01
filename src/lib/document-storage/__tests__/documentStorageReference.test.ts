import { describe, expect, it } from "vitest";
import {
  legacyUrlToCanonicalRef,
  parsePersistedStorageReference,
  toCanonicalStorageRef,
  toGovernedStorageReference,
} from "../documentStorageReference";
import { planGovernedUpload } from "../documentStorageValidation";

describe("documentStorageReference", () => {
  it("builds canonical storage references", () => {
    expect(toCanonicalStorageRef("receipts", "packing-proof/order-1/file.jpg")).toBe(
      "storage:receipts/packing-proof/order-1/file.jpg",
    );
  });

  it("migrates legacy public Supabase URLs to canonical refs without exposing secrets", () => {
    const canonical = legacyUrlToCanonicalRef(
      "https://project.supabase.co/storage/v1/object/public/receipts/packing-proof/order-1/file.jpg",
    );
    expect(canonical).toBe("storage:receipts/packing-proof/order-1/file.jpg");
  });

  it("creates governed metadata references after upload planning", () => {
    const plan = planGovernedUpload({
      documentClass: "product_image",
      file: { type: "image/png", size: 2048, name: "hero.png" },
      binding: { productId: "product-1" },
      actorUserId: "actor-1",
      provenance: "central_admin_ui",
    });
    const ref = toGovernedStorageReference(plan, { size: 2048 });
    expect(ref.canonicalRef).toBe(`storage:${plan.bucket}/${plan.storageKey}`);
    expect(ref.binding.productId).toBe("product-1");
    expect(ref.actorUserId).toBe("actor-1");
  });

  it("parses persisted canonical references for read authority", () => {
    const parsed = parsePersistedStorageReference(
      "storage:product-images/catalogue/products/product-1/1-uuid.png",
    );
    expect(parsed.bucket).toBe("product-images");
    expect(parsed.canonicalRef.startsWith("storage:")).toBe(true);
  });
});
