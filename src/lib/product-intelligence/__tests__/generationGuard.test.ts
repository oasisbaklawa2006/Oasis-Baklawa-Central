import { describe, expect, it } from "vitest";
import { createGenerationGuard } from "../generationGuard";

describe("createGenerationGuard", () => {
  it("marks only the latest generation as current", () => {
    const guard = createGenerationGuard();
    const first = guard.start();
    const second = guard.start();

    expect(guard.isLatest(first)).toBe(false);
    expect(guard.isLatest(second)).toBe(true);
  });

  it("lets only the latest async completion clear a loading flag", async () => {
    const guard = createGenerationGuard();
    let loading = false;

    async function reload(delayMs: number, startDelayMs = 0): Promise<void> {
      if (startDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, startDelayMs));
      }
      const generation = guard.start();
      loading = true;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (guard.isLatest(generation)) {
        loading = false;
      }
    }

    const slow = reload(20);
    const fast = reload(20, 5);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(loading).toBe(true);

    await slow;
    expect(loading).toBe(true);

    await fast;
    expect(loading).toBe(false);
  });
});
