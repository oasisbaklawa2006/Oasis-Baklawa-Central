import type { SupabaseClient } from "@supabase/supabase-js";

export type InterpretablePacketMessage = {
  id: string;
  direction: "inbound" | "outbound";
  content: string | null;
  message_type: string;
  provider_message_id?: string | null;
  media_url?: string | null;
};

type ContentInterpretationResponse = {
  success?: boolean;
  error?: string;
  interpretation?: {
    normalized_text?: string;
    extracted_text?: string;
    language?: string;
    confidence?: number;
    warnings?: string[];
    source_kind?: "text" | "image";
  };
};

const DEVANAGARI = /[\u0900-\u097F]/;
const interpretationCache = new Map<string, Promise<string>>();

const DEVANAGARI_DIGITS: Record<string, string> = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9",
};

const HINDI_COMMERCE_TERMS: Array<[RegExp, string]> = [
  [/किलोग्राम|किलो|किग्रा/gu, "kg"],
  [/ग्राम्स|ग्राम|ग्रा/gu, "gm"],
  [/बॉक्सेस|बॉक्स|डिब्बे|डिब्बा/gu, "box"],
  [/कार्टन्स|कार्टन/gu, "carton"],
  [/पीसेस|पीस|नग/gu, "pcs"],
  [/चाहिए|चाहिये/gu, "need"],
  [/भेजिये|भेजिए|भेजो|भेजना/gu, "send"],
  [/ऑर्डर/gu, "order"],
  [/पिरामिड/gu, "pyramid"],
  [/फिंगर/gu, "finger"],
  [/चॉकलेट्स|चॉकलेट/gu, "chocolate"],
  [/बकलावा|बाकलावा|बक्लावा/gu, "baklawa"],
  [/पिस्ताचियो|पिस्ता/gu, "pistachio"],
];

export function normalizeHindiCommerceFallback(value: string): string {
  let normalized = value.replace(/[०-९]/gu, (digit) => DEVANAGARI_DIGITS[digit] ?? digit);
  for (const [pattern, replacement] of HINDI_COMMERCE_TERMS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.replace(/\s+/g, " ").trim();
}

function messageNeedsInterpretation(message: InterpretablePacketMessage): boolean {
  if (message.direction !== "inbound") return false;
  if (DEVANAGARI.test(message.content ?? "")) return true;
  return message.message_type.toLowerCase() === "image" && Boolean(message.media_url);
}

async function interpretOne(
  supabase: SupabaseClient,
  message: InterpretablePacketMessage,
): Promise<string> {
  const providerMessageId = message.provider_message_id?.trim();
  const original = message.content ?? "";
  const fallback = DEVANAGARI.test(original) ? normalizeHindiCommerceFallback(original) : "";
  if (!providerMessageId || !messageNeedsInterpretation(message)) return fallback;

  const existing = interpretationCache.get(providerMessageId);
  if (existing) return existing;

  const request = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-content-interpret", {
        body: { provider_message_id: providerMessageId },
      });
      if (error) return fallback;
      const response = data as ContentInterpretationResponse | null;
      if (!response?.success) return fallback;
      const normalized = response.interpretation?.normalized_text?.trim() ?? "";
      return normalized || fallback;
    } catch {
      return fallback;
    }
  })();

  interpretationCache.set(providerMessageId, request);
  return request;
}

/**
 * Returns only derived interpretation text. Original packet evidence stays untouched;
 * callers append this to their read-only resolution input.
 */
export async function interpretPacketContent(
  supabase: SupabaseClient,
  messages: InterpretablePacketMessage[] | null | undefined,
): Promise<string> {
  const eligible = (messages ?? []).filter(messageNeedsInterpretation);
  if (eligible.length === 0) return "";

  const interpreted = await Promise.all(eligible.map((message) => interpretOne(supabase, message)));
  return interpreted.filter(Boolean).join("\n").slice(0, 12000);
}
