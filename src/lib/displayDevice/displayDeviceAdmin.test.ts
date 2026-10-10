import { describe, expect, it } from "vitest";
import { normalizeDisplayDeviceAdminRows } from "./displayDeviceAdmin";

describe("displayDeviceAdmin", () => {
  it("normalizes governed rows and drops malformed records", () => {
    expect(normalizeDisplayDeviceAdminRows([
      {
        deviceId: "tv-00000000-0000-0000-0000-000000000001",
        surfaceKey: "ready-goods",
        friendlyName: "RGS TV",
        configVersion: 4,
        active: true,
        apkVersion: "2.0.0",
      },
      { surfaceKey: "ready-goods" },
    ])).toEqual([
      expect.objectContaining({
        deviceId: "tv-00000000-0000-0000-0000-000000000001",
        surfaceKey: "ready-goods",
        configVersion: 4,
        active: true,
      }),
    ]);
  });

  it("fails closed for a non-array list payload", () => {
    expect(normalizeDisplayDeviceAdminRows({ deviceId: "forged" })).toEqual([]);
  });
});
