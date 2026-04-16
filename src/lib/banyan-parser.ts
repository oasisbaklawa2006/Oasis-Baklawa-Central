/**
 * Banyan Parser — shorthand alias map + invoice/voucher detection
 */

// Hard-coded shorthand map (supplements DB product_aliases)
export const SHORTHAND_MAP: Record<string, string> = {
  "asabi": "Asabi Finger Baklawa",
  "pyramid": "Pyramid Special Sweet",
  "burma": "Burma Baklawa",
  "kaju": "Kaju Katli",
  "katli": "Kaju Katli",
  "pistachio": "Pistachio Baklawa",
  "baklava": "Mixed Baklawa",
  "kunafa": "Kunafa",
  "maamoul": "Maamoul",
  "basbousa": "Basbousa",
  "namoura": "Namoura",
  "laddu": "Besan Laddu",
  "motichoor": "Motichoor Laddu",
  "barfi": "Kaju Barfi",
  "peda": "Kesar Peda",
  "halwa": "Gajar Halwa",
  "rasgulla": "Rasgulla",
  "gulab": "Gulab Jamun",
  "chamcham": "Cham Cham",
  "sandesh": "Bengal Sandesh",
};

/** Detect invoice/voucher references like TCF/25-26/1183 */
const INVOICE_PATTERN = /(?:voucher\s*no|invoice\s*no|inv\s*no|tcf)\s*[:/]?\s*[\w\-\/]+/gi;

export interface ParsedIntent {
  detectedSKUs: string[];
  invoiceRefs: string[];
  missingQty: boolean;
  missingPhone: boolean;
}

export function parseBanyanMessage(
  text: string,
  dbAliases: { alias_text: string; canonical_name: string }[],
  senderPhone: string | null
): ParsedIntent {
  const lower = text.toLowerCase();
  const matched = new Set<string>();

  // 1. Match from DB aliases
  for (const alias of dbAliases) {
    if (lower.includes(alias.alias_text.toLowerCase())) {
      matched.add(alias.canonical_name);
    }
  }

  // 2. Match from hardcoded shorthand
  for (const [key, canonical] of Object.entries(SHORTHAND_MAP)) {
    if (lower.includes(key)) {
      matched.add(canonical);
    }
  }

  // 3. Detect invoice references
  const invoiceRefs = (text.match(INVOICE_PATTERN) || []).map(r => r.trim());

  // 4. Check if quantity is present (digits followed by kg/pcs/box/carton/unit)
  const hasQty = /\d+\s*(kg|pcs|pc|box|boxes|carton|cartons|unit|units|pieces|gm|gms|gram)/i.test(text);
  // Also consider bare numbers > 0 near product names as qty
  const hasAnyNumber = /\b\d+\b/.test(text);
  const missingQty = matched.size > 0 && !hasQty && !hasAnyNumber;

  // 5. Check if phone is available
  const phoneDigits = (senderPhone || "").replace(/\D/g, "");
  const missingPhone = phoneDigits.length < 10;

  return {
    detectedSKUs: Array.from(matched),
    invoiceRefs,
    missingQty,
    missingPhone,
  };
}
