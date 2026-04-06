import { Home, BookOpen, LayoutDashboard, ShoppingCart, Package } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const navItems = [
  { icon: Home, label: "HOME", path: "/home" },
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
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
      style={{
        height: "60px",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(18px) saturate(180%)",
        WebkitBackdropFilter: "blur(18px) saturate(180%)",
        boxShadow: "0 -1px 12px rgba(0,0,0,0.03)",
        borderTop: "1px solid rgba(198,168,125,0.08)",
      }}
    >
      {/* Active indicator */}
      <motion.div
        className="absolute top-1.5 rounded-xl pointer-events-none"
        style={{
          width: `calc(${tabWidth}% - 12px)`,
          height: "44px",
          background: "hsl(36 30% 63% / 0.07)",
          border: "1px solid hsl(36 30% 63% / 0.1)",
        }}
        initial={false}
        animate={{
          left: `calc(${resolvedIndex * tabWidth}% + 6px)`,
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
            className="relative z-10 flex flex-col items-center justify-center gap-0.5 flex-1 py-1"
          >
            <item.icon
              size={19}
              strokeWidth={isActive ? 1.8 : 1.3}
              className={isActive ? "text-primary" : "text-muted-foreground"}
            />
            <span
              className={`text-[7px] tracking-[0.15em] transition-colors duration-200 ${
                isActive ? "text-primary font-semibold" : "text-muted-foreground font-medium"
              }`}
            >
              {item.label}
            </span>
          </motion.button>
        );
      })}
    </nav>
  );
};

export default BottomNavBar;
