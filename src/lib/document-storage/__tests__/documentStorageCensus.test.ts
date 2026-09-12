import { describe, expect, it } from "vitest";
import {
  POINT22_FOREIGN_PREREQUISITES,
  POINT22_STORAGE_CENSUS,
  POINT22_STORAGE_CONTRACT_SHAS,
} from "../documentStorageCensus";

describe("documentStorageCensus", () => {
  it("records Central main SHA and referenced storage contract anchors", () => {
    expect(POINT22_STORAGE_CONTRACT_SHAS.centralMain).toMatch(/^[0-9a-f]{40}$/);
    expect(POINT22_STORAGE_CONTRACT_SHAS.coreProductImagesLimits).toContain("product_images");
  });

  it("census separates Central-owned surfaces from foreign prerequisites", () => {
    const centralOwned = POINT22_STORAGE_CENSUS.filter((surface) => surface.centralOwned);
    const foreignOwned = POINT22_STORAGE_CENSUS.filter((surface) => !surface.centralOwned);
    expect(centralOwned.length).toBeGreaterThan(0);
    expect(foreignOwned.length).toBeGreaterThan(0);
    expect(centralOwned.every((surface) => surface.repository === "Central")).toBe(true);
  });

  it("marks WhatsApp media as Point41/protected-corpus separate boundary", () => {
    const whatsapp = POINT22_STORAGE_CENSUS.find((surface) => surface.id === "core-whatsapp-attachment");
    expect(whatsapp?.point41Separate).toBe(true);
    expect(whatsapp?.visibility).toBe("protected");
  });

  it("lists explicit foreign-repo prerequisites instead of duplicating authority", () => {
    expect(POINT22_FOREIGN_PREREQUISITES.some((item) => item.includes("receipts"))).toBe(true);
    expect(POINT22_FOREIGN_PREREQUISITES.some((item) => item.includes("whatsapp_attachments"))).toBe(true);
  });
});
