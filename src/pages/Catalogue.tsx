import AppShell from "@/components/AppShell";
import { Heart, ShoppingCart, Loader2, Lock, Package, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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
  {
    name: "Raw / Unfinished Products",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80",
  },
  { name: "Pre Packed Products", image: "https://images.unsplash.com/photo-1548848221-0c2e497ed557?w=600&q=80" },
  { name: "Gift Articles", image: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=600&q=80" },
  { name: "Packaging Supplies", image: "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&q=80" },
];

const subCategories = ["Baklawa", "Fusion Sweets", "Chocolates", "Dates", "Dragees & Nuts", "Cookies"];

const formatPrice = (price: number) => `₹${Math.round(price).toLocaleString("en-IN")}`;

const getCartonSize = (cartonType: string | null) => {
  if (cartonType?.toLowerCase().includes("c")) return 9;
  if (cartonType?.toLowerCase().includes("b")) return 6;
  if (cartonType?.toLowerCase().includes("a")) return 4;
  return 4;
};

const ProductCard = ({ product }: { product: any }) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [boxes, setBoxes] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  const packsPerCarton = getCartonSize(product.carton_type);
  const baseWholesalePrice = product.price_per_kg || 0;
  const clientDiscountRate = 0.15;
  const mySlabPrice = baseWholesalePrice * (1 - clientDiscountRate);

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAdding(true);
    const success = await addToCart(product.id, boxes, product.pack_size, product.carton_type);
    setIsAdding(false);
    if (success) {
      toast.success(`Added ${boxes} packs of ${product.name}!`, { icon: "📦" });
      setBoxes(1);
    }
  };

  return (
    <div
      onClick={() => navigate(`/product/${product.id}`)}
      className="bg-card rounded-2xl overflow-hidden relative group cursor-pointer transition-all duration-300 shadow-card border border-transparent hover:shadow-md hover:border-slate-200 flex flex-col h-full"
    >
      <button className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-card/80 backdrop-blur flex items-center justify-center hover:bg-card transition-colors shadow-sm">
        <Heart size={16} className="text-muted-foreground group-hover:text-rose-500 transition-colors" />
      </button>
      <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 shadow-sm">
        <Package size={12} /> {packsPerCarton}/Carton
      </div>
      <div className="w-full aspect-square overflow-hidden bg-muted p-4 flex items-center justify-center">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 drop-shadow-md"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-fine">No Image</div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <p className="text-ui-h5 text-foreground leading-tight group-hover:text-[#B8860B] transition-colors line-clamp-2">
          {product.name}
        </p>
        {isAuthenticated ? (
          <div className="mt-2 space-y-1 flex-1">
            <p className="text-fine text-muted-foreground">{product.pack_size || "700g"} • Avg 22g/pc</p>
            <div className="pt-1 flex items-end gap-2">
              <p className="text-lg font-black text-[#B8860B] leading-none">{formatPrice(mySlabPrice)}</p>
              <p className="text-[10px] text-slate-400 line-through leading-none mb-0.5">
                {formatPrice(baseWholesalePrice)}
              </p>
            </div>
            <div className="pt-3 mt-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-200 h-10 flex-1">
                  <button
                    onClick={() => setBoxes((b) => Math.max(1, b - 1))}
                    className="w-8 h-full rounded-lg bg-white shadow-sm font-bold text-slate-700 active:scale-95"
                  >
                    −
                  </button>
                  <span className="font-bold text-sm flex-1 text-center text-slate-900">{boxes}</span>
                  <button
                    onClick={() => setBoxes((b) => b + 1)}
                    className="w-8 h-full rounded-lg bg-slate-900 text-white shadow-sm font-bold active:scale-95"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={handleAdd}
                  disabled={isAdding}
                  className="w-10 h-10 rounded-xl bg-[#B8860B] text-white flex items-center justify-center shadow-md active:scale-95 hover:bg-[#9A7009] transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  {isAdding ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-2 flex-1 flex flex-col justify-end">
            <p className="text-fine text-muted-foreground flex items-center gap-1">
              <Lock size={10} /> Trade Members Only
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate("/login");
              }}
              className="w-full py-2 rounded-xl bg-muted text-foreground text-ui-button hover:bg-muted/80 transition-colors"
            >
              Login / Apply
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Catalogue = () => {
  const [activeSub, setActiveSub] = useState("Baklawa");
  const navigate = useNavigate();
  const { products, loading: productsLoading } = useProducts();
  const { items, loading: cartLoading } = useCart();
  const { isAuthenticated } = useAuth();

  const cartSubtotal = items.reduce((sum, item) => sum + item.quantity * (item.product?.price_per_kg || 0), 0);
  const cartTax = Math.round(cartSubtotal * 0.05);
  const cartGrandTotal = cartSubtotal + cartTax;
  const cartTotalPacks = items.reduce((s, it) => s + it.quantity, 0);

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-8 pb-32">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-display-h1 text-foreground"
        >
          Product Catalogue
        </motion.h1>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="text-display-h2 text-foreground mb-4 flex items-center gap-2">
            <span className="text-primary">⭐</span> My Favorites
          </h2>
          <div className="bg-card rounded-2xl shadow-card p-5">
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
              {favorites.map((item, i) => (
                <div
                  key={i}
                  className="min-w-[170px] max-w-[170px] flex-shrink-0 rounded-xl overflow-hidden border border-border/40"
                >
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

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-display-h2 text-foreground mb-4">Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {mainCategories.map((cat, i) => (
              <button key={i} className="relative rounded-2xl overflow-hidden shadow-card aspect-[4/3] group">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div
                  className="absolute bottom-0 left-0 right-0 px-3 py-2.5"
                  style={{ background: "linear-gradient(to top, hsl(40 40% 59% / 0.85), transparent)" }}
                >
                  <p className="text-ui-h5 text-white text-left">{cat.name}</p>
                </div>
              </button>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
            {subCategories.map((sub) => (
              <button
                key={sub}
                onClick={() => setActiveSub(sub)}
                className={`flex-shrink-0 px-5 py-2 rounded-full text-ui-button transition-all ${activeSub === sub ? "bg-primary text-primary-foreground shadow-fab" : "bg-card text-foreground shadow-card hover:shadow-fab"}`}
              >
                {sub}
              </button>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2 className="text-display-h2 text-foreground mb-4">Wholesale Loose Products</h2>
          {productsLoading ? (
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-stretch">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </motion.section>
      </div>

      <AnimatePresence>
        {items.length > 0 && !cartLoading && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-[80px] md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-[350px] z-40"
          >
            <div className="bg-slate-900 rounded-[1.5rem] shadow-2xl p-4 flex items-center justify-between border border-white/10">
              <div className="flex flex-col">
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-0.5">Your Order</p>
                <div className="flex items-center gap-2">
                  <span className="bg-[#B8860B] text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {cartTotalPacks} Packs
                  </span>
                  <p className="text-white font-black text-lg">{formatPrice(cartGrandTotal)}</p>
                </div>
              </div>
              <button
                onClick={() => navigate("/cart")}
                className="bg-white text-slate-900 px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-100 active:scale-95 transition-all shadow-lg shadow-white/10"
              >
                Review <ChevronRight size={16} className="-ml-1" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
};

export default Catalogue;
