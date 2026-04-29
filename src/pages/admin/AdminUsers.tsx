import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Plus, UserPlus, Building2, LockKeyhole, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";

/* ─── types ─── */
interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  department: string | null;
  designation: string | null;
  is_active: boolean | null;
  invite_status: string | null;
  mobile_number: string | null;
  company_id: string | null;
  created_at: string | null;
  commission_rate_percentage: number | null;
  is_sales_executive: boolean | null;
}

interface CompanyRow {
  id: string;
  business_name: string;
  gst_number: string | null;
  credit_limit: number | null;
  wallet_balance: number | null;
  account_manager_id: string | null;
}

interface ManagerOption {
  id: string;
  label: string;
}

interface RoleRow {
  id: string;
  role_key: string;
  role_name: string;
  is_active: boolean | null;
}

interface PermissionRow {
  id: string;
  permission_key: string;
  permission_name: string;
  module_name: string;
}

interface RolePermMap {
  id: string;
  role_id: string | null;
  permission_id: string | null;
}

/* ─── Constants ─── */
const MODULES = [
  "Client Governance",
  "Product Catalog",
  "Pricing Matrix",
  "Orders",
  "Production",
  "Assembly",
  "Packing",
  "Dispatch",
  "Finance",
  "Support",
  "Settings",
  "Audit",
];

const DEPARTMENTS = [
  "Assembly",
  "Packaging Store",
  "Bakery",
  "Chocolate",
  "Baklawa",
  "Fusion Sweets",
  "Nuts and Mixes",
  "Dragees",
  "Operations",
  "Ready Goods Store",
];

const DEFAULT_MODULE_MAP: Record<string, string[]> = {
  super_admin: [...MODULES],
  finance_head: ["Finance", "Orders", "Audit"],
  finance_exec: ["Finance", "Orders"],
  operations_manager: ["Production", "Assembly", "Packing", "Dispatch", "Orders"],
  dispatch_manager: ["Dispatch", "Packing", "Orders"],
  dispatch_incharge: ["Dispatch", "Packing"],
  security_control: ["Dispatch"],
  store_incharge: ["Production", "Orders"],
  hod_arabic: ["Production", "Orders"],
  hod_fusion: ["Production", "Orders"],
  hod_chocolate: ["Production", "Orders"],
  hod_bakery: ["Production", "Orders"],
  hod_nuts: ["Production", "Orders"],
  hod_assembly: ["Assembly", "Packing"],
  sales_executive: ["Orders", "Client Governance", "Product Catalog"],
  production_manager: ["Production", "Assembly", "Orders"],
  support_executive: ["Support", "Orders"],
  customer_user: [],
};

const INVITE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  invited: { label: "Invited", color: "bg-amber-100 text-amber-700" },
  active: { label: "Active", color: "bg-green-100 text-green-700" },
  inactive: { label: "Inactive", color: "bg-muted text-muted-foreground" },
  blocked: { label: "Blocked", color: "bg-red-100 text-red-700" },
};

const AdminUsers = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState("employees");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionRow[]>([]);
  const [rolePermMap, setRolePermMap] = useState<RolePermMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCredit, setEditingCredit] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [rolePermsEditing, setRolePermsEditing] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);

  // Temp password success modal
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ name: string; email: string; password: string; role: string } | null>(null);

  const [nf, setNf] = useState({
    name: "",
    email: "",
    mobile: "",
    dept: "",
    designation: "",
    role: "",
    password: "",
    status: "invited" as string,
  });
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const [usersRes, companiesRes, rolesRes, permsRes, rpMapRes] = await Promise.all([
      supabase.from("users").select("*").order("created_at", { ascending: false }),
      supabase.from("companies").select("*").order("created_at", { ascending: false }),
      supabase.from("roles").select("*").order("role_name"),
      supabase.from("permissions").select("*").order("module_name, permission_name"),
      supabase.from("role_permission_map").select("*"),
    ]);
    const allUsers = (usersRes.data as UserRow[]) ?? [];
    setUsers(allUsers);

    const me = allUsers.find((u) => u.id === user?.id);
    if (me) setCurrentUserRole(me.role);

    setCompanies((companiesRes.data as CompanyRow[]) ?? []);
    setRoles((rolesRes.data as RoleRow[]) ?? []);
    setAllPermissions((permsRes.data as PermissionRow[]) ?? []);
    setRolePermMap((rpMapRes.data as RolePermMap[]) ?? []);

    const mgrs: ManagerOption[] = allUsers
      .filter((u) => u.role === "sales_executive" || u.role === "admin" || u.is_sales_executive)
      .map((u) => ({ id: u.id, label: u.full_name || u.email || u.id }));
    setManagers(mgrs);

    if (!opts?.silent) setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const permsByModule = (mod: string) => allPermissions.filter((p) => p.module_name === mod);

  const getPermIdsForModules = (mods: string[]) =>
    allPermissions.filter((p) => mods.includes(p.module_name)).map((p) => p.id);

  const getRolePermIds = (roleId: string) =>
    rolePermMap
      .filter((m) => m.role_id === roleId)
      .map((m) => m.permission_id!)
      .filter(Boolean);

  const handleNewRoleChange = (roleKey: string) => {
    setNf((prev) => ({ ...prev, role: roleKey }));
    const defaults = DEFAULT_MODULE_MAP[roleKey] ?? [];
    setSelectedPermIds(getPermIdsForModules(defaults));
  };

  const generateTempPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 14; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  };

  const handleCreateEmployee = async () => {
    if (!nf.name.trim() || !nf.email.trim() || !nf.role) {
      toast.error("Name, Email, and Role are required");
      return;
    }
    if (!nf.password || nf.password.length < 6) {
      toast.error("Password is required (minimum 6 characters)");
      return;
    }
    setSaving("new");

    const roleRecord = roles.find((r) => r.role_key === nf.role);
    const chosenPassword = nf.password;

    // Auth redirect is locked to the production domain to avoid preview-URL leakage.
    const SITE_URL = "https://b2b.oasisbaklawa.com";
    const inviteRedirect = `${SITE_URL}/login`;

    // 1. Create the auth user with admin-set password
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: nf.email.trim(),
      password: chosenPassword,
      options: {
        emailRedirectTo: inviteRedirect,
        data: { full_name: nf.name, role: nf.role },
      },
    });

    if (authError) {
      // Handles "User already registered" gracefully — falls back to a magic-link invite.
      const looksDuplicate = /already|exist|registered/i.test(authError.message);
      if (looksDuplicate) {
        const { error: linkErr } = await supabase.auth.signInWithOtp({
          email: nf.email.trim(),
          options: { emailRedirectTo: inviteRedirect },
        });
        if (linkErr) {
          toast.error("User already exists; failed to send invite link: " + linkErr.message);
        } else {
          toast.success(`Invite link sent to ${nf.email.trim()} (user already existed).`);
        }
      } else {
        toast.error("Failed to create auth account: " + authError.message);
      }
      setSaving(null);
      return;
    }

    const newUserId = authData.user?.id;

    // GUARD: if email confirmation is required, no user row exists yet — send invite link instead.
    if (!newUserId) {
      await supabase.auth.signInWithOtp({
        email: nf.email.trim(),
        options: { emailRedirectTo: inviteRedirect },
      });
      toast.success(`Invite link sent to ${nf.email.trim()}. They'll complete setup on first login.`);
      setSaving(null);
      setShowModal(false);
      setNf({ name: "", email: "", mobile: "", dept: "", designation: "", role: "", password: "", status: "invited" });
      setSelectedPermIds([]);
      return;
    }

    // 2. Update the users table record (created by trigger) with full details
    await supabase
      .from("users")
      .update({
        full_name: nf.name,
        mobile_number: nf.mobile || null,
        role: nf.role,
        department: nf.dept || null,
        designation: nf.designation || null,
        is_active: true,
        invite_status: "active",
      })
      .eq("id", newUserId);

    // Staff roles: auto-approve in profiles table (defensive — non-fatal if it fails)
    const staffRoleSet = new Set([
      "super_admin", "admin", "finance_head", "finance_exec",
      "operations_manager", "production_manager",
      "hod_arabic", "hod_fusion", "hod_chocolate", "hod_bakery", "hod_nuts", "hod_assembly",
      "store_incharge", "dispatch_manager", "dispatch_incharge", "security_control",
      "sales_executive", "support_executive",
    ]);
    if (staffRoleSet.has(nf.role)) {
      const { error: profileErr } = await supabase
        .from("profiles")
        .upsert({
          id: newUserId,
          email: nf.email.trim(),
          full_name: nf.name,
          role: nf.role,
          is_approved: true,
          department: nf.dept || null,
        } as any, { onConflict: "id" });
      if (profileErr) {
        console.warn("[AdminUsers] profiles upsert non-fatal:", profileErr.message);
      }
    }

    // 3. Map role permissions
    if (roleRecord) {
      await supabase.from("user_role_map").insert({ user_id: newUserId, role_id: roleRecord.id });
    }

    if (roleRecord && selectedPermIds.length > 0) {
      const existingForRole = getRolePermIds(roleRecord.id);
      const newPerms = selectedPermIds.filter((pid) => !existingForRole.includes(pid));
      if (newPerms.length > 0) {
        await supabase
          .from("role_permission_map")
          .insert(newPerms.map((pid) => ({ role_id: roleRecord.id, permission_id: pid })));
      }
    }

    // 4. Send credentials email via Edge Function
    try {
      const { data: emailResult, error: emailError } = await supabase.functions.invoke("send-email", {
        body: {
          to: nf.email.trim(),
          subject: "Your Oasis Baklawa ERP Login Credentials",
          html: `
            <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #1c1c1c; color: #f5f5f5; border-radius: 12px;">
              <h1 style="color: #C4A052; font-size: 22px; margin-bottom: 8px;">Welcome to Oasis Baklawa</h1>
              <p style="margin-bottom: 24px; color: #aaa;">Your admin account has been created. Here are your login credentials:</p>
              <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; border-left: 3px solid #C4A052;">
                <p style="margin: 4px 0;"><strong style="color: #C4A052;">Email:</strong> ${nf.email.trim()}</p>
                <p style="margin: 4px 0;"><strong style="color: #C4A052;">Password:</strong> ${chosenPassword}</p>
                <p style="margin: 4px 0;"><strong style="color: #C4A052;">Role:</strong> ${nf.role.replace(/_/g, " ").toUpperCase()}</p>
              </div>
              <p style="margin-top: 20px; font-size: 13px; color: #888;">Please change your password after your first login. This is a secure, auto-generated credential.</p>
              <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />
              <p style="font-size: 11px; color: #666; text-align: center;">Oasis Baklawa B2B Portal — Enterprise Resource Management</p>
            </div>
          `,
        },
      });

      if (emailError) {
        console.error("Email send error:", emailError);
        toast.warning("Employee created but credentials email failed to send.");
      }
    } catch {
      toast.warning("Employee created but credentials email could not be sent.");
    }

    // 5. System notification for admin panel
    await supabase.from("notifications").insert({
      user_id: user?.id ?? null,
      type: "employee_onboarding",
      message: `New employee "${nf.name}" (${nf.role.replace(/_/g, " ")}) onboarded. Email: ${nf.email.trim()}`,
      is_read: false,
    });

    // 6. Audit log
    await supabase.from("audit_logs").insert({
      action_type: "create_employee",
      module_name: "user_role_control",
      entity_name: nf.name,
      entity_id: newUserId || "unknown",
      actor_id: user?.id ?? null,
      new_value: { role: nf.role, email: nf.email, auth_created: true },
    });

    // Optimistic UI: prepend new user to local state so the table reflects the change instantly.
    const optimisticUser: UserRow = {
      id: newUserId,
      email: nf.email.trim(),
      full_name: nf.name,
      role: nf.role,
      department: nf.dept || null,
      designation: nf.designation || null,
      is_active: true,
      invite_status: "active",
      mobile_number: nf.mobile || null,
      company_id: null,
      created_at: new Date().toISOString(),
      commission_rate_percentage: null,
      is_sales_executive: nf.role === "sales_executive",
    };
    setUsers((prev) => [optimisticUser, ...prev.filter((u) => u.id !== newUserId)]);

    // Show credentials modal
    setCreatedCredentials({ name: nf.name, email: nf.email.trim(), password: chosenPassword, role: nf.role });
    setShowCredentialsModal(true);
    toast.success(`User Created. Credentials: ${nf.email.trim()} / ${chosenPassword}`);
    setShowModal(false);
    setNf({ name: "", email: "", mobile: "", dept: "", designation: "", role: "", password: "", status: "invited" });
    setSelectedPermIds([]);
    // Background reconciliation — does not block the UI.
    void fetchData({ silent: true });
    setSaving(null);
  };

  const handleSaveCredit = async (c: CompanyRow) => {
    const newLimit = editingCredit[c.id] ?? c.credit_limit ?? 0;
    setSaving(c.id);
    const { error } = await supabase.from("companies").update({ credit_limit: newLimit }).eq("id", c.id);
    if (error) toast.error("Failed to update");
    else {
      toast.success(`Credit limit updated for ${c.business_name}`);
      await supabase.from("audit_logs").insert({
        action_type: "update_credit_limit",
        module_name: "user_role_control",
        entity_name: c.business_name,
        entity_id: c.id,
        actor_id: user?.id ?? null,
        new_value: { credit_limit: newLimit },
      });
      fetchData();
    }
    setSaving(null);
  };

  const openRolePermEdit = (role: RoleRow) => {
    setSelectedRoleId(role.id);
    setRolePermsEditing(getRolePermIds(role.id));
  };

  const toggleRolePerm = (permId: string) => {
    setRolePermsEditing((prev) => (prev.includes(permId) ? prev.filter((x) => x !== permId) : [...prev, permId]));
  };

  const saveRolePerms = async () => {
    if (!selectedRoleId) return;
    setSavingRole(true);

    await supabase.from("role_permission_map").delete().eq("role_id", selectedRoleId);

    if (rolePermsEditing.length > 0) {
      await supabase
        .from("role_permission_map")
        .insert(rolePermsEditing.map((pid) => ({ role_id: selectedRoleId, permission_id: pid })));
    }

    const roleName = roles.find((r) => r.id === selectedRoleId)?.role_name ?? "Unknown";
    await supabase.from("audit_logs").insert({
      action_type: "update_role_permissions",
      module_name: "user_role_control",
      entity_name: roleName,
      entity_id: selectedRoleId,
      actor_id: user?.id ?? null,
      new_value: { permission_count: rolePermsEditing.length },
    });

    toast.success(`Permissions saved for ${roleName}`);
    setSavingRole(false);
    setSelectedRoleId(null);
    fetchData();
  };

  const fmt = (n: number | null) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-display-h2 text-foreground">User & Role Control</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm hover:shadow-md"
        >
          <UserPlus size={14} /> Invite Employee
        </button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 rounded-xl p-1">
          <TabsTrigger value="employees" className="text-ui-label rounded-lg">
            Employees
          </TabsTrigger>
          <TabsTrigger value="companies" className="text-ui-label rounded-lg">
            Companies & Credit
          </TabsTrigger>
          <TabsTrigger value="roles" className="text-ui-label rounded-lg">
            Roles & Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          {users.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-ui-label text-muted-foreground">No users found.</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Name
                    </th>
                    <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Email
                    </th>
                    <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Role
                    </th>
                    <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Dept
                    </th>
                    <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="text-center px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Sales Exec
                    </th>
                    {currentUserRole === "super_admin" && (
                      <th className="text-right px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Comm %
                      </th>
                    )}
                    <th className="text-right px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => {
                    const st =
                      INVITE_STATUS_LABELS[u.invite_status ?? (u.is_active ? "active" : "inactive")] ??
                      INVITE_STATUS_LABELS.active;
                    return (
                      <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-4 text-sm text-foreground font-semibold">
                          {u.full_name || u.email || "—"}
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{u.email ?? "—"}</td>
                        <td className="px-5 py-4">
                          <Select
                            value={u.role || undefined}
                            onValueChange={async (newRole) => {
                              const { error } = await supabase.from("users").update({ role: newRole }).eq("id", u.id);
                              if (error) {
                                toast.error("Failed to update role: " + error.message);
                                return;
                              }
                              toast.success(`${u.full_name || u.email} → ${newRole}`);
                              setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role: newRole } : x)));
                              await supabase.from("audit_logs").insert({
                                action_type: "update_role",
                                module_name: "user_role_control",
                                entity_name: u.full_name || u.email || u.id,
                                entity_id: u.id,
                                actor_id: user?.id ?? null,
                                old_value: { role: u.role },
                                new_value: { role: newRole },
                              });
                            }}
                          >
                            <SelectTrigger className="w-[160px] h-8 text-xs font-bold uppercase">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
              {[
                "super_admin", "admin",
                "finance_head", "finance_exec",
                "operations_manager", "production_manager",
                "hod_arabic", "hod_fusion", "hod_chocolate", "hod_bakery", "hod_nuts", "hod_assembly",
                "store_incharge", "dispatch_manager", "dispatch_incharge", "security_control",
                "sales_executive", "support_executive",
                "b2b_buyer", "special_buyer", "horeca_buyer", "wholesale_buyer", "bulk_buyer",
              ].map((r) => (
                                <SelectItem key={r} value={r} className="text-xs font-semibold uppercase">{r.replace(/_/g, " ")}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-muted-foreground">{u.department ?? "—"}</td>
                        <td className="px-5 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide ${st.color}`}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <Switch
                            checked={!!u.is_sales_executive}
                            onCheckedChange={async (checked) => {
                              const { error } = await supabase
                                .from("users")
                                .update({ is_sales_executive: checked } as any)
                                .eq("id", u.id);
                              if (error) {
                                toast.error("Failed to update sales exec flag");
                                return;
                              }
                              toast.success(`${u.full_name || u.email} ${checked ? "enabled" : "disabled"} as Sales Executive`);
                              setUsers((prev) =>
                                prev.map((x) => (x.id === u.id ? { ...x, is_sales_executive: checked } : x))
                              );
                              await supabase.from("audit_logs").insert({
                                action_type: "toggle_sales_executive",
                                module_name: "user_role_control",
                                entity_name: u.full_name || u.email || u.id,
                                entity_id: u.id,
                                actor_id: user?.id ?? null,
                                old_value: { is_sales_executive: u.is_sales_executive },
                                new_value: { is_sales_executive: checked },
                              });
                            }}
                          />
                        </td>
                        {currentUserRole === "super_admin" && (
                          <td className="px-5 py-4 text-right">
                            {u.role === "sales_executive" ? (
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                className="w-20 h-8 text-xs font-bold text-right ml-auto"
                                defaultValue={u.commission_rate_percentage ?? 0}
                                onBlur={async (e) => {
                                  const newRate = parseFloat(e.target.value) || 0;
                                  if (newRate === (u.commission_rate_percentage ?? 0)) return;
                                  const { error } = await supabase
                                    .from("users")
                                    .update({ commission_rate_percentage: newRate })
                                    .eq("id", u.id);
                                  if (error) {
                                    toast.error("Failed to update commission rate");
                                    return;
                                  }
                                  toast.success(`Commission rate updated to ${newRate}%`);
                                  setUsers((prev) =>
                                    prev.map((x) => (x.id === u.id ? { ...x, commission_rate_percentage: newRate } : x))
                                  );
                                  await supabase.from("audit_logs").insert({
                                    action_type: "update_commission_rate",
                                    module_name: "user_role_control",
                                    entity_name: u.full_name || u.email || u.id,
                                    entity_id: u.id,
                                    actor_id: user?.id ?? null,
                                    old_value: { commission_rate_percentage: u.commission_rate_percentage },
                                    new_value: { commission_rate_percentage: newRate },
                                  });
                                }}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {(u.invite_status === "active" || (u.is_active && !u.invite_status)) && (
                              <>
                                <button
                                  title="Revoke Access"
                                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  onClick={async () => {
                                    const { error } = await supabase
                                      .from("users")
                                      .update({ invite_status: "inactive", is_active: false })
                                      .eq("id", u.id);
                                    if (error) {
                                      toast.error("Failed to revoke access");
                                      return;
                                    }
                                    toast.success(`Access revoked for ${u.full_name || u.email}`);
                                    setUsers((prev) =>
                                      prev.map((x) =>
                                        x.id === u.id ? { ...x, invite_status: "inactive", is_active: false } : x
                                      )
                                    );
                                    await supabase.from("audit_logs").insert({
                                      action_type: "revoke_access",
                                      module_name: "user_role_control",
                                      entity_name: u.full_name || u.email || u.id,
                                      entity_id: u.id,
                                      actor_id: user?.id ?? null,
                                      old_value: { invite_status: u.invite_status, is_active: u.is_active },
                                      new_value: { invite_status: "inactive", is_active: false },
                                    });
                                  }}
                                >
                                  <LockKeyhole size={14} />
                                </button>
                                <button
                                  title="Send Magic Login Link"
                                  className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                  onClick={async () => {
                                    if (!u.email) {
                                      toast.error("No email address for this user");
                                      return;
                                    }
                                    try {
                                      // Trigger Supabase magic link → user is auto-signed-in on click and lands on /welcome.
                                      const { error } = await supabase.auth.signInWithOtp({
                                        email: u.email,
                                        options: {
                                          emailRedirectTo: "https://b2b.oasisbaklawa.com/welcome",
                                          shouldCreateUser: false,
                                        },
                                      });
                                      if (error) throw error;
                                      toast.success(`Magic login link sent to ${u.email}`);
                                    } catch (err: any) {
                                      toast.error("Failed to send magic link: " + (err.message || "Unknown error"));
                                    }
                                  }}
                                >
                                  <Mail size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="companies">
          {companies.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-ui-label text-muted-foreground">No approved companies.</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Company
                    </th>
                    <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      GST
                    </th>
                    <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Account Manager
                    </th>
                    <th className="text-right px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Wallet
                    </th>
                    <th className="text-right px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Credit Limit
                    </th>
                    <th className="text-right px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {companies.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4 text-sm text-foreground font-semibold">{c.business_name}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{c.gst_number ?? "—"}</td>
                      <td className="px-5 py-4">
                        <Select
                          value={c.account_manager_id ?? "unassigned"}
                          onValueChange={async (val) => {
                            const managerId = val === "unassigned" ? null : val;
                            const { error } = await supabase
                              .from("companies")
                              .update({ account_manager_id: managerId })
                              .eq("id", c.id);
                            if (error) {
                              toast.error("Failed to assign manager");
                              return;
                            }
                            const mgrName = managers.find((m) => m.id === managerId)?.label ?? "None";
                            toast.success(`${c.business_name} → ${mgrName}`);
                            setCompanies((prev) =>
                              prev.map((x) => (x.id === c.id ? { ...x, account_manager_id: managerId } : x))
                            );
                            await supabase.from("audit_logs").insert({
                              action_type: "assign_account_manager",
                              module_name: "user_role_control",
                              entity_name: c.business_name,
                              entity_id: c.id,
                              actor_id: user?.id ?? null,
                              new_value: { account_manager_id: managerId },
                            });
                          }}
                        >
                          <SelectTrigger className="w-[180px] h-8 text-xs font-semibold">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned" className="text-xs text-muted-foreground">Unassigned</SelectItem>
                            {managers.map((m) => (
                              <SelectItem key={m.id} value={m.id} className="text-xs font-semibold">
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-black text-foreground">
                        {fmt(c.wallet_balance)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Input
                          type="number"
                          className="w-32 text-right text-sm font-bold inline-block rounded-lg focus-visible:ring-primary"
                          value={editingCredit[c.id] ?? c.credit_limit ?? 0}
                          onChange={(e) => setEditingCredit({ ...editingCredit, [c.id]: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleSaveCredit(c)}
                          disabled={saving === c.id}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 border border-primary/20"
                        >
                          {saving === c.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="roles">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {roles.map((r) => {
              const permIds = getRolePermIds(r.id);
              const permModules = [
                ...new Set(allPermissions.filter((p) => permIds.includes(p.id)).map((p) => p.module_name)),
              ];
              return (
                <div
                  key={r.id}
                  className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-serif font-bold text-foreground">{r.role_name}</h3>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${r.is_active ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-muted-foreground"}`}
                    />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wider">
                    {r.role_key} • {permIds.length} perms
                  </p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {permModules.length > 0 ? (
                      permModules.map((m) => (
                        <span
                          key={m}
                          className="text-[10px] font-bold px-2 py-1 rounded bg-muted/50 text-foreground border border-border"
                        >
                          {m}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No permissions configured</span>
                    )}
                  </div>
                  <button
                    onClick={() => openRolePermEdit(r)}
                    className="w-full py-2.5 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors border border-primary/20"
                  >
                    Edit Permissions
                  </button>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!selectedRoleId}
        onOpenChange={(open) => {
          if (!open) setSelectedRoleId(null);
        }}
      >
        <DialogContent className="fixed top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%] z-[100] w-[95vw] max-w-xl max-h-[85vh] overflow-y-auto bg-card border border-border rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-serif font-bold text-foreground">
              Edit Permissions: {roles.find((r) => r.id === selectedRoleId)?.role_name}
            </DialogTitle>
            <DialogDescription className="hidden">Modal description</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {MODULES.map((mod) => {
              const modPerms = permsByModule(mod);
              if (modPerms.length === 0) return null;
              return (
                <div key={mod} className="border border-border rounded-xl p-4 bg-muted/20">
                  <p className="text-sm font-bold text-foreground mb-3">{mod}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {modPerms.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-3 text-sm font-medium text-muted-foreground cursor-pointer p-2 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-border transition-all"
                      >
                        <Checkbox
                          checked={rolePermsEditing.includes(p.id)}
                          onCheckedChange={() => toggleRolePerm(p.id)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <span>{p.permission_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            <button
              onClick={saveRolePerms}
              disabled={savingRole}
              className="w-full mt-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {savingRole ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Save Security Matrix"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="fixed top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%] z-[100] w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-3xl p-6 md:p-8 shadow-2xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-2xl font-serif font-bold text-foreground">Invite Employee</DialogTitle>
            <DialogDescription className="hidden">Modal description</DialogDescription>
          </DialogHeader>
          <p className="text-xs font-medium text-muted-foreground mb-6">
            This creates an internal employee record. A separate auth account will be provisioned.
          </p>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name *</Label>
                <Input
                  value={nf.name}
                  onChange={(e) => setNf((p) => ({ ...p, name: e.target.value }))}
                  className="rounded-xl h-11 border-border focus-visible:ring-primary"
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email *</Label>
                <Input
                  value={nf.email}
                  onChange={(e) => setNf((p) => ({ ...p, email: e.target.value }))}
                  className="rounded-xl h-11 border-border focus-visible:ring-primary"
                  placeholder="email@oasis.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Initial Password *</Label>
              <Input
                type="password"
                value={nf.password}
                onChange={(e) => setNf((p) => ({ ...p, password: e.target.value }))}
                className="rounded-xl h-11 border-border focus-visible:ring-primary"
                placeholder="Min 6 characters"
              />
              <p className="text-[10px] text-muted-foreground italic">
                This password will be shared with the employee for first login.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile</Label>
                <Input
                  value={nf.mobile}
                  onChange={(e) => setNf((p) => ({ ...p, mobile: e.target.value }))}
                  className="rounded-xl h-11 border-border focus-visible:ring-primary"
                  placeholder="+91…"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Designation</Label>
                <Input
                  value={nf.designation}
                  onChange={(e) => setNf((p) => ({ ...p, designation: e.target.value }))}
                  className="rounded-xl h-11 border-border focus-visible:ring-primary"
                  placeholder="Floor Manager"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Role *</Label>
                <Select value={nf.role || "none"} onValueChange={handleNewRoleChange}>
                  <SelectTrigger className="rounded-xl h-11 border-border focus:ring-primary">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border">
                    <SelectItem value="none" className="hidden">Select Role...</SelectItem>
                    {roles.map((r) => (
                      <SelectItem
                        key={r.id}
                        value={r.role_key || r.id}
                        className="focus:bg-primary/10 focus:text-primary cursor-pointer"
                      >
                        {r.role_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Initial Status
                </Label>
                <Select value={nf.status || undefined} onValueChange={(v) => setNf((p) => ({ ...p, status: v }))}>
                  <SelectTrigger className="rounded-xl h-11 border-border focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border">
                    <SelectItem value="invited" className="focus:bg-primary/10 focus:text-primary cursor-pointer">
                      Invited
                    </SelectItem>
                    <SelectItem value="active" className="focus:bg-primary/10 focus:text-primary cursor-pointer">
                      Active
                    </SelectItem>
                    <SelectItem value="inactive" className="focus:bg-primary/10 focus:text-primary cursor-pointer">
                      Inactive
                    </SelectItem>
                    <SelectItem value="blocked" className="focus:bg-primary/10 focus:text-primary cursor-pointer">
                      Blocked
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Building2 size={14} className="text-primary" /> Production Department
              </Label>
              <Select value={nf.dept || undefined} onValueChange={(v) => setNf((p) => ({ ...p, dept: v }))}>
                <SelectTrigger className="rounded-xl h-11 border-border focus:ring-primary bg-muted/30">
                  <SelectValue placeholder="Assign a specific operational floor" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border max-h-[250px]">
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem
                      key={dept}
                      value={dept}
                      className="focus:bg-primary/10 focus:text-primary cursor-pointer font-medium"
                    >
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground italic">
                Critical for routing manufacturing orders to the correct team.
              </p>
            </div>

            {nf.role && (
              <div className="pt-4 border-t border-border">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block">
                  Module Access (Auto-filled by Role)
                </Label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
                  {MODULES.map((mod) => {
                    const modPerms = permsByModule(mod);
                    const allSelected = modPerms.every((p) => selectedPermIds.includes(p.id));
                    const someSelected = modPerms.some((p) => selectedPermIds.includes(p.id));
                    return (
                      <label
                        key={mod}
                        className="flex items-center gap-3 text-sm font-medium text-foreground cursor-pointer p-2.5 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                      >
                        <Checkbox
                          checked={allSelected}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          onCheckedChange={() => {
                            if (allSelected) {
                              setSelectedPermIds((prev) =>
                                prev.filter((id) => !modPerms.map((p) => p.id).includes(id)),
                              );
                            } else {
                              setSelectedPermIds((prev) => [...new Set([...prev, ...modPerms.map((p) => p.id)])]);
                            }
                          }}
                        />
                        <span className="text-xs">{mod}</span>
                        {someSelected && !allSelected && (
                          <span className="text-[10px] font-bold text-primary ml-auto uppercase tracking-wider">
                            (Partial)
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={handleCreateEmployee}
              disabled={saving === "new"}
              className="w-full mt-4 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {saving === "new" ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Deploy Employee Profile"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credentials Success Modal */}
      <Dialog open={showCredentialsModal} onOpenChange={setShowCredentialsModal}>
        <DialogContent className="fixed top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%] z-[100] w-[95vw] max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
              <UserPlus size={20} className="text-primary" /> Employee Created
            </DialogTitle>
            <DialogDescription className="hidden">Modal description</DialogDescription>
          </DialogHeader>
          {createdCredentials && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Account created successfully. <strong className="text-destructive">Copy the temporary password now — it will not be shown again.</strong>
              </p>
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</span>
                  <span className="text-sm font-bold text-foreground">{createdCredentials.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</span>
                  <span className="text-sm font-bold text-foreground">{createdCredentials.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Role</span>
                  <span className="text-sm font-bold text-primary uppercase">{createdCredentials.role.replace(/_/g, " ")}</span>
                </div>
                <div className="border-t border-border pt-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-destructive block mb-1">Temporary Password</span>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-card border border-primary/30 rounded-lg px-3 py-2 text-sm font-mono font-bold text-foreground select-all">
                      {createdCredentials.password}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdCredentials.password);
                        toast.success("Password copied to clipboard");
                      }}
                      className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowCredentialsModal(false)}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
