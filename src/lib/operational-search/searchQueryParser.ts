import type { OperationalSearchKind } from "./searchEntityContracts";
import { SEARCH_QUERY_ALIASES, inferSearchKindFromQuery } from "./searchAliases";
import { normalizeSearchText, queryTokensFromText, barcodeQueryTokens } from "./searchIndexNormalizer";

export interface ParsedOperationalSearchQuery {
  raw: string;
  normalized: string;
  tokens: string[];
  inferredKind: OperationalSearchKind | null;
  barcodeOrSoMode: boolean;
  entityTypeHint: string | null;
}

export function expandSearchAliases(query: string): string[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const prefix = trimmed.split(/[:\s]/)[0];
  const kind = SEARCH_QUERY_ALIASES[prefix];
  if (!kind) return [trimmed];
  const rest = trimmed.slice(prefix.length).replace(/^[\s:]+/, "");
  return rest ? [trimmed, rest, kind] : [trimmed, kind];
}

export function parseOperationalSearchQuery(text: string): ParsedOperationalSearchQuery {
  const normalized = normalizeSearchText(text);
  const inferredKind = inferSearchKindFromQuery(text);
  const barcodeOrSoMode =
    inferredKind === "barcode" ||
    inferredKind === "carton" ||
    inferredKind === "so_number" ||
    /^so[-#]?/i.test(text.trim()) ||
    /^[A-Z0-9]{6,}$/i.test(text.trim());

  const tokens = barcodeOrSoMode && (inferredKind === "barcode" || inferredKind === "carton")
    ? barcodeQueryTokens(text)
    : queryTokensFromText(text);

  let entityTypeHint: string | null = null;
  if (inferredKind === "so_number" || inferredKind === "uuid") entityTypeHint = "order";
  if (inferredKind === "barcode" || inferredKind === "carton") entityTypeHint = "scan_record";
  if (inferredKind === "dispatch") entityTypeHint = "dispatch_reference";
  if (inferredKind === "customer" || inferredKind === "phone") entityTypeHint = "customer";

  return {
    raw: text,
    normalized,
    tokens,
    inferredKind,
    barcodeOrSoMode,
    entityTypeHint,
  };
}
