import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TV_DEVICE_ROLES,
  TV_REQUEST_TIMEOUT_MS,
  TvRequestTimeoutError,
  TvResponseFormatError,
  withTvTimeout,
  TV_GROUPS,
  fetchTvDepartmentProductionQueue,
  fetchTvDeviceStatus,
  fetchTvRgsStockSnapshot,
  isMissingRpcError,
  isTvDeviceRole,
  TV_QUEUE_LEGACY_RPC,
  TV_QUEUE_NAMED_RPC,
  parseTvDeviceStatus,
  tvProductLabel,
  type TvRpcClient,
} from "../tvDevice";

const client = (reply: { data: unknown; error: { message?: string; code?: string } | null } | Error): TvRpcClient => ({
  rpc: vi.fn(async () => {
    if (reply instanceof Error) throw reply;
    return reply;
  }),
});

describe("TV device helpers", () => {
  it("names exactly Core's six canonical TV groups", () => {
    expect([...TV_GROUPS]).toEqual([
      "ARABIC_SWEETS",
      "CHOCOLATES_CONFECTIONERY",
      "FUSION_SWEETS",
      "BAKERY",
      "SEASONED_NUTS_MIXES",
      "RGS",
    ]);
  });

  it("treats only the three device roles as TV devices (TV_3PGS has no device row)", () => {
    expect([...TV_DEVICE_ROLES]).toEqual(["TV_DISPLAY", "TV_ASSEMBLY", "TV_READY"]);
    expect(isTvDeviceRole("TV_READY")).toBe(true);
    for (const role of ["TV_3PGS", "ADMIN", "HOD_BAKERY", "", null, undefined, "tv_display"]) {
      expect(isTvDeviceRole(role as string | null | undefined)).toBe(false);
    }
  });

  it("accepts only the five statuses Core returns and fails closed on anything else", () => {
    for (const status of ["ACTIVE", "DISABLED", "REVOKED", "GROUP_MISMATCH", "NOT_REGISTERED"]) {
      expect(parseTvDeviceStatus(status)).toBe(status);
    }
    for (const bad of ["active", "ACTIVE ", "OK", "", null, undefined, 1, true, {}, ["ACTIVE"]]) {
      expect(parseTvDeviceStatus(bad)).toBe("UNAVAILABLE");
    }
  });

  it("asks Core about the route's own group with Core's exact argument name", async () => {
    const c = client({ data: "ACTIVE", error: null });
    await expect(fetchTvDeviceStatus(c, "BAKERY")).resolves.toBe("ACTIVE");
    expect(c.rpc).toHaveBeenCalledWith("tv_device_status", { p_expected_group: "BAKERY" });
  });

  it("reports UNAVAILABLE (never ACTIVE) on an RPC error, a thrown error or an odd payload", async () => {
    await expect(fetchTvDeviceStatus(client({ data: "ACTIVE", error: { message: "boom" } }), "RGS")).resolves.toBe("UNAVAILABLE");
    await expect(fetchTvDeviceStatus(client(new Error("network")), "RGS")).resolves.toBe("UNAVAILABLE");
    await expect(fetchTvDeviceStatus(client({ data: { status: "ACTIVE" }, error: null }), "RGS")).resolves.toBe("UNAVAILABLE");
  });

  it("reads the group-scoped queue and stock snapshot without passing a group", async () => {
    const queue = client({ data: [{ id: "j1", product_id: "p1", product_name: "Pistachio Baklawa", sku: "BKL-1" }], error: null });
    await expect(fetchTvDepartmentProductionQueue(queue)).resolves.toEqual([
      { id: "j1", product_id: "p1", product_name: "Pistachio Baklawa", sku: "BKL-1" },
    ]);
    expect(queue.rpc).toHaveBeenCalledTimes(1);
    expect(queue.rpc).toHaveBeenCalledWith(TV_QUEUE_NAMED_RPC);
    const stock = client({ data: [{ product_id: "p1", available_qty: 3 }], error: null });
    await expect(fetchTvRgsStockSnapshot(stock)).resolves.toEqual([{ product_id: "p1", available_qty: 3 }]);
    expect(stock.rpc).toHaveBeenCalledWith("tv_rgs_stock_snapshot");
  });

  describe("department queue: named RPC with a legacy fallback only while Core has not deployed it", () => {
    const sequence = (replies: Array<{ data: unknown; error: { message?: string; code?: string } | null } | Error>) => {
      const calls: string[] = [];
      const c: TvRpcClient = {
        rpc: vi.fn(async (fn: string) => {
          calls.push(fn);
          const next = replies[calls.length - 1];
          if (next instanceof Error) throw next;
          return next;
        }),
      };
      return { c, calls };
    };

    it("uses the legacy queue when the named RPC does not exist yet (PostgREST PGRST202)", async () => {
      const { c, calls } = sequence([
        { data: null, error: { code: "PGRST202", message: "Could not find the function public.tv_department_production_queue_named_v1 in the schema cache" } },
        { data: [{ id: "j1", product_id: "p1" }], error: null },
      ]);
      await expect(fetchTvDepartmentProductionQueue(c)).resolves.toEqual([{ id: "j1", product_id: "p1" }]);
      expect(calls).toEqual([TV_QUEUE_NAMED_RPC, TV_QUEUE_LEGACY_RPC]);
    });

    it("also falls back on Postgres undefined_function (42883)", async () => {
      const { c, calls } = sequence([
        { data: null, error: { code: "42883", message: "function does not exist" } },
        { data: [], error: null },
      ]);
      await expect(fetchTvDepartmentProductionQueue(c)).resolves.toEqual([]);
      expect(calls).toEqual([TV_QUEUE_NAMED_RPC, TV_QUEUE_LEGACY_RPC]);
    });

    it("does NOT fall back on a permission or other failure: the legacy RPC is never used to paper over it", async () => {
      const { c, calls } = sequence([
        { data: null, error: { code: "42501", message: "permission denied for function" } },
        { data: [{ id: "should-not-be-read" }], error: null },
      ]);
      await expect(fetchTvDepartmentProductionQueue(c)).rejects.toThrow("permission denied for function");
      expect(calls).toEqual([TV_QUEUE_NAMED_RPC]);
    });

    it("does NOT fall back on a thrown network error", async () => {
      const { c, calls } = sequence([new Error("network down")]);
      await expect(fetchTvDepartmentProductionQueue(c)).rejects.toThrow("network down");
      expect(calls).toEqual([TV_QUEUE_NAMED_RPC]);
    });

    it("surfaces an error from the legacy queue after a fallback", async () => {
      const { c, calls } = sequence([
        { data: null, error: { code: "PGRST202", message: "Could not find the function" } },
        { data: null, error: { message: "legacy denied" } },
      ]);
      await expect(fetchTvDepartmentProductionQueue(c)).rejects.toThrow("legacy denied");
      expect(calls).toEqual([TV_QUEUE_NAMED_RPC, TV_QUEUE_LEGACY_RPC]);
    });

    it("does NOT fall back when the named RPC hangs: a timeout is a failure, not a missing function", async () => {
      vi.useFakeTimers();
      try {
        const calls: string[] = [];
        const c: TvRpcClient = {
          rpc: vi.fn((fn: string) => {
            calls.push(fn);
            return new Promise(() => {}) as never;
          }),
        };
        const pending = fetchTvDepartmentProductionQueue(c, 1000);
        const assertion = expect(pending).rejects.toBeInstanceOf(TvRequestTimeoutError);
        await vi.advanceTimersByTimeAsync(1000);
        await assertion;
        expect(calls).toEqual([TV_QUEUE_NAMED_RPC]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("recognises only a missing function as a missing RPC", () => {
      expect(isMissingRpcError({ code: "PGRST202" })).toBe(true);
      expect(isMissingRpcError({ code: "42883" })).toBe(true);
      expect(isMissingRpcError({ message: "Could not find the function public.x in the schema cache" })).toBe(true);
      for (const error of [null, undefined, {}, { message: "permission denied" }, { code: "42501" }, { code: "PGRST301", message: "JWT expired" }]) {
        expect(isMissingRpcError(error as never)).toBe(false);
      }
    });
  });

  it("surfaces read errors", async () => {
    await expect(fetchTvDepartmentProductionQueue(client({ data: null, error: { message: "denied" } }))).rejects.toThrow("denied");
    await expect(fetchTvRgsStockSnapshot(client({ data: null, error: {} }))).rejects.toThrow("TV stock snapshot unavailable");
  });

  it("accepts an empty list as a real answer but rejects any other payload instead of reading it as no rows", async () => {
    await expect(fetchTvDepartmentProductionQueue(client({ data: [], error: null }))).resolves.toEqual([]);
    await expect(fetchTvRgsStockSnapshot(client({ data: [], error: null }))).resolves.toEqual([]);
    for (const bad of ["nope", null, undefined, {}, { rows: [] }, 0, true]) {
      await expect(fetchTvDepartmentProductionQueue(client({ data: bad, error: null }))).rejects.toBeInstanceOf(TvResponseFormatError);
      await expect(fetchTvRgsStockSnapshot(client({ data: bad, error: null }))).rejects.toBeInstanceOf(TvResponseFormatError);
    }
  });

  it("also rejects a malformed payload from the legacy queue after a fallback", async () => {
    const calls: string[] = [];
    const c: TvRpcClient = {
      rpc: vi.fn(async (fn: string) => {
        calls.push(fn);
        return calls.length === 1
          ? { data: null, error: { code: "PGRST202", message: "Could not find the function" } }
          : { data: "nope", error: null };
      }),
    };
    await expect(fetchTvDepartmentProductionQueue(c)).rejects.toBeInstanceOf(TvResponseFormatError);
    expect(calls).toEqual([TV_QUEUE_NAMED_RPC, TV_QUEUE_LEGACY_RPC]);
  });

  it("labels products by SKU when Core provides one, else by an honest reference, and never invents a name", () => {
    expect(tvProductLabel("abcdef12-0000-0000-0000-000000000000", "BKL-PIST-250")).toBe("BKL-PIST-250");
    expect(tvProductLabel("abcdef12-0000-0000-0000-000000000000", "  ")).toBe("Product ref ABCDEF12");
    expect(tvProductLabel("abcdef12-0000-0000-0000-000000000000")).toBe("Product ref ABCDEF12");
    expect(tvProductLabel(null)).toBe("Unknown product");
    expect(tvProductLabel(undefined)).toBe("Unknown product");
  });

  it("prefers the product name, then the SKU, then an honest reference", () => {
    const id = "abcdef12-0000-0000-0000-000000000000";
    expect(tvProductLabel(id, "BKL-1", "Pistachio Baklawa 250g")).toBe("Pistachio Baklawa 250g");
    expect(tvProductLabel(id, "BKL-1", "   ")).toBe("BKL-1");
    expect(tvProductLabel(id, null, null)).toBe("Product ref ABCDEF12");
    expect(tvProductLabel(null, null, "Name without id")).toBe("Name without id");
  });

  describe("bounded requests (hung network must not stall a kiosk)", () => {
    afterEach(() => vi.useRealTimers());
    const hung = (): TvRpcClient => ({ rpc: vi.fn(() => new Promise<never>(() => {})) as unknown as TvRpcClient["rpc"] });

    it("keeps the timeout well under the one-minute poll", () => {
      expect(TV_REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
      expect(TV_REQUEST_TIMEOUT_MS).toBeLessThan(60_000);
    });

    it("abandons a status request that never answers and reports UNAVAILABLE (never ACTIVE)", async () => {
      vi.useFakeTimers();
      const result = fetchTvDeviceStatus(hung(), "BAKERY");
      await vi.advanceTimersByTimeAsync(TV_REQUEST_TIMEOUT_MS);
      await expect(result).resolves.toBe("UNAVAILABLE");
    });

    it("rejects the queue and stock reads on timeout so the board shows an error, not an empty list", async () => {
      vi.useFakeTimers();
      const queue = fetchTvDepartmentProductionQueue(hung());
      const stock = fetchTvRgsStockSnapshot(hung());
      const settled = Promise.allSettled([queue, stock]);
      await vi.advanceTimersByTimeAsync(TV_REQUEST_TIMEOUT_MS);
      const [q, s] = await settled;
      expect(q.status).toBe("rejected");
      expect(s.status).toBe("rejected");
      expect((q as PromiseRejectedResult).reason).toBeInstanceOf(TvRequestTimeoutError);
    });

    it("does not fire the timeout once the request has answered, and leaves no pending timer", async () => {
      vi.useFakeTimers();
      await expect(withTvTimeout(Promise.resolve("ok"), 1000)).resolves.toBe("ok");
      expect(vi.getTimerCount()).toBe(0);
    });

    it("still honours a custom timeout", async () => {
      vi.useFakeTimers();
      const result = fetchTvDeviceStatus(hung(), "RGS", 250);
      await vi.advanceTimersByTimeAsync(250);
      await expect(result).resolves.toBe("UNAVAILABLE");
    });
  });
});

describe("TV RPC cancellation (a timed-out request must not keep running)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** A PostgREST-style call: awaitable, with abortSignal() that records the signal and resolves/rejects on it. */
  function abortableClient(answer?: { data: unknown; error: null }) {
    const state = { signals: [] as AbortSignal[], aborted: 0 };
    const rpc = vi.fn(() => {
      const call = {
        then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          (answer ? Promise.resolve(answer) : new Promise<never>(() => {})).then(onFulfilled, onRejected),
        abortSignal: (signal: AbortSignal) => {
          state.signals.push(signal);
          signal.addEventListener("abort", () => {
            state.aborted += 1;
          });
          return call;
        },
      };
      return call;
    });
    return { client: { rpc } as unknown as TvRpcClient, state, rpc };
  }

  it("aborts the underlying request when the timeout expires, and still reports a timeout", async () => {
    vi.useFakeTimers();
    const { client: c, state } = abortableClient();
    const pending = fetchTvDepartmentProductionQueue(c, 1000);
    const assertion = expect(pending).rejects.toBeInstanceOf(TvRequestTimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(state.signals).toHaveLength(1);
    expect(state.signals[0].aborted).toBe(true);
    expect(state.aborted).toBe(1);
  });

  it("aborts the status check too (fails closed to UNAVAILABLE)", async () => {
    vi.useFakeTimers();
    const { client: c, state } = abortableClient();
    const pending = fetchTvDeviceStatus(c, "BAKERY", 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toBe("UNAVAILABLE");
    expect(state.signals[0].aborted).toBe(true);
  });

  it("does not abort a request that answered in time", async () => {
    const { client: c, state } = abortableClient({ data: [], error: null });
    await expect(fetchTvRgsStockSnapshot(c)).resolves.toEqual([]);
    expect(state.signals).toHaveLength(1);
    expect(state.signals[0].aborted).toBe(false);
  });

  it("still works with a client that has no abortSignal (plain promise)", async () => {
    await expect(fetchTvRgsStockSnapshot(client({ data: [], error: null }))).resolves.toEqual([]);
  });

  it("hands withTvTimeout's work function a signal that is aborted on timeout and not before", async () => {
    vi.useFakeTimers();
    let seen: AbortSignal | undefined;
    const pending = withTvTimeout((signal) => {
      seen = signal;
      return new Promise<never>(() => {});
    }, 500);
    const assertion = expect(pending).rejects.toBeInstanceOf(TvRequestTimeoutError);
    expect(seen?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
    expect(seen?.aborted).toBe(true);
  });
});
