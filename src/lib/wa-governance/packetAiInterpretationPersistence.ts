import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeConclusion,
  type PacketContentInterpretation,
} from "./packetContentInterpretation";

type PersistedRow = {
  interpretation: unknown;
  created_at: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 24)
    : [];
}

function confidence(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

export function parsePersistedPacketInterpretation(value: unknown): PacketContentInterpretation | null {
  const obj = asRecord(value);
  if (Object.keys(obj).length === 0) return null;
  const normalizedText = typeof obj.normalized_text === "string" ? obj.normalized_text.trim() : "";
  const extractedText = typeof obj.extracted_text === "string" ? obj.extracted_text.trim() : normalizedText;
  return {
    normalizedText: normalizedText.slice(0, 12000),
    extractedText: extractedText.slice(0, 12000),
    language: typeof obj.language === "string" ? obj.language.trim().slice(0, 120) : "unknown",
    confidence: confidence(obj.confidence),
    warnings: stringArray(obj.warnings),
    sourceKind: "packet",
    conclusion: normalizeConclusion(obj.conclusion),
    usedAi: true,
  };
}

/**
 * Read the newest append-only server-computed AI conclusion for a stitched packet.
 * Returns null when background processing has not completed yet; callers may use a
 * governed read-only fallback but must never make browser execution authoritative.
 */
export async function fetchLatestPacketAiInterpretation(
  supabase: SupabaseClient,
  packetId: string,
): Promise<PacketContentInterpretation | null> {
  const { data, error } = await supabase
    // Generated types intentionally lag this forward-only staging table until merge.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("whatsapp_packet_ai_interpretations" as any)
    .select("interpretation, created_at")
    .eq("packet_id", packetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[OperatorInbox] persisted packet AI lookup failed", error.message);
    return null;
  }
  return parsePersistedPacketInterpretation((data as unknown as PersistedRow | null)?.interpretation);
}
