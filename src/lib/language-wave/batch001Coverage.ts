import { BATCH001_PRODUCTS, BATCH001_WAVE2C_SKUS } from "./batch001Manifest";
import { buildWave2cProposals } from "./wave2cPack";
import type { LanguageTermKind } from "./types";

const REQUIRED_KINDS: LanguageTermKind[] = [
  "official_alias",
  "whatsapp_keyword",
  "customer_term",
  "search_keyword",
];

/** Primary resolver utterance per SKU (whatsapp_keyword or official name). */
export const BATCH001_RESOLVER_UTTERANCES: Record<string, string> = {
  "OAS-AS-BKL-0001": "cashew kitta",
  "OAS-AS-BKL-0002": "square baklawa",
  "OAS-AS-BKL-0003": "cashew ring",
  "OAS-AS-BKL-0004": "cashew rosebud",
  "OAS-AS-BKL-0005": "almond crosole",
  "OAS-AS-BKL-0006": "cashew pyramid",
  "OAS-AS-BKL-0007": "cashew finger",
  "OAS-AS-BKL-0008": "date baklawa",
  "OAS-AS-BKL-0009": "special square baklawa lebanese",
  "OAS-AS-BKL-0010": "pistachio ring",
  "OAS-AS-BKL-0011": "pistachio pyramid topping",
  "OAS-AS-BKL-0012": "chocolate pistachio asiyah",
  "OAS-AS-BKL-0013": "chocolate cashew asiyah",
  "OAS-AS-BKL-0014": "mor cashew asiyah lebanese baklava",
  "OAS-AS-BKL-0015": "mor pistachio asiyah lebanese baklava",
  "OAS-AS-BKL-0016": "pistachio asiyah",
  "OAS-AS-BKL-0017": "cashew asiyah",
  "OAS-AS-BKL-0018": "diamond pistachio",
  "OAS-AS-BKL-0019": "pistachio pyramid",
  "OAS-AS-BKL-0020": "tart cashew",
  "OAS-AS-BKL-0021": "mix nut tart",
  "OAS-AS-BKL-0022": "almond tart",
  "OAS-AS-BKL-0023": "pistachio tart",
  "OAS-AS-BKL-0024": "mor pistachio durum",
  "OAS-AS-BKL-0025": "coconut durum",
};

export interface SkuLanguageCoverage {
  sku: string;
  name: string;
  kinds_present: LanguageTermKind[];
  complete: boolean;
  source: "live_aliases" | "wave2c_pending" | "mixed";
}

export function assessBatch001LanguageCoverage(
  liveAliasSkus: Set<string>,
): SkuLanguageCoverage[] {
  const wave2cBySku = new Map<string, LanguageTermKind[]>();
  for (const proposal of buildWave2cProposals()) {
    const list = wave2cBySku.get(proposal.sku) ?? [];
    list.push(proposal.kind);
    wave2cBySku.set(proposal.sku, list);
  }

  return BATCH001_PRODUCTS.map((product) => {
    const hasLive = liveAliasSkus.has(product.sku);
    const waveKinds = wave2cBySku.get(product.sku) ?? [];
    const isWave2cOnly = BATCH001_WAVE2C_SKUS.includes(product.sku as (typeof BATCH001_WAVE2C_SKUS)[number]);

    let kinds_present: LanguageTermKind[];
    let source: SkuLanguageCoverage["source"];

    if (hasLive && waveKinds.length > 0) {
      kinds_present = [...new Set([...REQUIRED_KINDS])];
      source = "mixed";
    } else if (hasLive) {
      kinds_present = [...REQUIRED_KINDS];
      source = "live_aliases";
    } else if (isWave2cOnly) {
      kinds_present = [...new Set(waveKinds)];
      source = "wave2c_pending";
    } else {
      kinds_present = [];
      source = "live_aliases";
    }

    const complete = REQUIRED_KINDS.every((k) => kinds_present.includes(k));
    return { sku: product.sku, name: product.name, kinds_present, complete, source };
  });
}
