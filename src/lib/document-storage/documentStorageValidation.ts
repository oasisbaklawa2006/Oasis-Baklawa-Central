import { MIME_TO_EXTENSION, policyForDocumentClass } from "./documentStoragePolicy";
import {
  DocumentStorageGovernanceError,
  type DocumentStorageBucket,
  type GovernedStorageBinding,
  type GovernedUploadRequest,
} from "./documentStorageTypes";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertNonEmptyIdentity(value: string | null | undefined, label: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    throw new DocumentStorageGovernanceError("unresolved_identity", `${label} is required`);
  }
  return trimmed;
}

export function assertSafeStorageKeySegment(segment: string, label: string): string {
  const trimmed = segment.trim();
  if (!trimmed || trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) {
    throw new DocumentStorageGovernanceError("unsafe_path", `${label} contains unsafe path characters`);
  }
  if (trimmed.includes("\0")) {
    throw new DocumentStorageGovernanceError("unsafe_path", `${label} contains null bytes`);
  }
  return trimmed;
}

export function assertSafeStorageKey(storageKey: string): void {
  if (!storageKey || storageKey.startsWith("/") || storageKey.includes("..")) {
    throw new DocumentStorageGovernanceError("unsafe_path", "Storage key is unsafe");
  }
  if (storageKey.includes("\\") || storageKey.includes("\0")) {
    throw new DocumentStorageGovernanceError("unsafe_path", "Storage key is unsafe");
  }
}

export function assertRegisteredBucket(bucket: string): DocumentStorageBucket {
  if (bucket === "receipts" || bucket === "product-images" || bucket === "final-invoices" || bucket === "whatsapp_attachments") {
    return bucket;
  }
  throw new DocumentStorageGovernanceError("unauthorized_bucket", `Bucket ${bucket} is not governed`);
}

export function assertBindingSatisfied(binding: GovernedStorageBinding, required: readonly string[]): void {
  for (const key of required) {
    const value = binding[key as keyof GovernedStorageBinding];
    assertNonEmptyIdentity(typeof value === "string" ? value : null, key);
  }
}

export function assertMimeAllowed(contentType: string, allowed: readonly string[]): string {
  const normalized = contentType.trim().toLowerCase();
  if (!normalized || !allowed.includes(normalized)) {
    throw new DocumentStorageGovernanceError(
      "unsafe_mime",
      `MIME type ${contentType || "(missing)"} is not allowed`,
    );
  }
  return normalized;
}

export function assertSizeAllowed(byteSize: number, maxBytes: number): void {
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    throw new DocumentStorageGovernanceError("unsafe_size", "File size must be greater than zero");
  }
  if (byteSize > maxBytes) {
    throw new DocumentStorageGovernanceError("unsafe_size", `File exceeds maximum size of ${maxBytes} bytes`);
  }
}

export function extensionForMime(contentType: string): string {
  const ext = MIME_TO_EXTENSION[contentType];
  if (!ext) {
    throw new DocumentStorageGovernanceError("unsafe_mime", `No extension mapping for ${contentType}`);
  }
  return ext;
}

export function assertNoDemoFallback(storageMode: string | null | undefined): void {
  const normalized = (storageMode ?? "").trim().toLowerCase();
  if (normalized === "demo" || normalized === "local" || normalized === "mock") {
    throw new DocumentStorageGovernanceError("demo_fallback_forbidden", "Demo or local storage fallback is forbidden");
  }
}

export function assertCrossCompanyAccess(
  actorCompanyId: string | null | undefined,
  targetCompanyId: string | null | undefined,
): void {
  const actor = typeof actorCompanyId === "string" ? actorCompanyId.trim() : "";
  const target = typeof targetCompanyId === "string" ? targetCompanyId.trim() : "";
  if (actor && target && actor !== target) {
    throw new DocumentStorageGovernanceError(
      "cross_company_access",
      "Cross-company storage access is forbidden",
    );
  }
}

export function buildDeterministicStorageKey(input: {
  pathPrefix: string;
  binding: GovernedStorageBinding;
  contentType: string;
  documentClass: GovernedUploadRequest["documentClass"];
}): string {
  const policy = policyForDocumentClass(input.documentClass);
  const ext = extensionForMime(input.contentType);
  const nonce = createSecureNonce();

  if (input.documentClass === "packing_proof") {
    const orderId = assertSafeStorageKeySegment(assertNonEmptyIdentity(input.binding.orderId, "orderId"), "orderId");
    return `${policy.pathPrefix}/${orderId}/${Date.now()}-${nonce}.${ext}`;
  }

  if (input.documentClass === "dispatch_carton_evidence") {
    const cartonId = assertSafeStorageKeySegment(assertNonEmptyIdentity(input.binding.cartonId, "cartonId"), "cartonId");
    return `${policy.pathPrefix}/${cartonId}/${Date.now()}-${nonce}.${ext}`;
  }

  if (input.documentClass === "product_image") {
    const productSegment = input.binding.productId
      ? assertSafeStorageKeySegment(input.binding.productId, "productId")
      : "intake";
    return `${policy.pathPrefix}/${productSegment}/${Date.now()}-${nonce}.${ext}`;
  }

  throw new DocumentStorageGovernanceError(
    "unresolved_identity",
    `No deterministic key builder for ${input.documentClass}`,
  );
}

export function planGovernedUpload(request: GovernedUploadRequest): import("./documentStorageTypes").GovernedUploadPlan {
  assertNoDemoFallback(process.env.VITE_DOCUMENT_STORAGE_MODE);
  const policy = policyForDocumentClass(request.documentClass);

  if (!policy.centralUploadAllowed) {
    throw new DocumentStorageGovernanceError(
      "unauthorized_bucket",
      `${request.documentClass} uploads are not owned by Central`,
    );
  }

  const actorUserId = assertNonEmptyIdentity(request.actorUserId, "actorUserId");
  assertBindingSatisfied(request.binding, policy.requiredBindings);

  const contentType = assertMimeAllowed(request.file.type, policy.allowedMimeTypes);
  assertSizeAllowed(request.file.size, policy.maxBytes);

  const storageKey = buildDeterministicStorageKey({
    pathPrefix: policy.pathPrefix,
    binding: request.binding,
    contentType,
    documentClass: request.documentClass,
  });
  assertSafeStorageKey(storageKey);

  return {
    bucket: policy.bucket,
    storageKey,
    contentType,
    visibility: policy.visibility,
    documentClass: request.documentClass,
    binding: request.binding,
    actorUserId,
    provenance: request.provenance,
  };
}

export function parseCanonicalStorageRef(value: string | null | undefined): {
  bucket: DocumentStorageBucket;
  storageKey: string;
} {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed.startsWith("storage:")) {
    throw new DocumentStorageGovernanceError("invalid_reference", "Reference must use storage: prefix");
  }
  const remainder = trimmed.slice("storage:".length);
  const slashIndex = remainder.indexOf("/");
  if (slashIndex <= 0) {
    throw new DocumentStorageGovernanceError("invalid_reference", "Reference must include bucket and key");
  }
  const bucket = assertRegisteredBucket(remainder.slice(0, slashIndex));
  const storageKey = remainder.slice(slashIndex + 1);
  assertSafeStorageKey(storageKey);
  return { bucket, storageKey };
}

export function isCanonicalStorageRef(value: string | null | undefined): boolean {
  try {
    parseCanonicalStorageRef(value);
    return true;
  } catch {
    return false;
  }
}

export function isUuidLike(value: string): boolean {
  return UUID_RE.test(value);
}

function createSecureNonce(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  throw new DocumentStorageGovernanceError("storage_unavailable", "Secure random is unavailable");
}
