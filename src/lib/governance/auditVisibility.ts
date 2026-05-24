/**
 * Audit visibility semantics — documentation-only helpers.
 */

export const AUDIT_VISIBILITY_PRINCIPLES = [
  "Overrides append audit rows; never rewrite original movement rows.",
  "Customer-visible surfaces must never show raw governance payloads.",
  "CMD sees aggregates and policy state only until fine-grained ACL ships.",
] as const;
