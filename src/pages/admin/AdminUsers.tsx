import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  department: string | null;
  designation: string | null;
  is_active: boolean | null;
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

const MODULES = [
  "Client Governance", "Product Catalog", "Pricing Matrix", "Orders",
  "Production", "Assembly", "Packing", "Dispatch",
  "Finance", "Support", "Settings", "Audit",
];

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
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

const AdminUsers = () => {
  const [tab, setTab] = useState("employees");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCredit, setEditingCredit] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // New employee form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newDesignation, setNewDesignation] = useState("");
  const [newPerms, setNewPerms] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    const [usersRes, companiesRes, rolesRes] = await Promise.all([
      supabase.from("users").select("*").order("created_at", { ascending: false }),
      supabase.from("companies").select("*").order("created_at", { ascending: false }),
      supabase.from("roles").select("*").order("role_name"),
    ]);
    setUsers((usersRes.data as UserRow[]) ?? []);
    setCompanies((companiesRes.data as CompanyRow[]) ?? []);
    setRoles((rolesRes.data as RoleRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveCredit = async (c: CompanyRow) => {
    const newLimit = editingCredit[c.id] ?? c.credit_limit ?? 0;
    setSaving(c.id);
    const { error } = await supabase.from("companies").update({ credit_limit: newLimit }).eq("id", c.id);
    if (error) toast.error("Failed to update");
    else { toast.success(`Credit limit updated for ${c.business_name}`); fetchData(); }
    setSaving(null);
  };

  const handleRoleSelect = (roleKey: string) => {
    setNewRole(roleKey);
    setNewPerms(DEFAULT_PERMISSIONS[roleKey] ?? []);
  };

  const togglePerm = (mod: string) => {
    setNewPerms(prev => prev.includes(mod) ? prev.filter(p => p !== mod) : [...prev, mod]);
  };

  const handleCreateEmployee = async () => {
    if (!newName.trim() || !newEmail.trim() || !newRole) {
      toast.error("Name, Email, and Role are required");
      return;
    }
    setSaving("new");
    // Insert into users table (placeholder — real auth account would be created separately)
    const { error } = await supabase.from("users").insert({
      full_name: newName,
      email: newEmail,
      role: newRole,
      department: newDept || null,
      designation: newDesignation || null,
      is_active: true,
    });
    if (error) {
      toast.error("Failed to create employee: " + error.message);
    } else {
      toast.success(`Employee ${newName} created`);
      await supabase.from("audit_logs").insert({
        action_type: "create_employee",
        module_name: "user_role_control",
        entity_name: newName,
      });
      setShowModal(false);
      setNewName(""); setNewEmail(""); setNewRole(""); setNewDept(""); setNewDesignation(""); setNewPerms([]);
      fetchData();
    }
    setSaving(null);
  };

  const fmt = (n: number | null) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-display-h2 text-foreground">User & Role Control</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} /> Add Employee
        </button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="employees" className="text-ui-label">Employees</TabsTrigger>
          <TabsTrigger value="companies" className="text-ui-label">Companies & Credit</TabsTrigger>
          <TabsTrigger value="roles" className="text-ui-label">Roles</TabsTrigger>
        </TabsList>

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
                    <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Designation</th>
                    <th className="text-center px-4 py-3 text-ui-label text-muted-foreground">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="px-4 py-3 text-ui-cell text-foreground font-medium">{u.full_name || u.email || "—"}</td>
                      <td className="px-4 py-3 text-ui-cell text-muted-foreground">{u.email ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">{u.role}</span>
                      </td>
                      <td className="px-4 py-3 text-ui-cell text-muted-foreground">{u.department ?? "—"}</td>
                      <td className="px-4 py-3 text-ui-cell text-muted-foreground">{u.designation ?? "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`w-2 h-2 rounded-full inline-block ${u.is_active ? "bg-green-500" : "bg-muted-foreground"}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

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
                        <Input
                          type="number"
                          className="w-28 text-right text-sm inline-block rounded-lg"
                          value={editingCredit[c.id] ?? c.credit_limit ?? 0}
                          onChange={(e) => setEditingCredit({ ...editingCredit, [c.id]: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleSaveCredit(c)}
                          disabled={saving === c.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-button bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                        >
                          {saving === c.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          Save
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
          {roles.length === 0 ? (
            <p className="text-ui-label text-muted-foreground py-8">No roles defined. Add roles in the database.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map((r) => (
                <div key={r.id} className="bg-card border border-border rounded-xl p-4" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-ui-h5 text-foreground">{r.role_name}</h3>
                    <span className={`w-2 h-2 rounded-full ${r.is_active ? "bg-green-500" : "bg-muted-foreground"}`} />
                  </div>
                  <p className="text-fine text-muted-foreground">Key: {r.role_key}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(DEFAULT_PERMISSIONS[r.role_key] ?? []).map((p) => (
                      <span key={p} className="text-fine px-1.5 py-0.5 rounded bg-primary/10 text-primary">{p}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Employee Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-display-h2 text-foreground">Add Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-ui-label text-muted-foreground">Full Name *</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="rounded-lg" placeholder="Employee name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-ui-label text-muted-foreground">Email *</Label>
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="rounded-lg" placeholder="email@company.com" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-ui-label text-muted-foreground">Role *</Label>
                <Select value={newRole} onValueChange={handleRoleSelect}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(DEFAULT_PERMISSIONS).map((k) => (
                      <SelectItem key={k} value={k}>{k.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-ui-label text-muted-foreground">Department</Label>
                <Input value={newDept} onChange={(e) => setNewDept(e.target.value)} className="rounded-lg" placeholder="e.g. Finance" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-ui-label text-muted-foreground">Designation</Label>
                <Input value={newDesignation} onChange={(e) => setNewDesignation(e.target.value)} className="rounded-lg" placeholder="e.g. Manager" />
              </div>
            </div>

            {/* Permission Matrix */}
            <div>
              <Label className="text-ui-label text-muted-foreground mb-2 block">Module Permissions</Label>
              <div className="grid grid-cols-3 gap-2">
                {MODULES.map((mod) => (
                  <label key={mod} className="flex items-center gap-2 text-ui-cell text-foreground cursor-pointer p-1.5 rounded-lg hover:bg-muted/50">
                    <Checkbox
                      checked={newPerms.includes(mod)}
                      onCheckedChange={() => togglePerm(mod)}
                    />
                    <span className="text-xs">{mod}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreateEmployee}
              disabled={saving === "new"}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-ui font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving === "new" ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Create Employee"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
