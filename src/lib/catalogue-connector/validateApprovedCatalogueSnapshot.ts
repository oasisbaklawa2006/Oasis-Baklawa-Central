import type { ApprovedCatalogueProductSnapshot, CatalogueProductStatus } from "./catalogueConnectorTypes";

export interface CatalogueSnapshotValidationError {
  field: string;
  message: string;
}

export type CatalogueSnapshotValidationSuccess = {
  ok: true;
  snapshot: ApprovedCatalogueProductSnapshot;
};

export type CatalogueSnapshotValidationFailure = {
  ok: false;
  errors: CatalogueSnapshotValidationError[];
};

export type CatalogueSnapshotValidationResult =
  | CatalogueSnapshotValidationSuccess
  | CatalogueSnapshotValidationFailure;

function push(errors: CatalogueSnapshotValidationError[], field: string, message: string) {
  errors.push({ field, message });
}

function asNonEmptyString(value: unknown, field: string, errors: CatalogueSnapshotValidationError[]): string | null {
  if (typeof value !== "string" || !value.trim()) {
    push(errors, field, `${field} is required`);
    return null;
  }
  return value.trim();
}

function parseStatus(value: unknown, errors: CatalogueSnapshotValidationError[]): CatalogueProductStatus | null {
  if (value === "active" || value === "inactive") return value;
  push(errors, "status", 'status must be "active" or "inactive"');
  return null;
}

/** Parse JSON (object or array of one) and validate required approved snapshot fields. */
export function validateApprovedCatalogueSnapshot(raw: unknown): CatalogueSnapshotValidationResult {
  const errors: CatalogueSnapshotValidationError[] = [];

  let record: Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return { ok: false as const, errors: [{ field: "json", message: "Invalid JSON" }] };
    }
  }

  if (Array.isArray(raw)) {
    if (raw.length !== 1) {
      return {
        ok: false as const,
        errors: [{ field: "json", message: "Pilot import accepts one snapshot object or a single-element array" }],
      };
    }
    record = raw[0] as Record<string, unknown>;
  } else if (raw && typeof raw === "object") {
    record = raw as Record<string, unknown>;
  } else {
    return { ok: false as const, errors: [{ field: "json", message: "Expected a JSON object" }] };
  }

  const externalId = asNonEmptyString(record.external_catalogue_product_id, "external_catalogue_product_id", errors);
  const sku = asNonEmptyString(record.sku, "sku", errors);
  const productName = asNonEmptyString(record.product_name, "product_name", errors);
  const category = asNonEmptyString(record.category, "category", errors);
  const hsnCode = asNonEmptyString(record.hsn_code, "hsn_code", errors);
  const status = parseStatus(record.status, errors);

  if (typeof record.version !== "number" || !Number.isFinite(record.version) || record.version < 1) {
    push(errors, "version", "version must be a positive number");
  }
  const updatedAt = asNonEmptyString(record.updated_at, "updated_at", errors);

  if (!Array.isArray(record.approved_image_urls)) {
    push(errors, "approved_image_urls", "approved_image_urls must be an array");
  }

  if (errors.length > 0) {
    return { ok: false as const, errors };
  }

  const approvedImageUrls = (record.approved_image_urls as unknown[])
    .filter((u): u is string => typeof u === "string")
    .map((u) => u.trim())
    .filter(Boolean);

  const snapshot: ApprovedCatalogueProductSnapshot = {
    external_catalogue_product_id: externalId!,
    central_product_id:
      typeof record.central_product_id === "string" && record.central_product_id.trim()
        ? record.central_product_id.trim()
        : null,
    sku: sku!,
    product_name: productName!,
    product_description:
      typeof record.product_description === "string" ? record.product_description.trim() : null,
    approved_image_urls: approvedImageUrls,
    mrp: typeof record.mrp === "number" ? record.mrp : null,
    base_price: typeof record.base_price === "number" ? record.base_price : null,
    pack_size: typeof record.pack_size === "string" ? record.pack_size : null,
    net_weight_grams: typeof record.net_weight_grams === "number" ? record.net_weight_grams : null,
    avg_weight_per_pack: typeof record.avg_weight_per_pack === "number" ? record.avg_weight_per_pack : null,
    category: category!,
    sub_category: typeof record.sub_category === "string" ? record.sub_category : null,
    hsn_code: hsnCode!,
    gst_rate: typeof record.gst_rate === "number" ? record.gst_rate : null,
    uom: typeof record.uom === "string" ? record.uom : null,
    barcode_sku: typeof record.barcode_sku === "string" ? record.barcode_sku : null,
    status: status!,
    version: record.version as number,
    updated_at: updatedAt!,
  };

  return { ok: true as const, snapshot };
}
