import type { CrmActionChannel, CrmActionDeliveryState, CrmActionSource } from "./crmActionCaptureTypes";

/** Machine-readable governed capture prefix — consumed by Point 61 read adaptor. */
export const P62_CAPTURE_PREFIX = "[P62";

export type ParsedCaptureProvenance = {
  channel: CrmActionChannel | null;
  source: CrmActionSource | null;
  deliveryState: CrmActionDeliveryState | null;
  idempotencyKey: string | null;
  body: string;
};

const PROVENANCE_PATTERN =
  /^\[P62\|channel=([a-z]+)\|source=([a-z_]+)\|delivery=([a-z_]+)\|idem=([^\]]+)\]\s*/;

export function formatCaptureProvenance(params: {
  channel: CrmActionChannel;
  source: CrmActionSource;
  deliveryState: CrmActionDeliveryState;
  idempotencyKey: string;
  body: string;
}): string {
  const trimmedBody = params.body.trim();
  return `[P62|channel=${params.channel}|source=${params.source}|delivery=${params.deliveryState}|idem=${params.idempotencyKey}] ${trimmedBody}`;
}

export function parseCaptureProvenance(notes: string | null): ParsedCaptureProvenance {
  if (!notes) {
    return {
      channel: null,
      source: null,
      deliveryState: null,
      idempotencyKey: null,
      body: "",
    };
  }

  const match = notes.match(PROVENANCE_PATTERN);
  if (!match) {
    return {
      channel: null,
      source: null,
      deliveryState: null,
      idempotencyKey: null,
      body: notes,
    };
  }

  return {
    channel: match[1] as CrmActionChannel,
    source: match[2] as CrmActionSource,
    deliveryState: match[3] as CrmActionDeliveryState,
    idempotencyKey: match[4],
    body: notes.slice(match[0].length),
  };
}

/** Strip governed capture prefix for operator display and Point 61 detail projection. */
export function stripCaptureProvenance(notes: string | null): string | null {
  const parsed = parseCaptureProvenance(notes);
  if (!parsed.body) return null;
  return parsed.body;
}

export function idempotencyMarker(idempotencyKey: string): string {
  return `|idem=${idempotencyKey}`;
}
