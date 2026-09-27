/**
 * Collect top-level Playwright test result statuses from the JSON reporter output.
 * Ignores nested test.step result nodes that inflate recursive walk counts.
 */
function collectPlaywrightTestStatuses(report, titleFilter) {
  const statuses = [];
  const visitSuites = (suites) => {
    for (const suite of suites ?? []) {
      for (const spec of suite.specs ?? []) {
        const title = typeof spec?.title === "string" ? spec.title : "";
        if (titleFilter && !title.includes(titleFilter)) continue;
        for (const test of spec.tests ?? []) {
          const results = test.results ?? [];
          const last = results[results.length - 1];
          if (typeof last?.status === "string") statuses.push(last.status);
        }
      }
      visitSuites(suite.suites);
    }
  };
  visitSuites(report.suites ?? [report]);
  return statuses;
}

module.exports = { collectPlaywrightTestStatuses };
