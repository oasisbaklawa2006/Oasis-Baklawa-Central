import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { assertStaffInviteResponse } from "@/lib/staff-invite-response";

const ui = readFileSync("src/pages/admin/AdminUsers.tsx", "utf8");
const uuid = "b8e73436-3bca-4cf5-a2ed-2b799f87cb51";

describe("Core-governed employee invitation", () => {
  it("requires a confirmed Core-owned staff identity", () => {
    expect(assertStaffInviteResponse({ ok: true, user: { id: uuid } })).toBe(uuid);
    expect(() => assertStaffInviteResponse({ ok: true })).toThrow("Core did not confirm");
    expect(() => assertStaffInviteResponse({ ok: true, user: { id: "not-a-user" } })).toThrow();
    expect(() => assertStaffInviteResponse({ ok: false, error: "not authorised to grant this role" }))
      .toThrow("not authorised");
    expect(() => assertStaffInviteResponse(null)).toThrow("not confirmed");
  });
  it("uses a server-authorized invite without emailing or revealing a temporary password", () => {
    const start = ui.indexOf("const handleCreateEmployee = async");
    const end = ui.indexOf("const handleArchiveEmployee = async");
    const createEmployee = ui.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(createEmployee).toContain('supabase.functions.invoke("admin-provision-user"');
    expect(createEmployee).toContain('mode: "invite"');
    expect(createEmployee).toContain("assertStaffInviteResponse(data)");
    expect(createEmployee).not.toContain("supabase.auth.signUp(");
    expect(createEmployee).not.toContain('.from("users")');
    expect(createEmployee).not.toContain('.from("user_role_map")');
    expect(createEmployee).not.toContain('functions.invoke("send-email"');
    expect(ui).not.toContain("generateTempPassword");
    expect(ui).not.toContain("createdCredentials.password");
    expect(ui).not.toContain("nf.password");
    expect(ui).not.toContain("Your Oasis Baklawa ERP Login Credentials");
  });
  it("does not equate role provisioning with verified invitation delivery or activation", () => {
    expect(ui).toContain("Email delivery");
    expect(ui).toContain("have not been independently confirmed");
    expect(ui).toContain("Existing");
    expect(ui).toContain("staff profile process");
  });
});
