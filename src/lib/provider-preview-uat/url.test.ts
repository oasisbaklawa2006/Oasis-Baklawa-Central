import { describe, expect, it } from "vitest";
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
});
