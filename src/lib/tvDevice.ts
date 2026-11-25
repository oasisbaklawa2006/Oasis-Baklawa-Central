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

export type TvRpcResult = { data: unknown; error: { message?: string; code?: string } | null };

/** A PostgREST RPC builder can also be cancelled with abortSignal(); plain test doubles do not offer it. */
export type TvRpcCall = PromiseLike<TvRpcResult> & {
  abortSignal?: (signal: AbortSignal) => PromiseLike<TvRpcResult>;
};

export interface TvRpcClient {
  rpc: (fn: string, args?: Record<string, unknown>) => TvRpcCall;
}

/**
 * Upper bound for any single TV RPC. A kiosk polls forever, so a request that hangs (dead Wi-Fi, stalled proxy) must not
 * hold the refresh loop open: it is abandoned after this long and treated as a failure. Kept well under the 60s poll.
 */
export const TV_REQUEST_TIMEOUT_MS = 10_000;

export class TvRequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`TV request timed out after ${ms}ms`);
    this.name = "TvRequestTimeoutError";
  }
}

/**
 * Rejects with TvRequestTimeoutError if `work` has not settled within `ms`. The timer is always cleared.
 *
 * Pass a function to receive an AbortSignal: it is aborted when the timeout expires, so the underlying request is
 * cancelled instead of continuing in the background while the next poll starts another one.
 */
export function withTvTimeout<T>(
  work: PromiseLike<T> | ((signal: AbortSignal) => PromiseLike<T>),
  ms: number = TV_REQUEST_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      // Reject first so the timeout, not the abort error it triggers, is what the caller sees.
      reject(new TvRequestTimeoutError(ms));
      controller.abort();
    }, ms);
    let started: PromiseLike<T>;
    try {
      started = typeof work === "function" ? work(controller.signal) : work;
    } catch (error) {
      clearTimeout(timer);
      reject(error);
      return;
    }
    Promise.resolve(started).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (reason) => {
        clearTimeout(timer);
        reject(reason);
      },
    );
  });
}

/** One bounded RPC: aborted (when the client supports it) and rejected if it outlives the timeout. */
function callTvRpc(client: TvRpcClient, fn: string, args: Record<string, unknown> | undefined, ms: number) {
  return withTvTimeout<TvRpcResult>((signal) => {
    const call = args === undefined ? client.rpc(fn) : client.rpc(fn, args);
    return typeof call.abortSignal === "function" ? call.abortSignal(signal) : call;
  }, ms);
}

export async function fetchTvDeviceStatus(
  client: TvRpcClient,
  group: TvGroup,
  timeoutMs: number = TV_REQUEST_TIMEOUT_MS,
): Promise<TvDeviceStatusResult> {
  try {
    const { data, error } = await callTvRpc(client, "tv_device_status", { p_expected_group: group }, timeoutMs);
    if (error) return "UNAVAILABLE";
    return parseTvDeviceStatus(data);
  } catch {
    // Includes a timeout: an unverifiable device is never treated as ACTIVE.
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
  /** Present when Core's tv_department_production_queue_named_v1() is deployed; absent on the legacy queue RPC. */
  product_name?: string | null;
  sku?: string | null;
}

export interface TvStockBalanceRow {
  product_id: string;
  /** `inventory_stock_balances.sku` is NOT NULL in Core, so RGS rows always carry a human-readable SKU. */
  sku?: string | null;
  available_qty: number | null;
}

export class TvResponseFormatError extends Error {
  constructor(what: string) {
    super(`${what} returned an unexpected response (expected a list of rows)`);
    this.name = "TvResponseFormatError";
  }
}

/** Core returns a list of rows ([] is valid). Anything else must fail closed, never read as "no rows". */
function asRows<T>(data: unknown, what: string): T[] {
  if (!Array.isArray(data)) throw new TvResponseFormatError(what);
  return data as T[];
}

/** Core's department queue with each job's product name and SKU (a TV identity cannot read `products` itself). */
export const TV_QUEUE_NAMED_RPC = "tv_department_production_queue_named_v1";
/** Legacy queue: same rows, but only `product_id` (no name/SKU). Used only while the named RPC is not deployed. */
export const TV_QUEUE_LEGACY_RPC = "tv_department_production_queue";

/**
 * True when the RPC itself does not exist (migration not deployed yet) -- as opposed to a permission, network or
 * timeout failure, which must never be papered over by calling a different function.
 */
export function isMissingRpcError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883") return true;
  return /could not find the function|function .* does not exist/i.test(error.message ?? "");
}

/**
 * Open production jobs for the caller's OWN device group (resolved server-side; no group argument exists).
 * Prefers the named queue so the board can show a product name/SKU; falls back to the legacy queue only when Core has
 * not deployed the named RPC yet, in which case rows carry no name and the board shows a short product reference.
 */
export async function fetchTvDepartmentProductionQueue(
  client: TvRpcClient,
  timeoutMs: number = TV_REQUEST_TIMEOUT_MS,
): Promise<TvProductionJobRow[]> {
  const named = await callTvRpc(client, TV_QUEUE_NAMED_RPC, undefined, timeoutMs);
  if (!named.error) return asRows<TvProductionJobRow>(named.data, "TV production queue");
  if (!isMissingRpcError(named.error)) {
    throw new Error(named.error.message || "TV production queue unavailable");
  }
  const { data, error } = await callTvRpc(client, TV_QUEUE_LEGACY_RPC, undefined, timeoutMs);
  if (error) throw new Error(error.message || "TV production queue unavailable");
  return asRows<TvProductionJobRow>(data, "TV production queue");
}

/** FINISHED_GOODS balances; Core returns rows only for an enabled RGS device. */
export async function fetchTvRgsStockSnapshot(
  client: TvRpcClient,
  timeoutMs: number = TV_REQUEST_TIMEOUT_MS,
): Promise<TvStockBalanceRow[]> {
  const { data, error } = await callTvRpc(client, "tv_rgs_stock_snapshot", undefined, timeoutMs);
  if (error) throw new Error(error.message || "TV stock snapshot unavailable");
  return asRows<TvStockBalanceRow>(data, "TV stock snapshot");
}

/**
 * Identifies a product when a device session may not read `products` (RLS). Never invents a name.
 *
 * Priority: the product name from Core's named queue, then a SKU (RGS stock rows and the named queue both carry one),
 * then -- only when Core supplied neither, e.g. the legacy queue or a job with no product -- a short product reference.
 */
export function tvProductLabel(
  productId: string | null | undefined,
  sku?: string | null,
  name?: string | null,
): string {
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (cleanName) return cleanName;
  const cleanSku = typeof sku === "string" ? sku.trim() : "";
  if (cleanSku) return cleanSku;
  return productId ? `Product ref ${productId.slice(0, 8).toUpperCase()}` : "Unknown product";
}

/** True inside TvDeviceRoute's device branch only; defaults to false so every staff surface is unchanged. */
export const TvDeviceSessionContext = createContext<boolean>(false);
