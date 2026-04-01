import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import collClassics from "@/assets/collection-classics.jpg";
import collGifting from "@/assets/collection-gifting.jpg";
import collTrade from "@/assets/collection-trade.jpg";
import collFestive from "@/assets/collection-festive.jpg";

const COLLECTIONS = [
  {
    title: "Arabic Classics",
    subtitle: "Timeless recipes, perfected",
    image: collClassics,
    query: "Baklawa",
  },
  {
    title: "Premium Gifting",
    subtitle: "Crafted for impressions",
    image: collGifting,
    query: "Premium Gift Packs",
  },
  {
    title: "Trade Essentials",
    subtitle: "Bulk & wholesale favourites",
    image: collTrade,
    query: "Bulk Sweets & Nuts",
  },
  {
    title: "Festive Best Sellers",
    subtitle: "Celebrate in style",
    image: collFestive,
    query: "Gifting",
  },
];

const CuratedCollections = () => {
  const navigate = useNavigate();

  return (
    <section className="mt-8 mb-8">
      <div className="px-5 mb-4 flex items-center gap-3">
        <div className="w-6 h-[0.5px] bg-primary/40" />
        <p className="font-body text-[9px] font-medium tracking-[0.3em] uppercase text-muted-foreground">
          Curated Collections
        </p>
      </div>

      <div className="flex overflow-x-auto scrollbar-hide gap-3 px-5 pb-1 snap-x">
        {COLLECTIONS.map((col, i) => (
          <motion.button
            key={col.title}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            whileTap={{ scale: 0.97 }}
            onClick={() =>
              navigate(`/catalogue?category=${encodeURIComponent(col.query)}`)
            }
            className="relative min-w-[260px] h-[150px] rounded-2xl overflow-hidden snap-start flex-shrink-0 group"
          >
            <img
              src={col.image}
              alt={col.title}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              loading="lazy"
              width={800}
              height={512}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-foreground/60 via-foreground/30 to-transparent" />
            <div className="absolute bottom-0 left-0 p-4 z-10">
              <p className="font-display text-[15px] text-white leading-tight mb-0.5">
                {col.title}
              </p>
              <p className="font-body text-[9px] text-white/60 tracking-wider mb-2.5">
                {col.subtitle}
              </p>
              <span className="font-body text-[8px] tracking-[0.2em] uppercase text-primary border border-primary/50 rounded-full px-3 py-1 backdrop-blur-sm bg-primary/10">
                View Collection
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
};

export default CuratedCollections;
