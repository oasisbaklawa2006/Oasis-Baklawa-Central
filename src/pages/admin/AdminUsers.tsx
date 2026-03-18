import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Plus, UserPlus } from "lucide-react";
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

/* ─── module list (display order) ─── */
const MODULES = [
  "Client Governance", "Product Catalog", "Pricing Matrix", "Orders",
  "Production", "Assembly", "Packing", "Dispatch",
  "Finance", "Support", "Settings", "Audit",
];

/* default permission modules per role key */
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
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionRow[]>([]);
  const [rolePermMap, setRolePermMap] = useState<RolePermMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCredit, setEditingCredit] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  /* role detail view */
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [rolePermsEditing, setRolePermsEditing] = useState<string[]>([]); // permission_ids
  const [savingRole, setSavingRole] = useState(false);

  /* new employee form */
  const [nf, setNf] = useState({ name: "", email: "", mobile: "", dept: "", designation: "", role: "", status: "invited" as string });
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);

  /* ─── fetch ─── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [usersRes, companiesRes, rolesRes, permsRes, rpMapRes] = await Promise.all([
      supabase.from("users").select("*").order("created_at", { ascending: false }),
      supabase.from("companies").select("*").order("created_at", { ascending: false }),
      supabase.from("roles").select("*").order("role_name"),
      supabase.from("permissions").select("*").order("module_name, permission_name"),
      supabase.from("role_permission_map").select("*"),
    ]);
    setUsers((usersRes.data as UserRow[]) ?? []);
    setCompanies((companiesRes.data as CompanyRow[]) ?? []);
    setRoles((rolesRes.data as RoleRow[]) ?? []);
    setAllPermissions((permsRes.data as PermissionRow[]) ?? []);
    setRolePermMap((rpMapRes.data as RolePermMap[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── helpers ─── */
  const permsByModule = (mod: string) => allPermissions.filter(p => p.module_name === mod);

  const getPermIdsForModules = (mods: string[]) =>
    allPermissions.filter(p => mods.includes(p.module_name)).map(p => p.id);

  const getRolePermIds = (roleId: string) =>
    rolePermMap.filter(m => m.role_id === roleId).map(m => m.permission_id!).filter(Boolean);

  /* ─── new employee: role change auto-fills perms ─── */
  const handleNewRoleChange = (roleKey: string) => {
    setNf(prev => ({ ...prev, role: roleKey }));
    const defaults = DEFAULT_MODULE_MAP[roleKey] ?? [];
    setSelectedPermIds(getPermIdsForModules(defaults));
  };

  const toggleNewPerm = (id: string) => {
    setSelectedPermIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  /* ─── create employee (invite flow) ─── */
  const handleCreateEmployee = async () => {
    if (!nf.name.trim() || !nf.email.trim() || !nf.role) {
      toast.error("Name, Email, and Role are required"); return;
    }
    setSaving("new");

    // Find the role record
    const roleRecord = roles.find(r => r.role_key === nf.role);

    const { data: newUser, error } = await supabase.from("users").insert({
      full_name: nf.name,
      email: nf.email,
      mobile_number: nf.mobile || null,
      role: nf.role,
      department: nf.dept || null,
      designation: nf.designation || null,
      is_active: nf.status === "active",
      invite_status: nf.status,
    }).select().single();

    if (error || !newUser) {
      toast.error("Failed to create employee: " + (error?.message ?? "unknown"));
      setSaving(null); return;
    }

    // Save user_role_map
    if (roleRecord) {
      await supabase.from("user_role_map").insert({
        user_id: newUser.id,
        role_id: roleRecord.id,
      });
    }

    // Save individual permissions via role_permission_map for this role
    // (we save selected permissions for the role if not already mapped)
    if (roleRecord && selectedPermIds.length > 0) {
      const existingForRole = getRolePermIds(roleRecord.id);
      const newPerms = selectedPermIds.filter(pid => !existingForRole.includes(pid));
      if (newPerms.length > 0) {
        await supabase.from("role_permission_map").insert(
          newPerms.map(pid => ({ role_id: roleRecord.id, permission_id: pid }))
        );
      }
    }

    // Audit
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

  /* ─── save credit limit ─── */
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

  /* ─── role permission editing ─── */
  const openRolePermEdit = (role: RoleRow) => {
    setSelectedRoleId(role.id);
    setRolePermsEditing(getRolePermIds(role.id));
  };

  const toggleRolePerm = (permId: string) => {
    setRolePermsEditing(prev => prev.includes(permId) ? prev.filter(x => x !== permId) : [...prev, permId]);
  };

  const saveRolePerms = async () => {
    if (!selectedRoleId) return;
    setSavingRole(true);

    // Delete existing mappings for this role
    await supabase.from("role_permission_map").delete().eq("role_id", selectedRoleId);

    // Insert new mappings
    if (rolePermsEditing.length > 0) {
      await supabase.from("role_permission_map").insert(
        rolePermsEditing.map(pid => ({ role_id: selectedRoleId, permission_id: pid }))
      );
    }

    const roleName = roles.find(r => r.id === selectedRoleId)?.role_name ?? "Unknown";
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
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-display-h2 text-foreground">User & Role Control</h1>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <UserPlus size={14} /> Invite Employee
        </button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="employees" className="text-ui-label">Employees</TabsTrigger>
          <TabsTrigger value="companies" className="text-ui-label">Companies & Credit</TabsTrigger>
          <TabsTrigger value="roles" className="text-ui-label">Roles & Permissions</TabsTrigger>
        </TabsList>

        {/* ─── Employees Tab ─── */}
        <TabsContent value="employees">
          {users.length === 0 ? (
            <p className="text-ui-label text-muted-foreground py-8">No users found.</p>
          ) : (
            <div className="rounded-xl overflow-hidden border border-border bg-card" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Dept</th>
                    <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const st = INVITE_STATUS_LABELS[u.invite_status ?? (u.is_active ? "active" : "inactive")] ?? INVITE_STATUS_LABELS.active;
                    return (
                      <tr key={u.id} className="border-t border-border">
                        <td className="px-4 py-3 text-ui-cell text-foreground font-medium">{u.full_name || u.email || "—"}</td>
                        <td className="px-4 py-3 text-ui-cell text-muted-foreground text-xs">{u.email ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">{u.role}</span>
                        </td>
                        <td className="px-4 py-3 text-ui-cell text-muted-foreground">{u.department ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${st.color}`}>{st.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ─── Companies Tab ─── */}
        <TabsContent value="companies">
          {companies.length === 0 ? (
            <p className="text-ui-label text-muted-foreground py-8">No approved companies.</p>
          ) : (
            <div className="rounded-xl overflow-hidden border border-border bg-card" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Company</th>
                    <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">GST</th>
                    <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Wallet</th>
                    <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Credit Limit</th>
                    <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-4 py-3 text-ui-cell text-foreground font-medium">{c.business_name}</td>
                      <td className="px-4 py-3 text-ui-cell text-muted-foreground">{c.gst_number ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-ui-kpi text-sm text-foreground">{fmt(c.wallet_balance)}</td>
                      <td className="px-4 py-3 text-right">
                        <Input type="number" className="w-28 text-right text-sm inline-block rounded-lg"
                          value={editingCredit[c.id] ?? c.credit_limit ?? 0}
                          onChange={(e) => setEditingCredit({ ...editingCredit, [c.id]: Number(e.target.value) || 0 })} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleSaveCredit(c)} disabled={saving === c.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-button bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
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

        {/* ─── Roles & Permissions Tab ─── */}
        <TabsContent value="roles">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((r) => {
              const permIds = getRolePermIds(r.id);
              const permModules = [...new Set(allPermissions.filter(p => permIds.includes(p.id)).map(p => p.module_name))];
              return (
                <div key={r.id} className="bg-card border border-border rounded-xl p-4" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-ui-h5 text-foreground">{r.role_name}</h3>
                    <span className={`w-2 h-2 rounded-full ${r.is_active ? "bg-green-500" : "bg-muted-foreground"}`} />
                  </div>
                  <p className="text-fine text-muted-foreground mb-2">Key: {r.role_key} · {permIds.length} permissions</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {permModules.length > 0 ? permModules.map(m => (
                      <span key={m} className="text-fine px-1.5 py-0.5 rounded bg-primary/10 text-primary">{m}</span>
                    )) : (
                      <span className="text-fine text-muted-foreground">No permissions configured</span>
                    )}
                  </div>
                  <button onClick={() => openRolePermEdit(r)}
                    className="text-ui-label text-primary hover:underline">
                    Edit Permissions →
                  </button>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Role Permission Editor Dialog ─── */}
      <Dialog open={!!selectedRoleId} onOpenChange={(open) => { if (!open) setSelectedRoleId(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-display-h2 text-foreground">
              Edit Permissions: {roles.find(r => r.id === selectedRoleId)?.role_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {MODULES.map((mod) => {
              const modPerms = permsByModule(mod);
              if (modPerms.length === 0) return null;
              return (
                <div key={mod} className="border border-border rounded-lg p-3">
                  <p className="text-ui-h5 text-foreground mb-2">{mod}</p>
                  <div className="space-y-1.5">
                    {modPerms.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-ui-cell text-foreground cursor-pointer p-1 rounded hover:bg-muted/50">
                        <Checkbox checked={rolePermsEditing.includes(p.id)} onCheckedChange={() => toggleRolePerm(p.id)} />
                        <span className="text-xs">{p.permission_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            <button onClick={saveRolePerms} disabled={savingRole}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-ui font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              {savingRole ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Save Permissions"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Invite Employee Dialog ─── */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-display-h2 text-foreground">Invite Employee</DialogTitle>
          </DialogHeader>
          <p className="text-fine text-muted-foreground">
            This creates an employee record. A separate auth account and login credentials will need to be provisioned.
          </p>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-ui-label text-muted-foreground">Full Name *</Label>
                <Input value={nf.name} onChange={(e) => setNf(p => ({ ...p, name: e.target.value }))} className="rounded-lg" placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-ui-label text-muted-foreground">Email *</Label>
                <Input value={nf.email} onChange={(e) => setNf(p => ({ ...p, email: e.target.value }))} className="rounded-lg" placeholder="email@company.com" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-ui-label text-muted-foreground">Mobile</Label>
                <Input value={nf.mobile} onChange={(e) => setNf(p => ({ ...p, mobile: e.target.value }))} className="rounded-lg" placeholder="+91…" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-ui-label text-muted-foreground">Department</Label>
                <Input value={nf.dept} onChange={(e) => setNf(p => ({ ...p, dept: e.target.value }))} className="rounded-lg" placeholder="Finance" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-ui-label text-muted-foreground">Designation</Label>
                <Input value={nf.designation} onChange={(e) => setNf(p => ({ ...p, designation: e.target.value }))} className="rounded-lg" placeholder="Manager" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-ui-label text-muted-foreground">Role *</Label>
                <Select value={nf.role} onValueChange={handleNewRoleChange}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {roles.map(r => <SelectItem key={r.id} value={r.role_key}>{r.role_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-ui-label text-muted-foreground">Initial Status</Label>
                <Select value={nf.status} onValueChange={(v) => setNf(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invited">Invited</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Permission Matrix */}
            {nf.role && (
              <div>
                <Label className="text-ui-label text-muted-foreground mb-2 block">Module Permissions (pre-filled from role defaults)</Label>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                  {MODULES.map((mod) => {
                    const modPerms = permsByModule(mod);
                    const allSelected = modPerms.every(p => selectedPermIds.includes(p.id));
                    const someSelected = modPerms.some(p => selectedPermIds.includes(p.id));
                    return (
                      <label key={mod} className="flex items-center gap-2 text-ui-cell text-foreground cursor-pointer p-1.5 rounded-lg hover:bg-muted/50">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => {
                            if (allSelected) {
                              setSelectedPermIds(prev => prev.filter(id => !modPerms.map(p => p.id).includes(id)));
                            } else {
                              setSelectedPermIds(prev => [...new Set([...prev, ...modPerms.map(p => p.id)])]);
                            }
                          }}
                        />
                        <span className="text-xs">{mod}</span>
                        {someSelected && !allSelected && <span className="text-fine text-primary">(partial)</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={handleCreateEmployee} disabled={saving === "new"}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-ui font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving === "new" ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Create & Invite Employee"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
