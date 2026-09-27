import type {
  ExceptionCanonicalBinding,
  ExceptionCategory,
  ExceptionDeclarationInput,
  ExceptionGovernanceWriteContext,
  ExceptionQuantityImpact,
  ExceptionReleaseInput,
} from "./exceptionGovernanceTypes";
import { ExceptionGovernanceError } from "./exceptionGovernanceTypes";

function requirePositiveQty(value: number | null | undefined, label: string): void {
  if (value === null || value === undefined) return;
  if (!Number.isFinite(value) || value < 0) {
    throw new ExceptionGovernanceError("validation_failed", `${label} must be a non-negative finite number`);
  }
}

function requireBindingField(
  binding: ExceptionCanonicalBinding,
  field: keyof ExceptionCanonicalBinding,
  label: string,
): void {
  const value = binding[field];
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
    throw new ExceptionGovernanceError("validation_failed", `${label} binding is required`);
  }
}

export function validateQuantityIntegrity(quantities: ExceptionQuantityImpact): void {
  requirePositiveQty(quantities.expectedQty, "expectedQty");
  requirePositiveQty(quantities.actualQty, "actualQty");
  requirePositiveQty(quantities.rejectedQty, "rejectedQty");
  requirePositiveQty(quantities.wastedQty, "wastedQty");
  requirePositiveQty(quantities.holdQty, "holdQty");
  requirePositiveQty(quantities.shortageQty, "shortageQty");

  const produced = (quantities.actualQty ?? 0) + (quantities.wastedQty ?? 0) + (quantities.rejectedQty ?? 0);
  const hold = quantities.holdQty ?? 0;
  const expected = quantities.expectedQty;

  if (expected !== null && expected !== undefined && produced + hold > expected * 1.1) {
    throw new ExceptionGovernanceError(
      "validation_failed",
      "Quantity impact exceeds expected tolerance (>10%)",
    );
  }
}

export function validateCanonicalBinding(category: ExceptionCategory, binding: ExceptionCanonicalBinding): void {
  switch (category) {
    case "wastage":
      if (binding.subsystem === "PRODUCTION") requireBindingField(binding, "jobId", "jobId");
      if (binding.subsystem === "ASSEMBLY") requireBindingField(binding, "componentId", "componentId");
      break;
    case "rejection":
      if (binding.subsystem === "PRODUCTION") requireBindingField(binding, "jobId", "jobId");
      if (binding.subsystem === "RGS") requireBindingField(binding, "transferId", "transferId");
      if (binding.subsystem === "ASSEMBLY") requireBindingField(binding, "assemblyJobId", "assemblyJobId");
      break;
    case "shortage":
      requireBindingField(binding, "reservationId", "reservationId");
      requireBindingField(binding, "department", "department");
      break;
    case "blocker":
      requireBindingField(binding, "jobId", "jobId");
      requireBindingField(binding, "department", "department");
      break;
    case "quality_hold":
      if (binding.subsystem === "RGS") requireBindingField(binding, "transferId", "transferId");
      if (binding.subsystem === "3PGS") {
        requireBindingField(binding, "productId", "productId");
        requireBindingField(binding, "sku", "sku");
      }
      break;
    default:
      break;
  }
}

export function validateDepartmentIsolation(
  actorDepartment: string | null | undefined,
  bindingDepartment: string | null | undefined,
  actorRole: string,
): void {
  const role = actorRole.trim().toUpperCase();
  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "OPERATIONS_MANAGER") return;
  if (!actorDepartment?.trim() || !bindingDepartment?.trim()) return;
  if (actorDepartment.trim().toUpperCase() !== bindingDepartment.trim().toUpperCase()) {
    throw new ExceptionGovernanceError(
      "department_isolation",
      `Actor department ${actorDepartment} cannot act on ${bindingDepartment} exceptions`,
    );
  }
}

export function validateDeclarationInput(
  input: ExceptionDeclarationInput,
  ctx: ExceptionGovernanceWriteContext,
): void {
  if (!ctx.reason.trim()) {
    throw new ExceptionGovernanceError("validation_failed", "Reason is required");
  }
  if (!ctx.correlationId.trim()) {
    throw new ExceptionGovernanceError("validation_failed", "correlationId is required for idempotency");
  }
  validateCanonicalBinding(input.category, input.binding);
  if (input.quantities) validateQuantityIntegrity(input.quantities);
  validateDepartmentIsolation(ctx.actorDepartment, input.binding.department ?? null, ctx.actorRole);
}

export function validateReleaseInput(input: ExceptionReleaseInput, ctx: ExceptionGovernanceWriteContext): void {
  if (!ctx.reason.trim()) {
    throw new ExceptionGovernanceError("validation_failed", "Release reason is required");
  }
  if (!input.resolutionNotes.trim()) {
    throw new ExceptionGovernanceError("validation_failed", "Resolution notes are required");
  }
  if (!ctx.releaseAuthorizerRole?.trim()) {
    throw new ExceptionGovernanceError("validation_failed", "Independent release authorizer is required");
  }
  if (!ctx.correlationId.trim()) {
    throw new ExceptionGovernanceError("validation_failed", "correlationId is required for idempotent release");
  }
  validateCanonicalBinding(input.category, input.binding);
  if (input.quantities) validateQuantityIntegrity(input.quantities);
  validateDepartmentIsolation(ctx.actorDepartment, input.binding.department ?? null, ctx.actorRole);
}
