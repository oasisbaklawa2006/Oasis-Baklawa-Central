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
      className="fixed bottom-3 left-4 right-4 z-50 h-[64px] flex items-center justify-around rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(16px) saturate(160%)",
        WebkitBackdropFilter: "blur(16px) saturate(160%)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)",
        border: "1px solid rgba(198,168,125,0.15)",
      }}
    >
      {/* Active indicator */}
      <motion.div
        className="absolute top-2 rounded-xl pointer-events-none"
        style={{
          width: `calc(${tabWidth}% - 14px)`,
          height: "48px",
          background: "hsl(36 30% 63% / 0.08)",
          border: "1px solid hsl(36 30% 63% / 0.12)",
        }}
        initial={false}
        animate={{
          left: `calc(${resolvedIndex * tabWidth}% + 7px)`,
        }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
      />

      {navItems.map((item, i) => {
        const isActive = i === resolvedIndex;
        return (
          <motion.button
            key={item.label}
            whileTap={{ scale: 0.93 }}
            onClick={() => navigate(item.path)}
            className="relative z-10 flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5"
          >
            <item.icon
              size={20}
              strokeWidth={isActive ? 1.8 : 1.3}
              className={isActive ? "text-primary" : "text-muted-foreground"}
            />
            <span
              className={`text-[8px] tracking-[0.15em] transition-colors duration-200 ${
                isActive ? "text-primary font-semibold" : "text-muted-foreground font-medium"
              }`}
            >
              {item.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="nav-dot"
                className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary"
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
