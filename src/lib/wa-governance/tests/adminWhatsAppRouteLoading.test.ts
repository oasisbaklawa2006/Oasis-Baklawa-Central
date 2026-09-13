import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readRepoSource } from "@/lib/wa-governance/stage1PostgrestWriteScan";

const REPO_ROOT = join(import.meta.dirname, "../../../..");

describe("admin WhatsApp route loading", () => {
  it("keeps AdminLayout eager and nests lazy Suspense inside the layout Outlet", () => {
    const app = readRepoSource(REPO_ROOT, "src/App.tsx");
    const layout = readRepoSource(REPO_ROOT, "src/components/AdminLayout.tsx");
    expect(app).toContain('import AdminLayout from "@/components/AdminLayout.tsx"');
    expect(app).not.toMatch(/const AdminLayout\s*=\s*lazy\(/);
    expect(app).not.toContain("AdminRouteSuspense");
    expect(layout).toContain("AdminRouteSuspense");
    expect(layout).toContain("<Outlet />");
    expect(app).toContain('path="whatsapp"');
    expect(app).toContain('path="operator-inbox"');
  });

  it("fails admin lazy route loads to an error state within 5 seconds", () => {
    const suspense = readRepoSource(REPO_ROOT, "src/components/AdminRouteSuspense.tsx");
    expect(suspense).toContain("5_000");
    expect(suspense).toContain("failed to load");
    expect(suspense).toContain("Reload screen");
  });

  it("protected routes fail open when profile bootstrap exceeds 5 seconds", () => {
    const route = readRepoSource(REPO_ROOT, "src/components/ProtectedRoute.tsx");
    expect(route).toContain("PROFILE_BOOTSTRAP_TIMEOUT_MS = 5_000");
    expect(route).toContain("bootstrapWaitExpired");
  });

  it("operator workspace hydration fails open instead of blocking the inbox forever", () => {
    const gate = readRepoSource(REPO_ROOT, "src/components/whatsapp/OperatorInboxWorkspacePersistenceGate.tsx");
    expect(gate).toContain("HYDRATION_TIMEOUT_MS = 5_000");
    expect(gate).toContain("setReady(true)");
    expect(gate).toContain("WA_OPERATOR_WORKSPACE_HYDRATION_TIMEOUT");
  });
});
