export const STALE_EXTRACTION_DRAFT_MESSAGE =
  "This draft was created from an older WhatsApp extraction. Reject the old draft before creating a new one from the latest extraction.";

export function isExtractionVersionStale(args: {
  persistedExtractionRequestKey: string;
  liveExtractionRequestKey: string;
}): boolean {
  return args.persistedExtractionRequestKey !== args.liveExtractionRequestKey;
}

export function assertActiveDraftExtractionVersion(args: {
  persistedExtractionRequestKey: string;
  liveExtractionRequestKey: string;
  actionLabel: string;
}): void {
  if (isExtractionVersionStale(args)) {
    throw new Error(
      `Cannot ${args.actionLabel}: live extraction no longer matches the persisted draft version.`,
    );
  }
}
