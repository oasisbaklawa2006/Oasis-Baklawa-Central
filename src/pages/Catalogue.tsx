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

// THE UPGRADED LUXURY PRODUCT CARD
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
      toast.success(`Added ${boxes} packs to your order!`, { icon: "📦" });
      setBoxes(1);
    }
  };

  return (
    <div
      onClick={() => navigate(`/product/${product.id}`)}
      className="bg-white rounded-3xl overflow-hidden relative group cursor-pointer transition-all duration-300 shadow-sm border border-slate-100 hover:shadow-xl hover:border-slate-200 flex flex-col h-full"
    >
      {/* Floating Badges */}
      <div className="absolute top-3 left-3 right-3 z-10 flex justify-between items-start">
        <div className="bg-white/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1 shadow-sm border border-white/50">
          <Package size={10} className="text-[#B8860B]" /> {packsPerCarton} / Ctn
        </div>
        <button className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center shadow-sm border border-white/50 text-slate-400 hover:text-rose-500 transition-colors">
          <Heart size={14} />
        </button>
      </div>

      {/* Premium Image Area */}
      <div className="w-full aspect-square bg-gradient-to-b from-slate-50/50 to-white pt-10 pb-4 px-6 flex items-center justify-center">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700 drop-shadow-xl"
          />
        ) : (
          <div className="text-slate-300 font-medium text-xs">No Image</div>
        )}
      </div>

      {/* Details & Action Area */}
      <div className="p-4 flex flex-col flex-1 bg-white">
        <p className="font-display font-bold text-slate-900 text-sm leading-tight group-hover:text-[#B8860B] transition-colors line-clamp-2">
          {product.name}
        </p>

        {isAuthenticated ? (
          <div className="mt-1 flex flex-col flex-1">
            <p className="text-[10px] text-slate-500 font-medium">{product.pack_size || "700g"} • Wt 22g/pc</p>

            <div className="mt-2 flex justify-between items-end">
              <div>
                <p className="text-[10px] text-slate-400 line-through leading-none mb-0.5">
                  {formatPrice(baseWholesalePrice)}
                </p>
                <p className="text-lg font-black text-slate-900 leading-none">{formatPrice(mySlabPrice)}</p>
              </div>
            </div>

            {/* The Sleek Unified Action Row */}
            <div className="mt-auto pt-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100/70 rounded-full p-1 h-10 w-[90px]">
                  <button
                    onClick={() => setBoxes((b) => Math.max(1, b - 1))}
                    className="w-7 h-full rounded-full hover:bg-white hover:shadow-sm font-medium text-slate-600 transition-all"
                  >
                    −
                  </button>
                  <span className="font-bold text-xs flex-1 text-center text-slate-900">{boxes}</span>
                  <button
                    onClick={() => setBoxes((b) => b + 1)}
                    className="w-7 h-full rounded-full bg-white shadow-sm font-bold text-slate-900 active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={handleAdd}
                  disabled={isAdding}
                  className="flex-1 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center gap-1.5 shadow-md active:scale-95 hover:bg-[#B8860B] transition-colors disabled:opacity-50"
                >
                  {isAdding ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                  <span className="text-xs font-bold">Add</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-auto pt-4">
            <p className="text-[10px] text-slate-500 flex items-center gap-1 mb-2 font-medium">
              <Lock size={10} /> Members Only
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate("/login");
              }}
              className="w-full py-2.5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors"
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
      <div className="px-5 py-6 space-y-8 pb-32">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-display-h1 text-slate-900 font-bold"
        >
          Catalogue
        </motion.h1>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="text-sm uppercase tracking-widest font-bold text-slate-400 mb-4 flex items-center gap-2">
            <span className="text-[#B8860B]">⭐</span> My Favorites
          </h2>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-4">
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {favorites.map((item, i) => (
                <div key={i} className="min-w-[150px] max-w-[150px] flex-shrink-0">
                  <div className="h-[120px] rounded-2xl overflow-hidden mb-3">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="font-bold text-slate-900 text-sm leading-tight">{item.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{item.price}</p>
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
          <h2 className="text-sm uppercase tracking-widest font-bold text-slate-400 mb-4">Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {mainCategories.map((cat, i) => (
              <button
                key={i}
                className="relative rounded-2xl overflow-hidden shadow-sm border border-slate-100 aspect-[4/3] group"
              >
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
                  <p className="font-bold text-white text-xs leading-tight">{cat.name}</p>
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
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {subCategories.map((sub) => (
              <button
                key={sub}
                onClick={() => setActiveSub(sub)}
                className={`flex-shrink-0 px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm ${activeSub === sub ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-100 hover:border-slate-300"}`}
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
          <h2 className="text-sm uppercase tracking-widest font-bold text-slate-400 mb-4">Wholesale Products</h2>
          {productsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden p-4">
                  <Skeleton className="w-full aspect-square rounded-2xl" />
                  <div className="space-y-2 mt-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-10 w-full mt-4 rounded-full" />
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
