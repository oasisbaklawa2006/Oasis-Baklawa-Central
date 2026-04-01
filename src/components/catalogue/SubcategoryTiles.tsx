import { motion } from "framer-motion";
import catBulk from "@/assets/cat-bulk-sweets.jpg";

interface SubcategoryTilesProps {
  subcategories: string[];
  productCounts: Record<string, number>;
  onSelect: (sub: string) => void;
}

const SubcategoryTiles = ({ subcategories, productCounts, onSelect }: SubcategoryTilesProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {subcategories.map((sub, i) => {
        const count = productCounts[sub] || 0;
        return (
          <motion.button
            key={sub}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            onClick={() => onSelect(sub)}
            className="relative aspect-[4/5] overflow-hidden rounded-2xl group cursor-pointer bg-muted"
          >
            <img
              src={catBulk}
              alt={sub}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="font-display text-sm text-white leading-tight">{sub}</p>
              <p className="font-body text-[10px] text-white/50 mt-1">{count} products</p>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};

export default SubcategoryTiles;
