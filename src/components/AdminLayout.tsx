import { NavLink, Outlet, Navigate } from "react-router-dom";
import { LayoutDashboard, UserCheck, ClipboardList, Truck, DollarSign, LogOut, Menu, X, Loader2, Headphones } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logoImg from "@/assets/logo-open.png";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/approvals", icon: UserCheck, label: "B2B Approvals" },
  { to: "/admin/orders", icon: ClipboardList, label: "Order Queue" },
  { to: "/admin/dispatch", icon: Truck, label: "Dispatch" },
  { to: "/admin/finance", icon: DollarSign, label: "Finance" },
  { to: "/admin/support", icon: Headphones, label: "Support Tickets" },
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
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      setRole(data?.role ?? null);
      setRoleLoading(false);
    };
    fetchRole();
  }, [user, authLoading]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#111111" }}>
        <Loader2 size={24} className="animate-spin" style={{ color: "#c6a769" }} />
      </div>
    );
  }

  // Role gating: only admin/super_admin allowed
  if (!role || !["admin", "super_admin"].includes(role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#111111" }}>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "#1a1a1a" }}
      >
        <div className="p-5 flex items-center gap-3 border-b" style={{ borderColor: "#2a2a2a" }}>
          <img src={logoImg} alt="Oasis" className="w-[105px] object-contain" />
          <span className="font-display text-sm tracking-wide" style={{ color: "#c6a769" }}>
            Admin
          </span>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={18} style={{ color: "#888" }} />
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "text-[#c6a769] bg-[#c6a769]/10"
                    : "text-[#999] hover:text-[#ccc] hover:bg-white/5"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: "#2a2a2a" }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#999] hover:text-red-400 hover:bg-red-400/10 transition-colors w-full"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header
          className="h-14 flex items-center px-5 border-b lg:hidden"
          style={{ backgroundColor: "#1a1a1a", borderColor: "#2a2a2a" }}
        >
          <button onClick={() => setSidebarOpen(true)}>
            <Menu size={20} style={{ color: "#c6a769" }} />
          </button>
          <span className="ml-3 font-display text-sm" style={{ color: "#c6a769" }}>
            Admin Panel
          </span>
        </header>
        <main className="flex-1 p-6 overflow-y-auto" style={{ backgroundColor: "#111111" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
