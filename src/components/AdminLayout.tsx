import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, UserCheck, ClipboardList, Truck, DollarSign, LogOut, Menu, X, Loader2,
  Headphones, Users, Package, BarChart3, Scale, Globe, Settings, Shield,
  Factory, PackageCheck, Landmark, AlertCircle, Languages, Bell, Sparkles, Monitor, Activity, Megaphone, Inbox
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useApplicationBadge } from "@/hooks/useApplicationBadge";
import logoImg from "@/assets/logo-open.png";
import PanicAlertBanner from "@/components/PanicAlertBanner";
import AdminRouteGuard from "@/components/AdminRouteGuard";
import AdminHelpSidebar from "@/components/AdminHelpSidebar";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import { signOutAndClearSession } from "@/utils/authSession";
import { useAdminRealtimeToasts } from "@/hooks/useAdminRealtimeToasts";

const ROLE_MODULE_ACCESS: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  ADMIN: ["dashboard", "orders", "clients", "products", "pricing", "finance", "users", "moq", "currency", "support", "settings", "audit", "inventory", "packing", "production", "accounts", "exceptions"],
  FINANCE_HEAD: ["dashboard", "finance", "accounts", "orders", "audit"],
  FINANCE_EXEC: ["dashboard", "finance", "accounts", "orders"],
  OPERATIONS_MANAGER: ["dashboard", "orders", "production", "packing", "dispatch", "inventory"],
  PRODUCTION_MANAGER: ["dashboard", "orders", "production"],
  HOD_ARABIC: ["dashboard", "production", "orders"],
  HOD_FUSION: ["dashboard", "production", "orders"],
  HOD_CHOCOLATE: ["dashboard", "production", "orders"],
  HOD_BAKERY: ["dashboard", "production", "orders"],
  HOD_NUTS: ["dashboard", "production", "orders"],
  HOD_ASSEMBLY: ["dashboard", "production", "orders"],
  HOD_DRAGEES: ["dashboard", "production", "orders"],
  STORE_INCHARGE: ["dashboard", "inventory", "orders", "production"],
  DISPATCH_MANAGER: ["dashboard", "packing", "dispatch", "orders", "inventory"],
  DISPATCH_INCHARGE: ["dashboard", "packing", "dispatch", "orders"],
  SECURITY_CONTROL: ["dashboard", "packing"],
  SALES_EXECUTIVE: ["dashboard", "orders", "clients", "products"],
  SUPPORT_EXECUTIVE: ["dashboard", "support", "exceptions", "orders"],
  // Legacy compat
  DISPATCH_HEAD: ["dashboard", "packing", "dispatch", "orders", "inventory"],
  ASSEMBLY_MANAGER: ["dashboard", "production", "orders"],
  PACKING_SUPERVISOR: ["dashboard", "packing", "dispatch"],
  STORE_READY_GOODS: ["dashboard", "inventory", "orders", "production"],
  RGS_ADMIN: ["dashboard", "inventory", "orders", "production"],
  CUSTOMER_USER: [],
};

interface NavItem {
  to: string; icon: React.ElementType; label: string; end?: boolean; moduleKey: string;
}

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSalesExec, setIsSalesExec] = useState(false);
  const { user, loading: authLoading, role: authRole, profileReady } = useAuth();
  // Single source of truth: normalized uppercase role from useAuth (RPC-backed)
  const role = authRole ? authRole.trim().toUpperCase() : null;
  const navigate = useNavigate();
  const { t, lang, setLang } = useLanguage();
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const pendingApplications = useApplicationBadge(isAdmin);
  useAdminRealtimeToasts(!!user && !authLoading);

  const navSections: { title: string; items: NavItem[] }[] = [
    {
      title: "Command",
      items: [
        { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true, moduleKey: "dashboard" },
        { to: "/admin/heartbeat", icon: Activity, label: "CMD Heartbeat", end: false, moduleKey: "cmd_war_room" },
        { to: "/admin/cmd-war-room", icon: Monitor, label: "War Room", end: false, moduleKey: "cmd_war_room" },
      ],
    },
    {
      title: t("Operations"),
      items: [
        { to: "/admin/central-pool", icon: Inbox, label: "Central Pool", moduleKey: "orders" },
        { to: "/admin/order-management", icon: ClipboardList, label: t("Order Pipeline"), moduleKey: "orders" },
        { to: "/admin/order-management?view=production", icon: Factory, label: t("Production"), moduleKey: "production" },
        { to: "/admin/order-management?view=packing", icon: PackageCheck, label: t("Packing & Dispatch"), moduleKey: "packing" },
        { to: "/admin/accounts-release", icon: Landmark, label: t("Accounts & Release"), moduleKey: "accounts" },
        { to: "/admin/exceptions", icon: AlertCircle, label: t("Exceptions"), moduleKey: "exceptions" },
        { to: "/admin/assembly-tasks", icon: PackageCheck, label: "Assembly", moduleKey: "production" },
        { to: "/admin/assembly-tv", icon: Monitor, label: "Assembly TV", moduleKey: "production" },
        { to: "/admin/ready-goods", icon: Package, label: "Ready Goods", moduleKey: "inventory" },
        { to: "/admin/rgs-tv", icon: Monitor, label: "RGS TV", moduleKey: "inventory" },
        { to: "/admin/dispatch-mgmt", icon: Truck, label: "Dispatch", moduleKey: "packing" },
        { to: "/admin/dispatch-tv", icon: Monitor, label: "Dispatch TV", moduleKey: "packing" },
        { to: "/security-gate", icon: Shield, label: "Security Gate", moduleKey: "packing" },
      ],
    },
    {
      title: t("Governance"),
      items: [
        { to: "/admin/clients", icon: UserCheck, label: t("Clients"), moduleKey: "clients" },
        { to: "/admin/products", icon: Package, label: t("Products"), moduleKey: "products" },
        { to: "/admin/merchandising", icon: Sparkles, label: t("Merchandising"), moduleKey: "products" },
        { to: "/admin/pricing", icon: BarChart3, label: t("Pricing"), moduleKey: "pricing" },
        { to: "/admin/finance", icon: DollarSign, label: t("Finance"), moduleKey: "finance" },
        { to: "/admin/users", icon: Users, label: t("Users"), moduleKey: "users" },
        { to: "/sales/dashboard", icon: BarChart3, label: t("Sales Console"), moduleKey: "clients" },
      ],
    },
    {
      title: t("System"),
      items: [
        { to: "/admin/moq", icon: Scale, label: t("MOQ Rules"), moduleKey: "moq" },
        { to: "/admin/currency", icon: Globe, label: t("Currency"), moduleKey: "currency" },
        { to: "/admin/settings", icon: Settings, label: t("Settings"), moduleKey: "settings" },
        { to: "/admin/audit", icon: Shield, label: t("Audit Trail"), moduleKey: "audit" },
        { to: "/admin/inventory", icon: PackageCheck, label: t("Factory Stock"), moduleKey: "inventory" },
        { to: "/admin/support", icon: Headphones, label: t("Support"), moduleKey: "support" },
        { to: "/admin/logistics", icon: Truck, label: t("Logistics"), moduleKey: "settings" },
        { to: "/admin/notifications", icon: Bell, label: t("Notifications"), moduleKey: "settings" },
        { to: "/admin/announcements", icon: Megaphone, label: t("Announcements"), moduleKey: "settings" },
      ],
    },
  ];

  // Sales-exec flag only (role itself comes from unified useAuth/RPC)
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("is_sales_executive")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setIsSalesExec(!!(data as any)?.is_sales_executive);
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const handleLogout = async () => { await signOutAndClearSession(); navigate("/splash"); };

  // Only block on initial Supabase auth check. If profile is slow, fall through
  // with allowedModules=[] — useAuth has a 3s fallback that resolves role.
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  // Default to [] so layout renders even if role is missing (no infinite loader).
  const allowedModules: string[] = role ? (ROLE_MODULE_ACCESS[role] ?? []) : [];

  const hasAccess = (moduleKey: string) => {
    if (allowedModules.includes("*") || allowedModules.includes(moduleKey)) return true;
    // Multi-role: if user has is_sales_executive flag, grant access to clients module (Sales Console)
    if (isSalesExec && moduleKey === "clients") return true;
    return false;
  };

  const filteredSections = navSections
    .map(section => ({ ...section, items: section.items.filter(item => hasAccess(item.moduleKey)) }))
    .filter(section => section.items.length > 0);

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col bg-card border-r border-border transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ boxShadow: "2px 0 12px rgba(0,0,0,0.04)" }}>
        <div className="p-5 flex items-center gap-3 border-b border-border">
          <img src={logoImg} alt="Oasis" className="h-7 object-contain" />
          <span className="text-ui-h5 text-primary">Admin</span>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}><X size={18} className="text-muted-foreground" /></button>
        </div>

        <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-4">
          {filteredSections.map((section) => (
            <div key={section.title}>
              <p className="text-fine text-muted-foreground uppercase tracking-wider px-3 mb-1">{section.title}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-ui font-medium transition-colors ${isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                    <item.icon size={16} />
                    <span className="flex-1">{item.label}</span>
                    {item.moduleKey === "clients" && pendingApplications > 0 && (
                      <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {pendingApplications}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Language toggle */}
        <div className="px-3 py-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Languages size={14} className="text-muted-foreground" />
            <button onClick={() => setLang(lang === "en" ? "hi" : "en")}
              className="text-xs font-ui font-medium text-muted-foreground hover:text-primary transition-colors">
              {lang === "en" ? "हिंदी" : "English"}
            </button>
          </div>
        </div>

        <div className="p-3 border-t border-border">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-ui font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors w-full">
            <LogOut size={16} />{t("Sign Out")}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-14 flex items-center px-5 border-b border-border bg-card lg:hidden">
          <button onClick={() => setSidebarOpen(true)}><Menu size={20} className="text-primary" /></button>
          <span className="ml-3 text-ui-h5 text-primary">Admin Panel</span>
        </header>
        <PanicAlertBanner />
        <main className="flex-1 p-6 overflow-y-auto">
          <AdminRouteGuard><Outlet /></AdminRouteGuard>
        </main>
      </div>
      <AdminHelpSidebar />
      <OnboardingOverlay />
    </div>
  );
};

export default AdminLayout;
