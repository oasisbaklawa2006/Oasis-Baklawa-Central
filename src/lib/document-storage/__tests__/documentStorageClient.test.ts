import { describe, expect, it, vi } from "vitest";
import {
  deleteGovernedObject,
  executeGovernedUpload,
  resolveGovernedStorageAccessUrl,
} from "../documentStorageClient";
import { DocumentStorageGovernanceError } from "../documentStorageTypes";

type StorageHarness = {
  supabase: Parameters<typeof executeGovernedUpload>[0];
  upload: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  getPublicUrl: ReturnType<typeof vi.fn>;
  createSignedUrl: ReturnType<typeof vi.fn>;
};

function createStorageMock(): StorageHarness {
  const upload = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async () => ({ error: null }));
  const getPublicUrl = vi.fn(() => ({ data: { publicUrl: "https://example.test/public/product.png" } }));
  const createSignedUrl = vi.fn(async () => ({
    data: { signedUrl: "https://example.test/signed/private.jpg?token=abc" },
    error: null,
  }));

  return {
    supabase: {
      storage: {
        from: vi.fn(() => ({ upload, remove, getPublicUrl, createSignedUrl })),
      },
    } as unknown as Parameters<typeof executeGovernedUpload>[0],
    upload,
    remove,
    getPublicUrl,
    createSignedUrl,
  };
}

describe("documentStorageClient", () => {
  it("executes governed uploads and returns canonical metadata", async () => {
    const { supabase, upload } = createStorageMock();
    const file = new File(["x"], "ignored.jpg", { type: "image/jpeg" });
    const ref = await executeGovernedUpload(
      supabase,
      {
        documentClass: "dispatch_carton_evidence",
        file,
        binding: { cartonId: "carton-1" },
        actorUserId: "actor-1",
        provenance: "central_admin_ui",
      },
      file,
    );
    expect(upload).toHaveBeenCalledOnce();
    expect(ref.canonicalRef).toMatch(/^storage:receipts\/dispatch-carton-evidence\/carton-1\//);
    expect(ref.visibility).toBe("private");
  });

  it("fails closed when canonical storage is unavailable", async () => {
    const { supabase } = createStorageMock();
    supabase.storage.from = vi.fn(() => ({
      upload: vi.fn(async () => ({ error: { message: "bucket unavailable" } })),
      remove: vi.fn(),
      getPublicUrl: vi.fn(),
      createSignedUrl: vi.fn(),
    })) as unknown as typeof supabase.storage.from;
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    await expect(
      executeGovernedUpload(
        supabase,
        {
          documentClass: "packing_proof",
          file,
          binding: { orderId: "order-1" },
          actorUserId: "actor-1",
          provenance: "central_admin_ui",
        },
        file,
      ),
    ).rejects.toMatchObject({ code: "storage_unavailable" });
  });

  it("uses public URLs only for public visibility classes", async () => {
    const { supabase, getPublicUrl, createSignedUrl } = createStorageMock();
    const url = await resolveGovernedStorageAccessUrl(supabase, {
      bucket: "product-images",
      storageKey: "catalogue/products/p1/file.png",
      visibility: "public",
    });
    expect(getPublicUrl).toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(url).toBe("https://example.test/public/product.png");
  });

  it("uses signed URLs for private visibility classes", async () => {
    const { supabase, getPublicUrl, createSignedUrl } = createStorageMock();
    const url = await resolveGovernedStorageAccessUrl(supabase, {
      bucket: "receipts",
      storageKey: "packing-proof/order-1/file.jpg",
      visibility: "private",
    });
    expect(createSignedUrl).toHaveBeenCalled();
    expect(getPublicUrl).not.toHaveBeenCalled();
    expect(url).toContain("signed/private.jpg");
  });

  it("deletes governed objects using canonical bucket/key authority", async () => {
    const { supabase, remove } = createStorageMock();
    await deleteGovernedObject(supabase, {
      bucket: "receipts",
      storageKey: "packing-proof/order-1/file.jpg",
    });
    expect(remove).toHaveBeenCalledWith(["packing-proof/order-1/file.jpg"]);
  });

  it("rejects delete on unregistered buckets", async () => {
    const { supabase } = createStorageMock();
    await expect(
      deleteGovernedObject(supabase, {
        bucket: "evil-bucket" as "receipts",
        storageKey: "x.jpg",
      }),
    ).rejects.toBeInstanceOf(DocumentStorageGovernanceError);
  });
});
