import { describe, expect, it } from "vitest";
import { buildMediaVaultProjectionCatalog, groupMediaVaultItems } from "@/lib/media-vault/mediaVaultProjection";

describe("buildMediaVaultProjectionCatalog", () => {
  it("emits deterministic ids and marks shell samples", () => {
    const rows = buildMediaVaultProjectionCatalog();
    expect(rows.every((r) => r.isShellSample)).toBe(true);
    expect(rows.map((r) => r.id).sort()[0]).toBe("media-vault:shell:customer_reference_image");
  });

  it("groups by vault group without overlap", () => {
    const rows = buildMediaVaultProjectionCatalog();
    const g = groupMediaVaultItems(rows);
    const total = Object.values(g).reduce((n, a) => n + a.length, 0);
    expect(total).toBe(rows.length);
    expect(g.financial.map((x) => x.kind).sort()).toEqual(["invoice_document", "payment_receipt"].sort());
  });
});
