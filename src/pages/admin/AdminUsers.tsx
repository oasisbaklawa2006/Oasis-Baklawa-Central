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

/* ─── Constants ─── */
const MODULES = [
  "Client Governance", "Product Catalog", "Pricing Matrix", "Orders",
  "Production", "Assembly", "Packing", "Dispatch",
  "Finance", "Support", "Settings", "Audit",
];

// NEW: The strict list of departments for the ERP
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
  "Ready Goods Store"
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
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm hover:shadow-md">
          <UserPlus size={14} /> Invite Employee
        </button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 rounded-xl p-1">
          <TabsTrigger value="employees" className="text-ui-label rounded-lg">Employees</TabsTrigger>
          <TabsTrigger value="companies" className="text-ui-label rounded-lg">Companies & Credit</TabsTrigger>
          <TabsTrigger value="roles" className="text-ui-label rounded-lg">Roles & Permissions</TabsTrigger>
        </TabsList>

        {/* ─── Employees Tab ─── */}
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
                    <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</th>
                    <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Role</th>
                    <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Dept</th>
                    <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => {
                    const st = INVITE_STATUS_LABELS[u.invite_status ?? (u.is_active ? "active" : "inactive")] ?? INVITE_STATUS_LABELS.active;
                    return (
                      <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-4 text-sm text-foreground font-semibold">{u.full_name || u.email || "—"}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{u.email ?? "—"}</td>
                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-primary/10 text-primary border border-primary/20">{u.role}</span>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-muted-foreground">{u.department ?? "—"}</td>
                        <td className="px-5 py-4">
                          <span className={`px-