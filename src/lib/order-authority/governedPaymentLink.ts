/** Accepts only absolute https payment URLs for governed PAY_NOW links. */
export function parseGovernedHttpsPaymentLink(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || !parsed.hostname) return null;
  return parsed.href;
}

export function isGovernedHttpsPaymentLink(value: string | null | undefined): boolean {
  return parseGovernedHttpsPaymentLink(value) !== null;
}
