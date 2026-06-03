const PACKAGING_ALIAS_TERMS = new Set([
  "tin",
  "tins",
  "tray",
  "trays",
  "carton",
  "cartons",
  "box",
  "boxes",
  "acrylic",
  "case",
  "cases",
  "pack",
  "packs",
  "tin pack",
  "acrylic box",
  "assorted",
  "mixed",
  "hamper",
  "hampers",
  "gift box",
]);

export const IDENTITY_ALIAS_TERMS = [
  "baklava",
  "baklawa",
  "mamoul",
  "maamoul",
  "turkish delight",
  "lokum",
  "dates",
  "kunefe",
  "kunafa",
  "dragees",
  "chocolate tray",
  "chocolate box",
  "chocolate",
  "basbousa",
  "namoura",
  "barfi",
  "peda",
  "halwa",
  "rasgulla",
  "gulab jamun",
  "sandesh",
  "motichoor",
  "laddu",
  "pistachio",
  "kaju",
] as const;

export const PACKAGING_FORMAT_TOKENS = [
  "tin",
  "tins",
  "carton",
  "cartons",
  "box",
  "boxes",
  "tray",
  "trays",
  "acrylic",
  "gift box",
  "tin pack",
  "acrylic box",
  "case",
  "cases",
  "pack",
  "packs",
  "hamper",
  "hampers",
] as const;

export function normalizeProductAlias(alias: string): string {
  return alias.trim().replace(/\s+/g, " ").toLowerCase();
}

function identityAliasMatchesNormalized(normalized: string): boolean {
  if (!normalized) return false;
  return IDENTITY_ALIAS_TERMS.some((term) => {
    if (normalized === term) return true;
    if (normalized.includes(term)) return true;
    if (term.includes(normalized) && normalized.length >= 4) return true;
    if (term === "maamoul" && /\bmamoul\b/.test(normalized)) return true;
    if (term === "mamoul" && /\bmaamoul\b/.test(normalized)) return true;
    if (term === "baklawa" && /\bbaklava\b/.test(normalized)) return true;
    if (term === "baklava" && /\bbaklawa\b/.test(normalized)) return true;
    return false;
  });
}

export function isPackagingAlias(alias: string): boolean {
  const normalized = normalizeProductAlias(alias);
  if (!normalized) return false;
  if (PACKAGING_ALIAS_TERMS.has(normalized)) return true;

  const tokens = normalized.split(/\s+/);
  if (tokens.length === 1 && PACKAGING_ALIAS_TERMS.has(tokens[0])) return true;

  return PACKAGING_FORMAT_TOKENS.some(
    (token) => normalized === token || normalized.endsWith(` ${token}`) || normalized.startsWith(`${token} `),
  );
}

export function isIdentityAlias(alias: string): boolean {
  const normalized = normalizeProductAlias(alias);
  if (!normalized) return false;
  if (isPackagingAlias(alias)) return false;
  return identityAliasMatchesNormalized(normalized);
}

export function filterIdentityAliases(aliases: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const alias of aliases) {
    if (!isIdentityAlias(alias)) continue;
    const key = normalizeProductAlias(alias);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(alias.trim().replace(/\s+/g, " "));
  }
  return out;
}

export function aliasesMatchForIdentity(candidate: string, alias: string): boolean {
  if (!isIdentityAlias(alias) || !isIdentityAlias(candidate)) return false;
  const left = normalizeProductAlias(candidate);
  const right = normalizeProductAlias(alias);
  return left.includes(right) || right.includes(left);
}

export function extractPackagingFormatTokens(text: string): string[] {
  const lower = text.toLowerCase();
  const hits = PACKAGING_FORMAT_TOKENS.filter((token) => lower.includes(token));
  return [...new Set(hits)];
}

export function keywordMatchesIdentityAlias(keyword: string, text: string): boolean {
  const lower = text.toLowerCase();
  if (!isIdentityAlias(keyword)) return false;
  if (lower.includes(normalizeProductAlias(keyword))) return true;
  if (keyword === "maamoul" && /\bmamoul\b/.test(lower)) return true;
  if (keyword === "mamoul" && /\bmaamoul\b/.test(lower)) return true;
  if (keyword === "baklawa" && /\bbaklava\b/.test(lower)) return true;
  if (keyword === "baklava" && /\bbaklawa\b/.test(lower)) return true;
  return false;
}

export function extractIdentityKeywordHits(text: string): string[] {
  return IDENTITY_ALIAS_TERMS.filter((keyword) => keywordMatchesIdentityAlias(keyword, text)).map(
    (keyword) => keyword.replace(/\b\w/g, (char) => char.toUpperCase()),
  );
}
