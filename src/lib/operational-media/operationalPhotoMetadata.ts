import type { OperationalPhotoInput, OperationalPhotoMetadata } from "./operationalMediaTypes";
import { validateOperationalPhotoInput } from "./operationalPhotoValidation";

export function buildOperationalPhotoMetadata(input: OperationalPhotoInput): OperationalPhotoMetadata {
  const errors = validateOperationalPhotoInput(input);
  if (errors.length) {
    throw new Error(`Invalid operational photo metadata: ${errors.join(", ")}`);
  }
  return {
    imageReference: input.imageReference.trim(),
    caption: input.caption?.trim() ?? null,
    queueItemId: input.queueItemId,
    scanCorrelationId: input.scanCorrelationId ?? null,
    department: input.department,
    actorUserId: input.actorUserId,
    capturedAt: new Date().toISOString(),
    verificationRelation: input.verificationRelation ?? "queue_note",
  };
}

export function photoMetadataForEvent(meta: OperationalPhotoMetadata): Record<string, unknown> {
  return {
    operationalPhoto: meta,
    photoEvidenceUrl: meta.imageReference,
    department: meta.department,
    verificationRelation: meta.verificationRelation,
  };
}

export function formatPhotoNoteLine(meta: OperationalPhotoMetadata): string {
  return meta.caption
    ? `Photo attached: ${meta.caption}`
    : `Photo reference: ${meta.imageReference.slice(0, 64)}`;
}
