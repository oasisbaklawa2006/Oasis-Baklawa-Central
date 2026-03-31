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

  // Each tab occupies 20% of the width
  const tabWidth = 100 / navItems.length;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-[82px] flex items-center justify-around px-1"
      style={{ background: "#EEEEEE", borderTop: "1px solid #E0E0E0" }}
    >
      {/* Iridescent sliding bubble */}
      <motion.div
        className="absolute top-1 rounded-2xl pointer-events-none"
        style={{
          width: `calc(${tabWidth}% - 8px)`,
          height: "68px",
          background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(245,243,248,0.9) 40%, rgba(240,238,245,0.85) 100%)",
          boxShadow: `
            0 4px 20px rgba(0,0,0,0.08),
            0 1px 4px rgba(0,0,0,0.04),
            inset 0 1px 2px rgba(255,255,255,1),
            inset 0 -1px 2px rgba(200,195,210,0.15)
          `,
          border: "1px solid rgba(255,255,255,0.7)",
        }}
        initial={false}
        animate={{
          left: `calc(${resolvedIndex * tabWidth}% + 4px)`,
        }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
      >
        {/* Iridescent edge sheen - top-left */}
        <div
          className="absolute -top-[1px] -left-[1px] w-[60%] h-[60%] rounded-tl-2xl pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(200,180,255,0.35) 0%, rgba(180,220,255,0.2) 40%, transparent 70%)",
          }}
        />
        {/* Iridescent edge sheen - bottom-right */}
        <div
          className="absolute -bottom-[1px] -right-[1px] w-[50%] h-[50%] rounded-br-2xl pointer-events-none"
          style={{
            background: "linear-gradient(315deg, rgba(180,255,200,0.25) 0%, rgba(220,200,255,0.15) 40%, transparent 70%)",
          }}
        />
        {/* Central pearl highlight */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 35% 25%, rgba(255,255,255,0.8) 0%, transparent 50%)",
          }}
        />
      </motion.div>

      {/* Nav items */}
      {navItems.map((item, i) => {
        const isActive = i === resolvedIndex;
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className="relative z-10 flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors"
          >
            <item.icon
              size={24}
              strokeWidth={isActive ? 2.2 : 1.6}
              style={{ color: "#C6A769" }}
            />
            <span
              className="text-[9px] font-bold tracking-wider"
              style={{ color: isActive ? "#1c1c1c" : "#888888" }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNavBar;
