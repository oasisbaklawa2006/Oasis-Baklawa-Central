import { motion } from "framer-motion";
import catBulk from "@/assets/cat-bulk-sweets.jpg";
import catReady from "@/assets/cat-ready-packs.jpg";
import catPremium from "@/assets/cat-premium-gifts.jpg";
import catFrozen from "@/assets/cat-frozen.jpg";
import catPackaging from "@/assets/cat-packaging.jpg";

interface CategoryTilesProps {
  categories: string[];
  productCounts: Record<string, number>;
  onSelect: (cat: string) => void;
}

const CATEGORY_META: Record<string, { image: string; desc: string }> = {
  "Bulk Sweets & Nuts": { image: catBulk, desc: "Wholesale & bulk trade essentials" },
  "Ready packs": { image: catReady, desc: "Retail-ready packaged products" },
  "Premium Gift Packs": { image: catPremium, desc: "Luxury gifting collections" },
  "Semi-Prepared & Frozen Range": { image: catFrozen, desc: "Finish-ready gourmet products" },
  "Packaging & Decoration Material": { image: catPackaging, desc: "Packaging & presentation essentials" },
  "Gifting": { image: catPremium, desc: "Curated gift assortments" },
  "Dates": { image: catBulk, desc: "Premium date varieties" },
  "Chocolates": { image: catPremium, desc: "Artisan chocolate range" },
  "Baklawa": { image: catBulk, desc: "Traditional baklawa selection" },
  "Nuts & Dragees": { image: catBulk, desc: "Premium nuts & coated treats" },
};

const fallback = { image: catBulk, desc: "Browse products" };

const CategoryTiles = ({ categories, productCounts, onSelect }: CategoryTilesProps) => {
  return (
    <section>
      <h2 className="font-display text-2xl text-foreground mb-4">Shop by Category</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {categories.map((cat, i) => {
          const meta = CATEGORY_META[cat] || fallback;
          const count = productCounts[cat] || 0;
          // First two tiles on desktop are larger
          const isHero = i < 2;

          return (
            <motion.button
              key={cat}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              onClick={() => onSelect(cat)}
              className={`relative overflow-hidden rounded-2xl group cursor-pointer ${
                isHero ? "aspect-[4/5] md:aspect-[3/4]" : "aspect-[4/5]"
              }`}
            >
              <img
                src={meta.image}
                alt={cat}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="font-display text-base text-white leading-tight">{cat}</p>
                <p className="font-body text-[11px] text-white/70 mt-0.5 line-clamp-1">{meta.desc}</p>
                <p className="font-body text-[10px] text-white/50 mt-1">{count} products</p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
};

export default CategoryTiles;
