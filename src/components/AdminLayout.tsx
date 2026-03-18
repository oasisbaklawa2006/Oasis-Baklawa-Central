import { NavLink, Outlet, Navigate } from "react-router-dom";
import {
  LayoutDashboard, UserCheck, ClipboardList, Truck, DollarSign, LogOut, Menu, X, Loader2,
  Headphones, Users, Package, BarChart3, Scale, Globe, Settings, Shield
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logoImg from "@/assets/logo-open.png";

/* ─── Role → module permission mapping for nav visibility ─── */
const ROLE_MODULE_ACCESS: Record<string, string[]> = {
  super_admin: ["*"], // sees everything
  admin: ["*"],
  finance_head: ["dashboard", "finance", "orders", "audit"],
  dispatch_head: ["dashboard", "dispatch", "orders", "packing"],
  production_manager: ["dashboard", "orders", "production", "assembly"],
  assembly_manager: ["dashboard", "assembly", "packing"],
  packing_supervisor: ["dashboard", "packing", "dispatch"],
  sales_executive: ["dashboard", "orders", "clients", "products"],
  support_executive: ["dashboard", "support", "orders"],
  customer_user: [], // never sees admin
};

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  end?: boolean;
  moduleKey: string; // for role filtering
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Command",
    items: [
      { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true, moduleKey: "dashboard" },
      { to: "/admin/orders", icon: ClipboardList, label: "Order Pipeline", moduleKey: "orders" },
      { to: "/admin/dispatch", icon: Truck, label: "Packing & Dispatch", moduleKey: "dispatch" },
      { to: "/admin/finance", icon: DollarSign, label: "Accounts & Release", moduleKey: "finance" },
      { to: "/admin/support", icon: Headphones, label: "Support & Exceptions", moduleKey: "support" },
    ],
  },
  {
    title: "Governance",
    items: [
      { to: "/admin/clients", icon: UserCheck, label: "Client Governance", moduleKey: "clients" },
      { to: "/admin/products", icon: Package, label: "Product Catalog", moduleKey: "products" },
      { to: "/admin/pricing", icon: BarChart3, label: "Pricing Matrix", moduleKey: "pricing" },
      { to: "/admin/users", icon: Users, label: "User & Role Control", moduleKey: "users" },
    ],
  },
  {
    title: "Controls",
    items: [
      { to: "/admin/moq", icon: Scale, label: "MOQ Rules", moduleKey: "moq" },
      { to: "/admin/currency", icon: Globe, label: "Currency & Rates", moduleKey: "currency" },
      { to: "/admin/settings", icon: Settings, label: "System Settings", moduleKey: "settings" },
      { to: "/admin/audit", icon: Shield, label: "Audit Trail", moduleKey: "audit" },
    ],
  },
];

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || !user) return;
    const fetchRole = async () => {
      const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
      setRole(data?.role ?? null);
      setRoleLoading(false);
    };
    fetchRole();
  }, [user, authLoading]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/splash");
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!role || !["admin", "super_admin", "finance_head", "dispatch_head", "production_manager", "assembly_manager", "packing_supervisor", "sales_executive", "support_executive"].includes(role)) {
    return <Navigate to="/" replace />;
  }

  // Filter nav items based on role
  const allowedModules = ROLE_MODULE_ACCESS[role] ?? [];
  const hasAccess = (moduleKey: string) =>
    allowedModules.includes("*") || allowedModules.includes(moduleKey);

  const filteredSections = navSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => hasAccess(item.moduleKey)),
    }))
    .filter(section => section.items.length > 0);

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col bg-card border-r border-border transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ boxShadow: "2px 0 12px rgba(0,0,0,0.04)" }}
      >
        <div className="p-5 flex items-center gap-3 border-b border-border">
          <img src={logoImg} alt="Oasis" className="h-7 object-contain" />
          <span className="text-ui-h5 text-primary">Admin</span>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-4">
          {filteredSections.map((section) => (
            <div key={section.title}>
              <p className="text-fine text-muted-foreground uppercase tracking-wider px-3 mb-1">{section.title}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-ui font-medium transition-colors ${
                        isActive
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`
                    }
                  >
                    <item.icon size={16} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-ui font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors w-full"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-14 flex items-center px-5 border-b border-border bg-card lg:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu size={20} className="text-primary" />
          </button>
          <span className="ml-3 text-ui-h5 text-primary">Admin Panel</span>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
