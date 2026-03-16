import AppShell from "@/components/AppShell";
import { Heart, ShoppingCart, Loader2, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

import posterSpread from "@/assets/poster-spread.jpg";
import posterKunafa from "@/assets/poster-kunafa.jpg";
import posterSlice from "@/assets/poster-baklawa-slice.jpg";

const favorites = [
  { name: "Assorted Baklawa", price: "₹5,200 / kg", image: posterSpread },
  { name: "Stuffed Dates", price: "₹3,600 / kg", image: posterKunafa },
  { name: "Pistachio Baklawa", price: "₹4,500 / kg", image: posterSlice },
];

const mainCategories = [
  { name: "Wholesale Loose Products", image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80" },
  { name: "Raw / Unfinished Products", image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80" },
  { name: "Pre Packed Products", image: "https://images.unsplash.com/photo-1548848221-0c2e497ed557?w=600&q=80" },
  { name: "Gift Articles", image: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=600&q=80" },
  { name: "Packaging Supplies", image: "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&q=80" },
];

const subCategories = ["Baklawa", "Fusion Sweets", "Chocolates", "Dates", "Dragees & Nuts", "Cookies"];

const formatPrice = (price: number) =>
  `₹${price.toLocaleString("en-IN")}`;

const Catalogue = () => {
  const [activeSub, setActiveSub] = useState("Baklawa");
  const navigate = useNavigate();
  const { products, loading } = useProducts();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-8">
        {/* Header */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-display-h1 text-foreground"
        >
          Product Catalogue
        </motion.h1>

        {/* My Favorites */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <h2 className="text-display-h2 text-foreground mb-4 flex items-center gap-2">
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
                    <p className="text-ui-h5 text-foreground leading-tight">{item.name}</p>
                    <p className="text-fine text-muted-foreground mt-1">{item.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Main Categories */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <h2 className="text-display-h2 text-foreground mb-4">Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {mainCategories.map((cat, i) => (
              <button key={i} className="relative rounded-2xl overflow-hidden shadow-card aspect-[4/3] group">
                <img src={cat.image} alt={cat.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-3 py-2.5" style={{ background: "linear-gradient(to top, hsl(40 40% 59% / 0.85), transparent)" }}>
                  <p className="text-ui-h5 text-white text-left">{cat.name}</p>
                </div>
              </button>
            ))}
          </div>
        </motion.section>

        {/* Sub-Category Pills */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
            {subCategories.map((sub) => (
              <button
                key={sub}
                onClick={() => setActiveSub(sub)}
                className={`flex-shrink-0 px-5 py-2 rounded-full text-ui-button transition-all ${
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

        {/* Product Grid */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <h2 className="text-display-h2 text-foreground mb-4">Wholesale Loose Products</h2>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card rounded-2xl shadow-card overflow-hidden">
                  <Skeleton className="w-full aspect-square" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-9 w-full mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="text-body-p2 text-muted-foreground text-center py-8">No products found.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <div key={product.id} onClick={() => navigate(`/product/${product.id}`)} className="bg-card rounded-2xl shadow-card overflow-hidden relative group cursor-pointer">
                  <button className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-card/80 backdrop-blur flex items-center justify-center hover:bg-card transition-colors">
                    <Heart size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                  <div className="w-full aspect-square overflow-hidden bg-muted">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-fine">No Image</div>
                    )}
                  </div>
                  <div className="p-4 space-y-1.5">
                    <p className="text-ui-h5 text-foreground leading-tight">{product.name}</p>
                    {isAuthenticated ? (
                      <>
                        <p className="text-ui-kpi text-sm text-foreground">{formatPrice(product.price_per_kg)} <span className="text-fine text-muted-foreground">per kg</span></p>
                        <p className="text-fine text-muted-foreground">+ taxes extra</p>
                        {product.pack_size && (
                          <p className="text-fine text-muted-foreground">{product.pack_size}</p>
                        )}
                        {product.carton_type && (
                          <p className="text-fine-xs text-primary font-semibold">MOQ: 1 {product.carton_type}</p>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product.id, 1, product.pack_size, product.carton_type);
                          }}
                          className="mt-2 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-ui-button flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors"
                        >
                          <ShoppingCart size={14} />
                          Add to Cart
                        </button>
                      </>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <p className="text-fine text-muted-foreground flex items-center gap-1">
                          <Lock size={10} /> Trade Members Only
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate("/login"); }}
                          className="w-full py-2 rounded-xl bg-muted text-foreground text-ui-button hover:bg-muted/80 transition-colors"
                        >
                          Login / Apply
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </AppShell>
  );
};

export default Catalogue;
