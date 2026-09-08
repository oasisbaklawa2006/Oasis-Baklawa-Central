import type { ComplianceException, EanRegistryEntry } from "./managementReportingTypes";

export interface ProductComplianceRow {
  id: string;
  name: string;
  sku: string | null;
  barcode_sku: string | null;
  hsn_code: string | null;
  gst_percentage: number | null;
  allergen_warnings: string | null;
  ingredients: string | null;
  nutrition_facts: unknown;
  is_active: boolean | null;
}

export interface CompanyComplianceRow {
  id: string;
  business_name: string | null;
  fssai_number: string | null;
  gst_number: string | null;
}

const REQUIRED_PRODUCT_FIELDS: Array<{
  key: keyof ProductComplianceRow;
  label: string;
  category: ComplianceException["category"];
}> = [
  { key: "barcode_sku", label: "EAN/GTIN (barcode_sku)", category: "ean" },
  { key: "hsn_code", label: "HSN code", category: "hsn_gst" },
  { key: "gst_percentage", label: "GST rate", category: "hsn_gst" },
  { key: "allergen_warnings", label: "Allergen warnings", category: "label" },
  { key: "ingredients", label: "Ingredients list", category: "label" },
];

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

function hasNutritionFacts(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0 && value.trim() !== "{}";
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return false;
}

export function normalizeEan(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length < 8) return null;
  return cleaned;
}

export function buildEanDuplicateIndex(
  products: ProductComplianceRow[],
): Map<string, string[]> {
  const byEan = new Map<string, string[]>();
  for (const p of products) {
    const ean = normalizeEan(p.barcode_sku);
    if (!ean) continue;
    const list = byEan.get(ean) ?? [];
    list.push(p.id);
    byEan.set(ean, list);
  }
  return byEan;
}

export function buildEanRegistryEntries(
  products: ProductComplianceRow[],
  limit = 100,
  offset = 0,
  searchQuery = "",
): { entries: EanRegistryEntry[]; total: number } {
  const duplicateIndex = buildEanDuplicateIndex(products);
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filtered = products.filter((p) => {
    if (!normalizedSearch) return true;
    const ean = normalizeEan(p.barcode_sku) ?? "";
    const digitsQuery = normalizedSearch.replace(/\D/g, "");
    return (
      p.name.toLowerCase().includes(normalizedSearch) ||
      (p.sku ?? "").toLowerCase().includes(normalizedSearch) ||
      (digitsQuery.length > 0 && ean.includes(digitsQuery))
    );
  });

  const entries: EanRegistryEntry[] = filtered.slice(offset, offset + limit).map((p) => {
    const ean = normalizeEan(p.barcode_sku);
    const duplicateOfProductIds = ean
      ? (duplicateIndex.get(ean) ?? []).filter((id) => id !== p.id)
      : [];
    const missingFields: string[] = [];
    for (const field of REQUIRED_PRODUCT_FIELDS) {
      if (isBlank(p[field.key])) missingFields.push(field.label);
    }
    if (!hasNutritionFacts(p.nutrition_facts)) {
      missingFields.push("Nutrition facts (FSSAI)");
    }
    const totalChecks = REQUIRED_PRODUCT_FIELDS.length + 1;
    const complianceScore = Math.round(
      ((totalChecks - missingFields.length) / totalChecks) * 100,
    );

    return {
      productId: p.id,
      productName: p.name,
      ean,
      sku: p.sku,
      isDuplicate: duplicateOfProductIds.length > 0,
      duplicateOfProductIds,
      complianceScore,
      missingFields,
      drillRoute: `/admin/products?highlight=${encodeURIComponent(p.id)}`,
    };
  });

  return { entries, total: filtered.length };
}

export function buildComplianceExceptions(input: {
  products: ProductComplianceRow[];
  companies: CompanyComplianceRow[];
}): ComplianceException[] {
  const exceptions: ComplianceException[] = [];
  const duplicateIndex = buildEanDuplicateIndex(input.products);

  for (const p of input.products) {
    if (p.is_active === false) continue;
    const ean = normalizeEan(p.barcode_sku);
    if (!ean) {
      exceptions.push({
        id: `product:${p.id}:ean_missing`,
        entityType: "product",
        entityId: p.id,
        entityLabel: p.name,
        category: "ean",
        severity: "critical",
        message: "Missing or invalid EAN/GTIN (barcode_sku)",
        drillRoute: `/admin/products?highlight=${encodeURIComponent(p.id)}`,
      });
    } else {
      const dupes = (duplicateIndex.get(ean) ?? []).filter((id) => id !== p.id);
      if (dupes.length > 0) {
        exceptions.push({
          id: `product:${p.id}:ean_duplicate`,
          entityType: "product",
          entityId: p.id,
          entityLabel: p.name,
          category: "ean",
          severity: "high",
          message: `Duplicate EAN ${ean} shared with ${dupes.length} other product(s)`,
          drillRoute: `/admin/products?highlight=${encodeURIComponent(p.id)}`,
        });
      }
    }

    if (isBlank(p.hsn_code) || p.gst_percentage === null) {
      exceptions.push({
        id: `product:${p.id}:hsn_gst`,
        entityType: "product",
        entityId: p.id,
        entityLabel: p.name,
        category: "hsn_gst",
        severity: "high",
        message: "Missing HSN code or GST rate",
        drillRoute: `/admin/products?highlight=${encodeURIComponent(p.id)}`,
      });
    }

    if (isBlank(p.allergen_warnings) || isBlank(p.ingredients)) {
      exceptions.push({
        id: `product:${p.id}:label`,
        entityType: "product",
        entityId: p.id,
        entityLabel: p.name,
        category: "label",
        severity: "medium",
        message: "Missing allergen warnings or ingredients for legal label readiness",
        drillRoute: `/admin/label-command-center`,
      });
    }

    if (!hasNutritionFacts(p.nutrition_facts)) {
      exceptions.push({
        id: `product:${p.id}:nutrition`,
        entityType: "product",
        entityId: p.id,
        entityLabel: p.name,
        category: "nutrition",
        severity: "medium",
        message: "Missing FSSAI nutrition facts",
        drillRoute: `/admin/products?highlight=${encodeURIComponent(p.id)}`,
      });
    }
  }

  for (const c of input.companies) {
    if (isBlank(c.fssai_number)) {
      exceptions.push({
        id: `company:${c.id}:fssai`,
        entityType: "company",
        entityId: c.id,
        entityLabel: c.business_name ?? c.id.slice(0, 8),
        category: "fssai",
        severity: "high",
        message: "Company FSSAI registration number missing",
        drillRoute: `/admin/clients/${encodeURIComponent(c.id)}`,
      });
    }
    if (isBlank(c.gst_number)) {
      exceptions.push({
        id: `company:${c.id}:gst`,
        entityType: "company",
        entityId: c.id,
        entityLabel: c.business_name ?? c.id.slice(0, 8),
        category: "hsn_gst",
        severity: "high",
        message: "Company GST number missing",
        drillRoute: `/admin/clients/${encodeURIComponent(c.id)}`,
      });
    }
  }

  const severityOrder = { critical: 0, high: 1, medium: 2 };
  return exceptions.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );
}
