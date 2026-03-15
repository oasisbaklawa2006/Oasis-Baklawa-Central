import AppShell from "@/components/AppShell";
import { Heart, Plus, ShoppingCart } from "lucide-react";
import { motion } from "framer-motion";

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

/* ── Categories ── */
const categories = [
  "Wholesale Loose Products",
  "Fusion Sweets",
  "Chocolates",
  "Dates",
  "Dragees & Nuts",
  "Cookies",
  "Raw / Unfinished Products",
  "Pre Packed Products",
  "Gift Articles",
  "Packaging Supplies",
];

/* ── Sample products ── */
const sampleProducts = [
  { name: "Turkish Pistachio Baklawa", price: "₹4,500", pack: "500g Pack", moq: "MOQ: 1 Carton", image: pistachioImg },
  { name: "Cashew Roll Baklawa", price: "₹3,800", pack: "250g Pack", moq: "MOQ: 2 Cartons", image: cashewImg },
  { name: "Walnut Diamond Cut", price: "₹3,200", pack: "500g Pack", moq: "MOQ: 1 Carton", image: walnutImg },
  { name: "Assorted Premium Box", price: "₹5,200", pack: "1kg Pack", moq: "MOQ: 1 Carton", image: assortedImg },
];

const Catalogue = () => (
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
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
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

      {/* ── Categories Grid ── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h2 className="font-display text-lg tracking-wide text-foreground mb-4">Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories.map((cat, i) => (
            <button
              key={i}
              className="bg-card rounded-xl shadow-card p-4 text-left hover:ring-2 hover:ring-primary/40 transition-all"
            >
              <p className="font-body font-semibold text-foreground text-sm leading-snug">{cat}</p>
            </button>
          ))}
        </div>
      </motion.section>

      {/* ── Sample Category: Wholesale Loose Products ── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <h2 className="font-display text-lg tracking-wide text-foreground mb-4">Wholesale Loose Products</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sampleProducts.map((product, i) => (
            <div key={i} className="bg-card rounded-2xl shadow-card overflow-hidden relative group">
              {/* Fav heart */}
              <button className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-card/80 backdrop-blur flex items-center justify-center hover:bg-card transition-colors">
                <Heart size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
              {/* Image */}
              <div className="w-full aspect-square overflow-hidden">
                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              </div>
              {/* Info */}
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

export default Catalogue;
