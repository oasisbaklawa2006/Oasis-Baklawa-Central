import type { ClientResolutionTextSignals } from "./clientResolutionTypes";

const STAFF_RELAY_PATTERNS = [
  /(?:order\s+for|client|customer|party|for\s+M\/s\.?|for)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\s&'.-]{2,48})/i,
  /([A-Za-z][A-Za-z\s&'.-]{3,})\s+(?:ka|ke|ki|order|wants?|need)/i,
  /need\s+\d+\s+\w+\s+for\s+([A-Za-z0-9\s&'.-]{2,48})/i,
  /(?:from|for|m\/s\.?|company)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9 &.\-]{2,40})/i,
];

const BRAND_SUFFIX_PATTERN =
  /([A-Za-z][A-Za-z0-9]+(?:\s+[A-Za-z][A-Za-z0-9]+){0,3})\s+(?:traders|enterprises|sweets|foods|catering|hotel|restaurant|stores|bakery|pvt|ltd|limited)/i;

const LOCATION_TOKENS = [
  "cp",
  "gurgaon",
  "gurugram",
  "paharganj",
  "delhi",
  "noida",
  "faridabad",
  "ghaziabad",
  "connaught",
  "karol",
  "bangalore",
  "mumbai",
  "hyderabad",
  "chennai",
  "kolkata",
];

const GST_PATTERN = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/gi;
const ORDER_REF_PATTERN = /\b(?:SO[-\s]?|order\s*(?:#|no\.?|number)?\s*)?([A-Z0-9-]{5,20})\b/gi;
const CLIENT_CODE_PATTERN = /\b(?:client\s*code|code)\s*[:\-]?\s*(\d{3,8})\b/i;
const PHONE_PATTERN = /\b(?:\+?91[\s-]?)?([6-9]\d{9})\b/g;

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim().replace(/\s+/g, " ");
    if (!value || value.length < 2) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function extractNameCandidates(text: string): string[] {
  const names: string[] = [];
  for (const pattern of STAFF_RELAY_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) names.push(match[1].trim());
  }
  const brandMatch = text.match(BRAND_SUFFIX_PATTERN);
  if (brandMatch?.[1]) names.push(brandMatch[1].trim());

  const codeMatch = text.match(CLIENT_CODE_PATTERN);
  if (codeMatch?.[1]) names.push(codeMatch[1].trim());

  for (const token of text.split(/[\n,;|]+/)) {
    const trimmed = token.trim();
    if (trimmed.length >= 3 && trimmed.length <= 48 && /[A-Za-z]/.test(trimmed)) {
      names.push(trimmed);
    }
  }

  return uniqueStrings(names).slice(0, 8);
}

function extractLocationTokens(text: string): string[] {
  const lower = text.toLowerCase();
  return LOCATION_TOKENS.filter((token) => lower.includes(token));
}

export function buildClientResolutionCombinedText(
  messageText: string,
  stitchedPlainText?: string,
): string {
  return [messageText, stitchedPlainText].filter(Boolean).join("\n").trim();
}

export function extractClientResolutionTextSignals(
  messageText: string,
  stitchedPlainText?: string,
): ClientResolutionTextSignals {
  const combinedText = buildClientResolutionCombinedText(messageText, stitchedPlainText);
  const gstNumbers = uniqueStrings([...(combinedText.matchAll(GST_PATTERN))].map((m) => m[1].toUpperCase()));
  const phoneLast10 = uniqueStrings(
    [...combinedText.matchAll(PHONE_PATTERN)].map((m) => m[1].slice(-10)),
  );
  const orderReferences = uniqueStrings(
    [...combinedText.matchAll(ORDER_REF_PATTERN)]
      .map((m) => m[1].toUpperCase())
      .filter((ref) => ref.length >= 5 && !/^\d+$/.test(ref)),
  );
  const numericCodes = uniqueStrings(
    [...combinedText.matchAll(/\b(\d{3,8})\b/g)].map((m) => m[1]),
  );

  return {
    combinedText,
    nameCandidates: extractNameCandidates(combinedText),
    gstNumbers,
    phoneLast10,
    orderReferences,
    numericCodes,
    locationTokens: extractLocationTokens(combinedText),
  };
}

export function normalizeCompanySearchTerm(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function companyNameMatchesTerm(companyName: string, term: string): "exact" | "partial" | "none" {
  const normalizedCompany = normalizeCompanySearchTerm(companyName);
  const normalizedTerm = normalizeCompanySearchTerm(term);
  if (!normalizedTerm || !normalizedCompany) return "none";
  if (normalizedCompany === normalizedTerm) return "exact";
  if (normalizedCompany.includes(normalizedTerm) || normalizedTerm.includes(normalizedCompany)) {
    return "partial";
  }
  return "none";
}
