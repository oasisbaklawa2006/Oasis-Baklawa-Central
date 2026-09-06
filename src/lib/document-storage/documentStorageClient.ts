import type { SupabaseClient } from "@supabase/supabase-js";
import { SIGNED_URL_TTL_SECONDS } from "./documentStoragePolicy";
import {
  DocumentStorageGovernanceError,
  type GovernedStorageReference,
  type GovernedUploadPlan,
} from "./documentStorageTypes";
import { toGovernedStorageReference, parsePersistedStorageReference } from "./documentStorageReference";
import { assertRegisteredBucket, assertSafeStorageKey, planGovernedUpload } from "./documentStorageValidation";
import type { GovernedUploadRequest } from "./documentStorageTypes";

type StorageClient = Pick<SupabaseClient["storage"], "from">;

export async function executeGovernedUpload(
  supabase: { storage: StorageClient },
  request: GovernedUploadRequest,
  file: File,
): Promise<GovernedStorageReference> {
  const plan = planGovernedUpload(request);
  const { error } = await supabase.storage.from(plan.bucket).upload(plan.storageKey, file, {
    contentType: plan.contentType,
    upsert: false,
  });
  if (error) {
    throw new DocumentStorageGovernanceError(
      "storage_unavailable",
      error.message || "Governed upload failed",
    );
  }
  return toGovernedStorageReference(plan, file);
}

export async function deleteGovernedObject(
  supabase: { storage: StorageClient },
  ref: Pick<GovernedStorageReference, "bucket" | "storageKey">,
): Promise<void> {
  assertRegisteredBucket(ref.bucket);
  assertSafeStorageKey(ref.storageKey);
  const { error } = await supabase.storage.from(ref.bucket).remove([ref.storageKey]);
  if (error) {
    throw new DocumentStorageGovernanceError(
      "storage_unavailable",
      error.message || "Governed delete failed",
    );
  }
}

export async function resolveGovernedStorageAccessUrl(
  supabase: { storage: StorageClient },
  input: {
    bucket: string;
    storageKey: string;
    visibility: GovernedStorageReference["visibility"] | "public" | "private" | "protected";
  },
): Promise<string> {
  const bucket = assertRegisteredBucket(input.bucket);
  assertSafeStorageKey(input.storageKey);

  if (input.visibility === "public") {
    const { data } = supabase.storage.from(bucket).getPublicUrl(input.storageKey);
    if (!data.publicUrl) {
      throw new DocumentStorageGovernanceError("storage_unavailable", "Public URL resolution failed");
    }
    return data.publicUrl;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(input.storageKey, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new DocumentStorageGovernanceError(
      "signed_url_failed",
      error?.message || "Signed URL resolution failed",
    );
  }
  return data.signedUrl;
}

export async function resolveGovernedReferenceAccessUrl(
  supabase: { storage: StorageClient },
  ref: GovernedStorageReference,
): Promise<string> {
  return resolveGovernedStorageAccessUrl(supabase, {
    bucket: ref.bucket,
    storageKey: ref.storageKey,
    visibility: ref.visibility,
  });
}

export async function resolvePersistedReferenceAccessUrl(
  supabase: { storage: StorageClient },
  persistedRef: string,
  visibility: GovernedStorageReference["visibility"] = "private",
): Promise<string> {
  const parsed = parsePersistedStorageReference(persistedRef);
  return resolveGovernedStorageAccessUrl(supabase, {
    bucket: parsed.bucket,
    storageKey: parsed.storageKey,
    visibility,
  });
}

export function buildGovernedUploadPlan(request: GovernedUploadRequest): GovernedUploadPlan {
  return planGovernedUpload(request);
}
