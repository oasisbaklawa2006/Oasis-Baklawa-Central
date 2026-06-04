/** Text heuristics for draft-order readiness dimensions (no network). */

export interface AddressPaymentTextSignals {
  hasAddressKeyword: boolean;
  hasPincode: boolean;
  hasCityToken: boolean;
  hasPaymentTermsKeyword: boolean;
  hasAdvanceKeyword: boolean;
  hasCreditKeyword: boolean;
  addressSnippet: string | null;
  paymentTermsSnippet: string | null;
}

const ADDRESS_KEYWORDS =
  /\b(address|delivery|ship to|dispatch to|location|pincode|pin code|sector|road|street|nagar|colony|delhi|mumbai|bangalore|hyderabad|chennai|kolkata|pune|ahmedabad|jaipur|lucknow|noida|gurgaon|gurugram)\b/i;

const PAYMENT_TERMS_KEYWORDS =
  /\b(payment terms|credit|advance|net\s*\d+|due|upi|neft|rtgs|cod|cash on delivery|against delivery|30 days|45 days|60 days)\b/i;

const ADVANCE_KEYWORDS = /\b(advance|prepay|pre-paid|token amount|booking amount)\b/i;
const CREDIT_KEYWORDS = /\b(credit|on credit|credit limit|ledger|outstanding)\b/i;

const PINCODE_PATTERN = /\b[1-9]\d{5}\b/;

const CITY_TOKENS =
  /\b(delhi|mumbai|bangalore|bengaluru|hyderabad|chennai|kolkata|pune|ahmedabad|jaipur|lucknow|noida|gurgaon|gurugram|faridabad|ghaziabad|indore|surat|kanpur|nagpur|patna|bhopal|visakhapatnam|vadodara|ludhiana|agra|nashik|meerut|rajkot|varanasi|srinagar|aurangabad|dhanbad|amritsar|allahabad|prayagraj|ranchi|howrah|jabalpur|gwalior|vijayawada|jodhpur|madurai|raipur|kota|guwahati|chandigarh|solapur|hubli|mysore|tiruchirappalli|bareilly|moradabad|gurgaon|dehradun)\b/i;

export function extractAddressPaymentTextSignals(combinedText: string): AddressPaymentTextSignals {
  const text = combinedText.slice(0, 12000);
  const pincodeMatch = text.match(PINCODE_PATTERN);
  const paymentMatch = text.match(PAYMENT_TERMS_KEYWORDS);

  let addressSnippet: string | null = null;
  const addressLine = text
    .split(/\n/)
    .find((line) => ADDRESS_KEYWORDS.test(line) || PINCODE_PATTERN.test(line));
  if (addressLine) {
    addressSnippet = addressLine.trim().slice(0, 160);
  } else if (pincodeMatch) {
    addressSnippet = `Pincode ${pincodeMatch[0]} detected in message`;
  }

  return {
    hasAddressKeyword: ADDRESS_KEYWORDS.test(text),
    hasPincode: Boolean(pincodeMatch),
    hasCityToken: CITY_TOKENS.test(text),
    hasPaymentTermsKeyword: PAYMENT_TERMS_KEYWORDS.test(text),
    hasAdvanceKeyword: ADVANCE_KEYWORDS.test(text),
    hasCreditKeyword: CREDIT_KEYWORDS.test(text),
    addressSnippet,
    paymentTermsSnippet: paymentMatch ? paymentMatch[0].trim() : null,
  };
}
