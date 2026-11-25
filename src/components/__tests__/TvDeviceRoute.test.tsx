import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import TvDeviceRoute from "../TvDeviceRoute";
import { TV_REQUEST_TIMEOUT_MS, type TvRpcClient } from "@/lib/tvDevice";

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

  it("drops an earlier ACTIVE the moment the group changes, so another department's authorisation never leaks", async () => {
    currentRole = "TV_DISPLAY";
    const answers = new Map<string, (v: { data: unknown; error: null }) => void>();
    rpc = vi.fn((_fn: string, args?: Record<string, unknown>) => {
      const group = String(args?.p_expected_group);
      if (group === "ARABIC_SWEETS") return Promise.resolve({ data: "ACTIVE", error: null });
      return new Promise((resolve) => answers.set(group, resolve));
    });
    const view = render(
      <TvDeviceRoute group="ARABIC_SWEETS" staffRoles={STAFF} client={client()}>
        <div data-testid="tv-content">board</div>
      </TvDeviceRoute>,
    );
    await flush();
    expect(screen.getByTestId("tv-content")).toBeTruthy();

    // Same mounted route, now pointed at BAKERY whose check has not answered yet.
    view.rerender(
      <TvDeviceRoute group="BAKERY" staffRoles={STAFF} client={client()}>
        <div data-testid="tv-content">board</div>
      </TvDeviceRoute>,
    );
    expect(screen.queryByTestId("tv-content")).toBeNull();
    expect(screen.getByTestId("tv-device-checking")).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith("tv_device_status", { p_expected_group: "BAKERY" });

    // Only Core's answer for BAKERY can authorise it.
    await act(async () => {
      answers.get("BAKERY")?.({ data: "ACTIVE", error: null });
      await Promise.resolve();
    });
    expect(screen.getByTestId("tv-content")).toBeTruthy();
  });

  it("blocks the new group if Core says it is not this device's group, rather than keeping the old ACTIVE", async () => {
    currentRole = "TV_ASSEMBLY";
    rpc = vi.fn(async (_fn: string, args?: Record<string, unknown>) => ({
      data: args?.p_expected_group === "ARABIC_SWEETS" ? "ACTIVE" : "GROUP_MISMATCH",
      error: null,
    }));
    const view = render(
      <TvDeviceRoute group="ARABIC_SWEETS" staffRoles={STAFF} client={client()}>
        <div data-testid="tv-content">board</div>
      </TvDeviceRoute>,
    );
    await flush();
    expect(screen.getByTestId("tv-content")).toBeTruthy();
    view.rerender(
      <TvDeviceRoute group="FUSION_SWEETS" staffRoles={STAFF} client={client()}>
        <div data-testid="tv-content">board</div>
      </TvDeviceRoute>,
    );
    await flush();
    expect(screen.queryByTestId("tv-content")).toBeNull();
    expect(screen.getByTestId("tv-device-blocked").getAttribute("data-tv-device-status")).toBe("GROUP_MISMATCH");
  });

  it("times out a hung status request (fails closed) and keeps polling so the kiosk recovers", async () => {
    currentRole = "TV_READY";
    let call = 0;
    rpc = vi.fn(() => {
      call += 1;
      return call === 1 ? new Promise<never>(() => {}) : Promise.resolve({ data: "ACTIVE", error: null });
    });
    renderRoute("RGS");
    expect(screen.getByTestId("tv-device-checking")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TV_REQUEST_TIMEOUT_MS);
    });
    expect(screen.queryByTestId("tv-content")).toBeNull();
    expect(screen.getByTestId("tv-device-blocked").getAttribute("data-tv-device-status")).toBe("UNAVAILABLE");

    // The next one-minute poll is not stalled behind the hung call and restores the board.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000 - TV_REQUEST_TIMEOUT_MS);
    });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("tv-content")).toBeTruthy();
  });

  it("does not stack overlapping checks while one is still pending, across several poll intervals", async () => {
    currentRole = "TV_DISPLAY";
    rpc = vi.fn(() => new Promise<never>(() => {}));
    renderRoute();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(rpc).toHaveBeenCalledTimes(1);

    // The hung call is abandoned at the 10s timeout (fail closed). Right up to the first 60s poll nothing else starts.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(54_000); // t = 59s
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("tv-device-blocked").getAttribute("data-tv-device-status")).toBe("UNAVAILABLE");

    // Past the first poll exactly one new check starts; it is not doubled by the earlier hung one.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000); // t = 61s
    });
    expect(rpc).toHaveBeenCalledTimes(2);

    // And again across the second and third poll: one new check per poll, never more.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000); // t = 121s
    });
    expect(rpc).toHaveBeenCalledTimes(3);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000); // t = 181s
    });
    expect(rpc).toHaveBeenCalledTimes(4);
    expect(screen.queryByTestId("tv-content")).toBeNull();
  });

  it("a late ACTIVE from an abandoned check cannot override a later REVOKED result", async () => {
    currentRole = "TV_DISPLAY";
    let resolveFirst!: (value: { data: unknown; error: null }) => void;
    let call = 0;
    rpc = vi.fn(() => {
      call += 1;
      if (call === 1) {
        return new Promise<{ data: unknown; error: null }>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve({ data: "REVOKED", error: null });
    });
    renderRoute();

    // First check hangs and is abandoned at the timeout (fails closed).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TV_REQUEST_TIMEOUT_MS);
    });
    expect(screen.getByTestId("tv-device-blocked").getAttribute("data-tv-device-status")).toBe("UNAVAILABLE");

    // The next poll reports the device REVOKED.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000 - TV_REQUEST_TIMEOUT_MS);
    });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("tv-device-blocked").getAttribute("data-tv-device-status")).toBe("REVOKED");

    // The abandoned first request now answers ACTIVE, late. It must not restore the board.
    await act(async () => {
      resolveFirst({ data: "ACTIVE", error: null });
    });
    await flush();
    expect(screen.queryByTestId("tv-content")).toBeNull();
    expect(screen.getByTestId("tv-device-blocked").getAttribute("data-tv-device-status")).toBe("REVOKED");
  });
});
