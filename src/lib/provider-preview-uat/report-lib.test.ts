import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  displayUrlForReport,
  escapeMarkdownTableCell,
  readManifestJsonl,
  resolveProviderPreviewOutputFile,
  resolveProviderPreviewOutputRoot,
} from "../../../scripts/lib/provider-preview-report-lib.mjs";

const mergeScriptSource = readFileSync(
  path.join(process.cwd(), "scripts/merge-provider-preview-uat-report.mjs"),
  "utf8",
);

describe("provider-preview report lib", () => {
  it("escapes backslashes and pipes for Markdown table cells (CodeQL regression)", () => {
    expect(escapeMarkdownTableCell("note | pipe")).toBe("note \\| pipe");
    expect(escapeMarkdownTableCell("back\\slash")).toBe("back\\\\slash");
    expect(escapeMarkdownTableCell("a\nb")).toBe("a b");
  });

  it("resolves output files only inside the governed directory", () => {
    const root = resolveProviderPreviewOutputRoot();
    const manifest = resolveProviderPreviewOutputFile("UAT_MANIFEST_PROVIDER_PREVIEW.jsonl");
    expect(manifest.startsWith(`${root}${path.sep}`)).toBe(true);
    expect(() => resolveProviderPreviewOutputFile("../escape.json")).toThrow(/Disallowed/);
  });

  it("redacts URL userinfo for report provenance", () => {
    expect(displayUrlForReport("https://user:secret@host.vercel.app/path?q=1#x")).toBe(
      "https://host.vercel.app/path",
    );
  });

  it("merge script uses shared escape helper (no inline pipe-only replace)", () => {
    expect(mergeScriptSource).toContain("escapeMarkdownTableCell");
    expect(mergeScriptSource).not.toMatch(/\.replace\(\/\\\|\/g/);
  });

  it("skips malformed manifest lines without throwing", () => {
    const tmp = path.join(process.cwd(), "test-results", "provider-preview-uat");
    const manifest = path.join(tmp, "UAT_MANIFEST_PROVIDER_PREVIEW.jsonl");
    mkdirSync(tmp, { recursive: true });
    writeFileSync(manifest, '{"uatId":"UAT-0122"}\nnot-json\n', "utf8");
    const rows = readManifestJsonl();
    expect(rows.length).toBe(2);
    expect(rows[1].uatId).toBe("evidence-stream");
    rmSync(manifest, { force: true });
  });
});
