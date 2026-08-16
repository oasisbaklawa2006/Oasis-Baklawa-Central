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

type InterpretationCacheEntry = {
  promise: Promise<string>;
  expiresAt: number;
};

const DEVANAGARI = /[\u0900-\u097F]/u;
const MAX_INTERPRETABLE_MESSAGES = 16;
const MAX_INTERPRETATION_CONCURRENCY = 2;
const INTERPRETATION_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_INTERPRETATION_CACHE_ENTRIES = 128;
const interpretationCache = new Map<string, InterpretationCacheEntry>();

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

function getCachedInterpretation(providerMessageId: string): Promise<string> | null {
  const entry = interpretationCache.get(providerMessageId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    interpretationCache.delete(providerMessageId);
    return null;
  }
  // Refresh insertion order so eviction behaves as a small LRU.
  interpretationCache.delete(providerMessageId);
  interpretationCache.set(providerMessageId, entry);
  return entry.promise;
}

function storeCachedInterpretation(providerMessageId: string, promise: Promise<string>): void {
  interpretationCache.delete(providerMessageId);
  interpretationCache.set(providerMessageId, {
    promise,
    expiresAt: Date.now() + INTERPRETATION_CACHE_TTL_MS,
  });
  while (interpretationCache.size > MAX_INTERPRETATION_CACHE_ENTRIES) {
    const oldestKey = interpretationCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    interpretationCache.delete(oldestKey);
  }
}

async function interpretOne(
  supabase: SupabaseClient,
  message: InterpretablePacketMessage,
): Promise<string> {
  const providerMessageId = message.provider_message_id?.trim();
  const original = message.content ?? "";
  const fallback = DEVANAGARI.test(original) ? normalizeHindiCommerceFallback(original) : "";
  if (!providerMessageId || !messageNeedsInterpretation(message)) return fallback;

  const existing = getCachedInterpretation(providerMessageId);
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

  storeCachedInterpretation(providerMessageId, request);
  return request;
}

async function interpretWithBoundedConcurrency(
  supabase: SupabaseClient,
  eligible: InterpretablePacketMessage[],
): Promise<string[]> {
  const results = new Array<string>(eligible.length).fill("");
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= eligible.length) return;
      results[index] = await interpretOne(supabase, eligible[index]);
    }
  };

  const workerCount = Math.min(MAX_INTERPRETATION_CONCURRENCY, eligible.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

/**
 * Returns only derived interpretation text. Original packet evidence stays untouched;
 * callers append this to their read-only resolution input. Oversized interpretation
 * packets fail closed rather than silently dropping evidence that may contain a correction.
 */
export async function interpretPacketContent(
  supabase: SupabaseClient,
  messages: InterpretablePacketMessage[] | null | undefined,
): Promise<string> {
  const eligible = (messages ?? []).filter(messageNeedsInterpretation);
  if (eligible.length === 0) return "";
  if (eligible.length > MAX_INTERPRETABLE_MESSAGES) {
    throw new Error("INTERPRETATION_PACKET_TOO_LARGE");
  }

  const interpreted = await interpretWithBoundedConcurrency(supabase, eligible);
  return interpreted.filter(Boolean).join("\n").slice(0, 12000);
}
