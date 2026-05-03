import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UserPlus, Building2, LockKeyhole, Mail, X, Archive, AlertTriangle, Search, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  secondary_phones: string[] | null;
  company_id: string | null;
  created_at: string | null;
  commission_rate_percentage: number | null;
  is_sales_executive: boolean | null;
  deleted_at: string | null;
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
  admin: [...MODULES],
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
  b2b_buyer: ["Orders", "Product Catalog"],
  customer_user: [],
};

const INVITE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  invited: { label: "Invited", color: "bg-amber-100 text-amber-700" },
  active: { label: "Active", color: "bg-green-100 text-green-700" },
  inactive: { label: "Inactive", color: "bg-muted text-muted-foreground" },
  blocked: { label: "Blocked", color: "bg-red-100 text-red-700" },
};

const ROLES_REQUIRING_DEPARTMENT = new Set([
  "hod_arabic", "hod_fusion", "hod_chocolate", "hod_bakery",
  "hod_nuts", "hod_assembly", "hod_dragees",
  "store_incharge", "production_manager", "assembly_manager",
  "dispatch_manager", "dispatch_incharge", "packing_supervisor",
  "store_ready_goods", "rgs_admin",
]);

const generateTempPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let pwd = "";
  for (let i = 0; i < 14; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
};

const AdminUsers = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState("employees");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionRow[]>([]);
  const [rolePermMap, setRolePermMap] = useState<RolePermMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);

  // Employee search + filter
  const [empSearch, setEmpSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [rolePermsEditing, setRolePermsEditing] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);

  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email: string;
    password: string;
    role: string;
  } | null>(null);

  const [archiveTarget, setArchiveTarget] = useState<UserRow | null>(null);
  const [archiving, setArchiving] = useState(false);

  const [nf, setNf] = useState({
    name: "",
    email: "",
    mobile: "",
    secondary_mobile: "",
    dept: "none",
    designation: "",
    role: "none",
    password: "",
    status: "invited" as string,
    is_sales_executive: false,
    commission_rate: 0,
  });
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);

  const formatPlusPhone = (raw: string) => {
    const digits = (raw || "").replace(/[^\d]/g, "");
    if (!digits) return "";
    return `+${digits}`;
  };

  const fetchData = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const [usersRes, rolesRes, permsRes, rpMapRes] = await Promise.all([
          supabase.from("users").select("*").order("created_at", { ascending: false }),
          supabase.from("roles").select("*").order("role_name"),
          supabase.from("permissions").select("*").order("module_name, permission_name"),
          supabase.from("role_permission_map").select("*"),
        ]);

        const allUsers = (usersRes.data as UserRow[]) ?? [];
        setUsers(allUsers);

        const me = allUsers.find((u) => u.id === user?.id);
        if (me) setCurrentUserRole(me.role);

        setRoles((rolesRes.data as RoleRow[]) ?? []);
        setAllPermissions((permsRes.data as PermissionRow[]) ?? []);
        setRolePermMap((rpMapRes.data as RolePermMap[]) ?? []);
      } catch (error) {
        console.error("Fetch error", error);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-gen password when modal opens
  useEffect(() => {
    if (showModal && !nf.password) {
      setNf((prev) => ({ ...prev, password: generateTempPassword() }));
    }
  }, [showModal, nf.password]);

  const permsByModule = (mod: string) => allPermissions.filter((p) => p.module_name === mod);
  const getPermIdsForModules = (mods: string[]) =>
    allPermissions.filter((p) => mods.includes(p.module_name)).map((p) => p.id);
  const getRolePermIds = (roleId: string) =>
    rolePermMap
      .filter((m) => m.role_id === roleId)
      .map((m) => m.permission_id!)
      .filter(Boolean);

  const handleNewRoleChange = (roleKey: string) => {
    const needsDept = ROLES_REQUIRING_DEPARTMENT.has(roleKey);
    setNf((prev) => ({
      ...prev,
      role: roleKey,
      dept: needsDept ? prev.dept : "none",
    }));
    const defaults = DEFAULT_MODULE_MAP[roleKey] ?? [];
    setSelectedPermIds(getPermIdsForModules(defaults));
  };

  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => !u.deleted_at)
      .filter((u) => {
        const q = empSearch.toLowerCase();
        if (q && !`${u.full_name ?? ""} ${u.email ?? ""} ${u.role ?? ""} ${u.department ?? ""}`.toLowerCase().includes(q)) return false;
        if (roleFilter && u.role !== roleFilter) return false;
        return true;
      });
  }, [users, empSearch, roleFilter]);

  const handleCreateEmployee = async () => {
    if (!nf.name.trim() || !nf.email.trim()) return toast.error("Name and Email are required");
    if (nf.role === "none" || !nf.role) return toast.error("Role is required");
    if (!nf.password || nf.password.length < 6) return toast.error("Password is required (minimum 6 characters)");

    setSaving("new");
    const roleRecord = roles.find((r) => r.role_key === nf.role);
    const chosenPassword = nf.password;
    const inviteRedirect = `${window.location.origin}/login?manual_auth=true`;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: nf.email.trim(),
      password: chosenPassword,
      options: { emailRedirectTo: inviteRedirect, data: { full_name: nf.name, role: nf.role } },
    });

    if (authError) {
      const looksDuplicate = /already|exist|registered/i.test(authError.message);
      if (looksDuplicate) {
        const { error: linkErr } = await supabase.auth.signInWithOtp({
          email: nf.email.trim(),
          options: { emailRedirectTo: inviteRedirect },
        });
        if (linkErr) toast.error("User exists; failed to send link: " + linkErr.message);
        else toast.success(`Invite link sent to ${nf.email.trim()} (User already existed).`);
      } else {
        toast.error("Failed to create auth account: " + authError.message);
      }
      setSaving(null);
      return;
    }

    const newUserId = authData.user?.id;
    if (!newUserId) {
      await supabase.auth.signInWithOtp({ email: nf.email.trim(), options: { emailRedirectTo: inviteRedirect } });
      toast.success(`Invite link sent to ${nf.email.trim()}.`);
      setShowModal(false);
      setSaving(null);
      return;
    }

    const formattedMobile = nf.mobile ? formatPlusPhone(nf.mobile) : null;
    const formattedSecondary = nf.secondary_mobile ? formatPlusPhone(nf.secondary_mobile) : null;

    try {
      const isSalesExec = nf.is_sales_executive || nf.role === "sales_executive";
      await supabase.from("users").upsert(
        {
          id: newUserId,
          full_name: nf.name,
          email: nf.email.trim(),
          mobile_number: formattedMobile,
          ...(formattedSecondary ? { secondary_phones: [formattedSecondary] } : {}),
          role: nf.role,
          department: nf.dept === "none" ? null : nf.dept,
          designation: nf.designation || null,
          is_active: true,
          invite_status: "active",
          is_sales_executive: isSalesExec,
          ...(isSalesExec && nf.commission_rate > 0 ? { commission_rate_percentage: nf.commission_rate } : {}),
        } as Parameters<ReturnType<typeof supabase.from>["upsert"]>[0],
        { onConflict: "id" },
      );

      if (roleRecord) {
        await supabase
          .from("user_role_map")
          .upsert({ user_id: newUserId, role_id: roleRecord.id }, { onConflict: "user_id" });
      }

      const { error: emailError } = await supabase.functions.invoke("send-email", {
        body: {
          to: nf.email.trim(),
          subject: "Your Oasis Baklawa ERP Login Credentials",
          html: `<div style="font-family: Georgia, serif; padding: 32px; background: #1c1c1c; color: #f5f5f5; border-radius: 12px;">
            <h1 style="color: #C4A052; font-size: 22px;">Welcome to Oasis Baklawa</h1>
            <p>Your admin account has been created.</p>
            <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; border-left: 3px solid #C4A052;">
              <p><strong style="color: #C4A052;">Email:</strong> ${nf.email.trim()}</p>
              <p><strong style="color: #C4A052;">Password:</strong> ${chosenPassword}</p>
              <p><strong style="color: #C4A052;">Role:</strong> ${nf.role.replace(/_/g, " ").toUpperCase()}</p>
            </div></div>`,
        },
      });

      if (emailError) console.error("Email dispatch failed:", emailError);

      const optimisticUser: UserRow = {
        id: newUserId,
        email: nf.email.trim(),
        full_name: nf.name,
        role: nf.role,
        department: nf.dept === "none" ? null : nf.dept,
        designation: nf.designation || null,
        is_active: true,
        invite_status: "active",
        mobile_number: formattedMobile,
        secondary_phones: formattedSecondary ? [formattedSecondary] : null,
        company_id: null,
        created_at: new Date().toISOString(),
        commission_rate_percentage: isSalesExec && nf.commission_rate > 0 ? nf.commission_rate : null,
        is_sales_executive: isSalesExec,
        deleted_at: null,
      };

      setUsers((prev) => [optimisticUser, ...prev]);
      setCreatedCredentials({ name: nf.name, email: nf.email.trim(), password: chosenPassword, role: nf.role });
      setShowCredentialsModal(true);
      setShowModal(false);
      setNf({
        name: "",
        email: "",
        mobile: "",
        secondary_mobile: "",
        dept: "none",
        designation: "",
        role: "none",
        password: "",
        status: "invited",
        is_sales_executive: false,
        commission_rate: 0,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to finalize setup.");
    } finally {
      setSaving(null);
      void fetchData({ silent: true });
    }
  };

  const handleArchiveEmployee = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    const now = new Date().toISOString();
    try {
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ status: "rejected", is_approved: false })
        .eq("id", archiveTarget.id);
      const { error: userErr } = await supabase
        .from("users")
        .update({ is_active: false, invite_status: "blocked", deleted_at: now } as Parameters<ReturnType<typeof supabase.from>["update"]>[0])
        .eq("id", archiveTarget.id);
      if (profErr && userErr) {
        toast.error("Failed to archive employee");
      } else {
        toast.success(`${archiveTarget.full_name || archiveTarget.email} archived`);
        setUsers((prev) =>
          prev.map((x) =>
            x.id === archiveTarget.id ? { ...x, is_active: false, invite_status: "blocked", deleted_at: now } : x,
          ),
        );
        setArchiveTarget(null);
      }
    } finally {
      setArchiving(false);
    }
  };

  const openRolePermEdit = (role: RoleRow) => {
    setSelectedRoleId(role.id);
    setRolePermsEditing(getRolePermIds(role.id));
  };

  const toggleRolePerm = (permId: string) =>
    setRolePermsEditing((prev) => (prev.includes(permId) ? prev.filter((x) => x !== permId) : [...prev, permId]));

  const saveRolePerms = async () => {
    if (!selectedRoleId) return;
    setSavingRole(true);
    await supabase.from("role_permission_map").delete().eq("role_id", selectedRoleId);
    if (rolePermsEditing.length > 0) {
      await supabase
        .from("role_permission_map")
        .insert(rolePermsEditing.map((pid) => ({ role_id: selectedRoleId, permission_id: pid })));
    }
    toast.success("Permissions saved");
    setSavingRole(false);
    setSelectedRoleId(null);
    fetchData({ silent: true });
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-display-h2 text-foreground">User & Role Control</h1>
        <button
          onClick={() => { setWizardStep(1); setShowModal(true); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
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
            Client Directory
          </TabsTrigger>
          <TabsTrigger value="roles" className="text-ui-label rounded-lg">
            Roles & Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          {/* Search + filter bar */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                placeholder="Search by name, email, role, dept…"
                className="pl-8 h-9 text-sm rounded-lg"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
            >
              <option value="">All Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.role_key}>{r.role_name}</option>
              ))}
            </select>
            {(empSearch || roleFilter) && (
              <button
                onClick={() => { setEmpSearch(""); setRoleFilter(""); }}
                className="h-9 px-3 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 transition-colors"
              >
                Clear
              </button>
            )}
            <span className="text-xs text-muted-foreground ml-1">
              {filteredUsers.length} employee{filteredUsers.length !== 1 ? "s" : ""}
            </span>
          </div>
          {filteredUsers.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-sm text-muted-foreground">{empSearch || roleFilter ? "No employees match the current filters." : "No active employees found."}</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/30 whitespace-nowrap">
                      <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Name
                      </th>
                      <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Email
                      </th>
                      <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Mobile
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
                    {filteredUsers.map((u) => {
                      const st =
                        INVITE_STATUS_LABELS[u.invite_status ?? (u.is_active ? "active" : "inactive")] ??
                        INVITE_STATUS_LABELS.active;
                      return (
                        <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-4 text-sm text-foreground font-semibold whitespace-nowrap">
                            {u.full_name || u.email || "—"}
                          </td>
                          <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">
                            {u.email ?? "—"}
                          </td>
                          <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap font-number">
                            {u.mobile_number || "—"}
                          </td>
                          <td className="px-5 py-4 min-w-[160px]">
                            {/* Native Select for maximum performance in lists */}
                            <select
                              value={u.role || ""}
                              onChange={async (e) => {
                                const newRole = e.target.value;
                                const roleRecord = roles.find((r) => r.role_key === newRole);
                                const { error } = await supabase.from("users").update({ role: newRole }).eq("id", u.id);
                                if (error) return toast.error("Failed to update role");

                                if (roleRecord) {
                                  await supabase
                                    .from("user_role_map")
                                    .upsert({ user_id: u.id, role_id: roleRecord.id }, { onConflict: "user_id" });
                                }
                                toast.success(`${u.full_name || u.email} → ${newRole.replace(/_/g, " ")}`);
                                setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role: newRole } : x)));
                              }}
                              className="w-full bg-transparent text-xs font-bold uppercase tracking-wider border border-border rounded-lg py-1.5 px-2 focus:ring-1 focus:ring-primary focus:outline-none appearance-none cursor-pointer"
                            >
                              <option value="" disabled>
                                Select Role...
                              </option>
                              {roles.map((r) => (
                                <option key={r.id} value={r.role_key}>
                                  {r.role_name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-5 py-4 text-sm font-medium text-muted-foreground whitespace-nowrap">
                            {u.department ?? "—"}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
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
                                if (error) return toast.error("Failed to update flag");
                                toast.success(
                                  `${u.full_name || u.email} ${checked ? "enabled" : "disabled"} as Sales Exec`,
                                );
                                setUsers((prev) =>
                                  prev.map((x) =>
                                    x.id === u.id
                                      ? {
                                          ...x,
                                          is_sales_executive: checked,
                                          commission_rate_percentage: checked
                                            ? x.commission_rate_percentage || 0
                                            : null,
                                        }
                                      : x,
                                  ),
                                );
                              }}
                            />
                          </td>
                          {currentUserRole === "super_admin" && (
                            <td className="px-5 py-4 text-right">
                              {u.is_sales_executive || u.role === "sales_executive" ? (
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
                                    if (!error) {
                                      toast.success(`Commission updated`);
                                      setUsers((prev) =>
                                        prev.map((x) =>
                                          x.id === u.id ? { ...x, commission_rate_percentage: newRate } : x,
                                        ),
                                      );
                                    }
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
                                      if (!error) {
                                        toast.success("Access revoked");
                                        setUsers((prev) =>
                                          prev.map((x) =>
                                            x.id === u.id ? { ...x, invite_status: "inactive", is_active: false } : x,
                                          ),
                                        );
                                      }
                                    }}
                                  >
                                    <LockKeyhole size={14} />
                                  </button>
                                  <button
                                    title="Send Magic Login Link"
                                    className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                    onClick={async () => {
                                      if (!u.email) return toast.error("No email");
                                      const { error } = await supabase.auth.signInWithOtp({
                                        email: u.email,
                                        options: {
                                          emailRedirectTo: `${window.location.origin}/login?manual_auth=true`,
                                          shouldCreateUser: false,
                                        },
                                      });
                                      if (!error) toast.success(`Magic link sent to ${u.email}`);
                                    }}
                                  >
                                    <Mail size={14} />
                                  </button>
                                </>
                              )}
                              <button
                                title="Archive Employee"
                                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                onClick={() => setArchiveTarget(u)}
                              >
                                <Archive size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="companies">
          <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center text-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 size={22} className="text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Client & Credit Management</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                B2B client directory, credit limits, approval pipeline, slab assignment, and account manager assignment are managed in Client Governance.
              </p>
            </div>
            <Link
              to="/admin/clients"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <ExternalLink size={14} /> Go to Client Governance
            </Link>
          </div>
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
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wider">
                    {r.role_key} • {permIds.length} perms
                  </p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {permModules.map((m) => (
                      <span
                        key={m}
                        className="text-[10px] font-bold px-2 py-1 rounded bg-muted/50 text-foreground border border-border"
                      >
                        {m}
                      </span>
                    ))}
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

      {/* 1. NATIVE EDIT PERMISSIONS MODAL */}
      {!!selectedRoleId && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedRoleId(null)}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-3xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedRoleId(null)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X size={20} className="text-muted-foreground" />
            </button>
            <div className="mb-6 pr-8">
              <h2 className="text-2xl font-serif font-bold text-foreground">
                Edit Permissions: {roles.find((r) => r.id === selectedRoleId)?.role_name}
              </h2>
            </div>
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
          </div>
        </div>
      )}

      {/* 2. NATIVE INVITE EMPLOYEE MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-3xl p-6 md:p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X size={20} className="text-muted-foreground" />
            </button>
            <div className="mb-2 pr-8 flex items-center gap-3">
              <h2 className="text-2xl font-serif font-bold text-foreground">Invite Employee</h2>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Step {wizardStep} of 2
              </span>
            </div>
            {wizardStep === 1 && (
            <div className="space-y-5 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Full Name *
                  </Label>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Primary Mobile
                  </Label>
                  <Input
                    type="tel"
                    value={nf.mobile}
                    onChange={(e) => setNf((p) => ({ ...p, mobile: formatPlusPhone(e.target.value) }))}
                    className="rounded-xl h-11 border-border focus-visible:ring-primary font-number"
                    placeholder="+919876543210"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Secondary Mobile
                  </Label>
                  <Input
                    type="tel"
                    value={nf.secondary_mobile}
                    onChange={(e) => setNf((p) => ({ ...p, secondary_mobile: formatPlusPhone(e.target.value) }))}
                    className="rounded-xl h-11 border-border focus-visible:ring-primary font-number"
                    placeholder="+919876543211 (optional)"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Initial Password *
                </Label>
                <Input
                  type="text"
                  value={nf.password}
                  onChange={(e) => setNf((p) => ({ ...p, password: e.target.value }))}
                  className="rounded-xl h-11 border-border focus-visible:ring-primary font-mono text-sm"
                  placeholder="Min 6 characters"
                />
                <p className="text-[10px] text-muted-foreground italic">
                  Auto-generated. Share this with the employee for first login.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Role *</Label>
                  <select
                    value={nf.role}
                    onChange={(e) => handleNewRoleChange(e.target.value)}
                    className="flex h-11 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="none" className="hidden" disabled>
                      Select role...
                    </option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.role_key}>
                        {r.role_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Initial Status
                  </Label>
                  <select
                    value={nf.status}
                    onChange={(e) => setNf((p) => ({ ...p, status: e.target.value }))}
                    className="flex h-11 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="invited">Invited</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
              </div>
              {ROLES_REQUIRING_DEPARTMENT.has(nf.role) && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Building2 size={14} className="text-primary" /> Department <span className="text-destructive">*</span>
                  </Label>
                  <select
                    value={nf.dept}
                    onChange={(e) => setNf((p) => ({ ...p, dept: e.target.value }))}
                    className="flex h-11 w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="none" disabled>
                      Select department…
                    </option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-2 border-t border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Sales Executive
                    </Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Enables commission tracking and sales console access.</p>
                  </div>
                  <Switch
                    checked={nf.is_sales_executive || nf.role === "sales_executive"}
                    onCheckedChange={(v) => setNf((p) => ({ ...p, is_sales_executive: v }))}
                  />
                </div>
                {(nf.is_sales_executive || nf.role === "sales_executive") && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Commission Rate (%)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={nf.commission_rate}
                      onChange={(e) => setNf((p) => ({ ...p, commission_rate: parseFloat(e.target.value) || 0 }))}
                      className="rounded-xl h-11 border-border focus-visible:ring-primary font-number w-36"
                      placeholder="0.0"
                    />
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (!nf.name.trim() || !nf.email.trim()) return toast.error("Name and Email are required");
                  if (nf.role === "none" || !nf.role) return toast.error("Role is required");
                  if (!nf.password || nf.password.length < 6) return toast.error("Password must be at least 6 characters");
                  setWizardStep(2);
                }}
                className="w-full mt-4 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                Review Details →
              </button>
            </div>
            )}
            {wizardStep === 2 && (
              <div className="space-y-5 mt-6">
                <div className="rounded-2xl border border-border bg-muted/20 p-5 space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Confirm employee details
                  </p>
                  {[
                    { label: "Full Name", value: nf.name },
                    { label: "Email", value: nf.email },
                    { label: "Primary Mobile", value: nf.mobile || "—" },
                    { label: "Secondary Mobile", value: nf.secondary_mobile || "—" },
                    { label: "Password", value: nf.password, mono: true },
                    { label: "Role", value: (roles.find((r) => r.role_key === nf.role)?.role_name) || nf.role },
                    { label: "Status", value: nf.status },
                    ...(ROLES_REQUIRING_DEPARTMENT.has(nf.role) ? [{ label: "Department", value: nf.dept === "none" ? "—" : nf.dept }] : []),
                    { label: "Designation", value: nf.designation || "—" },
                    { label: "Sales Executive", value: (nf.is_sales_executive || nf.role === "sales_executive") ? "Yes" : "No" },
                    ...((nf.is_sales_executive || nf.role === "sales_executive") ? [{ label: "Commission %", value: `${nf.commission_rate}%` }] : []),
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{row.label}</span>
                      <span className={`text-foreground ${row.mono ? "font-mono text-xs" : "font-medium"}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    onClick={() => setWizardStep(1)}
                    disabled={saving === "new"}
                    className="py-3.5 rounded-xl bg-muted text-foreground font-bold text-sm hover:bg-muted/70 transition-all disabled:opacity-50"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleCreateEmployee}
                    disabled={saving === "new"}
                    className="py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
                  >
                    {saving === "new" ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Confirm & Create"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. NATIVE CREDENTIALS SUCCESS MODAL */}
      {showCredentialsModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowCredentialsModal(false)}
        >
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border rounded-3xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowCredentialsModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X size={20} className="text-muted-foreground" />
            </button>
            <div className="mb-4 pr-8">
              <h2 className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
                <UserPlus size={20} className="text-primary" /> Employee Created
              </h2>
            </div>
            {createdCredentials && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Account created successfully.{" "}
                  <strong className="text-destructive">Copy the temporary password now.</strong>
                </p>
                <div className="bg-muted/50 rounded-xl p-4 space-y-3 border border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</span>
                    <span className="text-sm font-bold text-foreground">{createdCredentials.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Role</span>
                    <span className="text-sm font-bold text-primary uppercase">
                      {createdCredentials.role.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="border-t border-border pt-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-destructive block mb-1">
                      Temporary Password
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-card border border-primary/30 rounded-lg px-3 py-2 text-sm font-mono font-bold text-foreground select-all">
                        {createdCredentials.password}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(createdCredentials.password);
                          toast.success("Copied");
                        }}
                        className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. ARCHIVE EMPLOYEE — HARD CONFIRM */}
      {archiveTarget && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
          onClick={() => !archiving && setArchiveTarget(null)}
        >
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-destructive/40 rounded-3xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-full bg-destructive/10 text-destructive shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-xl font-serif font-bold text-foreground">Archive Employee?</h2>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
                  This action is irreversible
                </p>
              </div>
            </div>
            <div className="bg-muted/40 border border-border rounded-xl p-4 mb-5">
              <p className="text-sm font-bold text-foreground">
                {archiveTarget.full_name || archiveTarget.email}
              </p>
              <p className="text-xs text-muted-foreground">{archiveTarget.email}</p>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              This will <strong className="text-destructive">permanently remove their access to the portal</strong>.
              Their profile status will be set to <code className="px-1 rounded bg-muted">rejected</code> and their
              user record will be deactivated.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setArchiveTarget(null)}
                disabled={archiving}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveEmployee}
                disabled={archiving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-destructive text-destructive-foreground hover:opacity-90 transition-all disabled:opacity-50"
              >
                {archiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                Archive Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
