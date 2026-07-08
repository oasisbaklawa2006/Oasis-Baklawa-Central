/**
 * Deterministic, template-based catalogue content draft generation for Catalogue Builder.
 * Pure function of existing selected-product fields — no external AI call, no network I/O,
 * no product mutation. Output is a first-pass draft only; operators edit and copy it manually.
 */

export const DRAFT_BLOCK_KEYS = [
  "catalogue_title",
  "short_description",
  "long_description",
  "b2b_sales_copy",
  "export_catalogue_copy",
  "whatsapp_message",
  "hindi_description",
  "storage_shelf_life_copy",
] as const;

export type DraftBlockKey = (typeof DRAFT_BLOCK_KEYS)[number];

export interface DraftBlockMeta {
  key: DraftBlockKey;
  label: string;
  hint: string;
}

export const DRAFT_BLOCK_META: DraftBlockMeta[] = [
  { key: "catalogue_title", label: "Catalogue title", hint: "Short buyer-facing title for listings." },
  { key: "short_description", label: "Short description", hint: "One-line summary for cards/search results." },
  { key: "long_description", label: "Long description", hint: "Fuller catalogue detail copy." },
  { key: "b2b_sales_copy", label: "B2B sales copy", hint: "Wholesale-facing pitch with pricing/MOQ context." },
  { key: "export_catalogue_copy", label: "Export catalogue copy", hint: "HSN/GST/weight-oriented copy for export documentation." },
  { key: "whatsapp_message", label: "WhatsApp product message", hint: "Short message an operator could send to a buyer." },
  { key: "hindi_description", label: "Hindi product description", hint: "Simple Hindi/Hinglish business copy — not a certified translation." },
  { key: "storage_shelf_life_copy", label: "Storage / shelf-life copy", hint: "Handling and shelf-life note." },
];

export type DraftBlocks = Record<DraftBlockKey, string>;

export interface DraftProductInput {
  name?: string | null;
  sku?: string | null;
  category?: string | null;
  sub_category?: string | null;
  description?: string | null;
  uom?: string | null;
  settlement_unit?: string | null;
  mrp?: number | null;
  wholesale_price?: number | null;
  pack_size?: string | null;
  net_weight_grams?: number | null;
  weight_per_pc_grams?: number | null;
  moq?: number | null;
  dietary_tags?: string[] | null;
  allergen_warnings?: string | null;
  ingredients?: string | null;
  shelf_life?: string | null;
  storage_type?: string | null;
  hsn_code?: string | null;
  gst_percentage?: number | null;
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function hasNumber(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

const MISSING_FIELD = (field: string) => `Add missing field first: ${field}.`;

function catalogueTitle(p: DraftProductInput): string {
  if (!hasText(p.name)) return MISSING_FIELD("Product Name");
  const packSuffix = hasText(p.pack_size) ? ` (${p.pack_size})` : "";
  return `${p.name}${packSuffix}`;
}

function shortDescription(p: DraftProductInput): string {
  if (!hasText(p.name)) return MISSING_FIELD("Product Name");
  const category = hasText(p.category) ? p.category : "product";
  const unit = hasText(p.uom) ? p.uom : "unit";
  if (hasText(p.description)) {
    const firstSentence = p.description!.split(/(?<=[.!?])\s/)[0].trim();
    return firstSentence || `${p.name} — ${category}, sold by ${unit}.`;
  }
  return `${p.name} — ${category}, sold by ${unit}. Add a product description for richer catalogue copy.`;
}

function longDescription(p: DraftProductInput): string {
  if (!hasText(p.name)) return MISSING_FIELD("Product Name");
  const lines: string[] = [];
  lines.push(hasText(p.description) ? p.description!.trim() : `${p.name} is listed under ${hasText(p.category) ? p.category : "the catalogue"}. Add a product description for full detail copy.`);
  if (hasText(p.pack_size) || hasNumber(p.net_weight_grams)) {
    const weightPart = hasNumber(p.net_weight_grams) ? `${p.net_weight_grams}g` : "";
    const packPart = hasText(p.pack_size) ? p.pack_size! : "";
    lines.push(`Pack: ${[packPart, weightPart].filter(Boolean).join(" · ") || "not set"}.`);
  }
  if (p.dietary_tags && p.dietary_tags.length > 0) {
    lines.push(`Dietary: ${p.dietary_tags.join(", ")}.`);
  }
  if (hasText(p.allergen_warnings)) {
    lines.push(`Allergen note: ${p.allergen_warnings}.`);
  }
  return lines.join("\n");
}

function b2bSalesCopy(p: DraftProductInput): string {
  if (!hasText(p.name)) return MISSING_FIELD("Product Name");
  if (!hasNumber(p.wholesale_price)) {
    return `${p.name} is available for wholesale. ${MISSING_FIELD("B2B Base price")}`;
  }
  const moqPart = hasNumber(p.moq) ? ` MOQ: ${p.moq} pack(s).` : " Add MOQ for a complete pitch.";
  const uomPart = hasText(p.uom) ? `/${p.uom}` : "";
  return `${p.name} — B2B base ₹${p.wholesale_price}${uomPart}.${moqPart}`;
}

function exportCatalogueCopy(p: DraftProductInput): string {
  if (!hasText(p.name)) return MISSING_FIELD("Product Name");
  const parts: string[] = [p.name!];
  parts.push(hasText(p.hsn_code) ? `HSN ${p.hsn_code}` : MISSING_FIELD("HSN Code"));
  parts.push(typeof p.gst_percentage === "number" ? `GST ${p.gst_percentage}%` : MISSING_FIELD("GST Rate"));
  if (hasNumber(p.net_weight_grams)) parts.push(`Net wt ${p.net_weight_grams}g`);
  return parts.join(" · ");
}

function whatsappMessage(p: DraftProductInput): string {
  if (!hasText(p.name)) return MISSING_FIELD("Product Name");
  if (!hasNumber(p.wholesale_price) && !hasNumber(p.mrp)) {
    return `Hi! We have *${p.name}* available. ${MISSING_FIELD("a price (MRP or B2B Base)")} Reply to know more.`;
  }
  const priceLine = hasNumber(p.wholesale_price) ? `B2B price ₹${p.wholesale_price}${hasText(p.uom) ? `/${p.uom}` : ""}` : `MRP ₹${p.mrp}`;
  return `Hi! We have *${p.name}* available — ${priceLine}. Reply to place your order.`;
}

function hindiDescription(p: DraftProductInput): string {
  if (!hasText(p.name)) return MISSING_FIELD("Product Name");
  const category = hasText(p.category) ? p.category : "उत्पाद";
  const priceLine = hasNumber(p.wholesale_price) ? ` कीमत ₹${p.wholesale_price} है।` : "";
  return `${p.name} अब उपलब्ध है (${category})।${priceLine} अधिक जानकारी के लिए संपर्क करें।\n(सरल हिंदी ड्राफ्ट — प्रमाणित अनुवाद नहीं है, भेजने से पहले जाँच लें।)`;
}

function storageShelfLifeCopy(p: DraftProductInput): string {
  if (!hasText(p.shelf_life) && !hasText(p.storage_type)) {
    return MISSING_FIELD("Shelf Life and Storage Type");
  }
  const shelf = hasText(p.shelf_life) ? `Shelf life: ${p.shelf_life} days.` : MISSING_FIELD("Shelf Life");
  const storage = hasText(p.storage_type) ? `Store ${p.storage_type}.` : MISSING_FIELD("Storage Type");
  return `${shelf} ${storage}`;
}

export function generateCatalogueDrafts(product: DraftProductInput): DraftBlocks {
  return {
    catalogue_title: catalogueTitle(product),
    short_description: shortDescription(product),
    long_description: longDescription(product),
    b2b_sales_copy: b2bSalesCopy(product),
    export_catalogue_copy: exportCatalogueCopy(product),
    whatsapp_message: whatsappMessage(product),
    hindi_description: hindiDescription(product),
    storage_shelf_life_copy: storageShelfLifeCopy(product),
  };
}
