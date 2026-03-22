import { Home, BookOpen, Package, ShoppingCart, LayoutDashboard } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: BookOpen, label: "Catalogue", path: "/catalogue" },
  { icon: LayoutDashboard, label: "Portal", path: "/dashboard", isCenter: true },
  { icon: ShoppingCart, label: "Cart", path: "/cart" },
  { icon: Package, label: "Orders", path: "/orders" },
];

const BottomNavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-[80px] bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] flex items-end justify-around px-2 pb-3">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;

        if (item.isCenter) {
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="relative flex flex-col items-center group"
            >
              {/* Subtle Bulge Background */}
              <div
                className={`absolute -top-10 w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg ${
                  isActive ? "bg-slate-900 text-white" : "bg-white border border-slate-100 text-[#B8860B]"
                }`}
              >
                <item.icon size={28} strokeWidth={isActive ? 2.5 : 1.8} />
              </div>
              <span
                className={`mt-8 text-[10px] uppercase tracking-tighter font-bold ${isActive ? "text-slate-900" : "text-slate-400"}`}
              >
                {item.label}
              </span>
            </button>
          );
        }

        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-1 py-2 px-3 transition-colors ${
              isActive ? "text-slate-900" : "text-slate-400"
            }`}
          >
            <item.icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className={`text-[10px] uppercase tracking-tighter ${isActive ? "font-bold" : "font-medium"}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNavBar;
