import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import TvDeviceRoute from "../TvDeviceRoute";
import type { TvRpcClient } from "@/lib/tvDevice";

let currentRole: string | null = null;
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ role: currentRole }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
// RoleProtectedRoute's own server-role verification is covered elsewhere; here it is a role allow-list.
vi.mock("@/components/RoleProtectedRoute", () => ({
  default: ({ allowedRoles, children }: { allowedRoles: string[]; children: ReactNode }) =>
    currentRole && allowedRoles.includes(currentRole) ? <>{children}</> : <div data-testid="role-denied" />,
}));

const STAFF = ["HOD_ARABIC", "PROD_ARABIC_SWEETS", "SUPER_ADMIN", "ADMIN"];
let statusReply: { data: unknown; error: { message?: string } | null } | Error;
let rpc: ReturnType<typeof vi.fn>;
const client = (): TvRpcClient => ({ rpc: rpc as unknown as TvRpcClient["rpc"] });

const renderRoute = (group: "ARABIC_SWEETS" | "RGS" = "ARABIC_SWEETS") =>
  render(
    <TvDeviceRoute group={group} staffRoles={STAFF} client={client()}>
      <div data-testid="tv-content">department board</div>
    </TvDeviceRoute>,
  );
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  statusReply = { data: "ACTIVE", error: null };
  rpc = vi.fn(async () => {
    if (statusReply instanceof Error) throw statusReply;
    return statusReply;
  });
});
afterEach(() => {
  vi.useRealTimers();
  currentRole = null;
});

describe("TvDeviceRoute", () => {
  it("shows the board to a TV device only after Core reports it ACTIVE for this group", async () => {
    currentRole = "TV_DISPLAY";
    renderRoute("ARABIC_SWEETS");
    expect(screen.queryByTestId("tv-content")).toBeNull();
    expect(screen.getByTestId("tv-device-checking")).toBeTruthy();
    await flush();
    expect(rpc).toHaveBeenCalledWith("tv_device_status", { p_expected_group: "ARABIC_SWEETS" });
    expect(screen.getByTestId("tv-content")).toBeTruthy();
  });

  it.each(["NOT_REGISTERED", "DISABLED", "REVOKED", "GROUP_MISMATCH"])("blocks a device that Core reports %s", async (status) => {
    currentRole = "TV_ASSEMBLY";
    statusReply = { data: status, error: null };
    renderRoute();
    await flush();
    expect(screen.queryByTestId("tv-content")).toBeNull();
    expect(screen.getByTestId("tv-device-blocked").getAttribute("data-tv-device-status")).toBe(status);
  });

  it("fails closed when the status call errors, throws or returns something unrecognised", async () => {
    currentRole = "TV_READY";
    for (const reply of [
      { data: "ACTIVE", error: { message: "rpc failed" } },
      new Error("network down"),
      { data: "SUPERUSER", error: null },
      { data: null, error: null },
    ] as const) {
      statusReply = reply as typeof statusReply;
      const { unmount } = renderRoute("RGS");
      await flush();
      expect(screen.queryByTestId("tv-content")).toBeNull();
      expect(screen.getByTestId("tv-device-blocked").getAttribute("data-tv-device-status")).toBe("UNAVAILABLE");
      unmount();
    }
  });

  it("stops showing data once a running device is disabled or revoked (re-checks every minute)", async () => {
    currentRole = "TV_DISPLAY";
    renderRoute();
    await flush();
    expect(screen.getByTestId("tv-content")).toBeTruthy();
    statusReply = { data: "REVOKED", error: null };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(screen.queryByTestId("tv-content")).toBeNull();
    expect(screen.getByTestId("tv-device-blocked").getAttribute("data-tv-device-status")).toBe("REVOKED");
  });

  it("keeps staff roles on the unchanged role guard without any device check", async () => {
    currentRole = "HOD_ARABIC";
    renderRoute();
    await flush();
    expect(screen.getByTestId("tv-content")).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("still denies a role that is neither staff-allowed nor a device", async () => {
    currentRole = "SALES_EXECUTIVE";
    renderRoute();
    await flush();
    expect(screen.queryByTestId("tv-content")).toBeNull();
    expect(screen.getByTestId("role-denied")).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not treat TV_3PGS as a device (no device row exists for it)", async () => {
    currentRole = "TV_3PGS";
    renderRoute();
    await flush();
    expect(rpc).not.toHaveBeenCalled();
    expect(screen.queryByTestId("tv-content")).toBeNull();
  });
});
