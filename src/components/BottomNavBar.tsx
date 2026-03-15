import { Home, BookOpen, Package, ShoppingCart, LayoutDashboard } from "lucide-react";
import { useState } from "react";

const navItems = [
  { icon: Home, label: "Home" },
  { icon: BookOpen, label: "Catalogue" },
  { icon: Package, label: "Orders" },
  { icon: ShoppingCart, label: "Cart" },
  { icon: LayoutDashboard, label: "Dashboard" },
];

const BottomNavBar = () => {
  const [active, setActive] = useState(0);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-[72px] bg-card shadow-[0_-2px_12px_rgba(0,0,0,0.06)] flex items-center justify-around px-2">
      {navItems.map((item, i) => {
        const isActive = active === i;
        return (
          <button
            key={item.label}
            onClick={() => setActive(i)}
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
