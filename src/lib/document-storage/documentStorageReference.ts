import type { GovernedStorageReference, GovernedUploadPlan } from "./documentStorageTypes";
import { policyForDocumentClass } from "./documentStoragePolicy";
import { parseCanonicalStorageRef } from "./documentStorageValidation";

export function toCanonicalStorageRef(bucket: string, storageKey: string): string {
  return `storage:${bucket}/${storageKey}`;
}

export function toGovernedStorageReference(plan: GovernedUploadPlan, file: Pick<File, "size">): GovernedStorageReference {
  const policy = policyForDocumentClass(plan.documentClass);
  return {
    bucket: plan.bucket,
    storageKey: plan.storageKey,
    canonicalRef: toCanonicalStorageRef(plan.bucket, plan.storageKey),
    documentClass: plan.documentClass,
    visibility: plan.visibility,
    contentType: plan.contentType,
    byteSize: file.size,
    binding: plan.binding,
    actorUserId: plan.actorUserId,
    provenance: plan.provenance,
    capturedAt: new Date().toISOString(),
  };
}

export function legacyUrlToCanonicalRef(url: string | null | undefined): string | null {
  const trimmed = typeof url === "string" ? url.trim() : "";
  if (!trimmed) return null;
  if (trimmed.startsWith("storage:")) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const marker = "/storage/v1/object/";
    const publicMarker = `${marker}public/`;
    const privateMarker = `${marker}sign/`;
    const authMarker = `${marker}authenticated/`;

    let remainder: string | null = null;
    if (parsed.pathname.includes(publicMarker)) {
      remainder = parsed.pathname.split(publicMarker)[1] ?? null;
    } else if (parsed.pathname.includes(privateMarker)) {
      remainder = parsed.pathname.split(privateMarker)[1] ?? null;
    } else if (parsed.pathname.includes(authMarker)) {
      remainder = parsed.pathname.split(authMarker)[1] ?? null;
    }

    if (!remainder) return null;
    const decoded = decodeURIComponent(remainder);
    const slashIndex = decoded.indexOf("/");
    if (slashIndex <= 0) return null;
    const bucket = decoded.slice(0, slashIndex);
    const storageKey = decoded.slice(slashIndex + 1);
    return toCanonicalStorageRef(bucket, storageKey);
  } catch {
    return null;
  }
}

export function resolveReferenceForPersistence(
  canonicalRef: string,
  legacyUrl?: string | null,
): string {
  if (canonicalRef.startsWith("storage:")) return canonicalRef;
  const migrated = legacyUrlToCanonicalRef(legacyUrl);
  return migrated ?? canonicalRef;
}

export function describeGovernedReference(ref: GovernedStorageReference): Record<string, unknown> {
  return {
    canonicalRef: ref.canonicalRef,
    documentClass: ref.documentClass,
    visibility: ref.visibility,
    contentType: ref.contentType,
    byteSize: ref.byteSize,
    binding: ref.binding,
    actorUserId: ref.actorUserId,
    provenance: ref.provenance,
    capturedAt: ref.capturedAt,
  };
}

export function parsePersistedStorageReference(value: string | null | undefined): {
  bucket: string;
  storageKey: string;
  canonicalRef: string;
} {
  const migrated = typeof value === "string" && value.startsWith("storage:")
    ? value
    : legacyUrlToCanonicalRef(value);
  if (!migrated) {
    throw new Error("INVALID_STORAGE_REFERENCE");
  }
  const parsed = parseCanonicalStorageRef(migrated);
  return { ...parsed, canonicalRef: migrated };
}
