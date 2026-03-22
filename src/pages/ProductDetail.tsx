import AppShell from "@/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import {
  Heart,
  ShoppingCart,
  Minus,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Package,
  Maximize2,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts"; // Needed for Next/Prev & Related
import { supabase } from "@/integrations/supabase/client";

const formatPrice = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const getCartonSize = (cartonType: string | null) => {
  if (cartonType?.toLowerCase().includes("c")) return 9;
  if (cartonType?.toLowerCase().includes("b")) return 6;
  if (cartonType?.toLowerCase().includes("a")) return 4;
  return 4;
};

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const { products } = useProducts();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [boxes, setBoxes] = useState(1);
  const [isFav, setIsFav] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Image Viewer State
  const [activeImage, setActiveImage] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    window.scrollTo(0, 0); // Reset scroll on product change
    setLoading(true);
    setBoxes(1); // Reset qty

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

  // Product Navigation & Related Products Logic
  const currentIndex = products.findIndex((p) => p.id === id);
  const prevProduct = currentIndex > 0 ? products[currentIndex - 1] : null;
  const nextProduct = currentIndex < products.length - 1 ? products[currentIndex + 1] : null;

  const relatedProducts = useMemo(() => {
    return products.filter((p) => p.id !== id && p.carton_type === product?.carton_type).slice(0, 4);
  }, [products, id, product]);

  if (loading)
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-[#B8860B]" />
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

  // Math & Logistics
  const packsPerCarton = getCartonSize(product.carton_type);
  const remainder = boxes % packsPerCarton;
  const neededToFill = remainder === 0 ? 0 : packsPerCarton - remainder;
  const progressPercentage = remainder === 0 ? 100 : (remainder / packsPerCarton) * 100;
  const currentCartons = Math.ceil(boxes / packsPerCarton);

  // MOCKING MULTIPLE IMAGES (Since DB only has one for now)
  const images = [product.image_url, product.image_url, product.image_url].filter(Boolean);

  // B2B PRICE SLAB LOGIC (Dynamic Discounts)
  const basePrice = product.price_per_kg || 0;
  let activeDiscount = 0;
  if (currentCartons >= 10)
    activeDiscount = 0.05; // 5% off for 10+ Cartons
  else if (currentCartons >= 5) activeDiscount = 0.03; // 3% off for 5-9 Cartons

  const discountedPricePerKg = basePrice * (1 - activeDiscount);
  const currentTotal = boxes * discountedPricePerKg;

  const handleAddToCart = async () => {
    setIsAdding(true);
    const success = await addToCart(product.id, boxes, product.pack_size, product.carton_type);
    setIsAdding(false);
    if (success) navigate("/cart");
  };

  return (
    <AppShell>
      <div className="max-w-md mx-auto bg-slate-50 min-h-screen pb-24 shadow-sm border-x border-slate-200">
        {/* GLOBAL BACK BUTTON & NAV */}
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-slate-100 shadow-sm">
          <button
            onClick={() => navigate("/catalogue")}
            className="flex items-center gap-1 text-slate-700 font-bold text-sm hover:text-[#B8860B] transition-colors"
          >
            <ChevronLeft size={20} /> Catalogue
          </button>
          <button
            onClick={() => setIsFav(!isFav)}
            className="w-9 h-9 flex items-center justify-center bg-slate-50 rounded-full border border-slate-200"
          >
            <Heart size={18} className={isFav ? "text-rose-500 fill-rose-500" : "text-slate-400"} />
          </button>
        </div>

        {/* IMAGE VIEWER WITH PAGINATION & MODAL */}
        <div className="w-full bg-white relative aspect-square group">
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={() => setShowImageModal(true)}
              className="w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm text-slate-600 hover:text-[#B8860B]"
            >
              <Maximize2 size={18} />
            </button>
          </div>

          <img
            src={images[activeImage] || "/placeholder.svg"}
            alt={product.name}
            onClick={() => setShowImageModal(true)}
            className="w-full h-full object-contain p-8 cursor-pointer drop-shadow-xl"
          />

          {/* Image Pagination Dots */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(idx)}
                  className={`h-2 rounded-full transition-all ${activeImage === idx ? "w-6 bg-[#B8860B]" : "w-2 bg-slate-300"}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* NEXT / PREV PRODUCT BAR */}
        <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => prevProduct && navigate(`/product/${prevProduct.id}`)}
            disabled={!prevProduct}
            className="flex items-center gap-1 hover:text-[#B8860B] disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={16} /> Prev Product
          </button>
          <span className="text-slate-500">|</span>
          <button
            onClick={() => nextProduct && navigate(`/product/${nextProduct.id}`)}
            disabled={!nextProduct}
            className="flex items-center gap-1 hover:text-[#B8860B] disabled:opacity-30 transition-colors"
          >
            Next Product <ChevronRight size={16} />
          </button>
        </div>

        {/* The Golden Buy Box */}
        <div className="bg-[#B8860B] text-white px-6 py-5 flex flex-col items-center text-center">
          <h1 className="font-display text-2xl font-bold tracking-wide">{product.name}</h1>
          <div className="flex items-center gap-2 mt-2 bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <Package size={14} /> 1 Pack = {product.pack_size || "700g"}
          </div>
        </div>

        {/* VOLUME PRICE SLABS (Intelligent Upselling) */}
        {isAuthenticated && (
          <div className="bg-white p-5 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex justify-between">
              <span>Volume Pricing Slabs</span>
              {activeDiscount > 0 && <span className="text-emerald-500">Active: {activeDiscount * 100}% Off</span>}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div
                className={`p-2 rounded-xl border text-center transition-colors ${currentCartons < 5 ? "border-[#B8860B] bg-[#FFF8DC]" : "border-slate-100 bg-slate-50"}`}
              >
                <p className="text-[10px] font-bold text-slate-500 uppercase">1-4 Cartons</p>
                <p className={`font-black text-sm ${currentCartons < 5 ? "text-[#B8860B]" : "text-slate-800"}`}>
                  {formatPrice(basePrice)}
                  <span className="text-[10px] font-normal">/kg</span>
                </p>
              </div>
              <div
                className={`p-2 rounded-xl border text-center transition-colors ${currentCartons >= 5 && currentCartons < 10 ? "border-[#B8860B] bg-[#FFF8DC]" : "border-slate-100 bg-slate-50"}`}
              >
                <p className="text-[10px] font-bold text-slate-500 uppercase">5-9 Cartons</p>
                <p
                  className={`font-black text-sm ${currentCartons >= 5 && currentCartons < 10 ? "text-[#B8860B]" : "text-slate-800"}`}
                >
                  {formatPrice(basePrice * 0.97)}
                  <span className="text-[10px] font-normal">/kg</span>
                </p>
              </div>
              <div
                className={`p-2 rounded-xl border text-center transition-colors ${currentCartons >= 10 ? "border-[#B8860B] bg-[#FFF8DC]" : "border-slate-100 bg-slate-50"}`}
              >
                <p className="text-[10px] font-bold text-slate-500 uppercase">10+ Cartons</p>
                <p className={`font-black text-sm ${currentCartons >= 10 ? "text-[#B8860B]" : "text-slate-800"}`}>
                  {formatPrice(basePrice * 0.95)}
                  <span className="text-[10px] font-normal">/kg</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white mb-2">
          <div className="grid grid-cols-2 border-b border-slate-100">
            <div className="p-3 text-sm font-medium text-slate-500 border-r border-slate-100">Wt Per Pc. (Avg.)</div>
            <div className="p-3 text-sm font-bold text-slate-800 text-center">22g</div>
          </div>
          <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50/50">
            <div className="p-3 text-sm font-medium text-slate-500 border-r border-slate-100">Shelf Life</div>
            <div className="p-3 text-sm font-bold text-slate-800 text-center">{product.shelf_life || "9 Months"}</div>
          </div>
        </div>

        {/* THE ORDER ENGINE */}
        {isAuthenticated && (
          <div className="p-6 bg-white space-y-6 shadow-sm border-y border-slate-100">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-between w-full px-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Packs</p>
                <div className="text-right">
                  <p className="text-lg font-black text-[#B8860B]">{formatPrice(currentTotal)}</p>
                  {activeDiscount > 0 && (
                    <p className="text-[10px] text-emerald-600 font-bold">
                      Includes {activeDiscount * 100}% Volume Discount
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-full p-1.5 w-full">
                <button
                  onClick={() => setBoxes((b) => Math.max(1, b - 1))}
                  className="w-14 h-14 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-2xl active:scale-95"
                >
                  −
                </button>
                <div className="flex-1 text-center">
                  <p className="text-3xl font-black text-slate-900">{boxes}</p>
                </div>
                <button
                  onClick={() => setBoxes((b) => b + 1)}
                  className="w-14 h-14 rounded-full bg-[#B8860B] text-white flex items-center justify-center font-bold text-2xl shadow-md active:scale-95"
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
                  ? "✨ Perfect! Master Carton Filled."
                  : `Add ${neededToFill} more packs for secure carton shipping.`}
              </p>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={isAdding}
              className="w-full py-4 rounded-2xl bg-slate-900 text-white font-bold text-base shadow-xl flex items-center justify-center gap-2 active:scale-95"
            >
              {isAdding ? <Loader2 size={20} className="animate-spin" /> : <ShoppingCart size={20} />} Add to Order
            </button>
          </div>
        )}

        {/* YOU MAY ALSO LIKE (Cross-Selling) */}
        {relatedProducts.length > 0 && (
          <div className="pt-8 pb-4">
            <h3 className="px-5 text-lg font-display font-bold text-slate-900 mb-4">You May Also Like</h3>
            <div className="flex overflow-x-auto gap-4 px-5 pb-4 scrollbar-hide">
              {relatedProducts.map((rp) => (
                <div
                  key={rp.id}
                  onClick={() => navigate(`/product/${rp.id}`)}
                  className="min-w-[140px] max-w-[140px] bg-white rounded-2xl border border-slate-200 p-3 shadow-sm flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="w-full aspect-square bg-slate-50 rounded-xl mb-3 p-2 flex items-center justify-center">
                    {rp.image_url ? (
                      <img src={rp.image_url} alt={rp.name} className="w-full h-full object-contain" />
                    ) : (
                      <Package size={24} className="text-slate-300" />
                    )}
                  </div>
                  <p className="font-bold text-slate-800 text-xs leading-tight line-clamp-2">{rp.name}</p>
                  {isAuthenticated && (
                    <p className="text-[10px] font-bold text-[#B8860B] mt-1">{formatPrice(rp.price_per_kg || 0)} /kg</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FULL SCREEN IMAGE MODAL */}
      <AnimatePresence>
        {showImageModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
          >
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-6 right-6 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <X size={24} />
            </button>
            <img src={images[activeImage]} alt="Zoomed" className="w-full max-w-lg object-contain max-h-[80vh]" />
            <p className="absolute bottom-10 text-white/50 text-sm tracking-widest font-bold uppercase">
              {product.name}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
};

export default ProductDetail;
