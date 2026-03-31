import { Home, BookOpen, LayoutDashboard, ShoppingCart, Package } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const navItems = [
  { icon: Home, label: "HOME", path: "/" },
  { icon: BookOpen, label: "CATALOGUE", path: "/catalogue" },
  { icon: LayoutDashboard, label: "DASHBOARD", path: "/dashboard" },
  { icon: ShoppingCart, label: "CART", path: "/cart" },
  { icon: Package, label: "ORDERS", path: "/orders" },
];

const BottomNavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const activeIndex = navItems.findIndex((item) => item.path === location.pathname);
  const resolvedIndex = activeIndex === -1 ? 0 : activeIndex;
  const tabWidth = 100 / navItems.length;

  return (
    <nav
      className="fixed bottom-3 left-4 right-4 z-50 h-[72px] flex items-center justify-around rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.75)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        border: "1px solid rgba(255,255,255,0.5)",
      }}
    >
      {/* Active indicator */}
      <motion.div
        className="absolute top-2 rounded-xl pointer-events-none"
        style={{
          width: `calc(${tabWidth}% - 12px)`,
          height: "56px",
          background: "hsl(var(--primary) / 0.08)",
        }}
        initial={false}
        animate={{
          left: `calc(${resolvedIndex * tabWidth}% + 6px)`,
        }}
        transition={{ type: "spring", stiffness: 350, damping: 32 }}
      />

      {navItems.map((item, i) => {
        const isActive = i === resolvedIndex;
        return (
          <motion.button
            key={item.label}
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate(item.path)}
            className="relative z-10 flex flex-col items-center justify-center gap-1 flex-1 py-2"
          >
            <item.icon
              size={22}
              strokeWidth={isActive ? 2 : 1.5}
              className={isActive ? "text-primary" : "text-muted-foreground"}
            />
            <span
              className={`text-[9px] font-medium tracking-wider transition-colors duration-200 ${
                isActive ? "text-primary font-bold" : "text-muted-foreground"
              }`}
            >
              {item.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="nav-dot"
                className="absolute -bottom-0 w-1 h-1 rounded-full bg-secondary"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </motion.button>
        );
      })}
    </nav>
  );
};

export default BottomNavBar;
