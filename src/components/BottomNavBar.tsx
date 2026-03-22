import { useNavigate, useLocation } from "react-router-dom";
import { Home, BookOpen, LayoutDashboard, ShoppingCart, History } from "lucide-react";

const BottomNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: <Home size={20} />, label: "Home", path: "/" },
    { icon: <BookOpen size={20} />, label: "Catalog", path: "/catalogue" },
    { icon: <LayoutDashboard size={28} />, label: "Portal", path: "/dashboard", isCenter: true },
    { icon: <ShoppingCart size={20} />, label: "Cart", path: "/cart" },
    { icon: <History size={20} />, label: "Orders", path: "/orders" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 px-6 pb-6 pt-3 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
      <div className="max-w-md mx-auto flex justify-between items-end">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          if (item.isCenter) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`relative -top-6 flex flex-col items-center justify-center w-16 h-16 rounded-full shadow-2xl transition-all duration-300 ${
                  isActive ? "bg-slate-900 text-white scale-110" : "bg-[#B8860B] text-white"
                }`}
              >
                {item.icon}
              </button>
            );
          }
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-slate-900" : "text-slate-400"
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavBar;
