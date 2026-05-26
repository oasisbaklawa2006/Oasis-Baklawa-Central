import { describe, expect, it } from "vitest";
import { createInMemorySearchIndexStore } from "../inMemorySearchIndexStore";
import { createSearchIndexRepository } from "../searchIndexRepository";
import { projectOrderSearchEntry } from "../searchIndexProjectionBuilder";

describe("searchIndexRepository", () => {
  it("upserts and searches by SO token", async () => {
    const repo = createSearchIndexRepository(createInMemorySearchIndexStore());
    const input = projectOrderSearchEntry({
      id: "00000000-0000-4000-8000-000000000001",
      orderNumber: "SO-2026-000001",
    });
    await repo.upsertSearchIndexEntry(input);

    const res = await repo.searchOperationalIndex(
      { text: "SO-2026-000001", limit: 10 },
      {
        role: "SUPER_ADMIN",
        departments: [],
        canViewConfidential: true,
        canViewRestricted: true,
      },
    );
    expect(res.cards.length).toBeGreaterThan(0);
    expect(res.cards[0].searchTitle).toContain("SO-2026-000001");
  });

  it("has no delete on repository contract", () => {
    const repo = createSearchIndexRepository(createInMemorySearchIndexStore());
    expect("deleteSearchIndexEntry" in repo).toBe(false);
  });
});
