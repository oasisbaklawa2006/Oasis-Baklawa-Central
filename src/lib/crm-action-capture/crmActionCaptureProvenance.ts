import type { CrmActionCapturePhase, CrmActionCaptureSource } from "./crmActionCaptureTypes";

export const POINT62_PROVENANCE_PREFIX = "[POINT62";

export function buildPoint62ProvenanceMarker(params: {
  source: CrmActionCaptureSource;
  channel: string;
  phase: CrmActionCapturePhase;
  idempotencyKey: string;
}): string {
  return `[POINT62:${params.source}:${params.channel}:${params.phase}:idem:${params.idempotencyKey}]`;
}

export function buildCapturedNotes(marker: string, body: string): string {
  const trimmed = body.trim();
  return trimmed ? `${marker}\n${trimmed}` : marker;
}

export function stripPoint62Provenance(notes: string | null): string | null {
  if (!notes) return null;
  if (!notes.startsWith(POINT62_PROVENANCE_PREFIX)) return notes;
  const newlineIndex = notes.indexOf("\n");
  if (newlineIndex === -1) return null;
  const stripped = notes.slice(newlineIndex + 1).trim();
  return stripped || null;
}

export function extractIdempotencyKeyFromNotes(notes: string | null): string | null {
  if (!notes?.startsWith(POINT62_PROVENANCE_PREFIX)) return null;
  const match = /:idem:([^\]\n]+)/.exec(notes);
  return match?.[1] ?? null;
}
