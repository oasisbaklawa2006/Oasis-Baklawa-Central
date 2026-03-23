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

  // DYNAMIC TOTAL calculation for the stepper
  const currentTotal = boxes * mySlabPrice;

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAdding(true);
    const success = await addToCart(product.id, boxes, product.pack_size, product.carton_type);
    setIsAdding(false);
    if (success) {
      toast.success(`Added ${boxes} packs to your order!`, { icon: "📦" });
      setBoxes(1);
    }
  };

  return (
    <div
      onClick={() => navigate(`/product/${product.id}`)}
      className="bg-white rounded-2xl overflow-hidden relative group cursor-pointer transition-all duration-300 shadow-sm border border-slate-100 hover:shadow-md flex flex-col h-full"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="absolute top-2 right-2 w-7 h-7 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm text-slate-300 hover:text-rose-500 transition-colors z-10"
      >
        <Heart size={14} />
      </button>

      <div className="w-full aspect-square bg-slate-50/50 flex items-center justify-center p-4">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 mix-blend-multiply"
          />
        ) : (
          <div className="text-slate-300 font-medium text-xs">No Image</div>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1 bg-white">
        <h3 className="font-display text-[13px] font-bold text-slate-900 leading-tight mb-1 truncate group-hover:text-[#B8860B] transition-colors">
          {product.name}
        </h3>

        {isAuthenticated ? (
          <div className="flex flex-col flex-1">
            {/* Added back QTY per pack info */}
            <p className="text-[9px] text-slate-500 font-medium mb-1.5">{product.pack_size || "700g"} • Avg 22g/pc</p>

            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-[9px] text-slate-400 line-through leading-none mb-0.5">
                  {formatPrice(baseWholesalePrice)}
                </p>
                <p className="text-[13px] font-black text-slate-900 leading-none">
                  {formatPrice(mySlabPrice)} <span className="text-[8px] font-bold text-slate-500">/pack</span>
                </p>
              </div>
              <span className="text-[8px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-wider">
                -{clientDiscountRate * 100}% Slab
              </span>
            </div>

            <div className="mt-auto flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
              {/* Added Dynamic Total Bar */}
              <div className="flex justify-between items-center px-1.5 bg-slate-50 rounded py-1">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
                <span className="text-[10px] font-black text-[#B8860B]">{formatPrice(currentTotal)}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 flex-1 h-8">
                  <button
                    onClick={() => setBoxes((b) => Math.max(1, b - 1))}
                    className="w-7 h-full flex items-center justify-center text-slate-500 font-bold active:bg-slate-200 rounded-l-lg"
                  >
                    −
                  </button>
                  <span className="font-bold text-[11px] flex-1 text-center text-slate-900">{boxes}</span>
                  <button
                    onClick={() => setBoxes((b) => b + 1)}
                    className="w-7 h-full flex items-center justify-center text-slate-700 font-bold active:bg-slate-200 rounded-r-lg"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={handleAdd}
                  disabled={isAdding}
                  className="w-8 h-8 rounded-lg bg-[#B8860B] text-white flex items-center justify-center shadow-sm active:scale-95 hover:bg-[#9A7009] transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  {isAdding ? <Loader2 size={12} className="animate-spin" /> : <ShoppingCart size={12} />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-auto pt-2 flex flex-col justify-end flex-1">
            <p className="text-[9px] text-slate-500 flex items-center gap-1 mb-2 font-medium">
              <Lock size={8} /> Members Only
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate("/login");
              }}
              className="w-full py-2 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px] hover:bg-slate-200 transition-colors"
            >
              Login to View
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
      <div className="px-5 py-6 space-y-6 pb-32">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-display-h1 text-slate-900 font-bold"
        >
          Catalogue
        </motion.h1>

        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-3 flex items-center gap-1.5">
            <span className="text-[#B8860B]">⭐</span> Favorites
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {favorites.map((item, i) => (
                <div key={i} className="min-w-[130px] max-w-[130px] flex-shrink-0">
                  <div className="h-[90px] rounded-xl overflow-hidden mb-2">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="font-bold text-slate-900 text-xs leading-tight truncate">{item.name}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h2 className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-3">Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {mainCategories.map((cat, i) => (
              <button
                key={i}
                className="relative rounded-xl overflow-hidden shadow-sm border border-slate-100 aspect-[4/3] group"
              >
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5 text-left">
                  <p className="font-bold text-white text-[10px] leading-tight">{cat.name}</p>
                </div>
              </button>
            ))}
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {subCategories.map((sub) => (
              <button
                key={sub}
                onClick={() => setActiveSub(sub)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-[11px] font-bold transition-all shadow-sm ${activeSub === sub ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-100 hover:border-slate-300"}`}
              >
                {sub}
              </button>
            ))}
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <h2 className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-3">Wholesale Products</h2>
          {productsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden p-3">
                  <Skeleton className="w-full aspect-square rounded-xl" />
                  <div className="space-y-2 mt-3">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-8 w-full mt-3 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="text-sm font-medium text-slate-500 text-center py-10">No products found.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 items-stretch">
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
            <div className="bg-slate-900 rounded-[1.25rem] shadow-2xl p-3.5 flex items-center justify-between border border-white/10">
              <div className="flex flex-col">
                <p className="text-white/60 text-[9px] font-bold uppercase tracking-widest mb-0.5">Your Order</p>
                <div className="flex items-center gap-2">
                  <span className="bg-[#B8860B] text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm">
                    {cartTotalPacks} Packs
                  </span>
                  <p className="text-white font-black text-base leading-none">{formatPrice(cartGrandTotal)}</p>
                </div>
              </div>
              <button
                onClick={() => navigate("/cart")}
                className="bg-white text-slate-900 px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-slate-100 active:scale-95 transition-all shadow-lg shadow-white/10"
              >
                Review <ChevronRight size={14} className="-ml-0.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
};

export default Catalogue;
