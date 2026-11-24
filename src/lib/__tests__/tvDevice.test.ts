import { describe, expect, it, vi } from "vitest";
import {
  TV_DEVICE_ROLES,
  TV_GROUPS,
  fetchTvDepartmentProductionQueue,
  fetchTvDeviceStatus,
  fetchTvRgsStockSnapshot,
  isTvDeviceRole,
  parseTvDeviceStatus,
  tvProductLabel,
  type TvRpcClient,
} from "../tvDevice";

const client = (reply: { data: unknown; error: { message?: string } | null } | Error): TvRpcClient => ({
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
    const queue = client({ data: [{ id: "j1", product_id: "p1" }], error: null });
    await expect(fetchTvDepartmentProductionQueue(queue)).resolves.toEqual([{ id: "j1", product_id: "p1" }]);
    expect(queue.rpc).toHaveBeenCalledWith("tv_department_production_queue");
    const stock = client({ data: [{ product_id: "p1", available_qty: 3 }], error: null });
    await expect(fetchTvRgsStockSnapshot(stock)).resolves.toEqual([{ product_id: "p1", available_qty: 3 }]);
    expect(stock.rpc).toHaveBeenCalledWith("tv_rgs_stock_snapshot");
  });

  it("surfaces read errors and treats a non-array payload as no rows", async () => {
    await expect(fetchTvDepartmentProductionQueue(client({ data: null, error: { message: "denied" } }))).rejects.toThrow("denied");
    await expect(fetchTvRgsStockSnapshot(client({ data: null, error: {} }))).rejects.toThrow("TV stock snapshot unavailable");
    await expect(fetchTvDepartmentProductionQueue(client({ data: "nope", error: null }))).resolves.toEqual([]);
  });

  it("labels products by id and never invents a name", () => {
    expect(tvProductLabel("abcdef12-0000-0000-0000-000000000000")).toBe("Product ABCDEF12");
    expect(tvProductLabel(null)).toBe("Unknown product");
    expect(tvProductLabel(undefined)).toBe("Unknown product");
  });
});
