import { describe, expect, it } from "vitest";
import {
  buildOperationalPhotoMetadata,
  formatPhotoNoteLine,
  photoMetadataForEvent,
} from "../operationalPhotoMetadata";

describe("operationalPhotoMetadata", () => {
  it("builds metadata for event append", () => {
    const meta = buildOperationalPhotoMetadata({
      imageReference: "internal://photo/abc",
      caption: "Line check",
      queueItemId: "00000000-0000-4000-8000-000000000099",
      department: "production",
      actorUserId: "00000000-0000-4000-8000-000000000001",
    });
    const ev = photoMetadataForEvent(meta);
    expect(ev.operationalPhoto).toBeTruthy();
    expect(formatPhotoNoteLine(meta)).toContain("Line check");
  });

  it("rejects empty reference", () => {
    expect(() =>
      buildOperationalPhotoMetadata({
        imageReference: "",
        queueItemId: "q",
        department: "production",
        actorUserId: "a",
      }),
    ).toThrow(/image_reference_required/);
  });
});
