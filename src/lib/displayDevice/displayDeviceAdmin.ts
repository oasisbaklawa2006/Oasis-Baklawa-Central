import { supabase } from "@/integrations/supabase/client";

type RpcResult = { data: unknown; error: { message?: string } | null };
type DisplayRpcClient = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<RpcResult>;
};

const rpcClient = supabase as unknown as DisplayRpcClient;

export type DisplayDeviceAdminRow = {
  deviceId: string;
  surfaceKey: string;
  friendlyName: string | null;
  location: string | null;
  configVersion: number;
  active: boolean;
  apkVersion: string | null;
  lastSeenAt: string | null;
  assignedAt: string | null;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function normalizeDisplayDeviceAdminRows(value: unknown): DisplayDeviceAdminRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asObject(item);
    if (!row || typeof row.deviceId !== "string" || typeof row.surfaceKey !== "string") return [];
    return [{
      deviceId: row.deviceId,
      surfaceKey: row.surfaceKey,
      friendlyName: typeof row.friendlyName === "string" ? row.friendlyName : null,
      location: typeof row.location === "string" ? row.location : null,
      configVersion: typeof row.configVersion === "number" ? row.configVersion : Number(row.configVersion) || 1,
      active: row.active !== false,
      apkVersion: typeof row.apkVersion === "string" ? row.apkVersion : null,
      lastSeenAt: typeof row.lastSeenAt === "string" ? row.lastSeenAt : null,
      assignedAt: typeof row.assignedAt === "string" ? row.assignedAt : null,
    }];
  });
}

function assertRpc(result: RpcResult): unknown {
  if (result.error) throw new Error(result.error.message || "Display authority request failed");
  return result.data;
}

export async function assignDisplayDevice(input: {
  deviceId: string;
  enrollmentCode: string;
  surfaceKey: string;
  friendlyName?: string;
  location?: string;
}): Promise<void> {
  const result = await rpcClient.rpc("admin_assign_display_device_v1", {
    p_device_id: input.deviceId.trim(),
    p_enrollment_code: input.enrollmentCode.trim().toUpperCase(),
    p_surface_key: input.surfaceKey,
    p_friendly_name: input.friendlyName?.trim() || null,
    p_location: input.location?.trim() || null,
  });
  assertRpc(result);
}

export async function listDisplayDevices(): Promise<DisplayDeviceAdminRow[]> {
  const result = await rpcClient.rpc("admin_list_display_devices_v1");
  return normalizeDisplayDeviceAdminRows(assertRpc(result));
}

export async function revokeDisplayDevice(deviceId: string): Promise<void> {
  const result = await rpcClient.rpc("admin_revoke_display_device_v1", {
    p_device_id: deviceId.trim(),
  });
  assertRpc(result);
}
