import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Heart, ShoppingCart, Minus, Plus, Loader2, ArrowLeft, Package } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useCart } from "@/hooks/useCart"; // Strictly using the DB Cart
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const getCartonSize = (cartonType: string | null) => {
  if (cartonType?.toLowerCase().includes("c")) return 9;
  if (cartonType?.toLowerCase().includes("b")) return 6;
  if (cartonType?.toLowerCase().includes("a")) return 4;
  return 4; // Default safe fallback
};

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [boxes, setBoxes] = useState(1); // Starting at 1 Box!
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
  const filledCartons = Math.floor(boxes / packsPerCarton);
  const neededToFill = remainder === 0 ? 0 : packsPerCarton - remainder;
  const progressPercentage = remainder === 0 ? 100 : (remainder / packsPerCarton) * 100;

  const adjustBoxes = (delta: number) => {
    setBoxes((prev) => Math.max(1, prev + delta));
  };

  const handleAddToCart = async () => {
    setIsAdding(true);
    const success = await addToCart(product.id, boxes, product.pack_size, product.carton_type);
    setIsAdding(false);
    if (success) navigate("/catalogue"); // <-- Change this to /catalogue!
  };

  return (
    <AppShell>
      <div className="max-w-md mx-auto bg-background min-h-screen pb-24 shadow-sm border-x border-border">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-border">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center bg-card rounded-full shadow-sm border border-border"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            onClick={() => setIsFav(!isFav)}
            className="w-10 h-10 flex items-center justify-center bg-card rounded-full shadow-sm border border-border"
          >
            <Heart size={20} className={isFav ? "text-primary fill-primary" : "text-muted-foreground"} />
          </button>
        </div>

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

        <div className="bg-[#B8860B] text-white px-6 py-4 flex flex-col items-center text-center">
          <h1 className="font-display text-2xl font-bold tracking-wide">{product.name}</h1>
          <p className="text-white/80 text-sm font-medium mt-1">Premium Retail Pack</p>
        </div>

        <div className="bg-white">
          <div className="grid grid-cols-2 border-b border-slate-100">
            <div className="p-3 text-sm font-medium text-slate-500 border-r border-slate-100">Wt Per Pc. (Avg.)</div>
            <div className="p-3 text-sm font-bold text-slate-800 text-center">22g</div>
          </div>
          <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50/50">
            <div className="p-3 text-sm font-medium text-slate-500 border-r border-slate-100">Storage temp</div>
            <div className="p-3 text-sm font-bold text-slate-800 text-center">{product.storage_type || "Ambient"}</div>
          </div>
          <div className="grid grid-cols-2 border-b border-slate-100">
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
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Order Packs</p>
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-full p-1.5 w-full max-w-[250px]">
                <button
                  onClick={() => adjustBoxes(-1)}
                  className="w-12 h-12 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:text-[#B8860B] active:scale-95 transition-all"
                >
                  <Minus size={20} />
                </button>
                <div className="flex-1 text-center">
                  <p className="text-2xl font-bold text-slate-900">{boxes}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Packs</p>
                </div>
                <button
                  onClick={() => adjustBoxes(1)}
                  className="w-12 h-12 rounded-full bg-[#B8860B] text-white shadow-md flex items-center justify-center hover:bg-[#9A7009] active:scale-95 transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            {/* GAMIFIED CARTON PROGRESS BAR */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Package size={14} /> {packsPerCarton} Packs = 1 Master Carton
                </p>
                {filledCartons > 0 && (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">
                    {filledCartons} Sealed
                  </span>
                )}
              </div>

              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  className={`h-full ${remainder === 0 ? "bg-emerald-500" : "bg-[#B8860B]"}`}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <p className="text-[11px] font-bold text-center text-slate-600">
                {remainder === 0
                  ? "✨ Master Carton Perfectly Filled!"
                  : `Add ${neededToFill} more packs to complete a Master Carton`}
              </p>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={isAdding}
              className="w-full py-4 rounded-2xl bg-slate-900 text-white font-bold text-base shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70"
            >
              {isAdding ? <Loader2 size={20} className="animate-spin" /> : <ShoppingCart size={20} />}
              Add to Batch
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default ProductDetail;
