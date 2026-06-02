import type {
  CatalogueAliasDraftView,
  CatalogueDraftRow,
  CatalogueDraftView,
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

export function parseCatalogueDraftView(
  kind: "tag" | "alias",
  row: CatalogueDraftRow,
): CatalogueDraftView {
  return kind === "tag" ? parseTagDraftView(row) : parseAliasDraftView(row);
}
