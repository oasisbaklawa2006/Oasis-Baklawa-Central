import { afterEach, describe, expect, it, vi } from "vitest";
import { generateTempPassword } from "./temporaryPassword";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("administrator temporary passwords", () => {
  it("uses Web Crypto and preserves the 14-character format", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      for (let i = 0; i < bytes.length; i++) bytes[i] = i;
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });
    const password = generateTempPassword();
    expect(getRandomValues).toHaveBeenCalled();
    expect(password).toHaveLength(14);
    expect(password).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%]{14}$/);
  });

  it("retries after rejecting bytes outside the unbiased range", () => {
    let calls = 0;
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        calls++;
        bytes.fill(calls === 1 ? 255 : 0);
        return bytes;
      },
    });
    expect(generateTempPassword()).toBe("A".repeat(14));
    expect(calls).toBe(2);
  });
});
