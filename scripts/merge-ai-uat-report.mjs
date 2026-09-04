import fs from "node:fs";

fs.mkdirSync("test-results", { recursive: true });

/** Escape untrusted evidence text before placing it in Markdown. */
function markdownText(value, maxLength = 1000) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** Render only URL origin and pathname, stripping credentials/query/fragment data. */
function displayUrl(value, fallback = "") {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "invalid URL";
  }
}

/** Parse the fixed JSONL evidence stream while retaining malformed-line failures. */
function loadEvidenceRows() {
  if (!fs.existsSync("test-results/ai-uat-evidence.jsonl")) return [];
  const rows = [];
  const lines = fs.readFileSync("test-results/ai-uat-evidence.jsonl", "utf8").split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line));
    } catch (error) {
      rows.push({
        uat_id: "evidence-stream",
        status: "BLOCKED",
        role: "unknown",
        expected: "Valid evidence JSONL",
        actual: `Could not parse evidence line: ${error instanceof Error ? error.message : String(error)}`,
        final_url: "",
        severity: "INFO",
        reproduction_steps: [],
      });
    }
  }
  return rows;
}

const rows = loadEvidenceRows();
const counts = { PASS: 0, FAIL: 0, BLOCKED: 0 };
for (const row of rows) {
  if (row.status in counts) counts[row.status] += 1;
}

let md = "# APPVERSE AI UAT — Tranche 1\n\n";
md += `Generated: ${new Date().toISOString()}  \n`;
md += `Target: ${markdownText(displayUrl(process.env.TEST_PREVIEW_URL, "not supplied"), 300)}  \n`;
md += `AI planner: ${process.env.AI_UAT_ENABLE_AI === "true" ? "enabled" : "disabled"}  \n`;
md += `Visual model input: ${process.env.AI_UAT_SEND_IMAGES === "true" ? "enabled (synthetic target only)" : "disabled"}\n\n`;
md += `**PASS ${counts.PASS} · FAIL ${counts.FAIL} · BLOCKED ${counts.BLOCKED}**\n\n`;
md += "| UAT | Status | Role | Severity | Final URL | Actual |\n";
md += "|---|---|---|---|---|---|\n";
for (const row of rows) {
  md += `| ${markdownText(row.uat_id, 80)} | **${markdownText(row.status, 20)}** | ${markdownText(row.role, 80)} | ${markdownText(row.severity, 20)} | ${markdownText(displayUrl(row.final_url), 220)} | ${markdownText(row.actual, 260)} |\n`;
}

md += "\n## Evidence details\n\n";
for (const row of rows) {
  md += `### ${markdownText(row.uat_id, 80)} — ${markdownText(row.status, 20)}\n\n`;
  md += `- **Role:** ${markdownText(row.role, 120)}\n`;
  md += `- **Expected:** ${markdownText(row.expected, 1200)}\n`;
  md += `- **Actual:** ${markdownText(row.actual, 1200)}\n`;
  md += `- **Final URL:** ${markdownText(displayUrl(row.final_url), 300)}\n`;
  const actions = Array.isArray(row.actions) ? row.actions : [];
  if (actions.length) {
    md += "- **AI actions:**\n";
    for (const action of actions) {
      const a = action?.action ?? {};
      const target = a.target ? ` → ${markdownText(a.target, 180)}` : "";
      const blocked = action?.error ? ` — BLOCKED: ${markdownText(action.error, 400)}` : "";
      md += `  - Step ${markdownText(action?.step ?? "?", 20)}: ${markdownText(a.action ?? "?", 40)}${target}${blocked}\n`;
    }
  }
  const consoleErrors = Array.isArray(row.console_errors) ? row.console_errors : [];
  if (consoleErrors.length) md += `- **Console errors:** ${consoleErrors.length}\n`;
  const failed = Array.isArray(row.failed_requests) ? row.failed_requests : [];
  if (failed.length) md += `- **Failed requests:** ${failed.length}\n`;
  md += "\n";
}

if (rows.length === 0) {
  md += "No UAT evidence was produced. The run was likely blocked before scenario execution.\n";
}

fs.writeFileSync("test-results/APPVERSE_AI_UAT_REPORT.md", md, "utf8");
console.log("test-results/APPVERSE_AI_UAT_REPORT.md");
