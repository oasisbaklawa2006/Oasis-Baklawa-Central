export interface NormalizedIdentifier {
  raw: string;
  normalized: string;
  kind: "email" | "phone";
  last10?: string;
  e164?: string;
  digits?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailIdentifier(value: string) {
  return EMAIL_REGEX.test(value.trim().toLowerCase());
}

export function normalizePhone(input: string, defaultCountryCode = "91") {
  const digits = input.replace(/\D/g, "");
  const trimmedCountry = defaultCountryCode.replace(/\D/g, "") || "91";

  if (!digits) {
    return {
      digits: "",
      last10: "",
      e164: "",
      national: "",
      variants: [] as string[],
    };
  }

  const last10 = digits.slice(-10);
  const national = last10 || digits;
  const withCountry = national.length === 10 ? `${trimmedCountry}${national}` : digits;
  const e164 = withCountry.startsWith("+") ? withCountry : `+${withCountry}`;

  const variants = Array.from(
    new Set(
      [
        digits,
        national,
        withCountry,
        e164,
        `0${national}`,
        national.length === 10 ? `+${trimmedCountry}${national}` : null,
        national.length === 10 ? `${trimmedCountry}${national}` : null,
      ].filter(Boolean) as string[],
    ),
  );

  return {
    digits,
    last10,
    national,
    e164,
    variants,
  };
}

export function normalizeIdentifier(input: string): NormalizedIdentifier {
  const raw = input.trim();

  if (isEmailIdentifier(raw)) {
    return {
      raw,
      normalized: raw.toLowerCase(),
      kind: "email",
    };
  }

  const phone = normalizePhone(raw);
  return {
    raw,
    normalized: phone.e164 || raw,
    kind: "phone",
    last10: phone.last10,
    e164: phone.e164,
    digits: phone.digits,
  };
}
