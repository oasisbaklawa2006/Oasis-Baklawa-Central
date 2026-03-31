import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const CATEGORIES = [
  { label: "Baklava", icon: "🍯", query: "Baklawa" },
  { label: "Dates", icon: "🌴", query: "Dates" },
  { label: "Chocolates", icon: "🍫", query: "Chocolates" },
  { label: "Nuts", icon: "🌰", query: "Nuts & Dragees" },
  { label: "Fusion", icon: "✨", query: "Bulk Sweets & Nuts" },
  { label: "Gifts", icon: "🎁", query: "Gifting" },
  { label: "Premium", icon: "🎀", query: "Premium Gift Packs" },
];

const CategoryIcons = () => {
  const navigate = useNavigate();

  return (
    <section className="px-4">
      <p className="text-[10px] font-body font-semibold tracking-[0.2em] uppercase text-[#C4A052] mb-4 flex items-center gap-2">
        <span className="text-sm">🏛️</span> EXPLORE OUR PRODUCT RANGE
      </p>
      <div className="flex overflow-x-auto scrollbar-hide gap-3 pb-2 snap-x">
        {CATEGORIES.map((cat) => (
          <motion.button
            key={cat.label}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(`/catalogue?category=${cat.query}`)}
            className="flex flex-col items-center justify-center min-w-[80px] w-20 h-20 rounded-2xl border border-[#C4A052]/30 bg-background hover:border-[#C4A052] transition-colors snap-start"
          >
            <span className="text-2xl mb-1">{cat.icon}</span>
            <span className="text-[9px] font-body font-semibold text-foreground uppercase tracking-wider">{cat.label}</span>
          </motion.button>
        ))}
      </div>
    </section>
  );
};

export default CategoryIcons;
