import { describe, expect, it } from "vitest";
import {
  isGovernedHttpsPaymentLink,
  parseGovernedHttpsPaymentLink,
} from "@/lib/order-authority/governedPaymentLink";

describe("governedPaymentLink", () => {
  it("accepts absolute https URLs", () => {
    expect(parseGovernedHttpsPaymentLink("https://pay.example.test/checkout")).toBe(
      "https://pay.example.test/checkout",
    );
    expect(isGovernedHttpsPaymentLink("https://pay.example.test/checkout")).toBe(true);
  });

  it("rejects javascript, http, relative, and malformed URLs", () => {
    for (const value of [
      "javascript:alert(1)",
      "http://pay.example.test/checkout",
      "/relative/path",
      "pay.example.test/checkout",
      "data:text/html,hello",
      "not a url",
    ]) {
      expect(parseGovernedHttpsPaymentLink(value)).toBeNull();
      expect(isGovernedHttpsPaymentLink(value)).toBe(false);
    }
  });
});
