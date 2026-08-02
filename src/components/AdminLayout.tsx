import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, UserCheck, ClipboardList, Truck, DollarSign, LogOut, Menu, X, Loader2,
  Headphones, Users, Package, BarChart3, Scale, Globe, Settings, Shield, MessageCircle,
  Factory, PackageCheck, Landmark, AlertCircle, Languages, Bell, Sparkles, Monitor, Activity, Megaphone, Store,
  ScanLine, CalendarDays, Warehouse, Box, ListOrdered, AlertOctagon, ScanBarcode, Network, Gauge, LayoutGrid, Search, PackageMinus,
  Workflow,
  Link2,
  Inbox,
  Brain,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useApplicationBadge } from "@/hooks/useApplicationBadge";
import logoImg from "@/assets/logo-open.png";
import PanicAlertBanner from "@/components/PanicAlertBanner";
import AdminRouteGuard from "@/components/AdminRouteGuard";
import AdminHelpSidebar from "@/components/AdminHelpSidebar";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import AppverseWorkspaceRail from "@/components/appverse/AppverseWorkspaceRail";
import AppverseMobileNav from "@/components/appverse/AppverseMobileNav";
import { signOutAndClearSession } from "@/utils/authSession";
import { useAdminRealtimeToasts } from "@/hooks/useAdminRealtimeToasts";
import { shouldHideAdvancedGovernanceNav } from "@/lib/golden-chain/operatorNavigation";

const ROLE_MODULE_ACCESS: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  ADMIN: [
    "dashboard", "cmd_war_room", "orders", "clients", "products", "pricing", "finance", "finance_audit",
    "users", "moq", "currency", "support", "settings", "audit", "inventory", "inventory_audit", "packing",
    "production", "accounts", "exceptions", "dispatch", "dispatch_audit",
  ],
  FINANCE_HEAD: ["dashboard", "cmd_war_room", "finance", "finance_audit", "accounts", "orders", "audit"],
  FINANCE_EXEC: ["dashboard", "cmd_war_room", "finance", "finance_audit", "accounts", "orders"],
  OPERATIONS_MANAGER: [
    "dashboard", "cmd_war_room", "orders", "production", "packing", "dispatch", "dispatch_audit", "inventory",
    "inventory_audit",
  ],
  PRODUCTION_MANAGER: ["dashboard", "orders", "production"],
  HOD_ARABIC: ["dashboard", "production", "orders"],
  HOD_FUSION: ["dashboard", "production", "orders"],
  HOD_CHOCOLATE: ["dashboard", "production", "orders"],
  HOD_BAKERY: ["dashboard", "production", "orders"],
  HOD_NUTS: ["dashboard", "production", "orders"],
  HOD_ASSEMBLY: ["dashboard", "production", "orders"],
  HOD_DRAGEES: ["dashboard", "production", "orders"],
  STORE_INCHARGE: ["dashboard", "cmd_war_room", "inventory", "orders", "production"],
  DISPATCH_MANAGER: ["dashboard", "cmd_war_room", "packing", "dispatch", "orders", "inventory"],
  DISPATCH_INCHARGE: ["dashboard", "cmd_war_room", "packing", "dispatch", "orders"],
  SECURITY_CONTROL: ["dashboard", "packing"],
  SALES_EXECUTIVE: [],
  SUPPORT_EXECUTIVE: ["dashboard", "support", "exceptions", "orders"],
  // Legacy compat
  DISPATCH_HEAD: ["dashboard", "cmd_war_room", "packing", "dispatch", "orders", "inventory"],
  ASSEMBLY_MANAGER: ["dashboard", "production", "orders"],
  PACKING_SUPERVISOR: ["dashboard", "packing", "dispatch"],
  STORE_READY_GOODS: ["dashboard", "cmd_war_room", "inventory", "orders", "production"],
  RGS_ADMIN: ["dashboard", "cmd_war_room", "inventory", "orders", "production"],
  CUSTOMER_USER: [],
};

interface NavItem {
  to: string; icon: React.ElementType; label: string; end?: boolean; moduleKey: string;
}

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAllTools, setShowAllTools] = useState(false);
  const { user, loading: authLoading, role: authRole } = useAuth();
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
        { to: "/admin", icon: LayoutDashboard, label: "Executive Dashboard", end: true, moduleKey: "dashboard" },
        { to: "/admin/execution-command-center", icon: Gauge, label: "Execution CMD", end: false, moduleKey: "cmd_war_room" },
        { to: "/admin/execution/production", icon: LayoutGrid, label: "Production board", end: false, moduleKey: "production" },
        { to: "/admin/execution/assembly", icon: LayoutGrid, label: "Assembly board", end: false, moduleKey: "production" },
        { to: "/admin/execution/dispatch", icon: LayoutGrid, label: "Dispatch board", end: false, moduleKey: "dispatch" },
        { to: "/admin/execution/ready-goods", icon: LayoutGrid, label: "Ready goods board", end: false, moduleKey: "inventory" },
        { to: "/admin/execution/retail", icon: LayoutGrid, label: "Retail board", end: false, moduleKey: "inventory" },
        { to: "/admin/execution/third-party", icon: LayoutGrid, label: "Third party board", end: false, moduleKey: "orders" },
        { to: "/admin/execution/complaints", icon: LayoutGrid, label: "Complaints board", end: false, moduleKey: "support" },
        { to: "/admin/live-work-queues", icon: ListOrdered, label: "Live work queues", end: false, moduleKey: "cmd_war_room" },
        { to: "/admin/entity-graph-explorer", icon: Network, label: "Entity graph explorer", end: false, moduleKey: "cmd_war_room" },
        { to: "/admin/product-intelligence-prototype", icon: Brain, label: "Product intelligence lab", end: false, moduleKey: "cmd_war_room" },
      ],
    },
    {
      title: t("Operations"),
      items: [
        { to: "/admin/inventory-command-center", icon: Warehouse, label: "Inventory command center (preview)", end: false, moduleKey: "inventory" },
        { to: "/admin/carton-explorer", icon: Box, label: "Carton explorer (preview)", end: false, moduleKey: "inventory" },
        { to: "/admin/reservation-board", icon: ListOrdered, label: "Reservation board (audit)", end: false, moduleKey: "inventory_audit" },
        { to: "/admin/stock-finalization", icon: PackageMinus, label: "Stock finalization (audit)", end: false, moduleKey: "inventory_audit" },
        { to: "/admin/inventory-risk-board", icon: AlertOctagon, label: "Inventory risk board (preview)", end: false, moduleKey: "inventory" },
        { to: "/admin/scan-timeline", icon: ScanBarcode, label: "Scan timeline (preview)", end: false, moduleKey: "inventory" },
        // Central Pool fully removed from sidebar — War Room is the only active track.
        // Route remains accessible via direct URL for read-only DB log auditing.
        { to: "/admin/order-management", icon: ClipboardList, label: t("Order Pipeline"), moduleKey: "orders" },
        { to: "/admin/order-management?view=production", icon: Factory, label: t("Production"), moduleKey: "production" },
        { to: "/admin/order-management?view=packing", icon: PackageCheck, label: t("Packing & Dispatch"), moduleKey: "packing" },
        { to: "/admin/accounts-release", icon: Landmark, label: t("Accounts & Release"), moduleKey: "accounts" },
        { to: "/admin/exceptions", icon: AlertCircle, label: t("Exceptions"), moduleKey: "exceptions" },
        { to: "/admin/assembly-tasks", icon: PackageCheck, label: "Assembly", moduleKey: "production" },
        { to: "/admin/ready-goods", icon: Package, label: "Ready Goods", moduleKey: "inventory" },
        { to: "/admin/store-coordination", icon: Store, label: "Store coordination", moduleKey: "orders" },
        { to: "/admin/label-command-center", icon: ScanLine, label: "Label command center", moduleKey: "orders" },
        { to: "/admin/customer-timeline-preview", icon: CalendarDays, label: "Customer timeline preview", moduleKey: "cmd_war_room" },
        { to: "/admin/operational-search", icon: Search, label: "Operational search", moduleKey: "cmd_war_room" },
        { to: "/admin/golden-chain-operator", icon: Workflow, label: "Golden Chain Operator", moduleKey: "dispatch" },
        { to: "/admin/dispatch-readiness", icon: ClipboardList, label: "Dispatch readiness (audit)", moduleKey: "dispatch_audit" },
        { to: "/admin/dispatch-completion", icon: Truck, label: "Dispatch completion (audit)", moduleKey: "dispatch_audit" },
        { to: "/admin/dispatch-finalization", icon: Truck, label: "Dispatch finalization (audit)", moduleKey: "dispatch_audit" },
        { to: "/admin/dispatch-mgmt", icon: Truck, label: "Dispatch", moduleKey: "packing" },
        { to: "/security-gate", icon: Shield, label: "Security Gate", moduleKey: "packing" },
      ],
    },
    {
      title: t("Governance"),
      items: [
        { to: "/admin/clients", icon: UserCheck, label: t("Clients"), moduleKey: "clients" },
        { to: "/admin/products", icon: Package, label: t("Products"), moduleKey: "products" },
        { to: "/admin/merchandising", icon: Sparkles, label: t("Merchandising"), moduleKey: "products" },
        { to: "/admin/catalogue-sync", icon: Link2, label: "Catalogue sync", moduleKey: "products" },
        { to: "/admin/catalogue-approvals", icon: Inbox, label: "Catalogue approvals", moduleKey: "products" },
        { to: "/admin/pricing", icon: BarChart3, label: t("Pricing"), moduleKey: "pricing" },
        { to: "/admin/finance-governance", icon: Landmark, label: "Finance governance (audit)", moduleKey: "finance_audit" },
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
        { to: "/admin/operator-inbox", icon: MessageCircle, label: "WhatsApp Inbox", moduleKey: "support" },
        { to: "/admin/logistics", icon: Truck, label: t("Logistics"), moduleKey: "settings" },
        { to: "/admin/notifications", icon: Bell, label: t("Notifications"), moduleKey: "settings" },
        { to: "/admin/announcements", icon: Megaphone, label: t("Announcements"), moduleKey: "settings" },
        { to: "/admin/display-management", icon: Monitor, label: t("Display Management"), moduleKey: "settings" },
      ],
    },
  ];

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
    return false;
  };

  const hideAdvancedGovernance = shouldHideAdvancedGovernanceNav(role);

  const canAccessGoldenChainOperator = () =>
    ["dispatch", "finance", "inventory"].some((moduleKey) => hasAccess(moduleKey));

  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.to === "/admin/golden-chain-operator") {
          if (!canAccessGoldenChainOperator()) return false;
        } else if (!hasAccess(item.moduleKey)) {
          return false;
        }
        if (hideAdvancedGovernance && item.moduleKey.endsWith("_audit")) return false;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="appverse-shell min-h-screen flex bg-background max-w-[100vw] overflow-x-hidden">
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 flex flex-col bg-card border-r border-border transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ boxShadow: "2px 0 12px rgba(0,0,0,0.04)" }}>
        <div className="p-5 flex items-center gap-3 border-b border-border">
          <img src={logoImg} alt="Oasis" className="h-7 object-contain" />
          <div className="min-w-0">
            <span className="block text-ui-h5 text-primary">App-Verse</span>
            <span className="block truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Central workspace</span>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}><X size={18} className="text-muted-foreground" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspaces</p>
          <AppverseWorkspaceRail allowedModules={allowedModules} onNavigate={() => setSidebarOpen(false)} />

          <div className="mt-5 border-t border-border/70 pt-3">
            <button
              type="button"
              onClick={() => setShowAllTools((value) => !value)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-expanded={showAllTools}
            >
              <span>All tools</span>
              <ChevronDown size={14} className={`transition-transform ${showAllTools ? "rotate-180" : ""}`} />
            </button>

            {showAllTools && (
              <nav className="mt-3 space-y-4" aria-label="All permitted tools">
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
            )}
          </div>
        </div>

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

      <div className="flex-1 flex flex-col min-h-screen min-w-0 max-w-full overflow-x-hidden">
        <header className="h-14 flex items-center px-5 border-b border-border bg-card lg:hidden">
          <button onClick={() => setSidebarOpen(true)}><Menu size={20} className="text-primary" /></button>
          <div className="ml-3">
            <span className="block text-ui-h5 text-primary">Oasis App-Verse</span>
            <span className="block text-[10px] text-muted-foreground">Role-based command view</span>
          </div>
        </header>
        {/* System status strip — verification + AI engine signals */}
        <div className="hidden lg:flex items-center justify-end gap-3 px-5 h-7 bg-card/60 border-b border-border text-[10px] font-medium tracking-wide">
          <span className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Security: OTP verification active
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span className="flex items-center gap-1.5 text-primary">
            <Sparkles size={10} /> AI Engine: 0.98 Disciplined
          </span>
        </div>
        <PanicAlertBanner />
        <main className="flex-1 p-4 pb-24 sm:p-6 sm:pb-24 lg:pb-6 overflow-y-auto overflow-x-hidden max-w-full">
          <AdminRouteGuard><Outlet /></AdminRouteGuard>
        </main>
      </div>
      <AppverseMobileNav allowedModules={allowedModules} />
      <AdminHelpSidebar />
      <OnboardingOverlay />
    </div>
  );
};

export default AdminLayout;
