import type {
  CatalogueAliasDraftView,
  CatalogueDraftRow,
  CatalogueDraftView,
  CatalogueMoqDraftView,
  CataloguePricingDraftView,
  CatalogueTagDraftView,
} from "./catalogueApprovalTypes";

function readString(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return null;
}

function readBoolean(payload: Record<string, unknown>, key: string): boolean | null {
  const value = payload[key];
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function readNumber(payload: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

/** Tag drafts map to `public.product_tags` fields (not legacy `tags`). */
export function parseTagDraftView(row: CatalogueDraftRow): CatalogueTagDraftView {
  const payload = row.payload ?? {};
  return {
    kind: "tag",
    draftId: row.id,
    operation: row.operation,
    tag_key: readString(payload, "tag_key"),
    tag_label: readString(payload, "tag_label", "name"),
    is_active: readBoolean(payload, "is_active"),
    submitted_at: row.submitted_at,
  };
}

/** Alias drafts map to `public.product_aliases` fields (`alias_text`, not `alias` column). */
export function parseAliasDraftView(row: CatalogueDraftRow): CatalogueAliasDraftView {
  const payload = row.payload ?? {};
  return {
    kind: "alias",
    draftId: row.id,
    operation: row.operation,
    alias_text: readString(payload, "alias_text", "alias"),
    canonical_name: readString(payload, "canonical_name", "product_name"),
    product_id: readString(payload, "product_id"),
    submitted_at: row.submitted_at,
  };
}

/** Pricing drafts map to `public.product_pricing_rules` fields. AI Studio only proposes
 * these (see ChannelPricingRules.tsx); Central is the sole approver (Point 27, Finding 2). */
export function parsePricingDraftView(row: CatalogueDraftRow): CataloguePricingDraftView {
  const payload = row.payload ?? {};
  return {
    kind: "pricing",
    draftId: row.id,
    operation: row.operation,
    product_id: readString(payload, "product_id"),
    price_channel: readString(payload, "price_channel"),
    price_type: readString(payload, "price_type"),
    calculated_price: readNumber(payload, "calculated_price", "base_price"),
    currency: readString(payload, "currency"),
    submitted_at: row.submitted_at,
  };
}

/** MOQ drafts map to `public.product_moq_rules` fields. AI Studio only proposes these
 * (see ChannelMoqRules.tsx); Central is the sole approver (Point 27, Finding 2). */
export function parseMoqDraftView(row: CatalogueDraftRow): CatalogueMoqDraftView {
  const payload = row.payload ?? {};
  return {
    kind: "moq",
    draftId: row.id,
    operation: row.operation,
    product_id: readString(payload, "product_id"),
    channel: readString(payload, "channel"),
    moq_applicable: readBoolean(payload, "moq_applicable"),
    moq_value: readNumber(payload, "moq_value", "min_order_quantity"),
    moq_uom: readString(payload, "moq_uom"),
    submitted_at: row.submitted_at,
  };
}

export function parseCatalogueDraftView(
  kind: "tag" | "alias" | "pricing" | "moq",
  row: CatalogueDraftRow,
): CatalogueDraftView {
  switch (kind) {
    case "tag":
      return parseTagDraftView(row);
    case "alias":
      return parseAliasDraftView(row);
    case "pricing":
      return parsePricingDraftView(row);
    case "moq":
      return parseMoqDraftView(row);
  }
}
