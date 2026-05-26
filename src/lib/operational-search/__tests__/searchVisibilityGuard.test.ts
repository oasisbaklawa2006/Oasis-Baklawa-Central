import { describe, expect, it } from "vitest";
import {
  filterIndexEntryForAuthority,
  isIndexEntryCustomerSafe,
} from "../searchVisibilityGuard";
import type { SearchIndexEntry } from "../searchIndexTypes";

function entry(partial: Partial<SearchIndexEntry>): SearchIndexEntry {
  return {
    entityType: "order",
    entityId: "00000000-0000-4000-8000-000000000001",
    orderId: "00000000-0000-4000-8000-000000000010",
    customerId: null,
    queueItemId: null,
    scanRecordId: null,
    eventId: null,
    publicRef: "SO-2026-1",
    searchTitle: "Order SO-2026-1",
    searchSubtitle: null,
    searchBody: null,
    normalizedTokens: ["so20261"],
    aliases: [],
    barcodeValues: [],
    soNumbers: ["SO-2026-1"],
    phoneTokens: [],
    emailTokens: [],
    department: null,
    visibility: "customer_safe_candidate",
    sensitivity: "normal",
    source: "test",
    metadata: {},
    ...partial,
  };
}

describe("searchVisibilityGuard", () => {
  it("rejects customer_safe_candidate with finance hold text", () => {
    expect(
      isIndexEntryCustomerSafe(
        entry({ searchTitle: "Finance hold on order", visibility: "customer_safe_candidate" }),
      ),
    ).toBe(false);
  });

  it("denies confidential sensitivity for default staff", () => {
    const r = filterIndexEntryForAuthority(entry({ sensitivity: "confidential" }), {
      role: "STAFF",
      departments: [],
      canViewConfidential: false,
      canViewRestricted: false,
    });
    expect(r.allowed).toBe(false);
  });

  it("allows staff_scoped when department matches", () => {
    const r = filterIndexEntryForAuthority(
      entry({ visibility: "staff_scoped", department: "dispatch" }),
      {
        role: "DISPATCH_MANAGER",
        departments: ["dispatch"],
        canViewConfidential: false,
        canViewRestricted: true,
      },
    );
    expect(r.allowed).toBe(true);
  });
});
