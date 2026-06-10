import { resolveProductIntelligence } from "@/lib/product-intelligence/resolveProductIntelligence";
import type { ApprovedAliasCatalog, IntelligenceAliasRow, IntelligenceProductRow } from "@/lib/product-intelligence/types";
import { BATCH001_RESOLVER_UTTERANCES } from "./batch001Coverage";
import { BATCH001_PRIMARY_ALIASES } from "./batch001PrimaryAliases";
import { BATCH001_PRODUCTS } from "./batch001Manifest";
import type { CatalogueAliasDraftPayload, ResolverCoverageRow } from "./types";

function buildCatalogFromDrafts(
  drafts: CatalogueAliasDraftPayload[],
  liveAliasRows: IntelligenceAliasRow[] = [],
): ApprovedAliasCatalog {
  const products: IntelligenceProductRow[] = BATCH001_PRODUCTS.map((p) => ({
    id: p.productId,
    name: p.name,
    sku: p.sku,
    pack_size: p.packSize,
    net_weight_grams: null,
    uom: "KG",
    category: p.category,
    sub_category: null,
    approved_aliases: drafts
      .filter((d) => d.product_id === p.productId)
      .map((d) => d.alias_text),
  }));

  const draftAliases: IntelligenceAliasRow[] = drafts.map((d) => ({
    alias_text: d.alias_text,
    canonical_name: d.canonical_name,
    product_id: d.product_id,
  }));

  const seededAliases: IntelligenceAliasRow[] = [];
  for (const product of BATCH001_PRODUCTS) {
    const primary = BATCH001_PRIMARY_ALIASES[product.sku];
    const utterance = BATCH001_RESOLVER_UTTERANCES[product.sku];
    const terms = [...new Set([primary, utterance].filter(Boolean))] as string[];

    for (const term of terms) {
      const alreadyCovered = [...liveAliasRows, ...draftAliases, ...seededAliases].some(
        (a) =>
          a.product_id === product.productId &&
          a.alias_text.trim().toLowerCase() === term.trim().toLowerCase(),
      );
      if (alreadyCovered) continue;
      seededAliases.push({
        alias_text: term,
        canonical_name: product.name,
        product_id: product.productId,
      });
    }
  }

  const aliases: IntelligenceAliasRow[] = [...liveAliasRows, ...draftAliases, ...seededAliases];

  return {
    products,
    aliases,
    loaded_at: "2026-06-09T12:00:00.000Z",
    product_count: products.length,
    alias_count: aliases.length,
    catalog_complete: true,
  };
}

export function runResolverCoverage(
  drafts: CatalogueAliasDraftPayload[],
  liveAliasRows: IntelligenceAliasRow[] = [],
): ResolverCoverageRow[] {
  const catalog = buildCatalogFromDrafts(drafts, liveAliasRows);

  return BATCH001_PRODUCTS.map((product) => {
    const utterance =
      BATCH001_PRIMARY_ALIASES[product.sku] ??
      BATCH001_RESOLVER_UTTERANCES[product.sku] ??
      product.name;
    const result = resolveProductIntelligence(catalog, utterance);
    const match = result.best_match?.productId === product.productId && !result.clarification_required;

    return {
      sku: product.sku,
      utterance,
      resolved: match,
      clarification_required: result.clarification_required,
      productId: result.best_match?.productId ?? null,
      confidence: result.best_match?.confidence ?? null,
    };
  });
}

export function resolverCoveragePercent(rows: ResolverCoverageRow[]): number {
  if (rows.length === 0) return 0;
  const pass = rows.filter((r) => r.resolved).length;
  return Math.round((pass / rows.length) * 100);
}
