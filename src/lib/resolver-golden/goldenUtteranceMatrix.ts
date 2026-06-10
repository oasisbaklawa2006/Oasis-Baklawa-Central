import { BATCH001_PRODUCTS } from "@/lib/language-wave/batch001Manifest";
import { BATCH001_RESOLVER_UTTERANCES } from "@/lib/language-wave/batch001Coverage";
import type { GoldenUtteranceCase } from "./types";

function batch001Specific(): GoldenUtteranceCase[] {
  return BATCH001_PRODUCTS.flatMap((product) => {
    const whatsapp = BATCH001_RESOLVER_UTTERANCES[product.sku];
    return [
      {
        id: `b001-${product.sku}-official`,
        utterance: product.name,
        category: "batch001_specific" as const,
        expected: "resolve" as const,
        expectedSku: product.sku,
        notes: "Official product name",
      },
      {
        id: `b001-${product.sku}-wa`,
        utterance: whatsapp ?? product.name.toLowerCase(),
        category: "batch001_specific" as const,
        expected:
          product.sku === "OAS-AS-BKL-0009" ||
          product.sku === "OAS-AS-BKL-0014" ||
          product.sku === "OAS-AS-BKL-0015"
            ? ("clarify" as const)
            : ("resolve" as const),
        expectedSku:
          product.sku === "OAS-AS-BKL-0009" ||
          product.sku === "OAS-AS-BKL-0014" ||
          product.sku === "OAS-AS-BKL-0015"
            ? undefined
            : product.sku,
        clarifySkus:
          product.sku === "OAS-AS-BKL-0014"
            ? ["OAS-AS-BKL-0014", "OAS-AS-BKL-0017"]
            : product.sku === "OAS-AS-BKL-0015"
              ? ["OAS-AS-BKL-0015", "OAS-AS-BKL-0016"]
              : product.sku === "OAS-AS-BKL-0009"
                ? ["OAS-AS-BKL-0002", "OAS-AS-BKL-0009"]
                : undefined,
      },
    ];
  });
}

const BATCH001_QUANTITY: GoldenUtteranceCase[] = [
  { id: "qty-001", utterance: "Need 2 kg Kitta", category: "batch001_quantity", expected: "resolve", expectedSku: "OAS-AS-BKL-0001" },
  { id: "qty-002", utterance: "Send 3 kg cashew kitta", category: "batch001_quantity", expected: "resolve", expectedSku: "OAS-AS-BKL-0001" },
  { id: "qty-003", utterance: "Please send 1 kg Mor Cashew Asiyah", category: "batch001_quantity", expected: "resolve", expectedSku: "OAS-AS-BKL-0014" },
  { id: "qty-004", utterance: "Want 2 kg pistachio pyramid", category: "batch001_quantity", expected: "resolve", expectedSku: "OAS-AS-BKL-0019" },
  { id: "qty-005", utterance: "Order 6 kg mix nut tart", category: "batch001_quantity", expected: "resolve", expectedSku: "OAS-AS-BKL-0021" },
  { id: "qty-006", utterance: "Need 1 kg coconut durum", category: "batch001_quantity", expected: "resolve", expectedSku: "OAS-AS-BKL-0025" },
  { id: "qty-007", utterance: "Send 3kg cashew ring", category: "batch001_quantity", expected: "resolve", expectedSku: "OAS-AS-BKL-0003" },
  { id: "qty-008", utterance: "2 kg tart cashew please", category: "batch001_quantity", expected: "resolve", expectedSku: "OAS-AS-BKL-0020" },
  { id: "qty-009", utterance: "1kg almond tart", category: "batch001_quantity", expected: "resolve", expectedSku: "OAS-AS-BKL-0022" },
  { id: "qty-010", utterance: "500gm mix nut tart", category: "batch001_quantity", expected: "resolve", expectedSku: "OAS-AS-BKL-0021" },
  { id: "qty-011", utterance: "Need 2 boxes pistachio ring", category: "batch001_quantity", expected: "resolve", expectedSku: "OAS-AS-BKL-0010" },
  { id: "qty-012", utterance: "3 cartons cashew finger", category: "batch001_quantity", expected: "resolve", expectedSku: "OAS-AS-BKL-0007" },
  { id: "qty-013", utterance: "Send 1 kg mor pistachio durum", category: "batch001_quantity", expected: "resolve", expectedSku: "OAS-AS-BKL-0024" },
  { id: "qty-014", utterance: "2 kg chocolate cashew asiyah", category: "batch001_quantity", expected: "resolve", expectedSku: "OAS-AS-BKL-0013" },
  { id: "qty-015", utterance: "1 kg diamond pistachio", category: "batch001_quantity", expected: "resolve", expectedSku: "OAS-AS-BKL-0018" },
];

const AMBIGUOUS_FAMILY: GoldenUtteranceCase[] = [
  { id: "amb-asiyah", utterance: "Need Asiyah", category: "ambiguous_family", expected: "clarify", clarifySkus: ["OAS-AS-BKL-0012", "OAS-AS-BKL-0013", "OAS-AS-BKL-0014", "OAS-AS-BKL-0015", "OAS-AS-BKL-0016", "OAS-AS-BKL-0017"] },
  { id: "amb-baklava", utterance: "Need Baklava", category: "ambiguous_family", expected: "clarify", notes: "Generic family — multiple baklawa SKUs" },
  { id: "amb-baklawa", utterance: "send baklawa", category: "ambiguous_family", expected: "clarify" },
  { id: "amb-pyramid", utterance: "Need Pyramid", category: "ambiguous_family", expected: "clarify", clarifySkus: ["OAS-AS-BKL-0006", "OAS-AS-BKL-0011", "OAS-AS-BKL-0019"] },
  { id: "amb-ring", utterance: "Ring", category: "ambiguous_family", expected: "clarify", clarifySkus: ["OAS-AS-BKL-0003", "OAS-AS-BKL-0010"] },
  { id: "amb-tart", utterance: "Tart", category: "ambiguous_family", expected: "clarify", clarifySkus: ["OAS-AS-BKL-0020", "OAS-AS-BKL-0021", "OAS-AS-BKL-0022", "OAS-AS-BKL-0023"] },
  { id: "amb-durum", utterance: "Durum", category: "ambiguous_family", expected: "clarify", clarifySkus: ["OAS-AS-BKL-0024", "OAS-AS-BKL-0025"] },
  { id: "amb-cashew-assiyah", utterance: "cashew assiyah", category: "ambiguous_family", expected: "clarify", clarifySkus: ["OAS-AS-BKL-0013", "OAS-AS-BKL-0014"], notes: "Live alias collision" },
  { id: "amb-square", utterance: "square baklawa", category: "ambiguous_family", expected: "clarify", clarifySkus: ["OAS-AS-BKL-0002", "OAS-AS-BKL-0009"] },
  { id: "amb-cashew-pyramid", utterance: "pyramid", category: "ambiguous_family", expected: "clarify", notes: "Unsafe generic live alias" },
  { id: "amb-mor-asiyah", utterance: "mor asiyah", category: "ambiguous_family", expected: "clarify", clarifySkus: ["OAS-AS-BKL-0014", "OAS-AS-BKL-0015"] },
  { id: "amb-choc-asiyah", utterance: "chocolate asiyah", category: "ambiguous_family", expected: "clarify", clarifySkus: ["OAS-AS-BKL-0012", "OAS-AS-BKL-0013"] },
];

const GENERIC_ONLY: GoldenUtteranceCase[] = [
  { id: "gen-baklava", utterance: "Baklava", category: "generic_only", expected: "clarify" },
  { id: "gen-sweets", utterance: "mixed sweets", category: "generic_only", expected: "clarify" },
  { id: "gen-assorted", utterance: "assorted", category: "generic_only", expected: "clarify" },
  { id: "gen-mithai", utterance: "mithai", category: "generic_only", expected: "clarify" },
  { id: "gen-dessert", utterance: "desserts", category: "generic_only", expected: "clarify" },
  { id: "gen-please-baklava", utterance: "please send baklava", category: "generic_only", expected: "clarify" },
  { id: "gen-kindly-tart", utterance: "kindly send tart", category: "generic_only", expected: "clarify" },
  { id: "gen-need-pyramid", utterance: "need pyramid", category: "generic_only", expected: "clarify" },
  { id: "gen-not-generic-mor-cashew", utterance: "Mor Cashew Asiyah", category: "generic_only", expected: "resolve", expectedSku: "OAS-AS-BKL-0014", notes: "Multi-word specific phrase — not generic-only despite asiyah token" },
];

const MULTILINGUAL: GoldenUtteranceCase[] = [
  { id: "ml-kaju-kitta", utterance: "Kaju Kitta", category: "multilingual", expected: "resolve", expectedSku: "OAS-AS-BKL-0001" },
  { id: "ml-kaju-ring", utterance: "Kaju Ring", category: "multilingual", expected: "resolve", expectedSku: "OAS-AS-BKL-0003" },
  { id: "ml-pista-pyramid", utterance: "Pista Pyramid", category: "multilingual", expected: "resolve", expectedSku: "OAS-AS-BKL-0019" },
  { id: "ml-pista-ring", utterance: "Pista Ring", category: "multilingual", expected: "resolve", expectedSku: "OAS-AS-BKL-0010" },
  { id: "ml-badam-tart", utterance: "Badam Tart", category: "multilingual", expected: "resolve", expectedSku: "OAS-AS-BKL-0022" },
  { id: "ml-khajoor", utterance: "khajoor baklawa", category: "multilingual", expected: "resolve", expectedSku: "OAS-AS-BKL-0008" },
  { id: "ml-nariyal-durum", utterance: "Nariyal Durum", category: "multilingual", expected: "resolve", expectedSku: "OAS-AS-BKL-0025" },
  { id: "ml-mor-kaju-asiyah", utterance: "Mor Kaju Asiyah", category: "multilingual", expected: "resolve", expectedSku: "OAS-AS-BKL-0014" },
  { id: "ml-mor-pista-asiyah", utterance: "Mor Pista Asiyah", category: "multilingual", expected: "resolve", expectedSku: "OAS-AS-BKL-0015" },
  { id: "ml-tart-kaju", utterance: "Tart Kaju", category: "multilingual", expected: "resolve", expectedSku: "OAS-AS-BKL-0020" },
];

const TYPO_TOLERANCE: GoldenUtteranceCase[] = [
  { id: "typo-kita", utterance: "Kita", category: "typo_tolerance", expected: "resolve", expectedSku: "OAS-AS-BKL-0001", notes: "Approved alias Kitta/Kita" },
  { id: "typo-baklawa", utterance: "Baklawa", category: "typo_tolerance", expected: "clarify", notes: "Phonetic variant — generic family" },
  { id: "typo-assiyah", utterance: "assiyah", category: "typo_tolerance", expected: "clarify" },
  { id: "typo-piramed", utterance: "piramed", category: "typo_tolerance", expected: "clarify", notes: "Live typo alias maps to Cashew Pyramid" },
  { id: "typo-crosole", utterance: "crosole", category: "typo_tolerance", expected: "clarify", notes: "Wrong canonical in live data" },
  { id: "typo-almand", utterance: "almand tart", category: "typo_tolerance", expected: "resolve", expectedSku: "OAS-AS-BKL-0022" },
  { id: "typo-cashew-kitta", utterance: "cashew kita", category: "typo_tolerance", expected: "resolve", expectedSku: "OAS-AS-BKL-0001" },
  { id: "typo-pist-pyr", utterance: "pistachio piramid", category: "typo_tolerance", expected: "resolve", expectedSku: "OAS-AS-BKL-0019" },
];

const SEARCH_FALLBACK: GoldenUtteranceCase[] = [
  { id: "search-sku", utterance: "OAS-AS-BKL-0019", category: "search_fallback", expected: "resolve", expectedSku: "OAS-AS-BKL-0019", notes: "SKU search path — SearchOverlay/AdminProducts" },
  { id: "search-category", utterance: "Lebanese Baklawa", category: "search_fallback", expected: "clarify", notes: "Category ILIKE — browse not resolution" },
  { id: "search-partial", utterance: "cashew", category: "search_fallback", expected: "clarify", notes: "Partial name — too broad" },
];

const NEGATIVE: GoldenUtteranceCase[] = [
  { id: "neg-empty", utterance: "   ", category: "negative", expected: "no_match" },
  { id: "neg-greeting", utterance: "Good morning", category: "negative", expected: "no_match" },
  { id: "neg-payment", utterance: "Payment done", category: "negative", expected: "no_match" },
  { id: "neg-unknown", utterance: "XYZ Unknown Product 999", category: "negative", expected: "no_match" },
];

/** Authoritative golden utterance matrix for resolver unification parity tests. */
export const GOLDEN_UTTERANCE_MATRIX: GoldenUtteranceCase[] = [
  ...batch001Specific(),
  ...BATCH001_QUANTITY,
  ...AMBIGUOUS_FAMILY,
  ...GENERIC_ONLY,
  ...MULTILINGUAL,
  ...TYPO_TOLERANCE,
  ...SEARCH_FALLBACK,
  ...NEGATIVE,
];

export function goldenMatrixStats(matrix: GoldenUtteranceCase[] = GOLDEN_UTTERANCE_MATRIX) {
  const byCategory = new Map<string, number>();
  const byExpected = new Map<string, number>();
  for (const row of matrix) {
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + 1);
    byExpected.set(row.expected, (byExpected.get(row.expected) ?? 0) + 1);
  }
  return {
    total: matrix.length,
    byCategory: Object.fromEntries(byCategory),
    byExpected: Object.fromEntries(byExpected),
  };
}
