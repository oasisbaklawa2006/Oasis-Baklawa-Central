import { describe, expect, it, vi } from "vitest";
import { DOCUMENT_CLASS_POLICIES, MIME_TO_EXTENSION } from "../documentStoragePolicy";
import {
  assertCrossCompanyAccess,
  assertNoDemoFallback,
  assertSafeStorageKey,
  buildDeterministicStorageKey,
  isCanonicalStorageRef,
  parseCanonicalStorageRef,
  planGovernedUpload,
} from "../documentStorageValidation";
import { DocumentStorageGovernanceError } from "../documentStorageTypes";

describe("documentStoragePolicy", () => {
  it("keeps receipts-backed classes private", () => {
    expect(DOCUMENT_CLASS_POLICIES.packing_proof.visibility).toBe("private");
    expect(DOCUMENT_CLASS_POLICIES.dispatch_carton_evidence.visibility).toBe("private");
  });

  it("keeps product images public and centrally uploadable", () => {
    expect(DOCUMENT_CLASS_POLICIES.product_image.visibility).toBe("public");
    expect(DOCUMENT_CLASS_POLICIES.product_image.centralUploadAllowed).toBe(true);
  });

  it("blocks Central uploads for foreign-owned classes", () => {
    expect(DOCUMENT_CLASS_POLICIES.payment_receipt.centralUploadAllowed).toBe(false);
    expect(DOCUMENT_CLASS_POLICIES.whatsapp_media_hint.centralUploadAllowed).toBe(false);
  });

  it("maps governed MIME types to deterministic extensions", () => {
    expect(MIME_TO_EXTENSION["image/jpeg"]).toBe("jpg");
    expect(MIME_TO_EXTENSION["application/pdf"]).toBe("pdf");
  });
});

describe("planGovernedUpload", () => {
  it("plans a governed packing proof upload with order binding", () => {
    const plan = planGovernedUpload({
      documentClass: "packing_proof",
      file: { type: "image/jpeg", size: 1024, name: "../../evil.jpg" },
      binding: { orderId: "order-1" },
      actorUserId: "actor-1",
      provenance: "central_admin_ui",
    });
    expect(plan.bucket).toBe("receipts");
    expect(plan.visibility).toBe("private");
    expect(plan.storageKey).toMatch(/^packing-proof\/order-1\/\d+-[0-9a-f-]+\.jpg$/);
    expect(plan.storageKey).not.toContain("evil");
  });

  it("rejects missing order binding", () => {
    expect(() =>
      planGovernedUpload({
        documentClass: "packing_proof",
        file: { type: "image/jpeg", size: 1024, name: "photo.jpg" },
        binding: {},
        actorUserId: "actor-1",
        provenance: "central_admin_ui",
      }),
    ).toThrow(DocumentStorageGovernanceError);
  });

  it("rejects unsafe MIME types", () => {
    try {
      planGovernedUpload({
        documentClass: "packing_proof",
        file: { type: "application/javascript", size: 1024, name: "x.js" },
        binding: { orderId: "order-1" },
        actorUserId: "actor-1",
        provenance: "central_admin_ui",
      });
      throw new Error("expected planGovernedUpload to throw");
    } catch (error) {
      expect(error).toMatchObject({ code: "unsafe_mime" });
    }
  });

  it("rejects oversized files", () => {
    try {
      planGovernedUpload({
        documentClass: "packing_proof",
        file: { type: "image/jpeg", size: 20 * 1024 * 1024, name: "big.jpg" },
        binding: { orderId: "order-1" },
        actorUserId: "actor-1",
        provenance: "central_admin_ui",
      });
      throw new Error("expected planGovernedUpload to throw");
    } catch (error) {
      expect(error).toMatchObject({ code: "unsafe_size" });
    }
  });

  it("rejects Central uploads for payment receipts", () => {
    try {
      planGovernedUpload({
        documentClass: "payment_receipt",
        file: { type: "image/jpeg", size: 1024, name: "receipt.jpg" },
        binding: { orderId: "order-1", companyId: "company-1" },
        actorUserId: "actor-1",
        provenance: "central_admin_ui",
      });
      throw new Error("expected planGovernedUpload to throw");
    } catch (error) {
      expect(error).toMatchObject({ code: "unauthorized_bucket" });
    }
  });
});

describe("storage path and reference validation", () => {
  it("rejects unsafe storage keys", () => {
    expect(() => assertSafeStorageKey("../receipts/evil.jpg")).toThrow(DocumentStorageGovernanceError);
  });

  it("parses canonical storage references", () => {
    const parsed = parseCanonicalStorageRef("storage:receipts/packing-proof/order-1/1-uuid.jpg");
    expect(parsed.bucket).toBe("receipts");
    expect(parsed.storageKey).toBe("packing-proof/order-1/1-uuid.jpg");
    expect(isCanonicalStorageRef("storage:receipts/packing-proof/order-1/1-uuid.jpg")).toBe(true);
  });

  it("never derives keys from file names", () => {
    const key = buildDeterministicStorageKey({
      pathPrefix: "dispatch-carton-evidence",
      binding: { cartonId: "carton-1" },
      contentType: "image/jpeg",
      documentClass: "dispatch_carton_evidence",
    });
    expect(key).toMatch(/^dispatch-carton-evidence\/carton-1\/\d+-[0-9a-f-]+\.jpg$/);
    expect(key).not.toContain("..");
  });
});

describe("fail-closed governance guards", () => {
  it("forbids demo or local storage fallback", () => {
    try {
      assertNoDemoFallback("demo");
      throw new Error("expected assertNoDemoFallback to throw");
    } catch (error) {
      expect(error).toMatchObject({ code: "demo_fallback_forbidden" });
    }
    try {
      assertNoDemoFallback("local");
      throw new Error("expected assertNoDemoFallback to throw");
    } catch (error) {
      expect(error).toMatchObject({ code: "demo_fallback_forbidden" });
    }
  });

  it("blocks cross-company access", () => {
    try {
      assertCrossCompanyAccess("company-a", "company-b");
      throw new Error("expected assertCrossCompanyAccess to throw");
    } catch (error) {
      expect(error).toMatchObject({ code: "cross_company_access" });
    }
  });
});
