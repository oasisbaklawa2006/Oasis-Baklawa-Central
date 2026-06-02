/** Minimal message shape for TOOL 2 spam heuristic snippet selection. */
export type SenderIdentitySnippetMessage = {
  direction: string;
  content: string | null;
  created_at?: string | null;
  packet_sequence?: number | null;
};

function inboundSortKey(message: SenderIdentitySnippetMessage): number {
  const ts = message.created_at ? Date.parse(message.created_at) : NaN;
  if (Number.isFinite(ts)) return ts;
  return message.packet_sequence ?? 0;
}

/**
 * Matches whatsapp-identify-sender contract: optional **last** inbound snippet.
 * Uses the latest inbound non-empty message; falls back to stitched plain text.
 */
export function pickLatestInboundSnippetForIdentifySender(
  messages: SenderIdentitySnippetMessage[] | undefined,
  stitchedPlainText?: string,
  maxLength = 280,
): string | undefined {
  const inbound = (messages ?? []).filter(
    (m) => m.direction === "inbound" && (m.content ?? "").trim().length > 0,
  );

  if (inbound.length > 0) {
    const latest = [...inbound].sort((a, b) => inboundSortKey(b) - inboundSortKey(a))[0];
    return (latest.content ?? "").trim().slice(0, maxLength);
  }

  const stitched = (stitchedPlainText ?? "").trim();
  return stitched ? stitched.slice(0, maxLength) : undefined;
}
