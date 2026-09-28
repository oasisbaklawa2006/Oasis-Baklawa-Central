import { describe, expect, it } from "vitest";
import { classifyAccessWallFromSignals, DEPLOYMENT_PROTECTION_CLASS } from "./access-wall";
import { normalizeProviderPreviewUrl, redactUrlForEvidence, resolveProviderPreviewBaseUrl } from "./url";

describe("provider-preview URL helpers", () => {
  it("redacts credentials query and fragment for evidence", () => {
    expect(redactUrlForEvidence("https://user:secret@host.vercel.app/path?q=1#frag")).toBe(
      "https://host.vercel.app/path",
    );
  });

  it("rejects embedded credentials in preview URLs", () => {
    expect(() =>
      normalizeProviderPreviewUrl("https://user:pass@preview-abc-oasisbaklawa2006-6222s-projects.vercel.app"),
    ).toThrow(/credentials/i);
  });

  it("resolves governed preview URLs from secret names only", () => {
    const env = {
      TEST_AI_STUDIO_PREVIEW_URL: "https://ai-studio-preview-oasisbaklawa2006-6222s-projects.vercel.app/",
      TEST_TRACE_PREVIEW_URL: "",
    };
    expect(resolveProviderPreviewBaseUrl("ai-studio", env)).toContain("ai-studio-preview");
    expect(resolveProviderPreviewBaseUrl("trace", env)).toBeNull();
  });

  it("treats a Vercel login URL as blocking even when app markers are present", () => {
    const result = classifyAccessWallFromSignals(
      "Oasis Trace",
      "https://vercel.com/login?next=oasis-trace",
      "Oasis Trace scanner console",
    );
    expect(result.blocked).toBe(true);
    expect(result.classification).toBe(DEPLOYMENT_PROTECTION_CLASS);
  });

  it("keeps app-marker suppression for weak non-URL wall signals", () => {
    const result = classifyAccessWallFromSignals(
      "Oasis Trace",
      "https://trace-preview.vercel.app/scan",
      "Oasis Trace deployment protection status panel",
    );
    expect(result.blocked).toBe(false);
  });
});
