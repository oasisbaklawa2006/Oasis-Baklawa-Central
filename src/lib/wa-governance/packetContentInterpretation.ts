import type { SupabaseClient } from "@supabase/supabase-js";

export type InterpretablePacketMessage = {
  id: string;
  direction: "inbound" | "outbound";
  content: string | null;
  message_type: string;
  provider_message_id?: string | null;
  media_url?: string | null;
};

export type PacketAiExplicitFact = {
  provider_message_id: string;
  kind: string;
  value: string;
};

export type PacketAiOrderLine = {
  product_name: string;
  sku: string;
  quantity: number | null;
  unit: string;
  status: "explicit" | "interpreted" | "unclear";
  evidence_ids: string[];
};

export type PacketAiCorrection = {
  provider_message_id: string;
  supersedes: string;
  replacement: string;
};

export type PacketAiConclusion = {
  intent: "NEW_ORDER" | "AMENDMENT" | "ENQUIRY" | "COMPLAINT" | "FINANCE" | "OTHER" | "UNCLEAR";
  summary: string;
  explicit_facts: PacketAiExplicitFact[];
  order_lines: PacketAiOrderLine[];
  corrections: PacketAiCorrection[];
  ambiguities: string[];
  recommended_action: string;
  human_review_required: boolean;
};

export type PacketContentInterpretation = {
  normalizedText: string;
  extractedText: string;
  language: string;
  confidence: number;
  warnings: string[];
  sourceKind: "text" | "image" | "audio" | "video" | "document" | "packet";
  conclusion: PacketAiConclusion | null;
  usedAi: boolean;
  error?: string;
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
    source_kind?: PacketContentInterpretation["sourceKind"];
    conclusion?: PacketAiConclusion;
  };
};

type InterpretationCacheEntry = {
  promise: Promise<PacketContentInterpretation>;
  expiresAt: number;
};

const DEVANAGARI = /[\u0900-\u097F]/u;
const MAX_INTERPRETABLE_MESSAGES = 16;
const INTERPRETATION_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_INTERPRETATION_CACHE_ENTRIES = 128;
const MULTIMODAL_TYPES = new Set(["image", "audio", "video", "document"]);
let interpretationCache = new Map<string, InterpretationCacheEntry>();

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
  [/काजू/gu, "kaju"],
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
  if (!message.provider_message_id?.trim()) return false;
  if ((message.content ?? "").trim()) return true;
  return MULTIMODAL_TYPES.has(message.message_type.toLowerCase());
}

function withoutCacheKey(key: string): Map<string, InterpretationCacheEntry> {
  return new Map([...interpretationCache].filter(([entryKey]) => entryKey !== key));
}

function trimCacheToLimit(): void {
  if (interpretationCache.size <= MAX_INTERPRETATION_CACHE_ENTRIES) return;
  interpretationCache = new Map(
    [...interpretationCache].slice(-MAX_INTERPRETATION_CACHE_ENTRIES),
  );
}

function getCachedInterpretation(key: string): Promise<PacketContentInterpretation> | null {
  const entry = interpretationCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    interpretationCache = withoutCacheKey(key);
    return null;
  }
  interpretationCache = withoutCacheKey(key);
  interpretationCache.set(key, entry);
  return entry.promise;
}

function storeCachedInterpretation(key: string, promise: Promise<PacketContentInterpretation>): void {
  interpretationCache = withoutCacheKey(key);
  interpretationCache.set(key, {
    promise,
    expiresAt: Date.now() + INTERPRETATION_CACHE_TTL_MS,
  });
  trimCacheToLimit();
}

function fallbackText(messages: InterpretablePacketMessage[]): string {
  const lines: string[] = [];
  for (const message of messages) {
    if (message.direction !== "inbound") continue;
    const original = (message.content ?? "").trim();
    if (!original) continue;
    lines.push(original);
    if (DEVANAGARI.test(original)) {
      const normalized = normalizeHindiCommerceFallback(original);
      if (normalized && normalized !== original) lines.push(normalized);
    }
  }
  return lines.join("\n").slice(0, 12000);
}

function fallbackInterpretation(
  messages: InterpretablePacketMessage[],
  error?: string,
): PacketContentInterpretation {
  const text = fallbackText(messages);
  return {
    normalizedText: text,
    extractedText: text,
    language: "fallback",
    confidence: 0,
    warnings: error ? [`AI interpretation unavailable: ${error}`] : [],
    sourceKind: "packet",
    conclusion: null,
    usedAi: false,
    ...(error ? { error } : {}),
  };
}

function clampConfidence(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

function normalizeConclusion(value: PacketAiConclusion | undefined): PacketAiConclusion | null {
  if (!value || typeof value !== "object") return null;
  return {
    intent: value.intent ?? "UNCLEAR",
    summary: typeof value.summary === "string" ? value.summary : "",
    explicit_facts: Array.isArray(value.explicit_facts) ? value.explicit_facts : [],
    order_lines: Array.isArray(value.order_lines) ? value.order_lines : [],
    corrections: Array.isArray(value.corrections) ? value.corrections : [],
    ambiguities: Array.isArray(value.ambiguities) ? value.ambiguities.filter((item): item is string => typeof item === "string") : [],
    recommended_action: typeof value.recommended_action === "string" ? value.recommended_action : "",
    human_review_required: value.human_review_required !== false,
  };
}

function parseSuccessfulResponse(
  response: ContentInterpretationResponse,
  fallback: string,
): PacketContentInterpretation {
  const interpretation = response.interpretation;
  if (!response.success || !interpretation) throw new Error(response.error || "INTERPRETATION_FAILED");
  const normalizedText = interpretation.normalized_text?.trim() || fallback;
  return {
    normalizedText: normalizedText.slice(0, 12000),
    extractedText: (interpretation.extracted_text?.trim() || fallback).slice(0, 12000),
    language: interpretation.language?.trim() || "unknown",
    confidence: clampConfidence(interpretation.confidence),
    warnings: Array.isArray(interpretation.warnings)
      ? interpretation.warnings.filter((item): item is string => typeof item === "string").slice(0, 24)
      : [],
    sourceKind: interpretation.source_kind ?? "packet",
    conclusion: normalizeConclusion(interpretation.conclusion),
    usedAi: true,
  };
}

function packetCacheKey(eligible: InterpretablePacketMessage[]): string {
  return eligible.map((message) => message.provider_message_id?.trim() ?? "").join("|");
}

async function requestPacketInterpretation(
  supabase: SupabaseClient,
  eligible: InterpretablePacketMessage[],
): Promise<PacketContentInterpretation> {
  const providerMessageIds = eligible
    .map((message) => message.provider_message_id?.trim())
    .filter((id): id is string => Boolean(id));
  const fallback = fallbackText(eligible);
  const { data, error } = await supabase.functions.invoke("whatsapp-content-interpret", {
    body: { provider_message_ids: providerMessageIds },
  });
  if (error) throw new Error(error.message || "INTERPRETATION_INVOKE_FAILED");
  return parseSuccessfulResponse(data as ContentInterpretationResponse, fallback);
}

/**
 * Returns one AI interpretation for the whole chronological inbound packet. Every
 * text message is eligible (English/Hindi/Hinglish/typos), along with image,
 * audio, video and document evidence. Original evidence stays immutable.
 */
export async function interpretPacketContentRich(
  supabase: SupabaseClient,
  messages: InterpretablePacketMessage[] | null | undefined,
): Promise<PacketContentInterpretation> {
  const eligible = (messages ?? []).filter(messageNeedsInterpretation);
  if (eligible.length === 0) return fallbackInterpretation(messages ?? []);
  if (eligible.length > MAX_INTERPRETABLE_MESSAGES) {
    throw new Error("INTERPRETATION_PACKET_TOO_LARGE");
  }

  const key = packetCacheKey(eligible);
  const cached = getCachedInterpretation(key);
  if (cached) {
    try {
      return await cached;
    } catch (error) {
      interpretationCache = withoutCacheKey(key);
      const message = error instanceof Error ? error.message : "INTERPRETATION_FAILED";
      return fallbackInterpretation(eligible, message);
    }
  }

  const request = requestPacketInterpretation(supabase, eligible);
  storeCachedInterpretation(key, request);
  try {
    return await request;
  } catch (error) {
    interpretationCache = withoutCacheKey(key);
    const message = error instanceof Error ? error.message : "INTERPRETATION_FAILED";
    return fallbackInterpretation(eligible, message);
  }
}

/** Backward-compatible derived text accessor used by existing read-only resolvers. */
export async function interpretPacketContent(
  supabase: SupabaseClient,
  messages: InterpretablePacketMessage[] | null | undefined,
): Promise<string> {
  const result = await interpretPacketContentRich(supabase, messages);
  return result.normalizedText;
}
