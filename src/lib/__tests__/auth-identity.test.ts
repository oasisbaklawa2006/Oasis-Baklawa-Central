import { describe, it, expect } from "vitest";
import {
  isEmailIdentifier,
  normalizeIdentifier,
  normalizePhone,
} from "@/lib/auth-identity";

describe("auth-identity", () => {
  describe("isEmailIdentifier", () => {
    it("accepts a valid email", () => {
      expect(isEmailIdentifier("user@example.com")).toBe(true);
    });
    it("trims and lowercases when matching", () => {
      expect(isEmailIdentifier("  USER@Example.COM  ")).toBe(true);
    });
    it("rejects a plain phone number", () => {
      expect(isEmailIdentifier("9891162212")).toBe(false);
    });
    it("rejects an empty string", () => {
      expect(isEmailIdentifier("")).toBe(false);
    });
  });

  describe("normalizePhone", () => {
    it("extracts last10 from a +91 number", () => {
      const r = normalizePhone("+91 98911 62212");
      expect(r.last10).toBe("9891162212");
      expect(r.e164).toBe("+919891162212");
    });
    it("handles a leading-zero variant", () => {
      const r = normalizePhone("09891162212");
      expect(r.last10).toBe("9891162212");
    });
    it("falls back when input is shorter than 10 digits", () => {
      const r = normalizePhone("12345");
      expect(r.last10).toBe("12345");
      expect(r.e164).toBe("+12345");
    });
    it("returns empty fields when nothing numeric is present", () => {
      const r = normalizePhone("abc---");
      expect(r.digits).toBe("");
      expect(r.e164).toBe("");
    });
  });

  describe("normalizeIdentifier", () => {
    it("classifies an email correctly", () => {
      const r = normalizeIdentifier("Admin@Oasis.com");
      expect(r.kind).toBe("email");
      expect(r.normalized).toBe("admin@oasis.com");
    });
    it("classifies a phone correctly and exposes last10", () => {
      const r = normalizeIdentifier("+91-98911-62212");
      expect(r.kind).toBe("phone");
      expect(r.last10).toBe("9891162212");
      expect(r.normalized).toBe("+919891162212");
    });
  });
});
