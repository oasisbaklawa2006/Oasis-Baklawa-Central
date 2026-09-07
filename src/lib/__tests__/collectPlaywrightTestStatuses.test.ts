import { describe, expect, it } from "vitest";
import { collectPlaywrightTestStatuses } from "../../../scripts/factory-certification/collect-playwright-test-statuses.cjs";

describe("collectPlaywrightTestStatuses", () => {
  it("counts one status per spec test and ignores nested step suites", () => {
    const report = {
      suites: [
        {
          title: "factory-operations-golden-pipeline.cert.spec.ts",
          specs: [
            {
              title: "POINT-38 :: Golden Pipeline governance-board order status E2E",
              tests: [
                {
                  results: [
                    {
                      status: "passed",
                      steps: [
                        { title: "step-a", results: [{ status: "passed" }] },
                        { title: "step-b", results: [{ status: "passed" }] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
          suites: [
            {
              title: "nested step suite",
              specs: [
                {
                  title: "POINT-38 :: step child",
                  tests: [{ results: [{ status: "passed" }] }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(collectPlaywrightTestStatuses(report, "POINT-38 :: Golden Pipeline")).toEqual(["passed"]);
    expect(collectPlaywrightTestStatuses(report)).toEqual(["passed", "passed"]);
  });
});
