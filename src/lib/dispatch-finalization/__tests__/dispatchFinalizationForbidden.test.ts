import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..");

describe("dispatch finalization forbidden patterns", () => {
  const files = [
    "dispatchFinalizationService.ts",
    "supabaseDispatchFinalizationStore.ts",
    "dispatchFinalizationWorkflow.ts",
  ];

  for (const file of files) {
    it(`${file} has no payment/invoice/notification automation`, () => {
      const src = readFileSync(join(ROOT, file), "utf8");
      expect(src).not.toMatch(/capturePayment|generateInvoice|razorpay|stripe/i);
      expect(src).not.toMatch(/sendNotification|whatsapp|\.rpc\(/i);
      expect(src).not.toMatch(/deductStock|silentDeduct/i);
    });
  }
});
