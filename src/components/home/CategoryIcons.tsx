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
    <section className="px-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-[1px] bg-[#C4A052]" />
        <p className="text-[9px] font-body font-medium tracking-[0.3em] uppercase text-[#C4A052]">
          Explore Our Range
        </p>
      </div>
      <div className="flex overflow-x-auto scrollbar-hide gap-4 pb-2 snap-x -mx-2 px-2">
        {CATEGORIES.map((cat, i) => (
          <motion.button
            key={cat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(`/catalogue?category=${cat.query}`)}
            className="flex flex-col items-center justify-center min-w-[72px] w-[72px] h-[88px] rounded-[16px] bg-[#F0EDE4] hover:bg-[#E8E3D6] transition-colors snap-start group"
          >
            <span className="text-2xl mb-2 group-hover:scale-110 transition-transform duration-500">{cat.icon}</span>
            <span className="text-[8px] font-body font-semibold text-[#1A120B] uppercase tracking-[0.15em]">{cat.label}</span>
          </motion.button>
        ))}
      </div>
    </section>
  );
};

export default CategoryIcons;
