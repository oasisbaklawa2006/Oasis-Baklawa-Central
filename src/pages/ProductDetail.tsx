import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Heart, ShoppingCart, Minus, Plus, Loader2, ChevronLeft, Package } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
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

  useEffect(() => {
    if (!id) return;
    supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setProduct(data);
        setLoading(false);
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

  // Mocking multiple images for the carousel effect
  const images = [product.image_url, product.image_url, product.image_url].filter(Boolean);

  const handleAddToCart = async () => {
    setIsAdding(true);
    const success = await addToCart(product.id, boxes, product.pack_size, product.carton_type);
    setIsAdding(false);
    if (success) navigate("/cart");
  };

  return (
    <AppShell>
      <div className="max-w-md mx-auto bg-background min-h-screen pb-24 shadow-sm border-x border-border">
        {/* GLOBAL BACK BUTTON & NAV */}
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

        {/* SWIPEABLE IMAGE CAROUSEL (Half-next peek effect) */}
        <div className="w-full bg-slate-50 pt-6 pb-8 overflow-hidden">
          <div
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 gap-4"
            style={{ paddingRight: "20%" }}
          >
            {images.map((img, idx) => (
              <div
                key={idx}
                className="w-[85%] flex-shrink-0 snap-center bg-white rounded-2xl shadow-sm p-4 aspect-square flex items-center justify-center border border-slate-100"
              >
                <img src={img} alt={product.name} className="w-full h-full object-contain drop-shadow-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* The Golden Buy Box (Now with Pack Weight) */}
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
      </div>
    </AppShell>
  );
};

export default ProductDetail;
