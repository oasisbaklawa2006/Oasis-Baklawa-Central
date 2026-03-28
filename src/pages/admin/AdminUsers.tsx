import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Plus, UserPlus, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
  dispatch_head: ["Dispatch", "Packing", "Orders"],
  sales_executive: ["Orders", "Client Governance", "Product Catalog"],
  production_manager: ["Production", "Assembly", "Orders"],
  assembly_manager: ["Assembly", "Packing"],
  packing_supervisor: ["Packing", "Dispatch"],
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

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [rolePermsEditing, setRolePermsEditing] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);

  const [nf, setNf] = useState({
    name: "",
    email: "",
    mobile: "",
    dept: "",
    designation: "",
    role: "",
    status: "invited" as string,
  });
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [usersRes, companiesRes, rolesRes, permsRes, rpMapRes] = await Promise.all([
      supabase.from("users").select("*").order("created_at", { ascending: false }),
      supabase.from("companies").select("*").order("created_at", { ascending: false }),
      supabase.from("roles").select("*").order("role_name"),
      supabase.from("permissions").select("*").order("module_name, permission_name"),
      supabase.from("role_permission_map").select("*"),
    ]);
    const allUsers = (usersRes.data as UserRow[]) ?? [];
    setUsers(allUsers);
    setCompanies((companiesRes.data as CompanyRow[]) ?? []);
    setRoles((rolesRes.data as RoleRow[]) ?? []);
    setAllPermissions((permsRes.data as PermissionRow[]) ?? []);
    setRolePermMap((rpMapRes.data as RolePermMap[]) ?? []);

    // Build managers list from sales_executive and admin roles
    const mgrs: ManagerOption[] = allUsers
      .filter((u) => u.role === "sales_executive" || u.role === "admin")
      .map((u) => ({ id: u.id, label: u.full_name || u.email || u.id }));
    setManagers(mgrs);

    setLoading(false);
  }, []);

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

  const handleCreateEmployee = async () => {
    if (!nf.name.trim() || !nf.email.trim() || !nf.role) {
      toast.error("Name, Email, and Role are required");
      return;
    }
    setSaving("new");

    const roleRecord = roles.find((r) => r.role_key === nf.role);

    const { data: newUser, error } = await supabase
      .from("users")
      .insert({
        full_name: nf.name,
        email: nf.email,
        mobile_number: nf.mobile || null,
        role: nf.role,
        department: nf.dept || null,
        designation: nf.designation || null,
        is_active: nf.status === "active",
        invite_status: nf.status,
      })
      .select()
      .single();

    if (error || !newUser) {
      toast.error("Failed to create employee: " + (error?.message ?? "unknown"));
      setSaving(null);
      return;
    }

    if (roleRecord) {
      await supabase.from("user_role_map").insert({
        user_id: newUser.id,
        role_id: roleRecord.id,
      });
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

    await supabase.from("audit_logs").insert({
      action_type: "create_employee",
      module_name: "user_role_control",
      entity_name: nf.name,
      entity_id: newUser.id,
      actor_id: user?.id ?? null,
    });

    toast.success(`Employee "${nf.name}" invited with role ${nf.role}`);
    setShowModal(false);
    setNf({ name: "", email: "", mobile: "", dept: "", designation: "", role: "", status: "invited" });
    setSelectedPermIds([]);
    fetchData();
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
                            value={u.role}
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
                              {["super_admin", "admin", "finance_head", "dispatch_head", "production_manager", "assembly_manager", "packing_supervisor", "sales_executive", "support_executive", "buyer"].map((r) => (
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
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto bg-card border-border rounded-3xl p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-serif font-bold text-foreground">
              Edit Permissions: {roles.find((r) => r.id === selectedRoleId)?.role_name}
            </DialogTitle>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border rounded-3xl p-6 md:p-8">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-2xl font-serif font-bold text-foreground">Invite Employee</DialogTitle>
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
                <Select value={nf.role} onValueChange={handleNewRoleChange}>
                  <SelectTrigger className="rounded-xl h-11 border-border focus:ring-primary">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border">
                    {roles.map((r) => (
                      <SelectItem
                        key={r.id}
                        value={r.role_key}
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
                <Select value={nf.status} onValueChange={(v) => setNf((p) => ({ ...p, status: v }))}>
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
              <Select value={nf.dept} onValueChange={(v) => setNf((p) => ({ ...p, dept: v }))}>
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
    </div>
  );
};

export default AdminUsers;
