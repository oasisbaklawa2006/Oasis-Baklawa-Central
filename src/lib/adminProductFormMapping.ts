import { normalizeProductProductionDepartment } from "@/lib/productProductionDepartments";

/**
 * Product Master form ↔ DB mapping helpers.
 * Preserves null/blank vs zero; avoids coercing empty inputs to 0.
 */

export function numericToFormValue(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return String(value);
}

export function parseOptionalFloat(value: string | null | undefined): number | null {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") return null;
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseOptionalInt(value: string | null | undefined): number | null {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") return null;
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** MoQ defaults to 1 on save when blank; other ints stay null when blank. */
export function parseMoqForSave(value: string | null | undefined): number {
  return parseOptionalInt(value) ?? 1;
}

export function parseGstForSave(value: string | null | undefined): number | null {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") return null;
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export type ProductFormNumericFields = {
  grams_per_piece: string;
  weight_per_box_kg: string;
  primary_pack_weight_kg: string;
  pcs_per_kg: string;
  pcs_per_primary_pack: string;
  packs_per_master_carton: string;
  weight_per_pc_grams: string;
  net_weight_grams: string;
  mrp: string;
  mrp_per_pc: string;
  wholesale_price: string;
  price_per_kg: string;
  gross_weight_kg: string;
  private_label_moq: string;
  private_label_price: string;
  moq: string;
  gst_percentage: string;
};

export function mapProductNumericFieldsFromRow(product: Record<string, unknown>): ProductFormNumericFields {
  return {
    grams_per_piece: numericToFormValue(product.grams_per_piece as number | null | undefined),
    weight_per_box_kg: numericToFormValue(product.weight_per_box_kg as number | null | undefined),
    primary_pack_weight_kg: numericToFormValue(product.primary_pack_weight_kg as number | null | undefined),
    pcs_per_kg: numericToFormValue(product.pcs_per_kg as number | null | undefined),
    pcs_per_primary_pack: numericToFormValue(product.pcs_per_primary_pack as number | null | undefined),
    packs_per_master_carton: numericToFormValue(product.packs_per_master_carton as number | null | undefined),
    weight_per_pc_grams: numericToFormValue(product.weight_per_pc_grams as number | null | undefined),
    net_weight_grams: numericToFormValue(product.net_weight_grams as number | null | undefined),
    mrp: numericToFormValue(product.mrp as number | null | undefined),
    mrp_per_pc: numericToFormValue(product.mrp_per_pc as number | null | undefined),
    wholesale_price: numericToFormValue(product.wholesale_price as number | null | undefined),
    price_per_kg: numericToFormValue(product.price_per_kg as number | null | undefined),
    gross_weight_kg: numericToFormValue(product.gross_weight_kg as number | null | undefined),
    private_label_moq: numericToFormValue(product.private_label_moq as number | null | undefined),
    private_label_price: numericToFormValue(product.private_label_price as number | null | undefined),
    moq: numericToFormValue(product.moq as number | null | undefined) || "1",
    gst_percentage: numericToFormValue(product.gst_percentage as number | null | undefined) || "18",
  };
}

export function mapNumericFieldsToPayload(formData: Record<string, unknown>): Record<string, number | null> {
  return {
    price_per_kg: parseOptionalFloat(formData.price_per_kg as string),
    mrp: parseOptionalFloat(formData.mrp as string),
    mrp_per_pc: parseOptionalFloat(formData.mrp_per_pc as string),
    wholesale_price: parseOptionalFloat(formData.wholesale_price as string),
    weight_per_pc_grams: parseOptionalFloat(formData.weight_per_pc_grams as string),
    net_weight_grams: parseOptionalFloat(formData.net_weight_grams as string),
    moq: parseMoqForSave(formData.moq as string),
    packs_per_master_carton: parseOptionalInt(formData.packs_per_master_carton as string),
    gst_percentage: parseGstForSave(formData.gst_percentage as string),
    private_label_moq: parseOptionalInt(formData.private_label_moq as string),
    private_label_price: parseOptionalFloat(formData.private_label_price as string),
    gross_weight_kg: parseOptionalFloat(formData.gross_weight_kg as string),
    grams_per_piece: parseOptionalFloat(formData.grams_per_piece as string),
    weight_per_box_kg: parseOptionalFloat(formData.weight_per_box_kg as string),
    primary_pack_weight_kg: parseOptionalFloat(formData.primary_pack_weight_kg as string),
    pcs_per_kg: parseOptionalFloat(formData.pcs_per_kg as string),
    pcs_per_primary_pack: parseOptionalFloat(formData.pcs_per_primary_pack as string),
  };
}

export function buildAdminProductFormFromRow(
  product: Record<string, unknown>,
  options: { defaultCategory: string },
): Record<string, unknown> {
  const numeric = mapProductNumericFieldsFromRow(product);
  const aliases = Array.isArray(product.aliases) ? (product.aliases as string[]).join(", ") : "";

  return {
    name: (product.name as string) || "",
    sku: (product.sku as string) || "",
    category: (product.category as string) || options.defaultCategory,
    sub_category: (product.sub_category as string) || "",
    department: (product.department as string) || "",
    production_department: normalizeProductProductionDepartment(product.production_department as string) ?? "",
    pack_size: (product.pack_size as string) || "",
    carton_type: (product.carton_type as string) || "",
    storage_type: (product.storage_type as string) || "ambient",
    description: (product.description as string) || "",
    shelf_life: (product.shelf_life as string) || "",
    image_url: (product.image_url as string) || "",
    is_active: product.is_active ?? true,
    visible_in_catalog: product.visible_in_catalog ?? true,
    hsn_code: (product.hsn_code as string) || "19059090",
    dietary_tags: (product.dietary_tags as string[]) || ["100% Eggless"],
    uom: (product.uom as string) || "Kg",
    settlement_unit: (product.settlement_unit as string) || "KG",
    nutrition_facts: (product.nutrition_facts as string) || "",
    allergen_warnings: (product.allergen_warnings as string) || "",
    ingredients: (product.ingredients as string) || "",
    has_bom: false,
    enable_variants: false,
    product_family: (product.product_family as string) || "bulk_sweets",
    dimensions: (product.dimensions as string) || "",
    material: (product.material as string) || "",
    bom_summary: (product.bom_summary as string) || "",
    aliases,
    ...numeric,
  };
}
