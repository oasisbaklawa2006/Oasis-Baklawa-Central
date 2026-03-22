import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Heart, ShoppingCart, Minus, Plus, Loader2, ChevronLeft, Package } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts"; // <-- Pulled in to get suggestions
import { supabase } from "@/integrations/supabase/client";

const getCartonSize = (cartonType: string | null) => {
  if (cartonType?.toLowerCase().includes("c")) return 9;
  if (cartonType?.toLowerCase().includes("b")) return 6;
  if (cartonType?.toLowerCase().includes("a")) return 4;
  return 4;
};

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [boxes, setBoxes] = useState(1);
  const [isFav, setIsFav] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const { products } = useProducts(); // Fetching all products for the carousel

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setProduct(data);
        setLoading(false);
        window.scrollTo(0, 0); // Ensure page scrolls to top when navigating to a new product
      });
  }, [id]);

  if (loading)
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  if (!product)
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <p>Product not found</p>
        </div>
      </AppShell>
    );

  const packsPerCarton = getCartonSize(product.carton_type);
  const remainder = boxes % packsPerCarton;
  const neededToFill = remainder === 0 ? 0 : packsPerCarton - remainder;
  const progressPercentage = remainder === 0 ? 100 : (remainder / packsPerCarton) * 100;

  // Filter out the current product to show in the "You May Also Like" carousel
  const suggestedProducts = products.filter((p) => p.id !== product.id).slice(0, 6);

  const handleAddToCart = async () => {
    setIsAdding(true);
    const success = await addToCart(product.id, boxes, product.pack_size, product.carton_type);
    setIsAdding(false);
    if (success) navigate("/cart");
  };

  return (
    <AppShell>
      <div className="max-w-md mx-auto bg-background min-h-screen pb-24 shadow-sm border-x border-border">
        {/* GLOBAL BACK BUTTON */}
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-slate-100 shadow-sm">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-slate-700 font-bold text-sm hover:text-primary transition-colors"
          >
            <ChevronLeft size={20} /> Back
          </button>
          <button
            onClick={() => setIsFav(!isFav)}
            className="w-9 h-9 flex items-center justify-center bg-slate-50 rounded-full border border-slate-200"
          >
            <Heart size={18} className={isFav ? "text-rose-500 fill-rose-500" : "text-slate-400"} />
          </button>
        </div>

        {/* CLEAN HERO IMAGE */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full bg-slate-50 aspect-square flex items-center justify-center p-8"
        >
          <img
            src={product.image_url || "/placeholder.svg"}
            alt={product.name}
            className="w-full h-full object-contain drop-shadow-xl"
          />
        </motion.div>

        {/* The Golden Buy Box */}
        <div className="bg-[#B8860B] text-white px-6 py-5 flex flex-col items-center text-center">
          <h1 className="font-display text-2xl font-bold tracking-wide">{product.name}</h1>
          <div className="flex items-center gap-2 mt-2 bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <Package size={14} /> 1 Pack = {product.pack_size || "700g"}
          </div>
        </div>

        <div className="bg-white">
          <div className="grid grid-cols-2 border-b border-slate-100">
            <div className="p-3 text-sm font-medium text-slate-500 border-r border-slate-100">Wt Per Pc. (Avg.)</div>
            <div className="p-3 text-sm font-bold text-slate-800 text-center">22g</div>
          </div>
          <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50/50">
            <div className="p-3 text-sm font-medium text-slate-500 border-r border-slate-100">Shelf Life</div>
            <div className="p-3 text-sm font-bold text-slate-800 text-center">{product.shelf_life || "9 Months"}</div>
          </div>

          {isAuthenticated && (
            <div className="grid grid-cols-2 border-b border-slate-100">
              <div className="p-4 text-base font-bold text-slate-900 border-r border-slate-100 flex items-center">
                Price/kg
              </div>
              <div className="p-4 text-xl font-bold text-[#B8860B] bg-[#FFF8DC] text-center">
                ₹{product.price_per_kg?.toLocaleString("en-IN")}
              </div>
            </div>
          )}
        </div>

        {isAuthenticated && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Packs</p>
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-full p-1.5 w-full max-w-[250px]">
                <button
                  onClick={() => setBoxes((b) => Math.max(1, b - 1))}
                  className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xl active:scale-95"
                >
                  −
                </button>
                <div className="flex-1 text-center">
                  <p className="text-2xl font-bold text-slate-900">{boxes}</p>
                </div>
                <button
                  onClick={() => setBoxes((b) => b + 1)}
                  className="w-12 h-12 rounded-full bg-[#B8860B] text-white flex items-center justify-center font-bold text-xl active:scale-95"
                >
                  +
                </button>
              </div>
            </div>

            {/* Gamified Progress on Product Page */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 flex items-center justify-between">
                <span>{packsPerCarton} Packs = 1 Master Carton</span>
                <span className="text-[#B8860B]">
                  {remainder === 0 ? packsPerCarton : remainder} / {packsPerCarton}
                </span>
              </p>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  className={`h-full ${remainder === 0 ? "bg-emerald-500" : "bg-[#B8860B]"}`}
                />
              </div>
              <p className="text-[11px] font-bold text-center text-slate-600">
                {remainder === 0
                  ? "✨ Perfect! 1 Master Carton Filled."
                  : `Add ${neededToFill} more packs for secure carton shipping.`}
              </p>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={isAdding}
              className="w-full py-4 rounded-2xl bg-slate-900 text-white font-bold text-base shadow-xl flex items-center justify-center gap-2 active:scale-95"
            >
              {isAdding ? <Loader2 size={20} className="animate-spin" /> : <ShoppingCart size={20} />} Add to Batch
            </button>
          </div>
        )}

        {/* CROSS-SELL PRODUCT CAROUSEL */}
        {suggestedProducts.length > 0 && (
          <div className="pt-2 pb-8">
            <div className="px-6 mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">You may also like</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-6">
              {suggestedProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/product/${p.id}`)}
                  className="min-w-[140px] max-w-[140px] bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex-shrink-0 cursor-pointer hover:shadow-md transition-all"
                >
                  <div className="w-full h-[110px] bg-slate-50 p-2 flex items-center justify-center">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-contain" />
                    ) : (
                      <Package size={24} className="text-slate-300" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-slate-900 text-xs leading-tight line-clamp-2 mb-1">{p.name}</p>
                    {isAuthenticated && <p className="text-[10px] font-bold text-[#B8860B]">₹{p.price_per_kg}/kg</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default ProductDetail;
