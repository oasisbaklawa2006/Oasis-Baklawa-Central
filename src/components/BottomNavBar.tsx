import { Home, BookOpen, Package, ShoppingCart, LayoutDashboard } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: BookOpen, label: "Catalogue", path: "/catalogue" },
  { icon: Package, label: "Orders", path: "/orders" },
  { icon: ShoppingCart, label: "Cart", path: "/cart" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
];

const BottomNavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-[72px] bg-card shadow-[0_-2px_12px_rgba(0,0,0,0.06)] flex items-center justify-around px-2">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-colors ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <item.icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className={`text-[11px] font-body ${isActive ? "font-semibold" : "font-medium"}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNavBar;
