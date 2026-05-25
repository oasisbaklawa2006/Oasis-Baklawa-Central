import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";
import type { OperationalPhotoMetadata } from "./operationalMediaTypes";

export function extractPhotosFromEvents(events: OperationalStoreEventRecord[]): OperationalPhotoMetadata[] {
  const photos: OperationalPhotoMetadata[] = [];
  for (const ev of events) {
    const raw = ev.metadata?.operationalPhoto;
    if (raw && typeof raw === "object") {
      photos.push(raw as OperationalPhotoMetadata);
    }
  }
  return photos;
}
