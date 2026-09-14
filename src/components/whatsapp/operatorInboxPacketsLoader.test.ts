import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

import {
  OPERATOR_INBOX_INITIAL_PACKET_LIMIT,
  OPERATOR_INBOX_PACKET_PAGE_SIZE,
  fetchOpenPacketsPage,
  fetchPacketById,
  mergeAppendUniqueById,
  mergeAppendUniqueByKey,
  withTimeout,
} from "./operatorInboxPacketsLoader";
import type { OperatorInboxPacket } from "./operatorInboxTypes";

/** Minimal chainable query-builder stub mirroring the Supabase fluent API used here. */
function packetsChain(result: { data: unknown; error: { message: string } | null }) {
  const range = vi.fn().mockResolvedValue(result);
  const orderCalls: unknown[][] = [];
  const orderChain: { order: ReturnType<typeof vi.fn>; range: typeof range } = {
    order: vi.fn((...args: unknown[]) => {
      orderCalls.push(args);
      return orderChain;
    }),
    range,
  };
  const eq = vi.fn().mockReturnValue(orderChain);
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, order: orderChain.order, range, orderCalls };
}

function makePacketRow(id: string, lastMessageAt: string): OperatorInboxPacket {
  return {
    id,
    contact_id: `contact-${id}`,
    fragment_count: 1,
    status: "open",
    first_message_at: lastMessageAt,
    last_message_at: lastMessageAt,
    stitched_content: null,
    whatsapp_contacts: { phone_number: "+15551234567", customer_name: `Customer ${id}`, wa_contact_id: `wa-${id}` },
  };
}

describe("fetchOpenPacketsPage", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("requests a bounded, newest-first window rather than the full open backlog", async () => {
    const chain = packetsChain({ data: [], error: null });
    fromMock.mockReturnValue(chain);

    await fetchOpenPacketsPage(0, OPERATOR_INBOX_INITIAL_PACKET_LIMIT);

    expect(fromMock).toHaveBeenCalledWith("whatsapp_message_packets");
    expect(chain.eq).toHaveBeenCalledWith("status", "open");
    expect(chain.orderCalls).toEqual([
      ["last_message_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(chain.range).toHaveBeenCalledWith(0, OPERATOR_INBOX_INITIAL_PACKET_LIMIT - 1);
  });

  it("filters zero-message legacy packet shells without embedding child ids", async () => {
    const chain = packetsChain({ data: [], error: null });
    fromMock.mockReturnValue(chain);

    await fetchOpenPacketsPage(0, OPERATOR_INBOX_INITIAL_PACKET_LIMIT);

    expect(chain.select).toHaveBeenCalledTimes(1);
    const packetSelect = String(chain.select.mock.calls[0]?.[0] ?? "");
    expect(packetSelect).toContain("whatsapp_messages!fk_whatsapp_messages_packet_id!inner()");
    expect(packetSelect).not.toContain("whatsapp_messages!fk_whatsapp_messages_packet_id!inner (\n        id");
  });

  it("pages beyond the initial window using the same bounded page size", async () => {
    const chain = packetsChain({ data: [], error: null });
    fromMock.mockReturnValue(chain);

    await fetchOpenPacketsPage(150, OPERATOR_INBOX_PACKET_PAGE_SIZE);

    expect(chain.range).toHaveBeenCalledWith(150, 150 + OPERATOR_INBOX_PACKET_PAGE_SIZE - 1);
  });

  it("preserves the newest-first ordering the server returns without re-sorting", async () => {
    const rows = [makePacketRow("a", "2026-08-15T10:00:00Z"), makePacketRow("b", "2026-08-14T10:00:00Z")];
    fromMock.mockReturnValue(packetsChain({ data: rows, error: null }));

    const result = await fetchOpenPacketsPage(0, OPERATOR_INBOX_INITIAL_PACKET_LIMIT);

    expect(result.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("throws (rather than swallowing) when the bounded query fails", async () => {
    fromMock.mockReturnValue(packetsChain({ data: null, error: { message: "connection reset" } }));

    await expect(fetchOpenPacketsPage(0, OPERATOR_INBOX_INITIAL_PACKET_LIMIT)).rejects.toMatchObject({
      message: "connection reset",
    });
  });
});

describe("fetchPacketById", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("fetches a single packet by governed UUID and excludes empty legacy shells", async () => {
    const row = makePacketRow("packet-1", "2026-08-15T10:00:00Z");
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select, eq, maybeSingle });

    const result = await fetchPacketById("packet-1");

    expect(fromMock).toHaveBeenCalledWith("whatsapp_message_packets");
    expect(eq).toHaveBeenCalledWith("id", "packet-1");
    expect(String(select.mock.calls[0]?.[0] ?? "")).toContain(
      "whatsapp_messages!fk_whatsapp_messages_packet_id!inner()",
    );
    expect(result?.id).toBe("packet-1");
  });
});

describe("withTimeout — stalled dependency cannot hang the skeleton forever", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects with a recoverable error once the timeout elapses on a stalled promise", async () => {
    const stalled = new Promise<never>(() => {});
    const result = withTimeout(stalled, 20000, "Timed out loading the inbox packet list.");
    const assertion = expect(result).rejects.toThrow("Timed out loading the inbox packet list.");
    await vi.advanceTimersByTimeAsync(20000);
    await assertion;
  });

  it("resolves normally when the underlying promise settles before the timeout", async () => {
    const result = withTimeout(Promise.resolve("ok"), 20000, "should not fire");
    await expect(result).resolves.toBe("ok");
  });

  it("propagates the underlying rejection reason (success/failure both exit loading, not just success)", async () => {
    const result = withTimeout(Promise.reject(new Error("boom")), 20000, "should not fire");
    await expect(result).rejects.toThrow("boom");
  });
});

describe("pagination merge helpers — no silent duplication or reordering", () => {
  it("mergeAppendUniqueById appends only genuinely new packets, keeping prior newest-first order intact", () => {
    const prev = [{ id: "a" }, { id: "b" }];
    const additions = [{ id: "b" }, { id: "c" }];
    expect(mergeAppendUniqueById(prev, additions)).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
  });

  it("regression: a deterministic (last_message_at, id) tiebreaker prevents skipped packets across tied-timestamp pages", () => {
    const pageOne = ["e", "d", "c"].map((id) => ({ id }));
    const pageTwo = ["b", "a"].map((id) => ({ id }));

    let loaded = mergeAppendUniqueById([], pageOne);
    expect(loaded.map((p) => p.id)).toEqual(["e", "d", "c"]);

    const offsetForPageTwo = loaded.length;
    expect(offsetForPageTwo).toBe(3);

    loaded = mergeAppendUniqueById(loaded, pageTwo);
    expect(loaded.map((p) => p.id)).toEqual(["e", "d", "c", "b", "a"]);
    expect(new Set(loaded.map((p) => p.id)).size).toBe(loaded.length);
  });

  it("mergeAppendUniqueByKey dedups composite-keyed governed rows (e.g. evidence links)", () => {
    const prev = [{ potential_order_id: "po1", provider_message_id: "m1" }];
    const additions = [
      { potential_order_id: "po1", provider_message_id: "m1" },
      { potential_order_id: "po2", provider_message_id: "m2" },
    ];
    const merged = mergeAppendUniqueByKey(prev, additions, (l) => `${l.potential_order_id}:${l.provider_message_id}`);
    expect(merged).toEqual([
      { potential_order_id: "po1", provider_message_id: "m1" },
      { potential_order_id: "po2", provider_message_id: "m2" },
    ]);
  });
});
