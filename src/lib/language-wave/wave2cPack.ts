import { BATCH001_WAVE2C_SKUS, batch001ProductBySku } from "./batch001Manifest";
import type { LanguageTermProposal } from "./types";

type Wave2cTermRow = {
  sku: (typeof BATCH001_WAVE2C_SKUS)[number];
  official_alias: string;
  whatsapp_keyword: string;
  customer_term: string;
  search_keyword: string;
};

const WAVE2C_ROWS: Wave2cTermRow[] = [
  {
    sku: "OAS-AS-BKL-0002",
    official_alias: "Square Baklawa",
    whatsapp_keyword: "square baklawa",
    customer_term: "chatur baklawa",
    search_keyword: "square piece baklawa lebanese",
  },
  {
    sku: "OAS-AS-BKL-0004",
    official_alias: "Cashew Rosebud",
    whatsapp_keyword: "cashew rosebud",
    customer_term: "rosebud cashew",
    search_keyword: "cashew rosebud baklawa",
  },
  {
    sku: "OAS-AS-BKL-0005",
    official_alias: "Almond Crosole",
    whatsapp_keyword: "almond crosole",
    customer_term: "crosole almond",
    search_keyword: "almond crosole baklawa",
  },
  {
    sku: "OAS-AS-BKL-0006",
    official_alias: "Cashew Pyramid",
    whatsapp_keyword: "cashew pyramid",
    customer_term: "kaju pyramid",
    search_keyword: "cashew pyramid baklawa",
  },
  {
    sku: "OAS-AS-BKL-0008",
    official_alias: "Date Baklawa",
    whatsapp_keyword: "date baklawa",
    customer_term: "khajoor baklawa",
    search_keyword: "date baklawa lebanese",
  },
  {
    sku: "OAS-AS-BKL-0009",
    official_alias: "Special Square Baklawa",
    whatsapp_keyword: "special square baklawa",
    customer_term: "special square",
    search_keyword: "special square baklawa lebanese",
  },
  {
    sku: "OAS-AS-BKL-0011",
    official_alias: "Pistachio Pyramid Topping",
    whatsapp_keyword: "pistachio pyramid topping",
    customer_term: "pista pyramid topping",
    search_keyword: "pistachio pyramid topping baklawa",
  },
  {
    sku: "OAS-AS-BKL-0018",
    official_alias: "Diamond Pistachio",
    whatsapp_keyword: "diamond pistachio",
    customer_term: "diamond pista",
    search_keyword: "diamond pistachio baklawa",
  },
];

export const WAVE2C_ID = "wave-2c";

export function buildWave2cProposals(): LanguageTermProposal[] {
  const proposals: LanguageTermProposal[] = [];

  for (const row of WAVE2C_ROWS) {
    const product = batch001ProductBySku(row.sku);
    if (!product) continue;

    const kinds = ["official_alias", "whatsapp_keyword", "customer_term", "search_keyword"] as const;
    for (const kind of kinds) {
      proposals.push({
        sku: row.sku,
        productId: product.productId,
        canonicalName: product.name,
        kind,
        term: row[kind],
        wave: WAVE2C_ID,
      });
    }
  }

  return proposals;
}
