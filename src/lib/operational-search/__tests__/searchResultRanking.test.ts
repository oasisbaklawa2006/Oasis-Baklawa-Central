import { describe, expect, it } from "vitest";
import { rankSearchEntries } from "../searchResultRanking";
import { parseOperationalSearchQuery } from "../searchQueryParser";
import type { SearchIndexEntry } from "../searchIndexTypes";

function orderEntry(so: string): SearchIndexEntry {
  return {
    entityType: "order",
    entityId: "1",
    orderId: "1",
    customerId: null,
    queueItemId: null,
    scanRecordId: null,
    eventId: null,
    publicRef: so,
    searchTitle: `Order ${so}`,
    searchSubtitle: null,
    searchBody: null,
    normalizedTokens: [so.toLowerCase()],
    aliases: [],
    barcodeValues: [],
    soNumbers: [so],
    phoneTokens: [],
    emailTokens: [],
    department: null,
    visibility: "internal",
    sensitivity: "normal",
    source: "test",
    metadata: {},
    updatedAt: "2026-05-24T12:00:00.000Z",
  };
}

describe("searchResultRanking", () => {
  it("ranks exact SO match higher", () => {
    const parsed = parseOperationalSearchQuery("SO-2026-9");
    const ranked = rankSearchEntries(
      [orderEntry("SO-2026-8"), orderEntry("SO-2026-9")],
      parsed,
    );
    expect(ranked[0]?.soNumbers[0]).toBe("SO-2026-9");
  });
});
