import type { OperationalPhotoInput } from "./operationalMediaTypes";

export function validateOperationalPhotoInput(input: OperationalPhotoInput): string[] {
  const errors: string[] = [];
  if (!input.imageReference?.trim()) errors.push("image_reference_required");
  if (!input.queueItemId?.trim()) errors.push("queue_item_id_required");
  if (!input.actorUserId?.trim()) errors.push("actor_required");
  if (!input.department?.trim()) errors.push("department_required");
  if (input.imageReference?.startsWith("http") && input.imageReference.includes("public")) {
    errors.push("public_url_forbidden");
  }
  return errors;
}
