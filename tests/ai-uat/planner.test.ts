import { afterEach, describe, expect, it, vi } from "vitest";
import { getAiUatCase } from "../../src/lib/ai-uat/catalogue";
import { requestAiPlannerAction } from "./planner";

const ORIGINAL_API_KEY = process.env.OPENAI_API_KEY;
const ORIGINAL_SEND_IMAGES = process.env.AI_UAT_SEND_IMAGES;

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_API_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = ORIGINAL_API_KEY;
  if (ORIGINAL_SEND_IMAGES === undefined) delete process.env.AI_UAT_SEND_IMAGES;
  else process.env.AI_UAT_SEND_IMAGES = ORIGINAL_SEND_IMAGES;
});

describe("optional AI planner provider availability", () => {
  it("records HTTP 429 as BLOCKED without failing deterministic UAT", async () => {
    process.env.OPENAI_API_KEY = "test-only-key";
    process.env.AI_UAT_SEND_IMAGES = "false";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              type: "insufficient_quota",
              code: "credit_balance_exhausted",
            },
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const page = {
      evaluate: vi.fn().mockResolvedValue("button: Mobile Verification"),
      url: vi.fn().mockReturnValue("https://example.vercel.app/login"),
    } as never;

    const action = await requestAiPlannerAction({
      page,
      testCase: getAiUatCase("UAT-001"),
      history: [],
    });

    expect(action).toEqual({
      action: "finish",
      target: null,
      value: null,
      direction: null,
      status: "BLOCKED",
      reason: "Optional AI planner unavailable (HTTP 429); deterministic Playwright assertions remain authoritative.",
    });
  });
});
