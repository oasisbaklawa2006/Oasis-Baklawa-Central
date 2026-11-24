import { createContext } from "react";

/**
 * Dedicated TV device sessions (Core `20260824130000_lane1_b1_tv_device_session_authority`).
 *
 * A TV device is an ordinary Supabase Auth account that already holds a governed TV role (`tv_display`,
 * `tv_assembly` or `tv_ready`) AND has an enabled, non-revoked row in `tv_devices` bound to exactly one canonical TV
 * group. Core resolves all of that server-side:
 *   - `tv_device_status(p_expected_group)` -> ACTIVE | DISABLED | REVOKED | GROUP_MISMATCH | NOT_REGISTERED
 *   - `tv_department_production_queue()`   -> production_jobs scoped to the caller's own group
 *   - `tv_rgs_stock_snapshot()`            -> FINISHED_GOODS stock balances, RGS group only
 * A TV identity never satisfies `is_internal_staff()`, so RLS denies it every other table. The client therefore may not
 * treat a TV role as proof of access: the route must see `ACTIVE` for ITS group before rendering, and must keep
 * polling so a disabled or revoked device stops showing data.
 */

export const TV_GROUPS = [
  "ARABIC_SWEETS",
  "CHOCOLATES_CONFECTIONERY",
  "FUSION_SWEETS",
  "BAKERY",
  "SEASONED_NUTS_MIXES",
  "RGS",
] as const;
export type TvGroup = (typeof TV_GROUPS)[number];

/** Client role keys (normalizeRole output) that identify a TV device account. TV_3PGS has no device row and is not one. */
export const TV_DEVICE_ROLES: readonly string[] = ["TV_DISPLAY", "TV_ASSEMBLY", "TV_READY"];

export function isTvDeviceRole(role: string | null | undefined): boolean {
  return typeof role === "string" && TV_DEVICE_ROLES.includes(role);
}

export type TvDeviceStatus = "ACTIVE" | "DISABLED" | "REVOKED" | "GROUP_MISMATCH" | "NOT_REGISTERED";
/** UNAVAILABLE = the status call failed or returned something unrecognised. It is never treated as ACTIVE. */
export type TvDeviceStatusResult = TvDeviceStatus | "UNAVAILABLE";

const KNOWN_STATUSES: readonly string[] = ["ACTIVE", "DISABLED", "REVOKED", "GROUP_MISMATCH", "NOT_REGISTERED"];

export function parseTvDeviceStatus(value: unknown): TvDeviceStatusResult {
  return typeof value === "string" && KNOWN_STATUSES.includes(value) ? (value as TvDeviceStatus) : "UNAVAILABLE";
}

export interface TvRpcClient {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
}

export async function fetchTvDeviceStatus(client: TvRpcClient, group: TvGroup): Promise<TvDeviceStatusResult> {
  try {
    const { data, error } = await client.rpc("tv_device_status", { p_expected_group: group });
    if (error) return "UNAVAILABLE";
    return parseTvDeviceStatus(data);
  } catch {
    return "UNAVAILABLE";
  }
}

export interface TvProductionJobRow {
  id: string;
  order_id: string | null;
  product_id: string | null;
  assigned_qty: number | null;
  produced_qty: number | null;
  priority: string | null;
  status: string | null;
  department: string | null;
  created_at: string | null;
}

export interface TvStockBalanceRow {
  product_id: string;
  available_qty: number | null;
}

function asRows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

/** Open production jobs for the caller's OWN device group (resolved server-side; no group argument exists). */
export async function fetchTvDepartmentProductionQueue(client: TvRpcClient): Promise<TvProductionJobRow[]> {
  const { data, error } = await client.rpc("tv_department_production_queue");
  if (error) throw new Error(error.message || "TV production queue unavailable");
  return asRows<TvProductionJobRow>(data);
}

/** FINISHED_GOODS balances; Core returns rows only for an enabled RGS device. */
export async function fetchTvRgsStockSnapshot(client: TvRpcClient): Promise<TvStockBalanceRow[]> {
  const { data, error } = await client.rpc("tv_rgs_stock_snapshot");
  if (error) throw new Error(error.message || "TV stock snapshot unavailable");
  return asRows<TvStockBalanceRow>(data);
}

/** Identifies a product when a device session may not read `products` (RLS). Never invents a name. */
export function tvProductLabel(productId: string | null | undefined): string {
  return productId ? `Product ${productId.slice(0, 8).toUpperCase()}` : "Unknown product";
}

/** True inside TvDeviceRoute's device branch only; defaults to false so every staff surface is unchanged. */
export const TvDeviceSessionContext = createContext<boolean>(false);
