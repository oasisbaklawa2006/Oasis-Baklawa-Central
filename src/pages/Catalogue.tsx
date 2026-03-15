import AppShell from "@/components/AppShell";
import { Heart, ShoppingCart } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

import posterSpread from "@/assets/poster-spread.jpg";
import posterKunafa from "@/assets/poster-kunafa.jpg";
import posterSlice from "@/assets/poster-baklawa-slice.jpg";
import pistachioImg from "@/assets/baklawa-pistachio.jpg";
import cashewImg from "@/assets/baklawa-cashew.jpg";
import walnutImg from "@/assets/baklawa-walnut.jpg";
import assortedImg from "@/assets/baklawa-assorted.jpg";

/* ── Favorites ── */
const favorites = [
  { name: "Assorted Baklawa", price: "₹5,200 / kg", image: posterSpread },
  { name: "Stuffed Dates", price: "₹3,600 / kg", image: posterKunafa },
  { name: "Pistachio Baklawa", price: "₹4,500 / kg", image: posterSlice },
];

/* ── Main Categories with Unsplash backgrounds ── */
const mainCategories = [
  { name: "Wholesale Loose Products", image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80" },
  { name: "Raw / Unfinished Products", image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80" },
  { name: "Pre Packed Products", image: "https://images.unsplash.com/photo-1548848221-0c2e497ed557?w=600&q=80" },
  { name: "Gift Articles", image: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=600&q=80" },
  { name: "Packaging Supplies", image: "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&q=80" },
];

/* ── Sub-categories ── */
const subCategories = ["Baklawa", "Fusion Sweets", "Chocolates", "Dates", "Dragees & Nuts", "Cookies"];

/* ── Sample products ── */
const sampleProducts = [
  { name: "Turkish Pistachio Baklawa", price: "₹4,500", pack: "500g Pack", moq: "MOQ: 1 Carton", image: pistachioImg },
  { name: "Cashew Roll Baklawa", price: "₹3,800", pack: "250g Pack", moq: "MOQ: 2 Cartons", image: cashewImg },
  { name: "Walnut Diamond Cut", price: "₹3,200", pack: "500g Pack", moq: "MOQ: 1 Carton", image: walnutImg },
  { name: "Assorted Premium Box", price: "₹5,200", pack: "1kg Pack", moq: "MOQ: 1 Carton", image: assortedImg },
];

const Catalogue = () => {
  const [activeSub, setActiveSub] = useState("Baklawa");

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-8">
        {/* ── Header ── */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="font-display text-2xl md:text-3xl tracking-wide text-foreground"
        >
          Product Catalogue
        </motion.h1>

        {/* ── My Favorites ── */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <h2 className="font-display text-lg tracking-wide text-foreground mb-4 flex items-center gap-2">
            <span className="text-primary">⭐</span> My Favorites
          </h2>
          <div className="bg-card rounded-2xl shadow-card p-5">
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
              {favorites.map((item, i) => (
                <div key={i} className="min-w-[170px] max-w-[170px] flex-shrink-0 rounded-xl overflow-hidden border border-border/40">
                  <div className="h-[130px] overflow-hidden">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3">
                    <p className="font-body font-semibold text-foreground text-sm leading-tight">{item.name}</p>
                    <p className="font-body text-xs text-muted-foreground mt-1">{item.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── Main Categories ── */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <h2 className="font-display text-lg tracking-wide text-foreground mb-4">Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {mainCategories.map((cat, i) => (
              <button
                key={i}
                className="relative rounded-2xl overflow-hidden shadow-card aspect-[4/3] group"
              >
                <img src={cat.image} alt={cat.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <p className="absolute bottom-3 left-3 right-3 font-body font-semibold text-white text-sm leading-snug text-left">{cat.name}</p>
              </button>
            ))}
          </div>
        </motion.section>

        {/* ── Sub-Category Pills ── */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
            {subCategories.map((sub) => (
              <button
                key={sub}
                onClick={() => setActiveSub(sub)}
                className={`flex-shrink-0 px-5 py-2 rounded-full font-body text-sm font-medium transition-all ${
                  activeSub === sub
                    ? "bg-primary text-primary-foreground shadow-fab"
                    : "bg-card text-foreground shadow-card hover:shadow-fab"
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </motion.section>

        {/* ── Product Grid ── */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <h2 className="font-display text-lg tracking-wide text-foreground mb-4">Wholesale Loose Products</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sampleProducts.map((product, i) => (
              <div key={i} className="bg-card rounded-2xl shadow-card overflow-hidden relative group">
                <button className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-card/80 backdrop-blur flex items-center justify-center hover:bg-card transition-colors">
                  <Heart size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
                <div className="w-full aspect-square overflow-hidden">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-4 space-y-1.5">
                  <p className="font-body font-bold text-foreground text-sm leading-tight">{product.name}</p>
                  <p className="font-body text-xs text-muted-foreground">{product.price} per kg + taxes</p>
                  <p className="font-body text-xs text-muted-foreground">{product.pack}</p>
                  <p className="font-body text-[11px] text-primary font-semibold">{product.moq}</p>
                  <button className="mt-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-body font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors">
                    <ShoppingCart size={14} />
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </AppShell>
  );
};

export default Catalogue;
